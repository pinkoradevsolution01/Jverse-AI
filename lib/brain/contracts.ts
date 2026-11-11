export type BrainEventType = "metadata" | "status" | "delta" | "approval" | "tool" | "error" | "done";

export type BrainStreamEvent = {
  version: "v1";
  type: BrainEventType;
  run_id: string;
  sequence: number;
  correlation_id: string;
  payload: Record<string, unknown>;
};

export type BrainChatRequest = { workspaceId: string; conversationId: string | null; message: string; model: string };
