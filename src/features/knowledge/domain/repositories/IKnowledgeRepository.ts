import type {
  KnowledgeCategory,
  KnowledgeResource,
  KnowledgeResourceVersion,
  KnowledgeResourceWithRelations,
  KnowledgeSuggestion,
  KnowledgeAccessLevel,
  KnowledgeFileType,
} from "../entities/KnowledgeResource";

export interface CreateCategoryInput {
  workspaceId: string;
  key: string;
  name: string;
  color?: string;
  icon?: string;
}

export interface CreateResourceInput {
  workspaceId: string;
  categoryId?: string | null;
  title: string;
  contentText: string;
  summary?: string;
  fileType?: KnowledgeFileType;
  storageKey?: string | null;
  sourceUrl?: string | null;
  sourceApp?: string | null;
  sourceType?: string;
  authorId?: string | null;
  projectId?: string | null;
  accessLevel?: KnowledgeAccessLevel;
  isPremium?: boolean;
  tags?: string[];
  keywords?: string[];
  aiMetadata?: Record<string, unknown> | null;
  createdById?: string | null;
}

export interface UpdateResourceInput {
  title?: string;
  summary?: string | null;
  contentText?: string;
  categoryId?: string | null;
  accessLevel?: KnowledgeAccessLevel;
  isPremium?: boolean;
  tags?: string[];
  keywords?: string[];
  status?: "active" | "processing" | "archived";
  aiMetadata?: Record<string, unknown> | null;
}

export interface ListResourcesFilter {
  workspaceId: string;
  categoryId?: string;
  tag?: string;
  isPremium?: boolean;
  fileType?: KnowledgeFileType;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SemanticSearchHit {
  resourceId: string;
  chunkId: string;
  score: number;
  snippet: string;
}

export interface SemanticSearchResult {
  hits: SemanticSearchHit[];
  query: string;
}

/**
 * Repository contract for the Knowledge Hub. Infrastructure (Prisma) implements
 * this; application use-cases depend on the interface (Dependency Inversion).
 */
export interface IKnowledgeRepository {
  // Categories
  listCategories(workspaceId: string): Promise<KnowledgeCategory[]>;
  createCategory(input: CreateCategoryInput): Promise<KnowledgeCategory>;
  findCategoryByKey(workspaceId: string, key: string): Promise<KnowledgeCategory | null>;

  // Resources
  get(id: string): Promise<KnowledgeResourceWithRelations | null>;
  list(filter: ListResourcesFilter): Promise<KnowledgeResourceWithRelations[]>;
  count(filter: ListResourcesFilter): Promise<number>;
  create(input: CreateResourceInput): Promise<KnowledgeResource>;
  update(id: string, patch: UpdateResourceInput): Promise<KnowledgeResource>;
  delete(id: string): Promise<void>;
  incrementView(id: string): Promise<void>;
  incrementUse(id: string): Promise<void>;

  // Chunks (RAG source text)
  replaceChunks(
    resourceId: string,
    chunks: { text: string; tokenCount?: number }[]
  ): Promise<{ id: string; ordinal: number; text: string; tokenCount: number | null }[]>;
  listChunks(resourceId: string): Promise<{ id: string; ordinal: number; text: string; tokenCount: number | null }[]>;
  getChunk(chunkId: string): Promise<{ id: string; resourceId: string; ordinal: number; text: string } | null>;

  // Versions
  listVersions(resourceId: string): Promise<KnowledgeResourceVersion[]>;
  addVersion(input: Omit<KnowledgeResourceVersion, "id" | "createdAt">): Promise<KnowledgeResourceVersion>;

  // Suggestions
  listSuggestions(workspaceId: string, targetUserId?: string): Promise<KnowledgeSuggestion[]>;
  addSuggestion(input: { workspaceId: string; resourceId?: string | null; targetUserId?: string | null; reason: string; kind?: string }): Promise<KnowledgeSuggestion>;
  dismissSuggestion(id: string): Promise<void>;
}
