import { app, type BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

import type { DesktopUpdateEvent } from "../shared/ipc";

export class DesktopUpdater {
  private configured = false;

  constructor(private readonly window: BrowserWindow) {}

  initialise() {
    const updateUrl = process.env.JVERSE_UPDATE_URL;
    if (!app.isPackaged || !updateUrl?.startsWith("https://")) return;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.setFeedURL({ provider: "generic", url: updateUrl });
    autoUpdater.on("checking-for-update", () => this.emit({ type: "checking" }));
    autoUpdater.on("update-available", (info) => this.emit({ type: "available", version: info.version }));
    autoUpdater.on("update-not-available", () => this.emit({ type: "not-available" }));
    autoUpdater.on("download-progress", (progress) => this.emit({ type: "download-progress", percent: progress.percent }));
    autoUpdater.on("update-downloaded", (info) => this.emit({ type: "downloaded", version: info.version }));
    autoUpdater.on("error", (error) => this.emit({ type: "error", message: "Update check failed." }));
    this.configured = true;
  }

  async check() {
    if (this.configured) await autoUpdater.checkForUpdates();
  }

  async download() {
    if (this.configured) await autoUpdater.downloadUpdate();
  }

  install() {
    if (this.configured) autoUpdater.quitAndInstall(false, true);
  }

  private emit(event: DesktopUpdateEvent) {
    if (!this.window.isDestroyed()) this.window.webContents.send("desktop:updates:event", event);
  }
}
