ALTER TABLE "KnowledgeResource"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("summary", '') || ' ' || coalesce("contentText", ''))
  ) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "KnowledgeResource_searchVector_idx"
  ON "KnowledgeResource" USING GIN ("searchVector");