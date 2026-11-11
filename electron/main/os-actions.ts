import { BrowserWindow, dialog, Notification, shell } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

import type { DesktopNotification, PathSelection } from "../shared/ipc";

async function selectPath(parent: BrowserWindow, options: Electron.OpenDialogOptions): Promise<PathSelection> {
  const selection = await dialog.showOpenDialog(parent, options);
  if (selection.canceled || !selection.filePaths[0]) return { ok: false, reason: "cancelled" };
  const path = selection.filePaths[0];
  return { ok: true, path };
}

export class DesktopOsActions {
  openFile(parent: BrowserWindow) {
    return selectPath(parent, { title: "Select file for JVerse Agent", properties: ["openFile"] });
  }

  openFolder(parent: BrowserWindow) {
    return selectPath(parent, { title: "Select folder for JVerse Agent", properties: ["openDirectory"] });
  }

  openApplication(parent: BrowserWindow) {
    const filters = process.platform === "win32"
      ? [{ name: "Applications", extensions: ["exe", "bat", "cmd"] }]
      : process.platform === "darwin"
        ? [{ name: "Applications", extensions: ["app"] }]
        : [{ name: "Applications", extensions: ["desktop", "appimage", "sh"] }];
    return selectPath(parent, { title: "Select application for JVerse Agent", properties: ["openFile"], filters });
  }

  async openPath(target: string | undefined, expected: "file" | "folder" | "application"): Promise<PathSelection> {
    if (!target || !path.isAbsolute(target)) return { ok: false, reason: "failed" };
    const stat = await fs.stat(target).catch(() => undefined);
    if (!stat || (expected === "folder" ? !stat.isDirectory() : !stat.isFile())) return { ok: false, reason: "failed" };
    const error = await shell.openPath(target);
    return error ? { ok: false, reason: "failed" } : { ok: true, path: target };
  }

  notify(notification: DesktopNotification) {
    if (!Notification.isSupported()) return false;
    new Notification({ title: notification.title, body: notification.body, silent: false }).show();
    return true;
  }
}
