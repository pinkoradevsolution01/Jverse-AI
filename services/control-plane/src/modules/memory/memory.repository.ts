import type { Embedding, MemoryKind, MemoryMatch, MemoryRecord } from "./memory.types";

export interface MemoryRepository {
  findLatestConversationSummary(input: {
    workspaceId: string;
    userId: string;
    conversationId: string;
  }): Promise<MemoryRecord | null>;
  listPreferences(input: { workspaceId: string; userId: string }): Promise<MemoryRecord[]>;
  findSemanticMatches(input: {
    workspaceId: string;
    userId: string;
    embedding: Embedding;
    limit: number;
    minimumSimilarity: number;
  }): Promise<MemoryMatch[]>;
  create(record: Omit<MemoryRecord, "id" | "createdAt" | "lastAccessedAt">): Promise<MemoryRecord>;
  putEmbedding(memoryId: string, embedding: Embedding): Promise<void>;
  markAccessed(memoryIds: string[]): Promise<void>;
  supersede(memoryIds: string[]): Promise<void>;
}

export type MemoryCandidate = {
  workspaceId: string;
  userId: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  kind: Exclude<MemoryKind, "conversation_summary">;
  content: string;
  metadata: Record<string, unknown>;
  importance: number;
  confidence: number;
  expiresAt: string | null;
};
