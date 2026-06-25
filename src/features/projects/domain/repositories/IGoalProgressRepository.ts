import type { SmartGoalSnapshot } from "../entities/SmartGoal";

export interface CreateSmartGoalInput {
  workspaceId: string;
  ownerId: string;
  title: string;
  specific?: string | null;
  measurable?: string | null;
  achievable?: string | null;
  relevant?: string | null;
  deadline?: Date | null;
}

export interface UpdateSmartGoalInput {
  title?: string;
  specific?: string | null;
  measurable?: string | null;
  achievable?: string | null;
  relevant?: string | null;
  deadline?: Date | null;
  status?: string;
}

export interface GoalSummary {
  id: string;
  workspaceId: string;
  title: string;
  status: string;
  ownerId: string;
  deadline: Date | null;
  createdAt: Date;
}

/**
 * Repository contract for the SMART Goal Progress Tracker.
 *
 * Focused on goals + their progress snapshot (goal + milestones + tasks +
 * members), kept separate from the broader IProjectRepository so each module
 * stays cohesive.
 */
export interface IGoalProgressRepository {
  listForWorkspace(workspaceId: string): Promise<GoalSummary[]>;
  findById(id: string): Promise<GoalSummary | null>;
  loadSnapshot(goalId: string): Promise<SmartGoalSnapshot | null>;
  create(input: CreateSmartGoalInput): Promise<GoalSummary>;
  update(id: string, patch: UpdateSmartGoalInput): Promise<GoalSummary>;

  /**
   * Keeps the workspace's active Goal row in sync with the leader's SMART goal
   * (edited in Project Settings). Creates one if none exists, otherwise patches
   * the most recent active goal so it shows up in the Progress tracker.
   */
  upsertActiveGoal(
    workspaceId: string,
    ownerId: string,
    data: {
      title: string;
      specific?: string | null;
      measurable?: string | null;
      achievable?: string | null;
      relevant?: string | null;
      deadline?: Date | null;
    }
  ): Promise<GoalSummary>;
}
