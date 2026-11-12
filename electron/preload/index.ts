import { contextBridge, ipcRenderer } from "electron";

import type { DesktopApi, DesktopLocalAgentEvent, DesktopUpdateEvent, PathSelection } from "../shared/ipc";

const desktopApi: DesktopApi = {
  pickFile: () => ipcRenderer.invoke("desktop:pick-file") as Promise<PathSelection>,
  pickFolder: () => ipcRenderer.invoke("desktop:pick-folder") as Promise<PathSelection>,
  pickApplication: () => ipcRenderer.invoke("desktop:pick-application") as Promise<PathSelection>,
  agentStatus: () => ipcRenderer.invoke("desktop:agent-status"),
  runtime: {
    status: () => ipcRenderer.invoke("desktop:runtime:status"),
    openInstaller: (component) => ipcRenderer.invoke("desktop:runtime:open-installer", component),
    installQwen: () => ipcRenderer.invoke("desktop:runtime:install-qwen"),
    onProgress: (listener) => {
      const channel = "desktop:runtime:progress";
      const wrapped = (_event: Electron.IpcRendererEvent, message: string) => listener(message);
      ipcRenderer.on(channel, wrapped);
      return () => ipcRenderer.removeListener(channel, wrapped);
    },
  },
  localAgent: {
    status: () => ipcRenderer.invoke("desktop:local-agent:status"),
    prepare: () => ipcRenderer.invoke("desktop:local-agent:prepare") as Promise<void>,
    start: () => ipcRenderer.invoke("desktop:local-agent:start") as Promise<void>,
    chat: (requestId, message) => ipcRenderer.invoke("desktop:local-agent:chat", requestId, message) as Promise<void>,
    transcribe: (audio) => ipcRenderer.invoke("desktop:local-agent:transcribe", audio),
    speak: (text) => ipcRenderer.invoke("desktop:local-agent:speak", text) as Promise<Uint8Array>,
    onProgress: (listener) => {
      const channel = "desktop:local-agent:progress";
      const wrapped = (_event: Electron.IpcRendererEvent, message: string) => listener(message);
      ipcRenderer.on(channel, wrapped);
      return () => ipcRenderer.removeListener(channel, wrapped);
    },
    onEvent: (listener) => {
      const channel = "desktop:local-agent:event";
      const wrapped = (_event: Electron.IpcRendererEvent, value: DesktopLocalAgentEvent) => listener(value);
      ipcRenderer.on(channel, wrapped);
      return () => ipcRenderer.removeListener(channel, wrapped);
    },
  },
  auth: {
    openGoogleOAuth: (url) => ipcRenderer.invoke("desktop:auth:open-google-oauth", url) as Promise<void>,
  },
  updates: {
    check: () => ipcRenderer.invoke("desktop:updates:check") as Promise<void>,
    download: () => ipcRenderer.invoke("desktop:updates:download") as Promise<void>,
    install: () => ipcRenderer.invoke("desktop:updates:install") as Promise<void>,
    onEvent: (listener) => {
      const channel = "desktop:updates:event";
      const wrapped = (_event: Electron.IpcRendererEvent, update: DesktopUpdateEvent) => listener(update);
      ipcRenderer.on(channel, wrapped);
      return () => ipcRenderer.removeListener(channel, wrapped);
    },
  },
};

contextBridge.exposeInMainWorld("jverseDesktop", desktopApi);
