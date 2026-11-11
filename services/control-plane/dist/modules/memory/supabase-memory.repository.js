"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseMemoryRepository = void 0;
const toRecord = (row) => ({
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
class SupabaseMemoryRepository {
    supabase;
    /** This client must be constructed only in the trusted Node control plane. */
    constructor(supabase) {
        this.supabase = supabase;
    }
    async findLatestConversationSummary(input) {
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
        if (error)
            throw error;
        return data ? toRecord(data) : null;
    }
    async listPreferences(input) {
        const { data, error } = await this.supabase
            .from("memory_records")
            .select("*")
            .eq("workspace_id", input.workspaceId)
            .eq("user_id", input.userId)
            .eq("memory_kind", "user_preference")
            .eq("status", "active")
            .order("importance", { ascending: false });
        if (error)
            throw error;
        return (data ?? []).map(toRecord);
    }
    async findSemanticMatches(input) {
        const vector = `[${input.embedding.values.join(",")}]`;
        const { data, error } = await this.supabase.rpc("match_memory_records", {
            p_workspace_id: input.workspaceId,
            p_user_id: input.userId,
            p_embedding: vector,
            p_match_count: input.limit,
            p_min_similarity: input.minimumSimilarity,
        });
        if (error)
            throw error;
        return (data ?? []).map((row) => ({
            id: String(row.memory_id),
            workspaceId: input.workspaceId,
            userId: input.userId,
            conversationId: null,
            sourceMessageId: null,
            kind: row.memory_kind,
            content: String(row.content),
            metadata: (row.metadata ?? {}),
            importance: Number(row.importance),
            confidence: Number(row.confidence),
            lastAccessedAt: null,
            expiresAt: null,
            createdAt: new Date(0).toISOString(),
            similarity: Number(row.similarity),
        }));
    }
    async create(record) {
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
        if (error)
            throw error;
        return toRecord(data);
    }
    async putEmbedding(memoryId, embedding) {
        const { error } = await this.supabase.from("memory_embeddings").upsert({
            memory_id: memoryId,
            embedding: `[${embedding.values.join(",")}]`,
            embedding_provider: embedding.provider,
            embedding_model: embedding.model,
        });
        if (error)
            throw error;
    }
    async markAccessed(memoryIds) {
        for (const memoryId of memoryIds) {
            const { error } = await this.supabase.rpc("increment_memory_access", { p_memory_id: memoryId });
            if (error)
                throw error;
        }
    }
    async supersede(memoryIds) {
        if (!memoryIds.length)
            return;
        const { error } = await this.supabase.from("memory_records")
            .update({ status: "superseded", updated_at: new Date().toISOString() })
            .in("id", memoryIds);
        if (error)
            throw error;
    }
}
exports.SupabaseMemoryRepository = SupabaseMemoryRepository;
