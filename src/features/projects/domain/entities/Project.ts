export interface Project {
  id: string;
  name: string;
  slug: string;
  hashtag: string;
  description: string | null;
  industry: string | null;
  category: string | null;
  emoji: string | null;
  teamSize: string | null;
  createdAt: Date;
}

export interface ProjectSummary {
  id: string;
  name: string;
  hashtag: string;
  emoji: string | null;
  description: string | null;
  industry: string | null;
  category: string | null;
  memberCount: number;
  leaderName: string | null;
}
