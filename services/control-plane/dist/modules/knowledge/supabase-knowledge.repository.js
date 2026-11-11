"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseKnowledgeRepository = void 0;
const asVector = (values) => `[${values.join(",")}]`;
const toDocument = (row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    ownerId: String(row.owner_id),
    storagePath: String(row.storage_path),
    fileName: String(row.file_name),
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    status: row.ingestion_status,
    metadata: (row.metadata ?? {}),
});
class SupabaseKnowledgeRepository {
    supabase;
    /** Construct exclusively with the control-plane's server-side Supabase client. */
    constructor(supabase) {
        this.supabase = supabase;
    }
    async getDocument(documentId) {
        const { data, error } = await this.supabase.from("knowledge_documents").select("*").eq("id", documentId).maybeSingle();
        if (error)
            throw error;
        return data ? toDocument(data) : null;
    }
    async setDocumentStatus(input) {
        const update = {
            ingestion_status: input.status,
            failure_code: input.failureCode ?? null,
            failure_message: input.failureMessage ?? null,
            chunk_count: input.chunkCount,
            embedding_provider: input.embeddingProvider,
            embedding_model: input.embeddingModel,
            ingested_at: input.status === "ready" ? new Date().toISOString() : undefined,
            updated_at: new Date().toISOString(),
        };
        const { error } = await this.supabase.from("knowledge_documents").update(update).eq("id", input.documentId);
        if (error)
            throw error;
    }
    async replaceChunks(input) {
        const { error: deleteError } = await this.supabase.from("knowledge_chunks").delete().eq("document_id", input.document.id);
        if (deleteError)
            throw deleteError;
        const { error: insertError } = await this.supabase.from("knowledge_chunks").insert(input.chunks.map((chunk) => ({
            document_id: chunk.documentId,
            workspace_id: chunk.workspaceId,
            ordinal: chunk.ordinal,
            content: chunk.content,
            token_estimate: chunk.tokenEstimate,
            metadata: chunk.metadata,
            embedding: asVector(chunk.embedding),
            embedding_provider: chunk.embeddingProvider,
            embedding_model: chunk.embeddingModel,
        })));
        if (insertError)
            throw insertError;
    }
    async findSimilar(input) {
        const { data, error } = await this.supabase.rpc("match_knowledge_chunks", {
            p_workspace_id: input.workspaceId,
            p_embedding: asVector(input.embedding),
            p_match_count: input.limit,
            p_min_similarity: input.minimumSimilarity,
        });
        if (error)
            throw error;
        return (data ?? []).map((row) => ({
            content: String(row.content),
            similarity: Number(row.similarity),
            citation: {
                documentId: String(row.document_id),
                fileName: String(row.file_name),
                ordinal: Number(row.ordinal),
                metadata: (row.metadata ?? {}),
            },
        }));
    }
}
exports.SupabaseKnowledgeRepository = SupabaseKnowledgeRepository;
