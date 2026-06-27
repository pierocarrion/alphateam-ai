import { db } from "@/server/lib/db";
import {
  message as messageTable,
  task as taskTable,
  membership as membershipTable,
  user as userTable,
  channel,
} from "@drizzle/schema";
import { eq, and, gte, desc, count, inArray } from "drizzle-orm";
import { createLogger } from "@/shared/lib/logger";
import {
  classifyMessage,
  detectImplicitLeaderMention,
  generateLeaderBriefing,
  isGeminiEnabled,
  predictTaskDelay,
  recommendAssignee,
  scoreProjectRisk,
  shouldUseFallback,
} from "./gemini";
import { computeLoadBalance } from "./metrics";

const log = createLogger("leaderBriefing");

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LeaderKpi {
  openTasks: number;
  overdueTasks: number;
  completedThisWeek: number;
  activeBlockers: number;
  overloadedMembers: number;
  pendingDecisions: number;
  mentionsLeader: number;
}

export interface LeaderBriefingResult {
  headline: string;
  bullets: string[];
  needsAttention: string[];
  kpi: LeaderKpi;
  risk: { riskScore: number; level: string; reasons: string[] };
  blockers: BlockerItem[];
  decisions: DecisionItem[];
  mentions: MentionItem[];
  eisenhower: EisenhowerCounts;
  generatedAt: Date;
  usedAi: boolean;
}

export interface BlockerItem {
  id: string;
  text: string;
  author: string;
  severity: "low" | "medium" | "high";
  createdAt: Date;
}

export interface DecisionItem {
  id: string;
  text: string;
  author: string;
  createdAt: Date;
}

export interface MentionItem {
  id: string;
  text: string;
  author: string;
  implicit: boolean;
  createdAt: Date;
}

export interface EisenhowerCounts {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  unsorted: number;
}

const BLOCKER_PATTERNS = [
  /i'?m blocked/i,
  /\bblocked\b/i,
  /no access/i,
  /don'?t have access/i,
  /waiting (on |for )?(approval|review|sign[- ]?off)/i,
  /can'?t continue/i,
  /cannot continue/i,
  /stuck (on|with)/i,
  /need (an? )?approval/i,
  /falta aprobaci[oó]n/i,
  /no tengo acceso/i,
  /estoy bloqueado/i,
];

const DECISION_PATTERNS = [
  /need (your |an )?approval/i,
  /need (you |a )?decision/i,
  /should we/i,
  /can (we|i) (ship|deploy|launch|proceed)/i,
  /waiting (on |for )?(you|sign[- ]?off|go[- ]?ahead)/i,
  /necesitamos aprobaci[oó]n/i,
];

const MENTION_PATTERNS = [
  /@leader/i,
  /@admin/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function severityFor(text: string): "low" | "medium" | "high" {
  const t = text.toLowerCase();
  if (/(production|prod|down|outage|critical|severe|cannot|can'?t)/.test(t)) return "high";
  if (/(stuck|waiting|blocked|access)/.test(t)) return "medium";
  return "low";
}

async function fetchMemberUserIds(workspaceId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: membershipTable.userId })
    .from(membershipTable)
    .where(eq(membershipTable.workspaceId, workspaceId));
  return rows.map((r) => r.userId);
}

export async function gatherLeaderSignals(
  workspaceId: string,
  leaderId: string,
  sinceHours = 24
) {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  const memberIds = await fetchMemberUserIds(workspaceId);

  const [messageRows, taskRows, load, completedThisWeekRows] = await Promise.all([
    db
      .select({
        id: messageTable.id,
        content: messageTable.content,
        createdAt: messageTable.createdAt,
        userId: messageTable.userId,
        userName: userTable.name,
      })
      .from(messageTable)
      .innerJoin(channel, eq(channel.id, messageTable.channelId))
      .leftJoin(userTable, eq(userTable.id, messageTable.userId))
      .where(
        and(
          eq(channel.workspaceId, workspaceId),
          gte(messageTable.createdAt, since)
        )
      )
      .orderBy(desc(messageTable.createdAt))
      .limit(200),
    memberIds.length > 0
      ? db
          .select({
            id: taskTable.id,
            title: taskTable.title,
            userId: taskTable.userId,
            status: taskTable.status,
            quadrant: taskTable.quadrant,
            deadline: taskTable.deadline,
            createdAt: taskTable.createdAt,
            userName: userTable.name,
          })
          .from(taskTable)
          .leftJoin(userTable, eq(userTable.id, taskTable.userId))
          .where(
            and(
              eq(taskTable.status, "open"),
              inArray(taskTable.userId, memberIds)
            )
          )
          .orderBy(desc(taskTable.createdAt))
      : Promise.resolve([]),
    computeLoadBalance(workspaceId),
    memberIds.length > 0
      ? db
          .select({ c: count() })
          .from(taskTable)
          .where(
            and(
              eq(taskTable.status, "done"),
              gte(taskTable.completedAt, new Date(Date.now() - 7 * DAY_MS)),
              inArray(taskTable.userId, memberIds)
            )
          )
          .then((rows) => Number(rows[0]?.c ?? 0))
      : Promise.resolve(0),
  ]);

  const messages = messageRows.map((m) => ({
    id: m.id,
    content: m.content,
    createdAt: m.createdAt,
    userId: m.userId,
    user: { id: m.userId, name: m.userName ?? "Someone" },
  }));

  const tasks = taskRows.map((t) => ({
    id: t.id,
    title: t.title,
    userId: t.userId,
    status: t.status,
    quadrant: t.quadrant,
    deadline: t.deadline,
    createdAt: t.createdAt,
    user: { id: t.userId, name: t.userName ?? "Someone" },
  }));

  const completedThisWeek = completedThisWeekRows;

  const now = Date.now();
  const blockers: BlockerItem[] = [];
  const decisions: DecisionItem[] = [];
  const mentions: MentionItem[] = [];

  for (const m of messages) {
    const text = m.content;
    const author = m.user.name ?? "Someone";
    if (matchesAny(text, MENTION_PATTERNS) || m.content.includes(`@${leaderId}`)) {
      mentions.push({
        id: m.id,
        text,
        author,
        implicit: false,
        createdAt: m.createdAt,
      });
    }
    if (matchesAny(text, BLOCKER_PATTERNS)) {
      blockers.push({
        id: m.id,
        text,
        author,
        severity: severityFor(text),
        createdAt: m.createdAt,
      });
    }
    if (matchesAny(text, DECISION_PATTERNS)) {
      decisions.push({
        id: m.id,
        text,
        author,
        createdAt: m.createdAt,
      });
    }
  }

  const overdueTasks = tasks.filter(
    (t) => t.deadline && new Date(t.deadline).getTime() < now
  ).length;

  const eisenhower: EisenhowerCounts = { q1: 0, q2: 0, q3: 0, q4: 0, unsorted: 0 };
  for (const t of tasks) {
    const q = t.quadrant;
    if (q === "q1") eisenhower.q1 += 1;
    else if (q === "q2") eisenhower.q2 += 1;
    else if (q === "q3") eisenhower.q3 += 1;
    else if (q === "q4") eisenhower.q4 += 1;
    else eisenhower.unsorted += 1;
  }

  const overloadedMembers = load.counts.filter((c) => c.openCount >= 4).length;

  const kpi: LeaderKpi = {
    openTasks: tasks.length,
    overdueTasks,
    completedThisWeek,
    activeBlockers: blockers.length,
    overloadedMembers,
    pendingDecisions: decisions.length,
    mentionsLeader: mentions.length,
  };

  const newTasksSince = tasks.filter((t) => t.createdAt >= since).length;
  const signals: string[] = [];
  if (newTasksSince > 0) signals.push(`${newTasksSince} new task(s) in the last ${sinceHours}h`);
  if (overdueTasks > 0) signals.push(`${overdueTasks} overdue task(s)`);
  if (blockers.length > 0) signals.push(`${blockers.length} active blocker(s)`);
  if (overloadedMembers > 0) signals.push(`${overloadedMembers} overloaded member(s)`);
  if (decisions.length > 0) signals.push(`${decisions.length} pending decision(s)`);

  const events = [
    ...blockers.map((b) => ({ kind: "blocker", detail: `${b.author}: ${b.text}` })),
    ...decisions.map((d) => ({ kind: "decision", detail: `${d.author}: ${d.text}` })),
    ...mentions.map((mm) => ({ kind: "mention", detail: `${mm.author}: ${mm.text}` })),
  ];

  return {
    since,
    messages,
    tasks,
    blockers,
    decisions,
    mentions,
    overdueTasks,
    eisenhower,
    overloadedMembers,
    kpi,
    signals,
    events,
    completedThisWeek,
  };
}

export async function buildLeaderBriefing(opts: {
  workspaceId: string;
  leaderId: string;
  leaderName: string;
  sinceHours?: number;
}): Promise<LeaderBriefingResult> {
  const sinceHours = opts.sinceHours ?? 24;
  const data = await gatherLeaderSignals(
    opts.workspaceId,
    opts.leaderId,
    sinceHours
  );

  let headline = `Here's a calm look at the last ${sinceHours} hours.`;
  let bullets: string[] = [];
  let needsAttention: string[] = [];

  if (data.kpi.activeBlockers > 0)
    needsAttention.push(`${data.kpi.activeBlockers} blocker(s) need a nudge.`);
  if (data.kpi.pendingDecisions > 0)
    needsAttention.push(`${data.kpi.pendingDecisions} decision(s) are waiting on you.`);
  if (data.kpi.overdueTasks > 0)
    needsAttention.push(`${data.kpi.overdueTasks} task(s) are overdue.`);

  bullets = [
    data.kpi.openTasks > 0 ? `${data.kpi.openTasks} tasks are open across the team.` : "The board is clear right now.",
    data.kpi.completedThisWeek > 0 ? `${data.kpi.completedThisWeek} tasks were completed this week.` : "No completions logged this week yet.",
    data.kpi.activeBlockers > 0 ? `${data.kpi.activeBlockers} blockers are active.` : "No blockers detected.",
    data.kpi.mentionsLeader > 0 ? `${data.kpi.mentionsLeader} message(s) mentioned you.` : "No one tagged you.",
  ].filter(Boolean);

  let risk: { riskScore: number; level: string; reasons: string[] } = {
    riskScore: 0,
    level: "low",
    reasons: [],
  };
  let usedAi = false;

  if (isGeminiEnabled()) {
    try {
      const [briefing, riskResp] = await Promise.all([
        generateLeaderBriefing({
          leaderName: opts.leaderName,
          hours: sinceHours,
          events: data.events.slice(0, 40),
        }),
        scoreProjectRisk({
          signals: data.signals,
          overdueTasks: data.kpi.overdueTasks,
          activeBlockers: data.kpi.activeBlockers,
          overloadedMembers: data.kpi.overloadedMembers,
        }),
      ]);
      if (briefing.ok && briefing.data) {
        headline = briefing.data.headline || headline;
        bullets = briefing.data.bullets.length ? briefing.data.bullets : bullets;
        needsAttention = briefing.data.needsAttention.length
          ? briefing.data.needsAttention
          : needsAttention;
        usedAi = true;
      }
      if (riskResp.ok && riskResp.data) {
        risk = {
          riskScore: Math.max(0, Math.min(100, Math.round(riskResp.data.riskScore))),
          level: riskResp.data.level,
          reasons: riskResp.data.reasons,
        };
      }
    } catch (err) {
      log.error("AI failed, using heuristic", err);
      if (!shouldUseFallback()) throw err;
    }
  } else {
    // Heuristic risk score when AI is off
    const score = Math.min(
      100,
      data.kpi.overdueTasks * 12 +
        data.kpi.activeBlockers * 10 +
        data.kpi.overloadedMembers * 8 +
        data.kpi.pendingDecisions * 6
    );
    risk = {
      riskScore: score,
      level: score > 80 ? "critical" : score > 55 ? "high" : score > 30 ? "medium" : "low",
      reasons: data.signals,
    };
  }

  return {
    headline,
    bullets,
    needsAttention,
    kpi: data.kpi,
    risk,
    blockers: data.blockers,
    decisions: data.decisions,
    mentions: data.mentions,
    eisenhower: data.eisenhower,
    generatedAt: new Date(),
    usedAi,
  };
}

export async function enrichImplicitMentions(
  mentions: MentionItem[],
  leaderName: string
): Promise<MentionItem[]> {
  if (!isGeminiEnabled() || mentions.length === 0) return mentions;
  const out: MentionItem[] = [];
  for (const m of mentions.slice(0, 20)) {
    if (m.implicit) {
      out.push(m);
      continue;
    }
    try {
      const res = await detectImplicitLeaderMention(m.text, leaderName);
      if (res.ok && res.data && res.data.mentionsLeader) {
        out.push({ ...m, implicit: true });
      } else {
        out.push(m);
      }
    } catch {
      out.push(m);
    }
  }
  return out;
}

export async function classifyRecentMessages(
  workspaceId: string,
  sinceHours = 24
): Promise<Array<{ id: string; classification: string; priority: string }>> {
  if (!isGeminiEnabled()) return [];
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const messages = await db
    .select({ id: messageTable.id, content: messageTable.content })
    .from(messageTable)
    .innerJoin(channel, eq(channel.id, messageTable.channelId))
    .where(
      and(eq(channel.workspaceId, workspaceId), gte(messageTable.createdAt, since))
    )
    .orderBy(desc(messageTable.createdAt))
    .limit(40);
  const out: Array<{ id: string; classification: string; priority: string }> = [];
  for (const m of messages) {
    try {
      const res = await classifyMessage(m.content);
      if (res.ok && res.data) {
        out.push({
          id: m.id,
          classification: res.data.classification,
          priority: res.data.priority,
        });
      }
    } catch {
      // skip
    }
  }
  return out;
}

export async function recommendTaskAssignee(opts: {
  workspaceId: string;
  taskTitle: string;
}): Promise<{
  recommendedUser: string | null;
  confidence: number;
  reasoning: string;
}> {
  const load = await computeLoadBalance(opts.workspaceId);
  const candidates = load.counts.map((c) => ({
    name: c.name,
    openTasks: c.openCount,
    skills: [] as string[],
  }));
  if (candidates.length === 0) {
    return { recommendedUser: null, confidence: 0, reasoning: "No team members found." };
  }
  if (!isGeminiEnabled()) {
    const best = [...candidates].sort((a, b) => a.openTasks - b.openTasks)[0];
    return {
      recommendedUser: best.name,
      confidence: 50,
      reasoning: "Lowest current load (heuristic).",
    };
  }
  const res = await recommendAssignee({ taskTitle: opts.taskTitle, candidates });
  if (res.ok && res.data) return res.data;
  const best = [...candidates].sort((a, b) => a.openTasks - b.openTasks)[0];
  return {
    recommendedUser: best.name,
    confidence: 50,
    reasoning: "Lowest current load (fallback).",
  };
}

export async function predictDelayForTask(opts: {
  taskId: string;
}): Promise<{ probabilityDelay: number; reasoning: string }> {
  const task = await db.query.task.findFirst({
    where: eq(taskTable.id, opts.taskId),
    columns: {
      id: true,
      userId: true,
      title: true,
      deadline: true,
      createdAt: true,
    },
  });
  if (!task) {
    return { probabilityDelay: 0, reasoning: "Task not found." };
  }
  const ownerOpenRows = await db
    .select({ c: count() })
    .from(taskTable)
    .where(and(eq(taskTable.userId, task.userId), eq(taskTable.status, "open")));
  const ownerOpen = Number(ownerOpenRows[0]?.c ?? 0);
  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - task.createdAt.getTime()) / DAY_MS)
  );
  const hasDeadline = !!task.deadline;
  const daysUntilDeadline = task.deadline
    ? Math.floor((task.deadline.getTime() - Date.now()) / DAY_MS)
    : null;

  if (!isGeminiEnabled()) {
    let p = 20;
    if (hasDeadline && daysUntilDeadline !== null && daysUntilDeadline < 0) p += 40;
    if (ageDays > 5) p += 15;
    if (ownerOpen >= 4) p += 15;
    return {
      probabilityDelay: Math.min(95, p),
      reasoning: "Heuristic estimate based on age, deadline and owner load.",
    };
  }
  const res = await predictTaskDelay({
    taskTitle: task.title,
    ageDays,
    hasDeadline,
    daysUntilDeadline,
    ownerOpenTasks: ownerOpen,
  });
  if (res.ok && res.data) return res.data;
  return {
    probabilityDelay: 30,
    reasoning: "Fallback estimate.",
  };
}
