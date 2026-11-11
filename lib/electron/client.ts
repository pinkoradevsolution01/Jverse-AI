export type DesktopCapabilityState = { available: boolean; reason?: "web" | "bridge_unavailable" };
export type DesktopBridge = {
  openFile(): Promise<{ ok: boolean; path?: string }>;
  openFolder(): Promise<{ ok: boolean; path?: string }>;
  openApplication(): Promise<{ ok: boolean; path?: string }>;
  notify(input: { title: string; body: string }): Promise<boolean>;
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
