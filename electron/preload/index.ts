import { contextBridge, ipcRenderer } from "electron";

import type { DesktopApi, DesktopUpdateEvent, PathSelection } from "../shared/ipc";

const desktopApi: DesktopApi = {
  pickFile: () => ipcRenderer.invoke("desktop:pick-file") as Promise<PathSelection>,
  pickFolder: () => ipcRenderer.invoke("desktop:pick-folder") as Promise<PathSelection>,
  pickApplication: () => ipcRenderer.invoke("desktop:pick-application") as Promise<PathSelection>,
  agentStatus: () => ipcRenderer.invoke("desktop:agent-status"),
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
