export type PathSelection = { ok: true; path: string } | { ok: false; reason: "cancelled" | "failed" };

export type DesktopAgentStatus = {
  connected: boolean;
  deviceId?: string;
  lastError?: string;
  lastSeenAt?: string;
};

export type DesktopRuntimeComponent = {
  id: "ollama" | "qwen" | "python" | "voice";
  label: string;
  status: "ready" | "missing" | "setup_required";
  detail: string;
};

export type DesktopRuntimeStatus = { components: DesktopRuntimeComponent[] };

export type DesktopLocalAgentStatus = {
  status: "ready" | "stopped" | "setup_required";
  detail: string;
};

export type DesktopLocalAgentEvent = {
  requestId: string;
  event: unknown;
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
  runtime: {
    status(): Promise<DesktopRuntimeStatus>;
    openInstaller(component: "ollama" | "python"): Promise<void>;
    installQwen(): Promise<void>;
    onProgress(listener: (message: string) => void): () => void;
  };
  localAgent: {
    status(): Promise<DesktopLocalAgentStatus>;
    /** Downloads Python packages/models only after an explicit first-run click. */
    prepare(): Promise<void>;
    start(): Promise<void>;
    chat(requestId: string, message: string): Promise<void>;
    transcribe(audio: Uint8Array): Promise<{ transcript: string; wake_word_detected: boolean; command?: string }>;
    speak(text: string): Promise<Uint8Array>;
    onProgress(listener: (message: string) => void): () => void;
    onEvent(listener: (event: DesktopLocalAgentEvent) => void): () => void;
  };
  auth: {
    /** Opens only a validated Supabase Google OAuth URL in the system browser. */
    openGoogleOAuth(url: string): Promise<void>;
  };
  updates: {
    check(): Promise<void>;
    download(): Promise<void>;
    install(): Promise<void>;
    onEvent(listener: (event: DesktopUpdateEvent) => void): () => void;
  };
};
