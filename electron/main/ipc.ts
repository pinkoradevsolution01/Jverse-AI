import { BrowserWindow, ipcMain } from "electron";

import { DesktopOsActions } from "./os-actions";
import { AgentDesktopBridge } from "./agent-bridge";
import { DesktopRuntimeManager } from "./runtime-manager";
import { LocalAgentManager } from "./local-agent-manager";
import { DesktopAuthManager } from "./desktop-auth-manager";
import { assertTrustedRenderer } from "./security";
import { DesktopUpdater } from "./updater";
import type { DesktopNotification } from "../shared/ipc";

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

export function registerDesktopIpc(updater: DesktopUpdater, bridge: AgentDesktopBridge, runtime: DesktopRuntimeManager, localAgent: LocalAgentManager, auth: DesktopAuthManager) {
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
    await localAgent.chat(requestId, message, (streamEvent) => {
      if (!window.isDestroyed()) window.webContents.send("desktop:local-agent:event", { requestId, event: streamEvent });
    });
  });
  ipcMain.handle("desktop:local-agent:cancel-chat", (event, requestId: unknown) => {
    assertTrustedRenderer(event);
    if (typeof requestId !== "string" || requestId.length < 8 || requestId.length > 128) throw new Error("Invalid local chat request.");
    return localAgent.cancelChat(requestId);
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
  ipcMain.handle("desktop:auth:start-google-oauth", async (event) => {
    assertTrustedRenderer(event);
    await auth.startGoogleOAuth();
  });
  ipcMain.handle("desktop:auth:consume-google-result", (event) => { assertTrustedRenderer(event); return auth.consume(); });
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
