-- AddUserGlobalRoleAndBlocked
-- Plataforma: rol global + flag de bloqueo para el panel de super-admin.

ALTER TABLE "User" ADD COLUMN "globalRole" TEXT;
ALTER TABLE "User" ADD COLUMN "blocked" BOOLEAN NOT NULL DEFAULT false;
