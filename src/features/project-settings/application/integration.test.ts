import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTestDb, resetDatabase, seedMember, seedUser } from "@/tests/helpers/db";
import { eq, and, count } from "drizzle-orm";
import { membership, projectKpiSnapshot } from "@drizzle/schema";
import { __resetProjectSettingsDeps, getProjectSettingsDeps } from "../infrastructure/container";
import { SaveSmartGoal } from "../application/use-cases/SaveSmartGoal";
import { SetMethodology } from "../application/use-cases/SetMethodology";
import {
  InviteMember,
  RemoveMember,
  UpdateMember,
} from "../application/use-cases/ManageMembers";
import { ConfigureKpis } from "../application/use-cases/ConfigureKpis";
import { UserFacingError } from "@/server/lib/errors";

async function seedLeader() {
  const db = await getTestDb();
  const { user, workspaceId } = await seedMember({ name: "Leader" });
  await db
    .update(membership)
    .set({ role: "leader", projectRole: "project_manager", status: "active" })
    .where(
      and(eq(membership.userId, user.id), eq(membership.workspaceId, workspaceId))
    );
  return { user, workspaceId };
}

describe("project-settings integration", () => {
  beforeEach(() => {
    __resetProjectSettingsDeps();
  });
  afterEach(async () => {
    await resetDatabase();
  });

  it("creates the SMART goal on first save and versions it on update", async () => {
    const deps = getProjectSettingsDeps();
    const { user, workspaceId } = await seedLeader();
    const useCase = new SaveSmartGoal(deps);

    const first = await useCase.execute({
      title: "Adopción Q3",
      specific: "Incrementar usuarios activos",
      measurable: "15% más",
      achievable: "Con el equipo actual",
      relevant: "Alineado a revenue",
      timeBound: "Durante Q3",
      deadline: null,
      workspaceId,
      actorId: user.id,
    });
    expect(first.version).toBe(1);
    expect(first.smartScore).toBeGreaterThan(0);

    const second = await useCase.execute({
      title: "Adopción Q3 v2",
      specific: "Incrementar usuarios activos diarios",
      measurable: "15% más vs Q2",
      achievable: "Con el equipo actual y campaign",
      relevant: "Alineado a revenue",
      timeBound: "Durante Q3 2026",
      deadline: "2026-09-30T12:00:00.000Z",
      workspaceId,
      actorId: user.id,
    });
    expect(second.version).toBe(2);
    expect(second.smartScore).toBeGreaterThanOrEqual(first.smartScore!);

    const versions = await deps.smartGoalRepository.listVersions(workspaceId);
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
  });

  it("sets exactly one primary methodology and keeps secondaries", async () => {
    const deps = getProjectSettingsDeps();
    const { user, workspaceId } = await seedLeader();
    const useCase = new SetMethodology(deps);

    const result = await useCase.execute({
      primary: "scrum",
      secondary: ["kanban", "lean_ux"],
      workspaceId,
      actorId: user.id,
    });
    const primaries = result.filter((m) => m.tier === "primary");
    const secondaries = result.filter((m) => m.tier === "secondary");
    expect(primaries).toHaveLength(1);
    expect(primaries[0].methodologyKey).toBe("scrum");
    expect(secondaries.map((s) => s.methodologyKey).sort()).toEqual(["kanban", "lean_ux"]);

    await expect(
      useCase.execute({ primary: null, secondary: [], workspaceId, actorId: user.id })
    ).rejects.toThrow(UserFacingError);
  });

  it("blocks removing or demoting the last active leader", async () => {
    const deps = getProjectSettingsDeps();
    const { user, workspaceId } = await seedLeader();
    const member = await deps.memberRepository.list(workspaceId);
    const leader = member[0];

    const update = new UpdateMember(deps);
    await expect(
      update.execute(workspaceId, leader.id, user.id, { permissionRole: "member" })
    ).rejects.toThrow(UserFacingError);

    const remove = new RemoveMember(deps);
    await expect(remove.execute(workspaceId, leader.id, user.id)).rejects.toThrow(
      UserFacingError
    );
  });

  it("prevents duplicate member emails via invitation", async () => {
    const deps = getProjectSettingsDeps();
    const { user, workspaceId } = await seedLeader();
    const invite = new InviteMember(deps);

    await invite.execute(workspaceId, user.id, {
      email: "teammate@example.com",
      projectRole: "ux_designer",
    });
    await expect(
      invite.execute(workspaceId, user.id, {
        email: "teammate@example.com",
        projectRole: "ux_designer",
      })
    ).rejects.toThrow(UserFacingError);
  });

  it("toggles KPIs and persists targets", async () => {
    const deps = getProjectSettingsDeps();
    const { user, workspaceId } = await seedLeader();
    const useCase = new ConfigureKpis(deps);

    const result = await useCase.execute({
      workspaceId,
      actorId: user.id,
      entries: [
        { kpiKey: "team_velocity", enabled: true, target: 42, alertThreshold: 25 },
        { kpiKey: "cycle_time", enabled: true, target: null, alertThreshold: null },
        { kpiKey: "defect_density", enabled: false },
      ],
    });

    const velocity = result.find((k) => k.kpiKey === "team_velocity");
    expect(velocity?.enabled).toBe(true);
    expect(velocity?.target).toBe(42);

    const db = await getTestDb();
    const [beforeRow] = await db.select({ c: count() }).from(projectKpiSnapshot);
    const snapshotsBefore = beforeRow.c;
    await deps.kpiRepository.recordSnapshot(workspaceId, "team_velocity", 40);
    const [afterRow] = await db.select({ c: count() }).from(projectKpiSnapshot);
    const snapshotsAfter = afterRow.c;
    expect(snapshotsAfter - snapshotsBefore).toBe(1);
  });

  it("can add and remove a non-leader member freely", async () => {
    const deps = getProjectSettingsDeps();
    const { workspaceId } = await seedLeader();
    const { user } = await seedUser({ name: "Dev", email: "dev@example.com" });
    const added = await deps.memberRepository.add({
      workspaceId,
      userId: user.id,
      projectRole: "backend_developer",
      permissionRole: "member",
    });
    expect(added.projectRole).toBe("backend_developer");

    const remove = new RemoveMember(deps);
    await remove.execute(workspaceId, added.id, user.id);
    const remaining = await deps.memberRepository.list(workspaceId);
    expect(remaining.find((m) => m.id === added.id)).toBeUndefined();
  });
});
