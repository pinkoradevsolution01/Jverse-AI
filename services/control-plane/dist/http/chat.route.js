"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChatRoute = createChatRoute;
const node_crypto_1 = require("node:crypto");
function sameSecret(received, expected) {
    if (!received)
        return false;
    const left = Buffer.from(received);
    const right = Buffer.from(expected);
    return left.length === right.length && (0, node_crypto_1.timingSafeEqual)(left, right);
}
function validRequest(body) {
    if (!body || typeof body !== "object")
        return false;
    const value = body;
    return typeof value.workspaceId === "string"
        && (value.conversationId === null || typeof value.conversationId === "string")
        && typeof value.message === "string" && value.message.length > 0 && value.message.length <= 24_000
        && value.model === "qwen2.5:7b";
}
function writeEvent(response, event) {
    response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}
function createChatRoute(input) {
    return async (request, response) => {
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
                if (event.type === "error" || event.type === "done")
                    break;
            }
        }
        catch (error) {
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
