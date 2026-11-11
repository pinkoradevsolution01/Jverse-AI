"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
function loadConfig() {
    const controlPlaneToken = process.env.AI_CONTROL_PLANE_TOKEN;
    if (!controlPlaneToken || controlPlaneToken.length < 32) {
        throw new Error("AI_CONTROL_PLANE_TOKEN must be a server-only secret of at least 32 characters.");
    }
    const port = Number(process.env.PORT ?? 8787);
    if (!Number.isInteger(port) || port < 1 || port > 65_535)
        throw new Error("PORT must be a valid TCP port.");
    return { port, controlPlaneToken };
}
