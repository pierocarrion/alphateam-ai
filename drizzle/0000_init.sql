CREATE TABLE "Account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "Account_provider_provider_account_id_key" UNIQUE("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionToken" text NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp (3) NOT NULL,
	CONSTRAINT "Session_sessionToken_unique" UNIQUE("sessionToken")
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"passwordHash" text,
	"emailVerified" timestamp (3),
	"image" text,
	"globalRole" text,
	"blocked" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "UserProfile" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"role" text,
	"hardMoment" text,
	"profileId" text,
	"onboarded" boolean DEFAULT false NOT NULL,
	"tone" text DEFAULT 'warm' NOT NULL,
	"preferredTags" text[] DEFAULT '{}' NOT NULL,
	"gentleCheckIns" boolean DEFAULT true NOT NULL,
	"pairStartInvites" boolean DEFAULT true NOT NULL,
	"quietMode" boolean DEFAULT false NOT NULL,
	"lastActiveWorkspaceId" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "UserProfile_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "VerificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp (3) NOT NULL,
	CONSTRAINT "VerificationToken_token_unique" UNIQUE("token"),
	CONSTRAINT "VerificationToken_identifier_token_key" UNIQUE("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "Goal" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"ownerId" text NOT NULL,
	"title" text NOT NULL,
	"specific" text,
	"measurable" text,
	"achievable" text,
	"relevant" text,
	"deadline" timestamp (3),
	"status" text DEFAULT 'active' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "IndustryDatabase" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text,
	"industry" text NOT NULL,
	"itemType" text NOT NULL,
	"data" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "JoinRequest" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"userId" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decidedById" text,
	"decidedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "JoinRequest_workspaceId_userId_key" UNIQUE("workspaceId","userId")
);
--> statement-breakpoint
CREATE TABLE "KnowledgeBaseItem" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"sourceApp" text,
	"sourceUrl" text,
	"validatedByLlmAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Meeting" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"ownerId" text,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"scheduledAt" timestamp (3),
	"status" text DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Membership" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"workspaceId" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"projectRole" text,
	"status" text DEFAULT 'active' NOT NULL,
	"photoUrl" text,
	"invitedEmail" text,
	"seniority" text,
	"hireDate" timestamp (3),
	"joinedAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "Membership_userId_workspaceId_key" UNIQUE("userId","workspaceId")
);
--> statement-breakpoint
CREATE TABLE "Methodology" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Milestone" (
	"id" text PRIMARY KEY NOT NULL,
	"goalId" text NOT NULL,
	"title" text NOT NULL,
	"dueDate" timestamp (3),
	"status" text DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Template" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"industry" text,
	"content" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Waitlist" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"teamSize" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "Waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "Workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"hashtag" text NOT NULL,
	"description" text,
	"industry" text,
	"category" text,
	"emoji" text DEFAULT '🚀',
	"teamSize" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "Workspace_slug_unique" UNIQUE("slug"),
	CONSTRAINT "Workspace_hashtag_unique" UNIQUE("hashtag")
);
--> statement-breakpoint
CREATE TABLE "WorkspaceSubscription" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"stripeCustomerId" text,
	"stripeSubscriptionId" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"currentPeriodEnd" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "WorkspaceSubscription_workspaceId_unique" UNIQUE("workspaceId")
);
--> statement-breakpoint
CREATE TABLE "Channel" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'channel' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "Channel_workspaceId_name_type_key" UNIQUE("workspaceId","name","type")
);
--> statement-breakpoint
CREATE TABLE "ChannelInsight" (
	"id" text PRIMARY KEY NOT NULL,
	"channelId" text NOT NULL,
	"workspaceId" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"sourceMessageId" text,
	"createdById" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ChannelParticipant" (
	"id" text PRIMARY KEY NOT NULL,
	"channelId" text NOT NULL,
	"userId" text NOT NULL,
	"joinedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "ChannelParticipant_channelId_userId_key" UNIQUE("channelId","userId")
);
--> statement-breakpoint
CREATE TABLE "Message" (
	"id" text PRIMARY KEY NOT NULL,
	"channelId" text NOT NULL,
	"userId" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"parentId" text
);
--> statement-breakpoint
CREATE TABLE "MessageAttachment" (
	"id" text PRIMARY KEY NOT NULL,
	"messageId" text NOT NULL,
	"fileName" text NOT NULL,
	"fileType" text NOT NULL,
	"storageKey" text,
	"url" text,
	"mimeType" text,
	"sizeBytes" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MessageReaction" (
	"id" text PRIMARY KEY NOT NULL,
	"messageId" text NOT NULL,
	"userId" text NOT NULL,
	"emoji" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "MessageReaction_messageId_userId_emoji_key" UNIQUE("messageId","userId","emoji")
);
--> statement-breakpoint
CREATE TABLE "DailyCheckIn" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"date" timestamp (3) DEFAULT now() NOT NULL,
	"mood" text,
	"energy" integer,
	"notes" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "DailyCheckIn_userId_date_key" UNIQUE("userId","date")
);
--> statement-breakpoint
CREATE TABLE "PairMatch" (
	"id" text PRIMARY KEY NOT NULL,
	"requesterId" text NOT NULL,
	"partnerId" text NOT NULL,
	"taskId" text,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approvedById" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Reward" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"triggeredBy" text,
	"claimedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RitualSession" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"taskId" text,
	"feeling" text,
	"moodAtStart" text,
	"moodAtEnd" text,
	"durationSec" integer DEFAULT 120 NOT NULL,
	"recoveredMinutes" integer,
	"startedAt" timestamp (3),
	"completedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Task" (
	"id" text PRIMARY KEY NOT NULL,
	"messageId" text,
	"userId" text NOT NULL,
	"smartGoalId" text,
	"title" text NOT NULL,
	"fromQuote" text,
	"category" text DEFAULT 'General' NOT NULL,
	"app" text DEFAULT 'Knowledge base' NOT NULL,
	"due" text,
	"deadline" timestamp (3),
	"load" text DEFAULT 'Light' NOT NULL,
	"micro" text NOT NULL,
	"action" text NOT NULL,
	"resource" text DEFAULT 'Untitled' NOT NULL,
	"selfMade" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"quadrant" text,
	"estimatedMinutes" integer,
	"workedMinutes" integer,
	"priority" integer,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"completedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "TeamMetric" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"date" timestamp (3) DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"value" double precision NOT NULL,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "UserMetric" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"date" timestamp (3) DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"value" double precision NOT NULL,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "AuditLog" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text,
	"actorId" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entityId" text,
	"before" text,
	"after" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KpiDefinition" (
	"id" text PRIMARY KEY NOT NULL,
	"kpiKey" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"formula" text NOT NULL,
	"dataSource" text NOT NULL,
	"frequency" text NOT NULL,
	CONSTRAINT "KpiDefinition_kpiKey_unique" UNIQUE("kpiKey")
);
--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"readAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProjectAiInsight" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"type" text NOT NULL,
	"severity" text,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProjectArtifactState" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"phaseId" text NOT NULL,
	"methodologyKey" text NOT NULL,
	"phaseKey" text NOT NULL,
	"artifactKey" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"mandatory" boolean DEFAULT false NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"filledContent" text,
	"knowledgeResourceId" text,
	"startedAt" timestamp (3),
	"completedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "ProjectArtifactState_workspaceId_artifactKey_key" UNIQUE("workspaceId","artifactKey")
);
--> statement-breakpoint
CREATE TABLE "ProjectInvitation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"email" text NOT NULL,
	"projectRole" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"invitedById" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "ProjectInvitation_workspaceId_email_key" UNIQUE("workspaceId","email")
);
--> statement-breakpoint
CREATE TABLE "ProjectKpi" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"kpiKey" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"target" double precision,
	"alertThreshold" double precision,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "ProjectKpi_workspaceId_kpiKey_key" UNIQUE("workspaceId","kpiKey")
);
--> statement-breakpoint
CREATE TABLE "ProjectKpiSnapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"projectKpiId" text NOT NULL,
	"value" double precision NOT NULL,
	"capturedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProjectMethodology" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"methodologyKey" text NOT NULL,
	"tier" text DEFAULT 'secondary' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "ProjectMethodology_workspaceId_methodologyKey_key" UNIQUE("workspaceId","methodologyKey")
);
--> statement-breakpoint
CREATE TABLE "ProjectPhaseState" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"methodologyKey" text NOT NULL,
	"phaseKey" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"startedAt" timestamp (3),
	"completedAt" timestamp (3),
	"notes" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "ProjectPhaseState_workspaceId_methodologyKey_phaseKey_key" UNIQUE("workspaceId","methodologyKey","phaseKey")
);
--> statement-breakpoint
CREATE TABLE "ProjectRole" (
	"id" text PRIMARY KEY NOT NULL,
	"roleKey" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	CONSTRAINT "ProjectRole_roleKey_unique" UNIQUE("roleKey")
);
--> statement-breakpoint
CREATE TABLE "ProjectSmartGoal" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"title" text NOT NULL,
	"specific" text,
	"measurable" text,
	"achievable" text,
	"relevant" text,
	"timeBound" text,
	"deadline" timestamp (3),
	"version" integer DEFAULT 1 NOT NULL,
	"smartScore" double precision,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "ProjectSmartGoal_workspaceId_unique" UNIQUE("workspaceId")
);
--> statement-breakpoint
CREATE TABLE "ProjectTask" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"assigneeId" text,
	"createdById" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text,
	"dueDate" timestamp (3),
	"tags" text[] DEFAULT '{}' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"phaseKey" text,
	"artifactKey" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	"completedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "PushSubscription" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"userAgent" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "PushSubscription_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "SmartGoalVersion" (
	"id" text PRIMARY KEY NOT NULL,
	"smartGoalId" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"specific" text,
	"measurable" text,
	"achievable" text,
	"relevant" text,
	"timeBound" text,
	"deadline" timestamp (3),
	"smartScore" double precision,
	"changedById" text,
	"changeNote" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EmployeeSkill" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"workspaceId" text NOT NULL,
	"skill" text NOT NULL,
	"level" text NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "EmployeeSkill_userId_workspaceId_skill_key" UNIQUE("userId","workspaceId","skill")
);
--> statement-breakpoint
CREATE TABLE "LearningActivity" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"workspaceId" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"skill" text,
	"level" text,
	"hours" double precision DEFAULT 0 NOT NULL,
	"startedAt" timestamp (3),
	"completedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Survey" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"workspaceId" text NOT NULL,
	"psychologicalSafety" integer NOT NULL,
	"sentiment" text NOT NULL,
	"comment" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AlphaDocument" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"userId" text NOT NULL,
	"workspaceId" text NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'decision_brief' NOT NULL,
	"sections" jsonb NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "AlphaDocument_sessionId_unique" UNIQUE("sessionId")
);
--> statement-breakpoint
CREATE TABLE "AlphaMessage" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"meta" jsonb,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AlphaSession" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"workspaceId" text NOT NULL,
	"title" text NOT NULL,
	"framework" text DEFAULT 'strategic_dialogue' NOT NULL,
	"challenge" text,
	"status" text DEFAULT 'active' NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"documentJson" jsonb,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	"completedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "Feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text,
	"userId" text,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"metricValue" double precision,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "FeedbackCampaign" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'pulse' NOT NULL,
	"questions" jsonb NOT NULL,
	"cadence" text DEFAULT 'weekly' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"startsAt" timestamp (3),
	"endsAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "FeedbackResponse" (
	"id" text PRIMARY KEY NOT NULL,
	"campaignId" text NOT NULL,
	"workspaceId" text NOT NULL,
	"submitterHash" text,
	"payload" jsonb NOT NULL,
	"sentiment" text,
	"emotion" text,
	"scores" jsonb,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KnowledgeCategory" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"icon" text,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "KnowledgeCategory_workspaceId_key_key" UNIQUE("workspaceId","key")
);
--> statement-breakpoint
CREATE TABLE "KnowledgeChunk" (
	"id" text PRIMARY KEY NOT NULL,
	"resourceId" text NOT NULL,
	"ordinal" integer NOT NULL,
	"text" text NOT NULL,
	"tokenCount" integer,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KnowledgeResource" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"categoryId" text,
	"title" text NOT NULL,
	"summary" text,
	"contentText" text NOT NULL,
	"fileType" text DEFAULT 'text' NOT NULL,
	"storageKey" text,
	"sourceUrl" text,
	"sourceApp" text,
	"sourceType" text DEFAULT 'manual' NOT NULL,
	"authorId" text,
	"projectId" text,
	"accessLevel" text DEFAULT 'workspace' NOT NULL,
	"isPremium" boolean DEFAULT false NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"viewCount" integer DEFAULT 0 NOT NULL,
	"useCount" integer DEFAULT 0 NOT NULL,
	"aiMetadata" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"createdById" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KnowledgeResourceVersion" (
	"id" text PRIMARY KEY NOT NULL,
	"resourceId" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"contentText" text NOT NULL,
	"summary" text,
	"changedById" text,
	"changeNote" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KnowledgeSuggestion" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"resourceId" text,
	"targetUserId" text,
	"reason" text NOT NULL,
	"kind" text DEFAULT 'topic_match' NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "IndustryDatabase" ADD CONSTRAINT "IndustryDatabase_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "KnowledgeBaseItem" ADD CONSTRAINT "KnowledgeBaseItem_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Methodology" ADD CONSTRAINT "Methodology_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_goalId_Goal_id_fk" FOREIGN KEY ("goalId") REFERENCES "public"."Goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Template" ADD CONSTRAINT "Template_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WorkspaceSubscription" ADD CONSTRAINT "WorkspaceSubscription_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChannelInsight" ADD CONSTRAINT "ChannelInsight_channelId_Channel_id_fk" FOREIGN KEY ("channelId") REFERENCES "public"."Channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChannelParticipant" ADD CONSTRAINT "ChannelParticipant_channelId_Channel_id_fk" FOREIGN KEY ("channelId") REFERENCES "public"."Channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChannelParticipant" ADD CONSTRAINT "ChannelParticipant_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Message" ADD CONSTRAINT "Message_channelId_Channel_id_fk" FOREIGN KEY ("channelId") REFERENCES "public"."Channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DailyCheckIn" ADD CONSTRAINT "DailyCheckIn_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PairMatch" ADD CONSTRAINT "PairMatch_requesterId_User_id_fk" FOREIGN KEY ("requesterId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PairMatch" ADD CONSTRAINT "PairMatch_partnerId_User_id_fk" FOREIGN KEY ("partnerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "RitualSession" ADD CONSTRAINT "RitualSession_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_smartGoalId_Goal_id_fk" FOREIGN KEY ("smartGoalId") REFERENCES "public"."Goal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TeamMetric" ADD CONSTRAINT "TeamMetric_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserMetric" ADD CONSTRAINT "UserMetric_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectAiInsight" ADD CONSTRAINT "ProjectAiInsight_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectArtifactState" ADD CONSTRAINT "ProjectArtifactState_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectArtifactState" ADD CONSTRAINT "ProjectArtifactState_phaseId_ProjectPhaseState_id_fk" FOREIGN KEY ("phaseId") REFERENCES "public"."ProjectPhaseState"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectInvitation" ADD CONSTRAINT "ProjectInvitation_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectKpi" ADD CONSTRAINT "ProjectKpi_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectKpiSnapshot" ADD CONSTRAINT "ProjectKpiSnapshot_projectKpiId_ProjectKpi_id_fk" FOREIGN KEY ("projectKpiId") REFERENCES "public"."ProjectKpi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectMethodology" ADD CONSTRAINT "ProjectMethodology_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectPhaseState" ADD CONSTRAINT "ProjectPhaseState_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectSmartGoal" ADD CONSTRAINT "ProjectSmartGoal_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_assigneeId_User_id_fk" FOREIGN KEY ("assigneeId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_createdById_User_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SmartGoalVersion" ADD CONSTRAINT "SmartGoalVersion_smartGoalId_ProjectSmartGoal_id_fk" FOREIGN KEY ("smartGoalId") REFERENCES "public"."ProjectSmartGoal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AlphaDocument" ADD CONSTRAINT "AlphaDocument_sessionId_AlphaSession_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."AlphaSession"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AlphaDocument" ADD CONSTRAINT "AlphaDocument_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AlphaDocument" ADD CONSTRAINT "AlphaDocument_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AlphaMessage" ADD CONSTRAINT "AlphaMessage_sessionId_AlphaSession_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."AlphaSession"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AlphaSession" ADD CONSTRAINT "AlphaSession_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AlphaSession" ADD CONSTRAINT "AlphaSession_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "FeedbackCampaign" ADD CONSTRAINT "FeedbackCampaign_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_campaignId_FeedbackCampaign_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."FeedbackCampaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "KnowledgeCategory" ADD CONSTRAINT "KnowledgeCategory_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_resourceId_KnowledgeResource_id_fk" FOREIGN KEY ("resourceId") REFERENCES "public"."KnowledgeResource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "KnowledgeResource" ADD CONSTRAINT "KnowledgeResource_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "KnowledgeResource" ADD CONSTRAINT "KnowledgeResource_categoryId_KnowledgeCategory_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."KnowledgeCategory"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "KnowledgeResourceVersion" ADD CONSTRAINT "KnowledgeResourceVersion_resourceId_KnowledgeResource_id_fk" FOREIGN KEY ("resourceId") REFERENCES "public"."KnowledgeResource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "KnowledgeSuggestion" ADD CONSTRAINT "KnowledgeSuggestion_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "KnowledgeSuggestion" ADD CONSTRAINT "KnowledgeSuggestion_resourceId_KnowledgeResource_id_fk" FOREIGN KEY ("resourceId") REFERENCES "public"."KnowledgeResource"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "JoinRequest_status_idx" ON "JoinRequest" USING btree ("status");--> statement-breakpoint
CREATE INDEX "Membership_workspaceId_status_idx" ON "Membership" USING btree ("workspaceId","status");--> statement-breakpoint
CREATE INDEX "Membership_workspaceId_projectRole_idx" ON "Membership" USING btree ("workspaceId","projectRole");--> statement-breakpoint
CREATE INDEX "ChannelInsight_channelId_type_createdAt_idx" ON "ChannelInsight" USING btree ("channelId","type","createdAt");--> statement-breakpoint
CREATE INDEX "ChannelInsight_workspaceId_createdAt_idx" ON "ChannelInsight" USING btree ("workspaceId","createdAt");--> statement-breakpoint
CREATE INDEX "Message_channelId_createdAt_idx" ON "Message" USING btree ("channelId","createdAt");--> statement-breakpoint
CREATE INDEX "Message_parentId_idx" ON "Message" USING btree ("parentId");--> statement-breakpoint
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX "TeamMetric_workspaceId_date_idx" ON "TeamMetric" USING btree ("workspaceId","date");--> statement-breakpoint
CREATE INDEX "TeamMetric_workspaceId_type_idx" ON "TeamMetric" USING btree ("workspaceId","type");--> statement-breakpoint
CREATE INDEX "UserMetric_userId_date_idx" ON "UserMetric" USING btree ("userId","date");--> statement-breakpoint
CREATE INDEX "UserMetric_userId_type_idx" ON "UserMetric" USING btree ("userId","type");--> statement-breakpoint
CREATE INDEX "AuditLog_workspaceId_entity_idx" ON "AuditLog" USING btree ("workspaceId","entity");--> statement-breakpoint
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "ProjectAiInsight_workspaceId_type_idx" ON "ProjectAiInsight" USING btree ("workspaceId","type");--> statement-breakpoint
CREATE INDEX "ProjectAiInsight_createdAt_idx" ON "ProjectAiInsight" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "ProjectArtifactState_workspaceId_phaseKey_idx" ON "ProjectArtifactState" USING btree ("workspaceId","phaseKey");--> statement-breakpoint
CREATE INDEX "ProjectArtifactState_workspaceId_status_idx" ON "ProjectArtifactState" USING btree ("workspaceId","status");--> statement-breakpoint
CREATE INDEX "ProjectInvitation_status_idx" ON "ProjectInvitation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ProjectKpi_workspaceId_enabled_idx" ON "ProjectKpi" USING btree ("workspaceId","enabled");--> statement-breakpoint
CREATE INDEX "ProjectKpiSnapshot_projectKpiId_capturedAt_idx" ON "ProjectKpiSnapshot" USING btree ("projectKpiId","capturedAt");--> statement-breakpoint
CREATE INDEX "ProjectMethodology_workspaceId_tier_idx" ON "ProjectMethodology" USING btree ("workspaceId","tier");--> statement-breakpoint
CREATE INDEX "ProjectPhaseState_workspaceId_methodologyKey_idx" ON "ProjectPhaseState" USING btree ("workspaceId","methodologyKey");--> statement-breakpoint
CREATE INDEX "ProjectSmartGoal_workspaceId_idx" ON "ProjectSmartGoal" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "ProjectTask_workspaceId_status_idx" ON "ProjectTask" USING btree ("workspaceId","status");--> statement-breakpoint
CREATE INDEX "ProjectTask_workspaceId_assigneeId_idx" ON "ProjectTask" USING btree ("workspaceId","assigneeId");--> statement-breakpoint
CREATE INDEX "ProjectTask_assigneeId_status_idx" ON "ProjectTask" USING btree ("assigneeId","status");--> statement-breakpoint
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "SmartGoalVersion_smartGoalId_version_idx" ON "SmartGoalVersion" USING btree ("smartGoalId","version");--> statement-breakpoint
CREATE INDEX "EmployeeSkill_workspaceId_skill_idx" ON "EmployeeSkill" USING btree ("workspaceId","skill");--> statement-breakpoint
CREATE INDEX "LearningActivity_workspaceId_completedAt_idx" ON "LearningActivity" USING btree ("workspaceId","completedAt");--> statement-breakpoint
CREATE INDEX "LearningActivity_userId_completedAt_idx" ON "LearningActivity" USING btree ("userId","completedAt");--> statement-breakpoint
CREATE INDEX "LearningActivity_workspaceId_skill_idx" ON "LearningActivity" USING btree ("workspaceId","skill");--> statement-breakpoint
CREATE INDEX "Survey_workspaceId_createdAt_idx" ON "Survey" USING btree ("workspaceId","createdAt");--> statement-breakpoint
CREATE INDEX "Survey_userId_createdAt_idx" ON "Survey" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "AlphaDocument_userId_updatedAt_idx" ON "AlphaDocument" USING btree ("userId","updatedAt");--> statement-breakpoint
CREATE INDEX "AlphaMessage_sessionId_createdAt_idx" ON "AlphaMessage" USING btree ("sessionId","createdAt");--> statement-breakpoint
CREATE INDEX "AlphaSession_userId_createdAt_idx" ON "AlphaSession" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "AlphaSession_workspaceId_createdAt_idx" ON "AlphaSession" USING btree ("workspaceId","createdAt");--> statement-breakpoint
CREATE INDEX "Feedback_workspaceId_type_idx" ON "Feedback" USING btree ("workspaceId","type");--> statement-breakpoint
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "FeedbackCampaign_workspaceId_status_idx" ON "FeedbackCampaign" USING btree ("workspaceId","status");--> statement-breakpoint
CREATE INDEX "FeedbackCampaign_workspaceId_createdAt_idx" ON "FeedbackCampaign" USING btree ("workspaceId","createdAt");--> statement-breakpoint
CREATE INDEX "FeedbackResponse_campaignId_createdAt_idx" ON "FeedbackResponse" USING btree ("campaignId","createdAt");--> statement-breakpoint
CREATE INDEX "FeedbackResponse_workspaceId_sentiment_idx" ON "FeedbackResponse" USING btree ("workspaceId","sentiment");--> statement-breakpoint
CREATE INDEX "FeedbackResponse_workspaceId_createdAt_idx" ON "FeedbackResponse" USING btree ("workspaceId","createdAt");--> statement-breakpoint
CREATE INDEX "KnowledgeCategory_workspaceId_idx" ON "KnowledgeCategory" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "KnowledgeChunk_resourceId_ordinal_idx" ON "KnowledgeChunk" USING btree ("resourceId","ordinal");--> statement-breakpoint
CREATE INDEX "KnowledgeResource_workspaceId_status_idx" ON "KnowledgeResource" USING btree ("workspaceId","status");--> statement-breakpoint
CREATE INDEX "KnowledgeResource_workspaceId_categoryId_idx" ON "KnowledgeResource" USING btree ("workspaceId","categoryId");--> statement-breakpoint
CREATE INDEX "KnowledgeResource_workspaceId_isPremium_idx" ON "KnowledgeResource" USING btree ("workspaceId","isPremium");--> statement-breakpoint
CREATE INDEX "KnowledgeResource_workspaceId_updatedAt_idx" ON "KnowledgeResource" USING btree ("workspaceId","updatedAt");--> statement-breakpoint
CREATE INDEX "KnowledgeResourceVersion_resourceId_version_idx" ON "KnowledgeResourceVersion" USING btree ("resourceId","version");--> statement-breakpoint
CREATE INDEX "KnowledgeSuggestion_workspaceId_createdAt_idx" ON "KnowledgeSuggestion" USING btree ("workspaceId","createdAt");--> statement-breakpoint
CREATE INDEX "KnowledgeSuggestion_targetUserId_dismissed_idx" ON "KnowledgeSuggestion" USING btree ("targetUserId","dismissed");