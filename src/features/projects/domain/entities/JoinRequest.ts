export type JoinRequestStatus = "pending" | "approved" | "rejected";

export interface JoinRequest {
  id: string;
  workspaceId: string;
  userId: string;
  message: string | null;
  status: JoinRequestStatus;
  decidedById: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

export interface JoinRequestWithUser extends JoinRequest {
  userName: string | null;
  userEmail: string | null;
}

export interface PendingRequestWithUser extends JoinRequest {
  userName: string | null;
  userEmail: string | null;
}
