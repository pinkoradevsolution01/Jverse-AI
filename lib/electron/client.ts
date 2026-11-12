export type DesktopCapabilityState = { available: boolean; reason?: "web" | "bridge_unavailable" };
export type DesktopBridge = {
  pickFile(): Promise<{ ok: boolean; path?: string }>;
  pickFolder(): Promise<{ ok: boolean; path?: string }>;
  pickApplication(): Promise<{ ok: boolean; path?: string }>;
  agentStatus(): Promise<{ connected: boolean; deviceId?: string; lastError?: string }>;
  runtime: {
    status(): Promise<{ components: Array<{ id: "ollama" | "qwen" | "python" | "voice"; label: string; status: "ready" | "missing" | "setup_required"; detail: string }> }>;
    openInstaller(component: "ollama" | "python"): Promise<void>;
    installQwen(): Promise<void>;
    onProgress(listener: (message: string) => void): () => void;
  };
};

declare global {
  interface Window { jverseDesktop?: DesktopBridge }
}

export function desktopCapabilities(): DesktopCapabilityState {
  if (typeof window === "undefined") return { available: false, reason: "web" };
  return window.jverseDesktop ? { available: true } : { available: false, reason: "bridge_unavailable" };
}

export function requireDesktop() {
  if (!window.jverseDesktop) throw new Error("The JVerse desktop bridge is unavailable.");
  return window.jverseDesktop;
}
