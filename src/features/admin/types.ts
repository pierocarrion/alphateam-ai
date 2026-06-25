export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  globalRole: string | null;
  blocked: boolean;
  createdAt: string;
  _count: { memberships: number };
}

export interface AdminWorkspace {
  id: string;
  name: string;
  slug: string;
  hashtag: string;
  emoji: string | null;
  category: string | null;
  createdAt: string;
  subscription: { plan: string; status: string } | null;
  _count: { memberships: number };
}

export interface AdminWorkspaceDetail extends Omit<AdminWorkspace, "subscription" | "_count"> {
  description: string | null;
  industry: string | null;
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
  } | null;
  memberships: {
    id: string;
    role: string;
    projectRole: string | null;
    status: string;
    joinedAt: string;
    user: { id: string; name: string | null; email: string | null };
  }[];
}
