import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  unique,
} from "drizzle-orm/pg-core";
import { cuid, ts } from "./_shared";

// next-auth uses JWT sessions (see src/app/api/auth/[...nextauth]/route.ts),
// so Session/VerificationToken tables are kept for compatibility but barely used.

export const user = pgTable("User", {
  id: text().primaryKey().$defaultFn(cuid),
  name: text(),
  email: text().unique(),
  passwordHash: text(),
  emailVerified: timestamp(ts),
  image: text(),
  // null = regular user · "superadmin" = platform admin
  globalRole: text(),
  blocked: boolean().default(false).notNull(),
  createdAt: timestamp(ts).defaultNow().notNull(),
  // updatedAt handled via .$onUpdate at query layer (see src/server/lib/db.ts)
  updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
});

export const account = pgTable(
  "Account",
  {
    id: text().primaryKey().$defaultFn(cuid),
    userId: text().notNull(),
    type: text().notNull(),
    provider: text().notNull(),
    providerAccountId: text().notNull(),
    // next-auth quirk: these specific fields ARE snake_case in the DB
    refresh_token: text(),
    access_token: text(),
    expires_at: integer(),
    token_type: text(),
    scope: text(),
    id_token: text(),
    session_state: text(),
  },
  (t) => ({
    providerAccount: unique("Account_provider_provider_account_id_key").on(
      t.provider,
      t.providerAccountId
    ),
  })
);

export const session = pgTable("Session", {
  id: text().primaryKey().$defaultFn(cuid),
  sessionToken: text().unique().notNull(),
  userId: text().notNull(),
  expires: timestamp(ts).notNull(),
});

export const verificationToken = pgTable(
  "VerificationToken",
  {
    identifier: text().notNull(),
    token: text().unique().notNull(),
    expires: timestamp(ts).notNull(),
  },
  (t) => ({
    idToken: unique("VerificationToken_identifier_token_key").on(
      t.identifier,
      t.token
    ),
  })
);

export const userProfile = pgTable("UserProfile", {
  id: text().primaryKey().$defaultFn(cuid),
  userId: text().unique().notNull(),
  role: text(),
  hardMoment: text(),
  profileId: text(),
  onboarded: boolean().default(false).notNull(),
  tone: text().default("warm").notNull(),
  preferredTags: text().array().notNull().default([]),
  gentleCheckIns: boolean().default(true).notNull(),
  pairStartInvites: boolean().default(true).notNull(),
  quietMode: boolean().default(false).notNull(),
  lastActiveWorkspaceId: text(),
  // CV-derived profile enrichment (populated when a user uploads a CV during
  // onboarding so Alpha can personalize without making them re-type everything).
  jobTitle: text(),
  seniority: text(),
  headline: text(),
  skills: text().array().notNull().default([]),
  cvStorageKey: text(),
  createdAt: timestamp(ts).defaultNow().notNull(),
  updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
});
