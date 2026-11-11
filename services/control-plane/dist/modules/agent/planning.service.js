"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanningService = void 0;
class PlanningService {
    model;
    constructor(model) {
        this.model = model;
    }
    async plan(input) {
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
exports.PlanningService = PlanningService;
