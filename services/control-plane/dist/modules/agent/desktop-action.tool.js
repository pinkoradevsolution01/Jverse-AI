"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesktopActionTool = void 0;
function isDesktopAction(value) {
    return value === "open-file-picker" || value === "open-folder-picker" || value === "open-application-picker" || value === "notify";
}
class DesktopActionTool {
    gateway;
    name = "desktop.capability";
    risk = "desktop";
    idempotent = false;
    constructor(gateway) {
        this.gateway = gateway;
    }
    validate(input) {
        return isDesktopAction(input.action)
            && typeof input.capabilityId === "string"
            && /^[A-Za-z0-9_-]{16,128}$/.test(input.capabilityId)
            && input.path === undefined
            && input.command === undefined;
    }
    execute(input, context, signal) {
        return this.gateway.execute({
            workspaceId: context.workspaceId,
            userId: context.userId,
            action: input.action,
            capabilityId: input.capabilityId,
            notification: typeof input.notification === "object" && input.notification !== null
                ? input.notification
                : undefined,
        }, signal);
    }
}
exports.DesktopActionTool = DesktopActionTool;
