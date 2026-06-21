-- AlterTable
ALTER TABLE "Channel" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'channel';

-- Drop old unique index and replace with one that includes type
DROP INDEX "Channel_workspaceId_name_key";
CREATE UNIQUE INDEX "Channel_workspaceId_name_type_key" ON "Channel"("workspaceId", "name", "type");

-- CreateTable
CREATE TABLE "ChannelParticipant" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelParticipant_channelId_userId_key" ON "ChannelParticipant"("channelId", "userId");

-- AddForeignKey
ALTER TABLE "ChannelParticipant" ADD CONSTRAINT "ChannelParticipant_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelParticipant" ADD CONSTRAINT "ChannelParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
