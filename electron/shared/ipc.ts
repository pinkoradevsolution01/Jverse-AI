export type PathSelection = { ok: true; path: string } | { ok: false; reason: "cancelled" | "failed" };

export type DesktopAgentStatus = {
  connected: boolean;
  deviceId?: string;
  lastError?: string;
  lastSeenAt?: string;
};

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
  /** Selects a target only. Opening it requires Python Agent approval. */
  pickFile(): Promise<PathSelection>;
  pickFolder(): Promise<PathSelection>;
  pickApplication(): Promise<PathSelection>;
  agentStatus(): Promise<DesktopAgentStatus>;
  updates: {
    check(): Promise<void>;
    download(): Promise<void>;
    install(): Promise<void>;
    onEvent(listener: (event: DesktopUpdateEvent) => void): () => void;
  };
};
