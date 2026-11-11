"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JVerseAgentOrchestrator = void 0;
/**
 * Coordinates intent, Phase 7 memory, Phase 8 RAG, constrained planning and
 * execution. Supabase-backed repository implementations persist each state
 * transition before a tool is called.
 */
class JVerseAgentOrchestrator {
    repository;
    contextProvider;
    intentDetection;
    planner;
    executor;
    tools;
    constructor(repository, contextProvider, intentDetection, planner, executor, tools) {
        this.repository = repository;
        this.contextProvider = contextProvider;
        this.intentDetection = intentDetection;
        this.planner = planner;
        this.executor = executor;
        this.tools = tools;
    }
    async run(input, signal) {
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
            return { status: "completed", intent, context, results: [] };
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
exports.JVerseAgentOrchestrator = JVerseAgentOrchestrator;
