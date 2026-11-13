import { createHash, randomBytes } from "node:crypto";

import { shell } from "electron";

const WEB_ORIGIN = process.env.JVERSE_WEB_URL ?? "https://jverseai.space";
const EXPECTED_SUPABASE_HOST = process.env.JVERSE_SUPABASE_AUTH_HOST ?? "cczyzhhreegioovlokyx.supabase.co";

export type DesktopAuthResult =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ready"; accessToken: string; refreshToken: string };

type PendingOAuth = { state: string; verifier: string; supabaseUrl: string; publishableKey: string; expiresAt: number };

function base64Url(value: Buffer) { return value.toString("base64url"); }

export class DesktopAuthManager {
  private pending: PendingOAuth | null = null;
  private result: DesktopAuthResult = { status: "idle" };
  private listeners = new Set<(result: DesktopAuthResult) => void>();

  onResult(listener: (result: DesktopAuthResult) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private publish(result: DesktopAuthResult) { this.result = result; this.listeners.forEach((listener) => listener(result)); }

  async startGoogleOAuth() {
    const response = await fetch(`${WEB_ORIGIN}/api/auth/desktop/config`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("JVerse could not load its secure sign-in configuration.");
    const config = await response.json() as { supabaseUrl?: string; publishableKey?: string };
    if (!config.supabaseUrl || !config.publishableKey) throw new Error("JVerse sign-in configuration is unavailable.");
    const supabase = new URL(config.supabaseUrl);
    if (supabase.protocol !== "https:" || supabase.hostname !== EXPECTED_SUPABASE_HOST) throw new Error("The JVerse sign-in service is not trusted.");

    const verifier = base64Url(randomBytes(48));
    const state = base64Url(randomBytes(32));
    const challenge = base64Url(createHash("sha256").update(verifier).digest());
    this.pending = { state, verifier, supabaseUrl: supabase.toString().replace(/\/$/, ""), publishableKey: config.publishableKey, expiresAt: Date.now() + 10 * 60 * 1000 };

    const authorize = new URL("/auth/v1/authorize", supabase);
    authorize.searchParams.set("provider", "google");
    authorize.searchParams.set("redirect_to", "jverse://auth/callback");
    authorize.searchParams.set("code_challenge", challenge);
    authorize.searchParams.set("code_challenge_method", "S256");
    authorize.searchParams.set("state", state);
    await shell.openExternal(authorize.toString());
  }

  async completeCallback(callbackUrl: string) {
    const callback = new URL(callbackUrl);
    const pending = this.pending;
    if (!pending || pending.expiresAt < Date.now()) {
      this.pending = null;
      this.publish({ status: "error", message: "The desktop sign-in session expired. Please try Google sign-in again." });
      return;
    }
    if (callback.searchParams.get("state") !== pending.state) {
      this.publish({ status: "error", message: "The desktop sign-in response could not be verified. Please try again." });
      return;
    }
    const providerError = callback.searchParams.get("error_description") ?? callback.searchParams.get("error");
    if (providerError) {
      this.pending = null;
      this.publish({ status: "error", message: `Google sign-in was cancelled or refused: ${providerError.slice(0, 180)}` });
      return;
    }
    const code = callback.searchParams.get("code");
    if (!code) {
      this.publish({ status: "error", message: "Google did not return a sign-in code. Please try again." });
      return;
    }
    try {
      const response = await fetch(`${pending.supabaseUrl}/auth/v1/token?grant_type=pkce`, {
        method: "POST",
        headers: { apikey: pending.publishableKey, Authorization: `Bearer ${pending.publishableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ auth_code: code, code_verifier: pending.verifier }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json().catch(() => null) as { access_token?: string; refresh_token?: string } | null;
      if (!response.ok || !payload?.access_token || !payload.refresh_token) throw new Error("token_exchange_failed");
      this.pending = null;
      this.publish({ status: "ready", accessToken: payload.access_token, refreshToken: payload.refresh_token });
    } catch {
      this.publish({ status: "error", message: "JVerse could not complete secure Google sign-in. Please try again." });
    }
  }

  consume() {
    const result = this.result;
    if (result.status !== "idle") this.result = { status: "idle" };
    return result;
  }
}
