import { JVerseApiError } from "../query/errors";
import type { BrainChatRequest, BrainStreamEvent } from "./contracts";

export async function openBrainStream(request: BrainChatRequest, signal?: AbortSignal): Promise<Response> {
  const response = await fetch("/api/brain/chat/stream", { method: "POST", headers: { Accept: "text/event-stream", "Content-Type": "application/json" }, body: JSON.stringify(request), signal });
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    throw new JVerseApiError(body?.error?.code ?? "unavailable", response.status, body?.error?.message ?? "The JVerse brain is unavailable.", response.headers.get("x-correlation-id") ?? undefined);
  }
  return response;
}

export function parseBrainEvent(block: string): BrainStreamEvent | null {
  const data = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
  try { return data ? JSON.parse(data) as BrainStreamEvent : null; } catch { return null; }
}
