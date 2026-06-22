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
  knowledgeBase: KnowledgeSeedItem[];
  goal?: { title: string; milestone?: string } | null;
}

export interface RequestToJoinInput {
  workspaceId: string;
  userId: string;
  message?: string;
}

export interface IProjectRepository {
  findByHashtag(hashtag: string): Promise<Project | null>;
  search(query: string): Promise<ProjectSummary[]>;
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
}
