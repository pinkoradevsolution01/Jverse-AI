"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentExecutionService = void 0;
class AgentExecutionService {
    repository;
    safety;
    constructor(repository, safety) {
        this.repository = repository;
        this.safety = safety;
    }
    async execute(input) {
        const tools = new Map(input.tools.map((tool) => [tool.name, tool]));
        if (!this.safety.validatePlan(input.plan, tools, input.context)) {
            await this.repository.setRunStatus(input.runId, "failed", { code: "invalid_plan" });
            throw new Error("The requested agent plan is not allowed.");
        }
        await this.repository.setRunStatus(input.runId, "executing");
        const results = [];
        for (const step of input.plan.steps) {
            if (input.signal.aborted) {
                await this.repository.setRunStatus(input.runId, "cancelled");
                return { status: "cancelled", results };
            }
            const tool = tools.get(step.toolName);
            if (this.safety.requiresApproval(tool)) {
                const approval = await this.repository.getApproval(input.runId, step.id);
                if (approval !== "approved") {
                    if (approval === "denied" || approval === "expired") {
                        await this.repository.setRunStatus(input.runId, "cancelled", { approval });
                        return { status: "cancelled", results };
                    }
                    await this.repository.createApproval(this.safety.approvalFor({
                        runId: input.runId,
                        stepId: step.id,
                        tool,
                        rationale: step.rationale,
                    }));
                    await this.repository.saveStep({ runId: input.runId, stepId: step.id, toolName: tool.name, status: "awaiting_approval" });
                    await this.repository.setRunStatus(input.runId, "awaiting_approval");
                    return { status: "awaiting_approval", results };
                }
            }
            await this.repository.saveStep({ runId: input.runId, stepId: step.id, toolName: tool.name, status: "started" });
            try {
                const result = await tool.execute(step.input, input.context, input.signal);
                await this.repository.saveStep({
                    runId: input.runId,
                    stepId: step.id,
                    toolName: tool.name,
                    status: result.ok ? "completed" : "failed",
                    result: { ok: result.ok, summary: result.summary.slice(0, 2_000) },
                });
                if (!result.ok) {
                    await this.repository.setRunStatus(input.runId, "failed", { tool: tool.name });
                    return { status: "failed", results };
                }
                results.push(result.summary);
            }
            catch {
                await this.repository.saveStep({ runId: input.runId, stepId: step.id, toolName: tool.name, status: "failed" });
                await this.repository.setRunStatus(input.runId, "failed", { tool: tool.name });
                return { status: "failed", results };
            }
        }
        await this.repository.setRunStatus(input.runId, "completed");
        return { status: "completed", results };
    }
}
exports.AgentExecutionService = AgentExecutionService;
