import express from "express";

import { loadConfig } from "./config";
import { UnpairedDesktopProviderGateway } from "./desktop/desktop-provider.gateway";
import { createChatRoute } from "./http/chat.route";

const config = loadConfig();
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.get("/health", (_request, response) => response.json({ status: "ok", provider: "unpaired" }));
app.post("/v1/chat/stream", createChatRoute({
  controlPlaneToken: config.controlPlaneToken,
  provider: new UnpairedDesktopProviderGateway(),
}));
app.listen(config.port, "127.0.0.1", () => {
  console.log(`JVerse control plane listening on 127.0.0.1:${config.port}`);
});
