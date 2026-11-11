import type { KnowledgeChunk, KnowledgeDocument, KnowledgeDocumentStatus, RetrievedKnowledge } from "./knowledge.types";

export interface KnowledgeRepository {
  getDocument(documentId: string): Promise<KnowledgeDocument | null>;
  setDocumentStatus(input: {
    documentId: string;
    status: KnowledgeDocumentStatus;
    failureCode?: string | null;
    failureMessage?: string | null;
    chunkCount?: number;
    embeddingProvider?: string | null;
    embeddingModel?: string | null;
  }): Promise<void>;
  replaceChunks(input: {
    document: KnowledgeDocument;
    chunks: Array<KnowledgeChunk & { embedding: number[]; embeddingProvider: string; embeddingModel: string }>;
  }): Promise<void>;
  findSimilar(input: {
    workspaceId: string;
    embedding: number[];
    limit: number;
    minimumSimilarity: number;
  }): Promise<RetrievedKnowledge[]>;
}

export interface KnowledgeSourceStore {
  download(storagePath: string): Promise<Uint8Array>;
}
