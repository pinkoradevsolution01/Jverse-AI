import type { AgentIntent } from "./agent.types";

export interface IntentModel {
  classifyIntent(message: string): Promise<AgentIntent>;
}

export class IntentDetectionService {
  constructor(private readonly model: IntentModel) {}

  async detect(message: string): Promise<AgentIntent> {
    const intent = await this.model.classifyIntent(message);
    return {
      name: intent.name.slice(0, 80),
      confidence: Math.max(0, Math.min(1, intent.confidence)),
      requiresTools: Boolean(intent.requiresTools),
      summary: intent.summary.slice(0, 500),
    };
  }
}
