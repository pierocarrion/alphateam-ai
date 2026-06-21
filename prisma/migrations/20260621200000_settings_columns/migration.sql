-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "gentleCheckIns" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserProfile" ADD COLUMN "pairStartInvites" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserProfile" ADD COLUMN "quietMode" BOOLEAN NOT NULL DEFAULT false;
