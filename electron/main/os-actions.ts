import { BrowserWindow, dialog, Notification, shell } from "electron";

import type { DesktopNotification, OpenResult } from "../shared/ipc";

async function openSelectedPath(parent: BrowserWindow, options: Electron.OpenDialogOptions): Promise<OpenResult> {
  const selection = await dialog.showOpenDialog(parent, options);
  if (selection.canceled || !selection.filePaths[0]) return { ok: false, reason: "cancelled" };
  const path = selection.filePaths[0];
  const error = await shell.openPath(path);
  return error ? { ok: false, reason: "failed" } : { ok: true, path };
}

export class DesktopOsActions {
  openFile(parent: BrowserWindow) {
    return openSelectedPath(parent, { title: "Open file", properties: ["openFile"] });
  }

  openFolder(parent: BrowserWindow) {
    return openSelectedPath(parent, { title: "Open folder", properties: ["openDirectory"] });
  }

  openApplication(parent: BrowserWindow) {
    const filters = process.platform === "win32"
      ? [{ name: "Applications", extensions: ["exe", "bat", "cmd"] }]
      : process.platform === "darwin"
        ? [{ name: "Applications", extensions: ["app"] }]
        : [{ name: "Applications", extensions: ["desktop", "appimage", "sh"] }];
    return openSelectedPath(parent, { title: "Open application", properties: ["openFile"], filters });
  }

  notify(notification: DesktopNotification) {
    if (!Notification.isSupported()) return false;
    new Notification({ title: notification.title, body: notification.body, silent: false }).show();
    return true;
  }
}
