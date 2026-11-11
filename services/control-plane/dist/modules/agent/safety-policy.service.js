"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentSafetyPolicy = void 0;
class AgentSafetyPolicy {
    validatePlan(plan, tools, context) {
        const seen = new Set();
        for (const step of plan.steps) {
            if (!step.id || seen.has(step.id) || step.rationale.length > 1_000)
                return false;
            seen.add(step.id);
            const tool = tools.get(step.toolName);
            if (!tool || !tool.validate(step.input, context))
                return false;
        }
        return true;
    }
    requiresApproval(tool) {
        return tool.risk !== "read";
    }
    approvalFor(input) {
        return {
            runId: input.runId,
            stepId: input.stepId,
            toolName: input.tool.name,
            risk: input.tool.risk,
            summary: input.rationale.slice(0, 1_000),
            expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        };
    }
}
exports.AgentSafetyPolicy = AgentSafetyPolicy;
