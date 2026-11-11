import type { KnowledgeRepository, KnowledgeSourceStore } from "./knowledge.repository";
import type { DocumentExtractor, KnowledgeChunk, KnowledgeDocument, KnowledgeEmbeddingProvider } from "./knowledge.types";

const MAX_SEGMENT_CHARACTERS = 3_600;
const OVERLAP_CHARACTERS = 360;

function estimateTokens(content: string) {
  return Math.ceil(content.length / 4);
}

function splitSegment(content: string) {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + MAX_SEGMENT_CHARACTERS);
    const boundary = normalized.lastIndexOf("\n", end);
    const nextEnd = boundary > start + Math.floor(MAX_SEGMENT_CHARACTERS / 2) ? boundary : end;
    chunks.push(normalized.slice(start, nextEnd).trim());
    if (nextEnd === normalized.length) break;
    start = Math.max(nextEnd - OVERLAP_CHARACTERS, start + 1);
  }
  return chunks.filter(Boolean);
}

export class KnowledgeIngestionOrchestrator {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly sourceStore: KnowledgeSourceStore,
    private readonly extractors: DocumentExtractor[],
    private readonly embeddingProvider: KnowledgeEmbeddingProvider,
  ) {}

  async ingest(documentId: string) {
    const document = await this.repository.getDocument(documentId);
    if (!document || document.status === "deleted") return;

    try {
      await this.repository.setDocumentStatus({ documentId, status: "extracting" });
      const extractor = this.extractors.find((candidate) => candidate.supports(document.mimeType));
      if (!extractor) throw new Error("unsupported_extractor");

      const source = await this.sourceStore.download(document.storagePath);
      const segments = await extractor.extract({ source, fileName: document.fileName, mimeType: document.mimeType });
      await this.repository.setDocumentStatus({ documentId, status: "chunking" });

      const chunks = this.toChunks(document, segments);
      if (!chunks.length) throw new Error("empty_document");
      await this.repository.setDocumentStatus({ documentId, status: "embedding" });

      const embeddings = await this.embeddingProvider.embed(chunks.map((chunk) => chunk.content));
      if (embeddings.length !== chunks.length) throw new Error("embedding_count_mismatch");

      await this.repository.replaceChunks({
        document,
        chunks: chunks.map((chunk, index) => ({
          ...chunk,
          embedding: embeddings[index].values,
          embeddingProvider: embeddings[index].provider,
          embeddingModel: embeddings[index].model,
        })),
      });
      await this.repository.setDocumentStatus({
        documentId,
        status: "ready",
        chunkCount: chunks.length,
        embeddingProvider: embeddings[0].provider,
        embeddingModel: embeddings[0].model,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "knowledge_ingestion_failed";
      await this.repository.setDocumentStatus({
        documentId,
        status: "failed",
        failureCode: message.slice(0, 80),
        failureMessage: "The document could not be processed. Review the source file and retry.",
      });
    }
  }

  private toChunks(document: KnowledgeDocument, segments: Array<{ content: string; metadata: Record<string, unknown> }>) {
    const chunks: KnowledgeChunk[] = [];
    for (const segment of segments) {
      for (const content of splitSegment(segment.content)) {
        chunks.push({
          documentId: document.id,
          workspaceId: document.workspaceId,
          ordinal: chunks.length,
          content,
          tokenEstimate: estimateTokens(content),
          metadata: segment.metadata,
        });
      }
    }
    return chunks;
  }
}
