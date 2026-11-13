import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

import type { ChatService } from "../chat/chat.service";
import type { ProviderEvent } from "../desktop/desktop-provider.gateway";

function sameSecret(received: string | undefined, expected: string) {
  if (!received) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function validRequest(body: unknown): body is { workspaceId: string; conversationId: string | null; message: string; model: string } {
  if (!body || typeof body !== "object") return false;
  const value = body as Record<string, unknown>;
  return typeof value.workspaceId === "string"
    && (value.conversationId === null || typeof value.conversationId === "string")
    && typeof value.message === "string" && value.message.length > 0 && value.message.length <= 24_000
    && value.model === "qwen2.5:1.5b";
}

function writeEvent(response: Response, event: ProviderEvent) {
  response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export function createChatRoute(input: { controlPlaneToken: string; chat: ChatService }) {
  return async (request: Request, response: Response) => {
    if (!sameSecret(request.header("X-JVerse-Control-Plane-Token"), input.controlPlaneToken)) {
      response.status(401).json({ error: "unauthorized_control_plane_request" });
      return;
    }
    const userId = request.header("X-JVerse-User-Id");
    if (!userId || !validRequest(request.body)) {
      response.status(400).json({ error: "invalid_chat_request" });
      return;
    }

    response.status(200).set({
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    });
    response.flushHeaders();

    const controller = new AbortController();
    request.on("close", () => controller.abort());
    try {
      for await (const event of input.chat.stream({ ...request.body, userId, signal: controller.signal })) {
        writeEvent(response, event);
        if (event.type === "error" || event.type === "done") break;
      }
    } catch (error) {
      const message = error instanceof Error && error.message === "workspace_access_denied"
        ? "You do not have access to this workspace."
        : error instanceof Error && error.message === "conversation_not_found"
          ? "This conversation could not be found."
          : "Chat history could not be prepared.";
      writeEvent(response, { type: "error", code: "chat_context_failed", message });
    }
    response.end();
  };
}
