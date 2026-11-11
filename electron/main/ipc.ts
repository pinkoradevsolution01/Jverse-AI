import { BrowserWindow, ipcMain } from "electron";

import { DesktopOsActions } from "./os-actions";
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

export function registerDesktopIpc(updater: DesktopUpdater) {
  const os = new DesktopOsActions();
  ipcMain.handle("desktop:open-file", (event) => {
    assertTrustedRenderer(event);
    return os.openFile(parentWindow(event));
  });
  ipcMain.handle("desktop:open-folder", (event) => {
    assertTrustedRenderer(event);
    return os.openFolder(parentWindow(event));
  });
  ipcMain.handle("desktop:open-application", (event) => {
    assertTrustedRenderer(event);
    return os.openApplication(parentWindow(event));
  });
  ipcMain.handle("desktop:notify", (event, notification: unknown) => {
    assertTrustedRenderer(event);
    return validNotification(notification) && os.notify(notification);
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
