import { app, BrowserWindow, Menu, nativeImage, session, Tray } from "electron";
import path from "node:path";

import { registerDesktopIpc } from "./ipc";
import { AgentDesktopBridge } from "./agent-bridge";
import { DesktopOsActions } from "./os-actions";
import { DesktopRuntimeManager } from "./runtime-manager";
import { LocalAgentManager } from "./local-agent-manager";
import { DesktopAuthManager } from "./desktop-auth-manager";
import { isAllowedNavigation, isTrustedRenderer } from "./security";
import { DesktopUpdater } from "./updater";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let desktopBridge: AgentDesktopBridge | null = null;
let runtimeManager: DesktopRuntimeManager | null = null;
let localAgent: LocalAgentManager | null = null;
let desktopAuth: DesktopAuthManager | null = null;

function isDesktopAuthCallback(callbackUrl: string) {
  try {
    const callback = new URL(callbackUrl);
    return callback.protocol === "jverse:" && callback.hostname === "auth" && callback.pathname === "/callback";
  } catch { return false; }
}

function handleDesktopAuthCallback(callbackUrl: string) {
  if (!isDesktopAuthCallback(callbackUrl) || !desktopAuth) return;
  void desktopAuth.completeCallback(callbackUrl);
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

function protocolArgument(values: string[]) {
  return values.find((value) => value.startsWith("jverse://"));
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

function rendererUrl() {
  if (!app.isPackaged) return process.env.ELECTRON_RENDERER_URL ?? "http://localhost:3000";
  const target = process.env.JVERSE_WEB_URL ?? "https://jverseai.space";
  if (!target.startsWith("https://")) throw new Error("JVERSE_WEB_URL must be a trusted HTTPS URL in packaged builds.");
  return target;
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
  app.setAsDefaultProtocolClient("jverse");
  app.setAppUserModelId("ai.jverse.desktop");
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => (
    permission === "media" && isTrustedRenderer(webContents?.getURL() ?? "")
  ));
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === "media" && isTrustedRenderer(webContents?.getURL() ?? ""));
  });
  desktopAuth = new DesktopAuthManager();
  desktopAuth.onResult((result) => {
    const target = mainWindow;
    if (target && !target.isDestroyed()) target.webContents.send("desktop:auth:google-result", result);
  });
  const window = createWindow();
  const launchCallback = protocolArgument(process.argv);
  if (launchCallback) handleDesktopAuthCallback(launchCallback);
  const updater = new DesktopUpdater(window);
  updater.initialise();
  desktopBridge = new AgentDesktopBridge(new DesktopOsActions());
  runtimeManager = new DesktopRuntimeManager();
  runtimeManager.onProgress((message) => {
    const target = mainWindow;
    if (target && !target.isDestroyed()) target.webContents.send("desktop:runtime:progress", message);
  });
  localAgent = new LocalAgentManager(runtimeManager);
  localAgent.onProgress((message) => {
    const target = mainWindow;
    if (target && !target.isDestroyed()) target.webContents.send("desktop:local-agent:progress", message);
  });
  registerDesktopIpc(updater, desktopBridge, runtimeManager, localAgent, desktopAuth);
  desktopBridge.start();
  createTray();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("second-instance", (_event, commandLine) => {
  const callback = protocolArgument(commandLine);
  if (callback) handleDesktopAuthCallback(callback);
  else { mainWindow?.show(); mainWindow?.focus(); }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => { desktopBridge?.stop(); localAgent?.stop(); });
