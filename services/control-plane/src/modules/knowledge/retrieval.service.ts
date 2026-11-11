import type { KnowledgeRepository } from "./knowledge.repository";
import type { KnowledgeEmbeddingProvider, RetrievedKnowledge } from "./knowledge.types";

function diversify(matches: RetrievedKnowledge[], limit: number) {
  const selected: RetrievedKnowledge[] = [];
  const documents = new Set<string>();
  for (const match of matches) {
    if (selected.length >= limit) break;
    if (documents.has(match.citation.documentId) && selected.length < Math.ceil(limit / 2)) continue;
    documents.add(match.citation.documentId);
    selected.push(match);
  }
  return selected;
}

export class KnowledgeRetrievalService {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly embeddingProvider: KnowledgeEmbeddingProvider,
  ) {}

  async retrieve(input: { workspaceId: string; query: string; maximumChunks: number; minimumSimilarity?: number }) {
    const [queryEmbedding] = await this.embeddingProvider.embed([input.query]);
    const candidates = await this.repository.findSimilar({
      workspaceId: input.workspaceId,
      embedding: queryEmbedding.values,
      limit: Math.min(20, Math.max(input.maximumChunks * 3, 8)),
      minimumSimilarity: input.minimumSimilarity ?? 0.30,
    });
    return diversify(candidates, input.maximumChunks);
  }
}
