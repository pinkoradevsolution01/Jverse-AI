import express from "express";
import { createClient } from "@supabase/supabase-js";

import { ChatRepository } from "./chat/chat.repository";
import { ChatService } from "./chat/chat.service";
import { loadConfig } from "./config";
import { OllamaLocalGateway } from "./desktop/ollama-local.gateway";
import { createChatRoute } from "./http/chat.route";

const config = loadConfig();
const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const provider = new OllamaLocalGateway(config.ollamaBaseUrl);
const chat = new ChatService(new ChatRepository(supabase), provider);
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.get("/health", (_request, response) => response.json({ status: "ok", provider: "ollama-local", model: "qwen2.5:7b" }));
app.post("/v1/chat/stream", createChatRoute({
  controlPlaneToken: config.controlPlaneToken,
  chat,
}));
app.listen(config.port, "127.0.0.1", () => {
  console.log(`JVerse control plane listening on 127.0.0.1:${config.port}`);
});
