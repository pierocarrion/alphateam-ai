import { User, UserProfile } from "../entities/User";

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
}

export interface UpdateProfileInput {
  role?: string;
  hardMoment?: string;
  profileId?: string;
  onboarded?: boolean;
  tone?: "warm" | "balanced";
  jobTitle?: string;
  seniority?: string;
  headline?: string;
  skills?: string[];
  cvStorageKey?: string;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<(User & { profile: UserProfile | null }) | null>;
  create(input: CreateUserInput): Promise<User>;
  updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile>;
}
