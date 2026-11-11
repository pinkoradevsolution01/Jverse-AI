export type SupportedKnowledgeMimeType =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "text/plain"
  | "text/markdown";

export type KnowledgeDocumentStatus = "queued" | "extracting" | "chunking" | "embedding" | "ready" | "failed" | "deleted";

export type KnowledgeDocument = {
  id: string;
  workspaceId: string;
  ownerId: string;
  storagePath: string;
  fileName: string;
  mimeType: SupportedKnowledgeMimeType;
  byteSize: number;
  status: KnowledgeDocumentStatus;
  metadata: Record<string, unknown>;
};

export type ExtractedSegment = {
  content: string;
  metadata: Record<string, unknown>;
};

export type KnowledgeChunk = {
  documentId: string;
  workspaceId: string;
  ordinal: number;
  content: string;
  tokenEstimate: number;
  metadata: Record<string, unknown>;
};

export type KnowledgeEmbedding = {
  values: number[];
  provider: string;
  model: string;
};

export type KnowledgeCitation = {
  documentId: string;
  fileName: string;
  ordinal: number | null;
  metadata: Record<string, unknown>;
};

export type RetrievedKnowledge = {
  content: string;
  similarity: number;
  citation: KnowledgeCitation;
};

export interface DocumentExtractor {
  supports(mimeType: SupportedKnowledgeMimeType): boolean;
  extract(input: { source: Uint8Array; fileName: string; mimeType: SupportedKnowledgeMimeType }): Promise<ExtractedSegment[]>;
}

export interface KnowledgeEmbeddingProvider {
  embed(input: string[]): Promise<KnowledgeEmbedding[]>;
}
