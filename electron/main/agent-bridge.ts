import os from "node:os";

import { DesktopOsActions } from "./os-actions";
import type { DesktopAgentStatus, DesktopNotification } from "../shared/ipc";

type AgentCommand = {
  id: string;
  action_type: "open_file" | "open_folder" | "open_application" | "notify";
  input_payload: { path?: string; notification?: DesktopNotification };
};

const POLL_INTERVAL_MS = 2_500;

/** An outbound-only, paired-device bridge. The renderer never receives its token. */
export class AgentDesktopBridge {
  private timer: NodeJS.Timeout | undefined;
  private lastError: string | undefined;
  private lastSeenAt: string | undefined;
  private busy = false;

  constructor(private readonly osActions: DesktopOsActions) {}

  private get configured() {
    return Boolean(process.env.JVERSE_AGENT_URL && process.env.JVERSE_DESKTOP_ID && process.env.JVERSE_DESKTOP_TOKEN);
  }

  status(): DesktopAgentStatus {
    return { connected: this.configured && !this.lastError, deviceId: process.env.JVERSE_DESKTOP_ID, lastError: this.lastError, lastSeenAt: this.lastSeenAt };
  }

  start() {
    if (!this.configured || this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = undefined; }

  private endpoint(path: string) {
    const base = process.env.JVERSE_AGENT_URL!;
    return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
  }

  private headers() {
    return { "Content-Type": "application/json", "X-JVerse-Desktop-Id": process.env.JVERSE_DESKTOP_ID!, "X-JVerse-Desktop-Token": process.env.JVERSE_DESKTOP_TOKEN! };
  }

  private async tick() {
    if (this.busy || !this.configured) return;
    this.busy = true;
    try {
      await this.heartbeat();
      const response = await fetch(this.endpoint("/v1/desktop/commands/next"), { headers: this.headers() });
      if (!response.ok) throw new Error(`Agent command poll failed (${response.status}).`);
      const command = await response.json() as AgentCommand | null;
      this.lastSeenAt = new Date().toISOString(); this.lastError = undefined;
      if (command) await this.execute(command);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "Desktop agent bridge is unavailable.";
    } finally { this.busy = false; }
  }

  private async heartbeat() {
    const response = await fetch(this.endpoint("/v1/desktop/heartbeat"), {
      method: "POST", headers: this.headers(),
      body: JSON.stringify({ platform: process.platform, hostname: os.hostname(), memory_mb: Math.round(os.totalmem() / 1024 / 1024) }),
    });
    if (!response.ok) throw new Error(`Agent heartbeat failed (${response.status}).`);
  }

  private async execute(command: AgentCommand) {
    let result: { ok: boolean; reason?: string; path?: string };
    try {
      switch (command.action_type) {
        case "open_file": result = await this.osActions.openPath(command.input_payload.path, "file"); break;
        case "open_folder": result = await this.osActions.openPath(command.input_payload.path, "folder"); break;
        case "open_application": result = await this.osActions.openPath(command.input_payload.path, "application"); break;
        case "notify": result = { ok: this.osActions.notify(command.input_payload.notification ?? { title: "JVerse AI", body: "" }) }; break;
      }
    } catch (error) { result = { ok: false, reason: error instanceof Error ? error.message : "desktop_execution_failed" }; }
    await fetch(this.endpoint(`/v1/desktop/commands/${command.id}/complete`), { method: "POST", headers: this.headers(), body: JSON.stringify(result) });
  }
}
