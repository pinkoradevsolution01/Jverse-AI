"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeRetrievalService = void 0;
function diversify(matches, limit) {
    const selected = [];
    const documents = new Set();
    for (const match of matches) {
        if (selected.length >= limit)
            break;
        if (documents.has(match.citation.documentId) && selected.length < Math.ceil(limit / 2))
            continue;
        documents.add(match.citation.documentId);
        selected.push(match);
    }
    return selected;
}
class KnowledgeRetrievalService {
    repository;
    embeddingProvider;
    constructor(repository, embeddingProvider) {
        this.repository = repository;
        this.embeddingProvider = embeddingProvider;
    }
    async retrieve(input) {
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
exports.KnowledgeRetrievalService = KnowledgeRetrievalService;
