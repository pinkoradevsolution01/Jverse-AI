"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Chrome, LoaderCircle } from "lucide-react";
import { BrandLogo } from "../brand-logo";
import { createClient } from "../../lib/supabase/browser";

type DesktopGoogleResult =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ready"; accessToken: string; refreshToken: string };

function timeout<T>(task: Promise<T>, milliseconds = 20_000) {
  return Promise.race<T>([
    task,
    new Promise<T>((_resolve, reject) => window.setTimeout(() => reject(new Error("The sign-in request timed out. Check your internet connection and try again.")), milliseconds)),
  ]);
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const signUp = mode === "sign-up";
  useEffect(() => {
    const desktop = window.jverseDesktop?.auth;
    if (!desktop) return;
    let active = true;
    async function complete(result: DesktopGoogleResult) {
      if (!active || result.status === "idle") return;
      if (result.status === "error") { setMessage(result.message); setBusy(false); return; }
      const { error } = await createClient().auth.setSession({ access_token: result.accessToken, refresh_token: result.refreshToken });
      if (!active) return;
      if (error) { setMessage(error.message); setBusy(false); return; }
      window.location.assign("/dashboard");
    }
    void desktop.consumeGoogleResult().then(complete);
    return desktop.onGoogleResult((result) => { void complete(result); });
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase = createClient();
      const result = signUp ? await timeout(supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth/callback" } })) : await timeout(supabase.auth.signInWithPassword({ email, password }));
      if (result.error) setMessage(result.error.message);
      else if (signUp) setMessage("Check your email to verify your JVerse account.");
      else window.location.assign("/dashboard");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authentication is currently unavailable."); }
    finally { setBusy(false); }
  }
  async function google() {
    setBusy(true); setMessage("");
    try {
      const desktop = window.jverseDesktop?.auth;
      if (window.jverseDesktop && !desktop) {
        setMessage("This is an older JVerse Desktop app. Install JVerse Desktop 0.1.2 or newer, then try Google sign-in again.");
        setBusy(false);
        return;
      }
      if (desktop) setMessage("Opening your secure Google sign-in in the default browser…");
      if (desktop) {
        await desktop.startGoogleOAuth();
        return;
      }
      const result = await timeout(createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/auth/callback" } }));
      if (result.error) setMessage(result.error.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Google sign-in is currently unavailable."); setBusy(false); }
  }
  return <section className="glass w-full max-w-md rounded-3xl p-6 sm:p-8"><div className="flex items-center gap-3"><BrandLogo decorative className="h-10 w-12 object-contain drop-shadow-[0_0_12px_rgba(0,229,255,.45)]" /><p className="text-[11px] font-bold tracking-[.18em] text-cyan-300">JVERSE ID</p></div><h1 className="mt-3 text-3xl font-semibold">{signUp ? "Create your workspace" : "Welcome back"}</h1><p className="mt-2 text-sm text-zinc-400">{signUp ? "Start with a protected personal workspace." : "Sign in to continue your command center."}</p><button onClick={google} disabled={busy} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10 disabled:opacity-60"><Chrome size={17}/> Continue with Google</button><div className="my-6 flex items-center gap-3 text-[11px] text-zinc-600"><i className="h-px flex-1 bg-white/10"/>OR CONTINUE WITH EMAIL<i className="h-px flex-1 bg-white/10"/></div><form onSubmit={submit} className="space-y-4"><label className="block text-xs text-zinc-300">Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-cyan-300/50"/></label><label className="block text-xs text-zinc-300">Password<input required minLength={6} type="password" autoComplete={signUp ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-cyan-300/50"/></label><button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-[#050816] disabled:opacity-60">{busy && <LoaderCircle className="animate-spin" size={16}/>} {signUp ? "Create account" : "Sign in"}</button></form>{message && <p aria-live="polite" className="mt-4 text-xs leading-5 text-zinc-400">{message}</p>}<p className="mt-6 text-center text-xs text-zinc-500">{signUp ? "Already have an account?" : "New to JVerse?"} <Link className="text-cyan-300" href={signUp ? "/auth/sign-in" : "/auth/sign-up"}>{signUp ? "Sign in" : "Create account"}</Link></p></section>;
}

