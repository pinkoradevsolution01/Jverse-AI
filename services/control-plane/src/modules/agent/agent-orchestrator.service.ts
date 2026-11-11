import type { AgentExecutionRepository } from "./agent.repository";
import type { AgentContext, AgentRunInput, AgentTool } from "./agent.types";
import { AgentExecutionService } from "./execution.service";
import { IntentDetectionService } from "./intent-detection.service";
import { PlanningService } from "./planning.service";

export interface AgentContextProvider {
  hydrate(input: AgentRunInput): Promise<AgentContext>;
}

/**
 * Coordinates intent, Phase 7 memory, Phase 8 RAG, constrained planning and
 * execution. Supabase-backed repository implementations persist each state
 * transition before a tool is called.
 */
export class JVerseAgentOrchestrator {
  constructor(
    private readonly repository: AgentExecutionRepository,
    private readonly contextProvider: AgentContextProvider,
    private readonly intentDetection: IntentDetectionService,
    private readonly planner: PlanningService,
    private readonly executor: AgentExecutionService,
    private readonly tools: AgentTool[],
  ) {}

  async run(input: AgentRunInput, signal: AbortSignal) {
    await this.repository.setRunStatus(input.runId, "planning");
    const [intent, context] = await Promise.all([
      this.intentDetection.detect(input.userMessage),
      this.contextProvider.hydrate(input),
    ]);
    await this.repository.appendAudit({
      runId: input.runId,
      event: "intent_detected",
      metadata: { name: intent.name, confidence: intent.confidence, requiresTools: intent.requiresTools },
    });

    if (!intent.requiresTools) {
      await this.repository.setRunStatus(input.runId, "completed", { mode: "model_response" });
      return { status: "completed" as const, intent, context, results: [] };
    }

    const plan = await this.planner.plan({
      intent,
      userMessage: input.userMessage,
      context,
      tools: this.tools,
    });
    await this.repository.savePlan(input.runId, plan);
    await this.repository.appendAudit({
      runId: input.runId,
      event: "plan_created",
      metadata: { stepCount: plan.steps.length, toolNames: plan.steps.map((step) => step.toolName) },
    });

    const execution = await this.executor.execute({
      runId: input.runId,
      plan,
      context,
      tools: this.tools,
      signal,
    });
    return { ...execution, intent, context, plan };
  }
}
