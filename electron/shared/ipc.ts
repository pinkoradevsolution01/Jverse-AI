export type OpenResult = { ok: true; path: string } | { ok: false; reason: "cancelled" | "failed" };

export type DesktopNotification = {
  title: string;
  body: string;
};

export type DesktopUpdateEvent =
  | { type: "checking" }
  | { type: "available"; version: string }
  | { type: "not-available" }
  | { type: "download-progress"; percent: number }
  | { type: "downloaded"; version: string }
  | { type: "error"; message: string };

export type DesktopApi = {
  openFile(): Promise<OpenResult>;
  openFolder(): Promise<OpenResult>;
  openApplication(): Promise<OpenResult>;
  notify(notification: DesktopNotification): Promise<boolean>;
  updates: {
    check(): Promise<void>;
    download(): Promise<void>;
    install(): Promise<void>;
    onEvent(listener: (event: DesktopUpdateEvent) => void): () => void;
  };
};
