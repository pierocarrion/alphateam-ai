import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { cuid, ts } from "./_shared";
import { user } from "./auth";
import { workspace } from "./workspace";

export const channel = pgTable(
  "Channel",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text().notNull(),
    // channel, dm
    type: text().default("channel").notNull(),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    wsNameType: unique("Channel_workspaceId_name_type_key").on(
      t.workspaceId,
      t.name,
      t.type
    ),
  })
);

export const channelParticipant = pgTable(
  "ChannelParticipant",
  {
    id: text().primaryKey().$defaultFn(cuid),
    channelId: text()
      .notNull()
      .references(() => channel.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    channelUser: unique("ChannelParticipant_channelId_userId_key").on(
      t.channelId,
      t.userId
    ),
  })
);

export const message = pgTable(
  "Message",
  {
    id: text().primaryKey().$defaultFn(cuid),
    channelId: text()
      .notNull()
      .references(() => channel.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text().notNull(),
    createdAt: timestamp(ts).defaultNow().notNull(),
    // Thread support: null for top-level messages, parent id for replies.
    parentId: text(),
  },
  (t) => ({
    byChannelCreated: index("Message_channelId_createdAt_idx").on(
      t.channelId,
      t.createdAt
    ),
    byParent: index("Message_parentId_idx").on(t.parentId),
  })
);

export const messageAttachment = pgTable(
  "MessageAttachment",
  {
    id: text().primaryKey().$defaultFn(cuid),
    messageId: text()
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    fileName: text().notNull(),
    fileType: text().notNull(),
    storageKey: text(),
    url: text(),
    mimeType: text(),
    sizeBytes: integer().default(0).notNull(),
    width: integer(),
    height: integer(),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    byMessage: index("MessageAttachment_messageId_idx").on(t.messageId),
  })
);

export const messageReaction = pgTable(
  "MessageReaction",
  {
    id: text().primaryKey().$defaultFn(cuid),
    messageId: text()
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    emoji: text().notNull(),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    msgUserEmoji: unique("MessageReaction_messageId_userId_emoji_key").on(
      t.messageId,
      t.userId,
      t.emoji
    ),
    byMessage: index("MessageReaction_messageId_idx").on(t.messageId),
  })
);

export const channelInsight = pgTable(
  "ChannelInsight",
  {
    id: text().primaryKey().$defaultFn(cuid),
    channelId: text()
      .notNull()
      .references(() => channel.id, { onDelete: "cascade" }),
    workspaceId: text().notNull(),
    // summary | tasks | risks | decisions | next_steps | retrospective | strategy | fetch
    type: text().notNull(),
    payload: jsonb().notNull().$type<unknown>(),
    sourceMessageId: text(),
    createdById: text(),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    byChannelTypeCreated: index(
      "ChannelInsight_channelId_type_createdAt_idx"
    ).on(t.channelId, t.type, t.createdAt),
    byWsCreated: index("ChannelInsight_workspaceId_createdAt_idx").on(
      t.workspaceId,
      t.createdAt
    ),
  })
);
