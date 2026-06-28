-- Full-text search column for the Knowledge Hub. Idempotent.
--
-- Adds a STORED generated `searchVector` tsvector column on KnowledgeResource
-- derived from title+summary+contentText (using the 'simple' dictionary so it
-- works for any language without requiring per-language configs), plus a GIN
-- index so `plainto_tsquery('simple', ?) @@ "searchVector"` is fast.
--
-- Run by cloudbuild.yaml step 1 (and cloudbuild-migrate.yaml) before
-- drizzle-kit push. Mirrors drizzle/0003_fts.sql which is applied by
-- `drizzle-kit migrate` in tests.

ALTER TABLE "KnowledgeResource"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("summary", '') || ' ' || coalesce("contentText", ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS "KnowledgeResource_searchVector_idx"
  ON "KnowledgeResource" USING GIN ("searchVector");