import { Project, ProjectSummary } from "../entities/Project";
import {
  JoinRequest,
  JoinRequestStatus,
  JoinRequestWithUser,
  PendingRequestWithUser,
} from "../entities/JoinRequest";

export interface KnowledgeSeedItem {
  title: string;
  content: string;
  sourceUrl?: string;
}

export interface KnowledgeBaseItem {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  sourceApp: string | null;
  sourceUrl: string | null;
  createdAt: Date;
}

export interface UpdateKnowledgeInput {
  title?: string;
  content?: string;
  sourceUrl?: string | null;
}

export interface CreateProjectInput {
  name: string;
  slug: string;
  hashtag: string;
  description?: string;
  industry?: string;
  category?: string;
  emoji?: string;
  teamSize?: string;
  leaderUserId: string;
  methodology: "scrum" | "design_thinking";
  knowledgeBase: KnowledgeSeedItem[];
  goal?: { title: string; milestone?: string } | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  industry?: string | null;
  category?: string | null;
  emoji?: string;
  teamSize?: string | null;
}

export interface RequestToJoinInput {
  workspaceId: string;
  userId: string;
  message?: string;
}

export interface IProjectRepository {
  findByHashtag(hashtag: string): Promise<Project | null>;
  findById(id: string): Promise<Project | null>;
  search(query: string): Promise<ProjectSummary[]>;
  listForUser(userId: string): Promise<ProjectSummary[]>;
  update(id: string, input: UpdateProjectInput): Promise<Project>;
  isMember(userId: string, workspaceId: string): Promise<boolean>;
  hasOpenRequest(userId: string, workspaceId: string): Promise<boolean>;
  create(input: CreateProjectInput): Promise<Project>;
  createJoinRequest(input: RequestToJoinInput): Promise<JoinRequest>;
  findRequestByUser(
    userId: string,
    workspaceId: string
  ): Promise<JoinRequest | null>;
  listPendingRequests(workspaceId: string): Promise<PendingRequestWithUser[]>;
  findRequest(id: string): Promise<JoinRequestWithUser | null>;
  isLeader(userId: string, workspaceId: string): Promise<boolean>;
  decideRequest(
    id: string,
    decision: JoinRequestStatus,
    decidedById: string
  ): Promise<JoinRequest>;
  findOrCreateCommunity(): Promise<Project>;
  addMember(workspaceId: string, userId: string): Promise<void>;
  listKnowledge(workspaceId: string): Promise<KnowledgeBaseItem[]>;
  addKnowledge(
    workspaceId: string,
    item: { title: string; content: string; sourceUrl?: string }
  ): Promise<KnowledgeBaseItem>;
  updateKnowledge(
    id: string,
    patch: UpdateKnowledgeInput
  ): Promise<KnowledgeBaseItem>;
  deleteKnowledge(id: string): Promise<void>;
}
