import type { AgentContext, AgentIntent, AgentPlan, AgentTool } from "./agent.types";

export interface AgentPlanningModel {
  createPlan(input: {
    intent: AgentIntent;
    userMessage: string;
    context: AgentContext;
    tools: Array<{ name: string; risk: string }>;
  }): Promise<AgentPlan>;
}

export class PlanningService {
  constructor(private readonly model: AgentPlanningModel) {}

  async plan(input: { intent: AgentIntent; userMessage: string; context: AgentContext; tools: AgentTool[] }) {
    const plan = await this.model.createPlan({
      intent: input.intent,
      userMessage: input.userMessage,
      context: input.context,
      tools: input.tools.map((tool) => ({ name: tool.name, risk: tool.risk })),
    });
    if (!plan.goal || plan.goal.length > 1_000 || plan.steps.length > 8) {
      throw new Error("Agent plan exceeds the approved execution budget.");
    }
    return plan;
  }
}
