import { app, BrowserWindow, Menu, nativeImage, session, Tray } from "electron";
import path from "node:path";

import { registerDesktopIpc } from "./ipc";
import { AgentDesktopBridge } from "./agent-bridge";
import { DesktopOsActions } from "./os-actions";
import { isAllowedNavigation, isTrustedRenderer } from "./security";
import { DesktopUpdater } from "./updater";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let desktopBridge: AgentDesktopBridge | null = null;

function rendererUrl() {
  if (!app.isPackaged) return process.env.ELECTRON_RENDERER_URL ?? "http://localhost:3000";
  if (!process.env.JVERSE_WEB_URL?.startsWith("https://")) throw new Error("JVERSE_WEB_URL must be a trusted HTTPS URL in packaged builds.");
  return process.env.JVERSE_WEB_URL;
}

function trayIcon() {
  return nativeImage.createFromDataURL("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSczMicgaGVpZ2h0PSczMic+PGNpcmNsZSBjeD0nMTYnIGN5PScxNicgcj0nMTQnIGZpbGw9JyMwMGU1ZmYnLz48dGV4dCB4PScxNicgeT0nMjEnIGZpbGw9JyMwNTA4MTYnIGZvbnQtc2l6ZT0nMTYnIHRleHQtYW5jaG9yPSdtaWRkbGUnIGZvbnQtZmFtaWx5PSdBcmlhbCc+SjwvdGV4dD48L3N2Zz4=");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1040,
    minHeight: 720,
    show: false,
    backgroundColor: "#050816",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      preload: path.join(__dirname, "../preload/index.js"),
    },
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault();
  });
  void mainWindow.loadURL(rendererUrl());
  return mainWindow;
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip("JVerse AI");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open JVerse AI", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: "Quit", click: () => app.quit() },
  ]));
  tray.on("click", () => mainWindow?.show());
}

app.whenReady().then(() => {
  app.setAppUserModelId("ai.jverse.desktop");
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => (
    permission === "media" && isTrustedRenderer(webContents?.getURL() ?? "")
  ));
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === "media" && isTrustedRenderer(webContents?.getURL() ?? ""));
  });
  const window = createWindow();
  const updater = new DesktopUpdater(window);
  updater.initialise();
  desktopBridge = new AgentDesktopBridge(new DesktopOsActions());
  registerDesktopIpc(updater, desktopBridge);
  desktopBridge.start();
  createTray();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => desktopBridge?.stop());
