export type MemoryKind = "long_term_fact" | "conversation_summary" | "user_preference";

export type MemoryRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  kind: MemoryKind;
  content: string;
  metadata: Record<string, unknown>;
  importance: number;
  confidence: number;
  lastAccessedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type MemoryMatch = MemoryRecord & { similarity: number };

export type MemoryTurn = {
  role: "user" | "assistant" | "tool";
  content: string;
};

export type MemoryContextRequest = {
  workspaceId: string;
  userId: string;
  conversationId: string | null;
  userMessage: string;
  shortTermTurns: MemoryTurn[];
  maxCharacters: number;
};

export type ContextBlock = {
  source: "preference" | "conversation_summary" | "long_term" | "short_term";
  content: string;
  memoryId?: string;
  score?: number;
};

export type Embedding = {
  values: number[];
  provider: string;
  model: string;
};

export interface MemoryEmbeddingProvider {
  embed(input: string): Promise<Embedding>;
}
