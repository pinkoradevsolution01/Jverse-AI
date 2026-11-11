"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const config_1 = require("./config");
const desktop_provider_gateway_1 = require("./desktop/desktop-provider.gateway");
const chat_route_1 = require("./http/chat.route");
const config = (0, config_1.loadConfig)();
const app = (0, express_1.default)();
app.disable("x-powered-by");
app.use(express_1.default.json({ limit: "32kb" }));
app.get("/health", (_request, response) => response.json({ status: "ok", provider: "unpaired" }));
app.post("/v1/chat/stream", (0, chat_route_1.createChatRoute)({
    controlPlaneToken: config.controlPlaneToken,
    provider: new desktop_provider_gateway_1.UnpairedDesktopProviderGateway(),
}));
app.listen(config.port, "127.0.0.1", () => {
    console.log(`JVerse control plane listening on 127.0.0.1:${config.port}`);
});
