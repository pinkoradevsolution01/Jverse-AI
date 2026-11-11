import { app, type IpcMainInvokeEvent } from "electron";

function origin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

export function rendererOrigins() {
  const production = process.env.JVERSE_WEB_URL ? origin(process.env.JVERSE_WEB_URL) : "";
  const development = process.env.ELECTRON_RENDERER_URL ? origin(process.env.ELECTRON_RENDERER_URL) : "http://localhost:3000";
  return new Set([production, ...(app.isPackaged ? [] : [development])].filter(Boolean));
}

export function isTrustedRenderer(url: string) {
  return rendererOrigins().has(origin(url));
}

export function assertTrustedRenderer(event: IpcMainInvokeEvent) {
  const senderUrl = event.senderFrame?.url;
  if (!senderUrl || !isTrustedRenderer(senderUrl)) {
    throw new Error("Desktop capability denied for untrusted renderer origin.");
  }
}

export function isAllowedNavigation(url: string) {
  const candidate = origin(url);
  if (rendererOrigins().has(candidate)) return true;
  const supabaseHost = origin(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  return candidate === supabaseHost || candidate === "https://accounts.google.com";
}
