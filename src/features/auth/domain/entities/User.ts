export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  role: string | null;
  hardMoment: string | null;
  profileId: string | null;
  onboarded: boolean;
  tone: "warm" | "balanced";
  jobTitle: string | null;
  seniority: string | null;
  headline: string | null;
  skills: string[];
  cvStorageKey: string | null;
}
