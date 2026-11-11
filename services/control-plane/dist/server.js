"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supabase_js_1 = require("@supabase/supabase-js");
const chat_repository_1 = require("./chat/chat.repository");
const chat_service_1 = require("./chat/chat.service");
const config_1 = require("./config");
const ollama_local_gateway_1 = require("./desktop/ollama-local.gateway");
const chat_route_1 = require("./http/chat.route");
const config = (0, config_1.loadConfig)();
const supabase = (0, supabase_js_1.createClient)(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});
const provider = new ollama_local_gateway_1.OllamaLocalGateway(config.ollamaBaseUrl);
const chat = new chat_service_1.ChatService(new chat_repository_1.ChatRepository(supabase), provider);
const app = (0, express_1.default)();
app.disable("x-powered-by");
app.use(express_1.default.json({ limit: "32kb" }));
app.get("/health", (_request, response) => response.json({ status: "ok", provider: "ollama-local", model: "qwen2.5:7b" }));
app.post("/v1/chat/stream", (0, chat_route_1.createChatRoute)({
    controlPlaneToken: config.controlPlaneToken,
    chat,
}));
app.listen(config.port, "127.0.0.1", () => {
    console.log(`JVerse control plane listening on 127.0.0.1:${config.port}`);
});
