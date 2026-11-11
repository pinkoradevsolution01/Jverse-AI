import type { SupabaseClient } from "@supabase/supabase-js";

import type { KnowledgeRepository } from "./knowledge.repository";
import type { KnowledgeDocument, KnowledgeDocumentStatus, RetrievedKnowledge } from "./knowledge.types";

const asVector = (values: number[]) => `[${values.join(",")}]`;

const toDocument = (row: Record<string, unknown>): KnowledgeDocument => ({
  id: String(row.id),
  workspaceId: String(row.workspace_id),
  ownerId: String(row.owner_id),
  storagePath: String(row.storage_path),
  fileName: String(row.file_name),
  mimeType: row.mime_type as KnowledgeDocument["mimeType"],
  byteSize: Number(row.byte_size),
  status: row.ingestion_status as KnowledgeDocument["status"],
  metadata: (row.metadata ?? {}) as Record<string, unknown>,
});

export class SupabaseKnowledgeRepository implements KnowledgeRepository {
  /** Construct exclusively with the control-plane's server-side Supabase client. */
  constructor(private readonly supabase: SupabaseClient) {}

  async getDocument(documentId: string) {
    const { data, error } = await this.supabase.from("knowledge_documents").select("*").eq("id", documentId).maybeSingle();
    if (error) throw error;
    return data ? toDocument(data as Record<string, unknown>) : null;
  }

  async setDocumentStatus(input: {
    documentId: string;
    status: KnowledgeDocumentStatus;
    failureCode?: string | null;
    failureMessage?: string | null;
    chunkCount?: number;
    embeddingProvider?: string | null;
    embeddingModel?: string | null;
  }) {
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
    if (error) throw error;
  }

  async replaceChunks(input: {
    document: KnowledgeDocument;
    chunks: Array<{ documentId: string; workspaceId: string; ordinal: number; content: string; tokenEstimate: number; metadata: Record<string, unknown>; embedding: number[]; embeddingProvider: string; embeddingModel: string }>;
  }) {
    const { error: deleteError } = await this.supabase.from("knowledge_chunks").delete().eq("document_id", input.document.id);
    if (deleteError) throw deleteError;
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
    if (insertError) throw insertError;
  }

  async findSimilar(input: { workspaceId: string; embedding: number[]; limit: number; minimumSimilarity: number }) {
    const { data, error } = await this.supabase.rpc("match_knowledge_chunks", {
      p_workspace_id: input.workspaceId,
      p_embedding: asVector(input.embedding),
      p_match_count: input.limit,
      p_min_similarity: input.minimumSimilarity,
    });
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => ({
      content: String(row.content),
      similarity: Number(row.similarity),
      citation: {
        documentId: String(row.document_id),
        fileName: String(row.file_name),
        ordinal: Number(row.ordinal),
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
      },
    })) as RetrievedKnowledge[];
  }
}
