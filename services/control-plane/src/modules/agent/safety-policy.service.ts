import type { AgentContext, AgentPlan, AgentTool, ApprovalRequest } from "./agent.types";

export class AgentSafetyPolicy {
  validatePlan(plan: AgentPlan, tools: Map<string, AgentTool>, context: AgentContext) {
    const seen = new Set<string>();
    for (const step of plan.steps) {
      if (!step.id || seen.has(step.id) || step.rationale.length > 1_000) return false;
      seen.add(step.id);
      const tool = tools.get(step.toolName);
      if (!tool || !tool.validate(step.input, context)) return false;
    }
    return true;
  }

  requiresApproval(tool: AgentTool) {
    return tool.risk !== "read";
  }

  approvalFor(input: { runId: string; stepId: string; tool: AgentTool; rationale: string }): ApprovalRequest {
    return {
      runId: input.runId,
      stepId: input.stepId,
      toolName: input.tool.name,
      risk: input.tool.risk as Exclude<AgentTool["risk"], "read">,
      summary: input.rationale.slice(0, 1_000),
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    };
  }
}
