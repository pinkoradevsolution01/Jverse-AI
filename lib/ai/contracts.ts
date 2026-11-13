/** Balanced local profile for 8 GB Windows desktops. */
export const DEFAULT_QWEN_MODEL = "qwen2.5:1.5b";

export type ChatStreamRequest = {
  conversationId: string | null;
  workspaceId: string;
  message: string;
  model: string;
};

export type ChatStreamEvent =
  | { type: "metadata"; conversationId: string; messageId: string }
  | { type: "delta"; text: string }
  | { type: "done"; usage?: { inputTokens?: number; outputTokens?: number } }
  | { type: "status"; state: string; intent?: string; plan?: string[] }
  | { type: "tool"; result: string }
  | { type: "approval"; actionId: string; targetSummary: string; expiresAt?: string }
  | { type: "error"; code: string; message: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseChatStreamRequest(value: unknown): ChatStreamRequest | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  const message = typeof candidate.message === "string" ? candidate.message.trim() : "";
  const workspaceId = typeof candidate.workspaceId === "string" ? candidate.workspaceId : "";
  const conversationId = candidate.conversationId === null || candidate.conversationId === undefined
    ? null
    : typeof candidate.conversationId === "string"
      ? candidate.conversationId
      : "";
  const model = typeof candidate.model === "string" && candidate.model.trim()
    ? candidate.model.trim()
    : DEFAULT_QWEN_MODEL;

  if (!message || message.length > 24_000 || !UUID_PATTERN.test(workspaceId)) return null;
  if (conversationId !== null && !UUID_PATTERN.test(conversationId)) return null;

  return { conversationId, workspaceId, message, model };
}
