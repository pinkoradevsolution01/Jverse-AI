import type { AgentPlan, AgentRunStatus, ApprovalRequest } from "./agent.types";

export interface AgentExecutionRepository {
  setRunStatus(runId: string, status: AgentRunStatus, details?: Record<string, unknown>): Promise<void>;
  savePlan(runId: string, plan: AgentPlan): Promise<void>;
  saveStep(input: {
    runId: string;
    stepId: string;
    toolName: string;
    status: "started" | "completed" | "failed" | "awaiting_approval";
    result?: Record<string, unknown>;
  }): Promise<void>;
  createApproval(request: ApprovalRequest): Promise<void>;
  getApproval(runId: string, stepId: string): Promise<"approved" | "denied" | "pending" | "expired">;
  appendAudit(input: { runId: string; event: string; metadata: Record<string, unknown> }): Promise<void>;
}
