import { contextBridge, ipcRenderer } from "electron";

import type { DesktopApi, DesktopNotification, DesktopUpdateEvent, OpenResult } from "../shared/ipc";

function validNotification(value: DesktopNotification) {
  return typeof value?.title === "string" && value.title.length > 0 && value.title.length <= 120
    && typeof value.body === "string" && value.body.length <= 1_000;
}

const desktopApi: DesktopApi = {
  openFile: () => ipcRenderer.invoke("desktop:open-file") as Promise<OpenResult>,
  openFolder: () => ipcRenderer.invoke("desktop:open-folder") as Promise<OpenResult>,
  openApplication: () => ipcRenderer.invoke("desktop:open-application") as Promise<OpenResult>,
  notify: (notification) => validNotification(notification)
    ? ipcRenderer.invoke("desktop:notify", notification) as Promise<boolean>
    : Promise.resolve(false),
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
