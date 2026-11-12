import { BrowserWindow, ipcMain, shell } from "electron";

import { DesktopOsActions } from "./os-actions";
import { AgentDesktopBridge } from "./agent-bridge";
import { DesktopRuntimeManager } from "./runtime-manager";
import { LocalAgentManager } from "./local-agent-manager";
import { assertTrustedRenderer } from "./security";
import { DesktopUpdater } from "./updater";
import type { DesktopNotification } from "../shared/ipc";

const SUPABASE_AUTH_HOST = process.env.JVERSE_SUPABASE_AUTH_HOST ?? "cczyzhhreegioovlokyx.supabase.co";

function validGoogleOAuthUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 8_192) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === SUPABASE_AUTH_HOST
      && url.pathname === "/auth/v1/authorize"
      && url.searchParams.get("provider") === "google"
      && url.searchParams.get("redirect_to") === "jverse://auth/callback";
  } catch { return false; }
}

function parentWindow(event: Electron.IpcMainInvokeEvent) {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) throw new Error("Desktop window is unavailable.");
  return window;
}

function validNotification(value: unknown): value is DesktopNotification {
  if (!value || typeof value !== "object") return false;
  const notification = value as DesktopNotification;
  return typeof notification.title === "string" && notification.title.length > 0 && notification.title.length <= 120
    && typeof notification.body === "string" && notification.body.length <= 1_000;
}

export function registerDesktopIpc(updater: DesktopUpdater, bridge: AgentDesktopBridge, runtime: DesktopRuntimeManager, localAgent: LocalAgentManager) {
  const os = new DesktopOsActions();
  ipcMain.handle("desktop:pick-file", (event) => {
    assertTrustedRenderer(event);
    return os.openFile(parentWindow(event));
  });
  ipcMain.handle("desktop:pick-folder", (event) => {
    assertTrustedRenderer(event);
    return os.openFolder(parentWindow(event));
  });
  ipcMain.handle("desktop:pick-application", (event) => {
    assertTrustedRenderer(event);
    return os.openApplication(parentWindow(event));
  });
  ipcMain.handle("desktop:agent-status", (event) => { assertTrustedRenderer(event); return bridge.status(); });
  ipcMain.handle("desktop:runtime:status", (event) => { assertTrustedRenderer(event); return runtime.status(); });
  ipcMain.handle("desktop:runtime:open-installer", (event, component: unknown) => {
    assertTrustedRenderer(event);
    if (component !== "ollama" && component !== "python") throw new Error("Unsupported runtime installer.");
    return runtime.openInstaller(component);
  });
  ipcMain.handle("desktop:runtime:install-qwen", (event) => { assertTrustedRenderer(event); return runtime.installQwen(); });
  ipcMain.handle("desktop:local-agent:status", (event) => { assertTrustedRenderer(event); return localAgent.status(); });
  ipcMain.handle("desktop:local-agent:prepare", async (event) => {
    assertTrustedRenderer(event);
    await localAgent.prepare();
  });
  ipcMain.handle("desktop:local-agent:start", async (event) => {
    assertTrustedRenderer(event);
    await localAgent.start();
  });
  ipcMain.handle("desktop:local-agent:chat", async (event, requestId: unknown, message: unknown) => {
    assertTrustedRenderer(event);
    if (typeof requestId !== "string" || requestId.length < 8 || requestId.length > 128) throw new Error("Invalid local chat request.");
    if (typeof message !== "string" || !message.trim() || message.length > 24_000) throw new Error("Invalid local chat message.");
    const window = parentWindow(event);
    await localAgent.chat(message, (streamEvent) => {
      if (!window.isDestroyed()) window.webContents.send("desktop:local-agent:event", { requestId, event: streamEvent });
    });
  });
  ipcMain.handle("desktop:local-agent:transcribe", async (event, audio: unknown) => {
    assertTrustedRenderer(event);
    if (!(audio instanceof Uint8Array) || audio.byteLength > 16 * 1024 * 1024) throw new Error("Invalid voice recording.");
    return localAgent.transcribe(audio);
  });
  ipcMain.handle("desktop:local-agent:speak", async (event, text: unknown) => {
    assertTrustedRenderer(event);
    if (typeof text !== "string" || !text.trim() || text.length > 12_000) throw new Error("Invalid speech text.");
    return localAgent.speak(text);
  });
  ipcMain.handle("desktop:auth:open-google-oauth", async (event, url: unknown) => {
    assertTrustedRenderer(event);
    if (!validGoogleOAuthUrl(url)) throw new Error("The requested Google sign-in URL is not trusted.");
    await shell.openExternal(url);
  });
  ipcMain.handle("desktop:updates:check", async (event) => {
    assertTrustedRenderer(event);
    await updater.check();
  });
  ipcMain.handle("desktop:updates:download", async (event) => {
    assertTrustedRenderer(event);
    await updater.download();
  });
  ipcMain.handle("desktop:updates:install", (event) => {
    assertTrustedRenderer(event);
    updater.install();
  });
}
