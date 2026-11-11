import type { SupabaseClient } from "@supabase/supabase-js";

import type { MemoryRepository } from "./memory.repository";
import type { Embedding, MemoryMatch, MemoryRecord } from "./memory.types";

type DatabaseMemoryRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  conversation_id: string | null;
  source_message_id: string | null;
  memory_kind: MemoryRecord["kind"];
  content: string;
  metadata: Record<string, unknown>;
  importance: number;
  confidence: number;
  last_accessed_at: string | null;
  expires_at: string | null;
  created_at: string;
};

const toRecord = (row: DatabaseMemoryRow): MemoryRecord => ({
  id: row.id,
  workspaceId: row.workspace_id,
  userId: row.user_id,
  conversationId: row.conversation_id,
  sourceMessageId: row.source_message_id,
  kind: row.memory_kind,
  content: row.content,
  metadata: row.metadata,
  importance: row.importance,
  confidence: row.confidence,
  lastAccessedAt: row.last_accessed_at,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
});

export class SupabaseMemoryRepository implements MemoryRepository {
  /** This client must be constructed only in the trusted Node control plane. */
  constructor(private readonly supabase: SupabaseClient) {}

  async findLatestConversationSummary(input: { workspaceId: string; userId: string; conversationId: string }) {
    const { data, error } = await this.supabase
      .from("memory_records")
      .select("*")
      .eq("workspace_id", input.workspaceId)
      .eq("user_id", input.userId)
      .eq("conversation_id", input.conversationId)
      .eq("memory_kind", "conversation_summary")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? toRecord(data as DatabaseMemoryRow) : null;
  }

  async listPreferences(input: { workspaceId: string; userId: string }) {
    const { data, error } = await this.supabase
      .from("memory_records")
      .select("*")
      .eq("workspace_id", input.workspaceId)
      .eq("user_id", input.userId)
      .eq("memory_kind", "user_preference")
      .eq("status", "active")
      .order("importance", { ascending: false });
    if (error) throw error;
    return (data as DatabaseMemoryRow[] | null ?? []).map(toRecord);
  }

  async findSemanticMatches(input: { workspaceId: string; userId: string; embedding: Embedding; limit: number; minimumSimilarity: number }) {
    const vector = `[${input.embedding.values.join(",")}]`;
    const { data, error } = await this.supabase.rpc("match_memory_records", {
      p_workspace_id: input.workspaceId,
      p_user_id: input.userId,
      p_embedding: vector,
      p_match_count: input.limit,
      p_min_similarity: input.minimumSimilarity,
    });
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.memory_id),
      workspaceId: input.workspaceId,
      userId: input.userId,
      conversationId: null,
      sourceMessageId: null,
      kind: row.memory_kind as MemoryRecord["kind"],
      content: String(row.content),
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      importance: Number(row.importance),
      confidence: Number(row.confidence),
      lastAccessedAt: null,
      expiresAt: null,
      createdAt: new Date(0).toISOString(),
      similarity: Number(row.similarity),
    })) as MemoryMatch[];
  }

  async create(record: Omit<MemoryRecord, "id" | "createdAt" | "lastAccessedAt">) {
    const { data, error } = await this.supabase.from("memory_records").insert({
      workspace_id: record.workspaceId,
      user_id: record.userId,
      conversation_id: record.conversationId,
      source_message_id: record.sourceMessageId,
      memory_kind: record.kind,
      content: record.content,
      metadata: record.metadata,
      importance: record.importance,
      confidence: record.confidence,
      expires_at: record.expiresAt,
    }).select("*").single();
    if (error) throw error;
    return toRecord(data as DatabaseMemoryRow);
  }

  async putEmbedding(memoryId: string, embedding: Embedding) {
    const { error } = await this.supabase.from("memory_embeddings").upsert({
      memory_id: memoryId,
      embedding: `[${embedding.values.join(",")}]`,
      embedding_provider: embedding.provider,
      embedding_model: embedding.model,
    });
    if (error) throw error;
  }

  async markAccessed(memoryIds: string[]) {
    for (const memoryId of memoryIds) {
      const { error } = await this.supabase.rpc("increment_memory_access", { p_memory_id: memoryId });
      if (error) throw error;
    }
  }

  async supersede(memoryIds: string[]) {
    if (!memoryIds.length) return;
    const { error } = await this.supabase.from("memory_records")
      .update({ status: "superseded", updated_at: new Date().toISOString() })
      .in("id", memoryIds);
    if (error) throw error;
  }
}
