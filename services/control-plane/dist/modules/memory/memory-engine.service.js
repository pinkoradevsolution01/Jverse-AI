"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryEngineService = void 0;
const CHARACTER_OVERHEAD = 30;
function isUsable(record) {
    return !record.expiresAt || new Date(record.expiresAt).getTime() > Date.now();
}
function recencyScore(timestamp) {
    if (!timestamp)
        return 0;
    const ageDays = Math.max(0, (Date.now() - new Date(timestamp).getTime()) / 86_400_000);
    return Math.exp(-ageDays / 45);
}
function rank(match) {
    return (match.similarity * 0.58 +
        (match.importance / 100) * 0.20 +
        match.confidence * 0.14 +
        recencyScore(match.lastAccessedAt || match.createdAt) * 0.08);
}
function withinBudget(blocks, maximum) {
    let remaining = maximum;
    return blocks.filter((block) => {
        const cost = block.content.length + CHARACTER_OVERHEAD;
        if (cost > remaining)
            return false;
        remaining -= cost;
        return true;
    });
}
class MemoryEngineService {
    repository;
    embeddingProvider;
    constructor(repository, embeddingProvider) {
        this.repository = repository;
        this.embeddingProvider = embeddingProvider;
    }
    async buildContext(input) {
        const preferencesPromise = this.repository.listPreferences({
            workspaceId: input.workspaceId,
            userId: input.userId,
        });
        const summaryPromise = input.conversationId
            ? this.repository.findLatestConversationSummary({
                workspaceId: input.workspaceId,
                userId: input.userId,
                conversationId: input.conversationId,
            })
            : Promise.resolve(null);
        const embeddingPromise = this.embeddingProvider.embed(input.userMessage);
        const [preferences, summary, embedding] = await Promise.all([
            preferencesPromise,
            summaryPromise,
            embeddingPromise,
        ]);
        const matches = await this.repository.findSemanticMatches({
            workspaceId: input.workspaceId,
            userId: input.userId,
            embedding,
            limit: 12,
            minimumSimilarity: 0.30,
        });
        const summaryId = summary?.id;
        const longTerm = matches
            .filter((match) => match.id !== summaryId && match.kind === "long_term_fact" && isUsable(match))
            .sort((left, right) => rank(right) - rank(left));
        const blocks = [
            ...preferences
                .filter(isUsable)
                .sort((left, right) => right.confidence - left.confidence || right.importance - left.importance)
                .map((memory) => ({ source: "preference", content: memory.content, memoryId: memory.id })),
            ...(summary && isUsable(summary)
                ? [{ source: "conversation_summary", content: summary.content, memoryId: summary.id }]
                : []),
            ...longTerm.map((memory) => ({
                source: "long_term",
                content: memory.content,
                memoryId: memory.id,
                score: rank(memory),
            })),
            ...input.shortTermTurns.map((turn) => ({
                source: "short_term",
                content: `${turn.role}: ${turn.content}`,
            })),
        ];
        const selected = withinBudget(blocks, input.maxCharacters);
        const accessedMemoryIds = selected.flatMap((block) => (block.memoryId ? [block.memoryId] : []));
        if (accessedMemoryIds.length)
            void this.repository.markAccessed(accessedMemoryIds);
        return selected;
    }
}
exports.MemoryEngineService = MemoryEngineService;
