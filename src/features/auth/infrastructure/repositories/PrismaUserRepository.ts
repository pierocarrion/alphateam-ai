import { eq } from "drizzle-orm";
import { db } from "@/server/lib/db";
import { user, userProfile } from "@drizzle/schema";
import {
  CreateUserInput,
  IUserRepository,
  UpdateProfileInput,
} from "../../domain/repositories/IUserRepository";
import { User, UserProfile } from "../../domain/entities/User";

export class PrismaUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const row = await db.query.user.findFirst({ where: eq(user.email, email) });
    if (!row) return null;
    return this.toUser(row);
  }

  async findById(
    id: string
  ): Promise<(User & { profile: UserProfile | null }) | null> {
    // Single joined query: user + its (optional) profile. Faster than two
    // round-trips and avoids over-fetching unrelated columns.
    const rows = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        createdAt: user.createdAt,
        pId: userProfile.id,
        pUserId: userProfile.userId,
        pRole: userProfile.role,
        pHardMoment: userProfile.hardMoment,
        pProfileId: userProfile.profileId,
        pOnboarded: userProfile.onboarded,
        pTone: userProfile.tone,
      })
      .from(user)
      .leftJoin(userProfile, eq(userProfile.userId, user.id))
      .where(eq(user.id, id));
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      ...this.toUser(r),
      profile: r.pId ? this.toProfile(r) : null,
    };
  }

  async create(input: CreateUserInput): Promise<User> {
    // Create user + empty profile atomically.
    const created = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(user)
        .values({
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash,
        })
        .returning();
      await tx.insert(userProfile).values({ userId: u!.id });
      return u!;
    });
    return this.toUser(created);
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput
  ): Promise<UserProfile> {
    // Build the update set dynamically so undefined fields are skipped
    // (matches Prisma's `?? undefined` semantics). `updatedAt` is always
    // present so Drizzle's `onConflictDoUpdate` never sees an empty `set`
    // (which would throw "No values to set").
    const set: Partial<typeof userProfile.$inferInsert> = { updatedAt: new Date() };
    if (input.role !== undefined) set.role = input.role ?? null;
    if (input.hardMoment !== undefined) set.hardMoment = input.hardMoment ?? null;
    if (input.profileId !== undefined) set.profileId = input.profileId ?? null;
    if (input.onboarded !== undefined) set.onboarded = input.onboarded;
    if (input.tone !== undefined) set.tone = input.tone;

    const [row] = await db
      .insert(userProfile)
      .values({
        userId,
        role: input.role ?? null,
        hardMoment: input.hardMoment ?? null,
        profileId: input.profileId ?? null,
        onboarded: input.onboarded ?? false,
        tone: input.tone ?? "warm",
      })
      .onConflictDoUpdate({ target: userProfile.userId, set })
      .returning();
    return this.toProfile(row!);
  }

  private toUser(row: {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
    createdAt: Date;
  }): User {
    return {
      id: row.id,
      email: row.email ?? "",
      name: row.name,
      image: row.image,
      createdAt: row.createdAt,
    };
  }

  private toProfile(row: {
    pId?: string | null;
    id?: string;
    pUserId?: string | null;
    userId?: string;
    pRole?: string | null;
    role?: string | null;
    pHardMoment?: string | null;
    hardMoment?: string | null;
    pProfileId?: string | null;
    profileId?: string | null;
    pOnboarded?: boolean | null;
    onboarded?: boolean | null;
    pTone?: string | null;
    tone?: string | null;
  }): UserProfile {
    return {
      id: (row.pId ?? row.id)!,
      userId: (row.pUserId ?? row.userId)!,
      role: row.pRole ?? row.role ?? null,
      hardMoment: row.pHardMoment ?? row.hardMoment ?? null,
      profileId: row.pProfileId ?? row.profileId ?? null,
      onboarded: row.pOnboarded ?? row.onboarded ?? false,
      tone:
        (row.pTone ?? row.tone) === "balanced" ? "balanced" : "warm",
    };
  }
}
