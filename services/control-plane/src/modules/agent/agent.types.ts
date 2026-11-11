export type AgentRunStatus = "queued" | "planning" | "awaiting_approval" | "executing" | "completed" | "cancelled" | "failed";
export type ToolRisk = "read" | "mutation" | "desktop" | "external";

export type AgentIntent = {
  name: string;
  confidence: number;
  requiresTools: boolean;
  summary: string;
};

export type AgentToolCall = {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  rationale: string;
};

export type AgentPlan = {
  goal: string;
  steps: AgentToolCall[];
};

export type AgentRunInput = {
  runId: string;
  workspaceId: string;
  userId: string;
  conversationId: string | null;
  userMessage: string;
};

export type AgentContext = {
  workspaceId: string;
  userId: string;
  conversationId: string | null;
  memory: string;
  knowledge: Array<{ content: string; citation: Record<string, unknown> }>;
};

export type AgentToolResult = {
  ok: boolean;
  summary: string;
  data?: Record<string, unknown>;
  retryable?: boolean;
};

export type ApprovalRequest = {
  runId: string;
  stepId: string;
  toolName: string;
  risk: Exclude<ToolRisk, "read">;
  summary: string;
  expiresAt: string;
};

export interface AgentTool {
  name: string;
  risk: ToolRisk;
  idempotent: boolean;
  validate(input: Record<string, unknown>, context: AgentContext): boolean;
  execute(input: Record<string, unknown>, context: AgentContext, signal: AbortSignal): Promise<AgentToolResult>;
}
