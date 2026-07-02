ALTER TABLE "UserProfile" ADD COLUMN "jobTitle" text;--> statement-breakpoint
ALTER TABLE "UserProfile" ADD COLUMN "seniority" text;--> statement-breakpoint
ALTER TABLE "UserProfile" ADD COLUMN "headline" text;--> statement-breakpoint
ALTER TABLE "UserProfile" ADD COLUMN "skills" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "UserProfile" ADD COLUMN "cvStorageKey" text;