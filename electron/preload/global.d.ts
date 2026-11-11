import type { DesktopApi } from "../shared/ipc";

declare global {
  interface Window {
    jverseDesktop?: DesktopApi;
  }
}

export {};
