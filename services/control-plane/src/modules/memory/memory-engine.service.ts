import type { MemoryRepository } from "./memory.repository";
import type {
  ContextBlock,
  MemoryContextRequest,
  MemoryEmbeddingProvider,
  MemoryMatch,
  MemoryRecord,
} from "./memory.types";

const CHARACTER_OVERHEAD = 30;

function isUsable(record: MemoryRecord) {
  return !record.expiresAt || new Date(record.expiresAt).getTime() > Date.now();
}

function recencyScore(timestamp: string | null) {
  if (!timestamp) return 0;
  const ageDays = Math.max(0, (Date.now() - new Date(timestamp).getTime()) / 86_400_000);
  return Math.exp(-ageDays / 45);
}

function rank(match: MemoryMatch) {
  return (
    match.similarity * 0.58 +
    (match.importance / 100) * 0.20 +
    match.confidence * 0.14 +
    recencyScore(match.lastAccessedAt || match.createdAt) * 0.08
  );
}

function withinBudget(blocks: ContextBlock[], maximum: number) {
  let remaining = maximum;
  return blocks.filter((block) => {
    const cost = block.content.length + CHARACTER_OVERHEAD;
    if (cost > remaining) return false;
    remaining -= cost;
    return true;
  });
}

export class MemoryEngineService {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly embeddingProvider: MemoryEmbeddingProvider,
  ) {}

  async buildContext(input: MemoryContextRequest): Promise<ContextBlock[]> {
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
    const blocks: ContextBlock[] = [
      ...preferences
        .filter(isUsable)
        .sort((left, right) => right.confidence - left.confidence || right.importance - left.importance)
        .map((memory) => ({ source: "preference" as const, content: memory.content, memoryId: memory.id })),
      ...(summary && isUsable(summary)
        ? [{ source: "conversation_summary" as const, content: summary.content, memoryId: summary.id }]
        : []),
      ...longTerm.map((memory) => ({
        source: "long_term" as const,
        content: memory.content,
        memoryId: memory.id,
        score: rank(memory),
      })),
      ...input.shortTermTurns.map((turn) => ({
        source: "short_term" as const,
        content: `${turn.role}: ${turn.content}`,
      })),
    ];

    const selected = withinBudget(blocks, input.maxCharacters);
    const accessedMemoryIds = selected.flatMap((block) => (block.memoryId ? [block.memoryId] : []));
    if (accessedMemoryIds.length) void this.repository.markAccessed(accessedMemoryIds);
    return selected;
  }
}
