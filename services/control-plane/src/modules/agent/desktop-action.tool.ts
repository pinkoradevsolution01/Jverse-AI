import type { AgentContext, AgentTool, AgentToolResult } from "./agent.types";

type DesktopAction = "open-file-picker" | "open-folder-picker" | "open-application-picker" | "notify";

export interface PairedDesktopGateway {
  execute(input: { workspaceId: string; userId: string; action: DesktopAction; capabilityId: string; notification?: { title: string; body: string } }, signal: AbortSignal): Promise<AgentToolResult>;
}

function isDesktopAction(value: unknown): value is DesktopAction {
  return value === "open-file-picker" || value === "open-folder-picker" || value === "open-application-picker" || value === "notify";
}

export class DesktopActionTool implements AgentTool {
  readonly name = "desktop.capability";
  readonly risk = "desktop" as const;
  readonly idempotent = false;

  constructor(private readonly gateway: PairedDesktopGateway) {}

  validate(input: Record<string, unknown>) {
    return isDesktopAction(input.action)
      && typeof input.capabilityId === "string"
      && /^[A-Za-z0-9_-]{16,128}$/.test(input.capabilityId)
      && input.path === undefined
      && input.command === undefined;
  }

  execute(input: Record<string, unknown>, context: AgentContext, signal: AbortSignal) {
    return this.gateway.execute({
      workspaceId: context.workspaceId,
      userId: context.userId,
      action: input.action as DesktopAction,
      capabilityId: input.capabilityId as string,
      notification: typeof input.notification === "object" && input.notification !== null
        ? input.notification as { title: string; body: string }
        : undefined,
    }, signal);
  }
}
