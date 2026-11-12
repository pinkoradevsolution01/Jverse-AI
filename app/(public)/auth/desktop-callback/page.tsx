"use client";

import { useEffect, useState } from "react";

import { createClient } from "../../../../lib/supabase/browser";

export default function DesktopAuthCallbackPage() {
  const [message, setMessage] = useState("Completing secure desktop sign-in…");

  useEffect(() => {
    async function complete() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) { setMessage("The sign-in callback did not contain an authorization code. Please try again."); return; }
      try {
        const { error } = await createClient().auth.exchangeCodeForSession(code);
        if (error) { setMessage(error.message); return; }
        window.location.replace("/dashboard");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Desktop sign-in could not be completed.");
      }
    }
    void complete();
  }, []);

  return <main className="grid min-h-screen place-items-center bg-[#050816] p-6 text-center text-slate-100"><div className="max-w-md rounded-2xl border border-cyan-300/20 bg-[#071326] p-8"><p className="text-sm font-semibold text-cyan-200">JVERSE ID</p><p role="status" className="mt-3 text-sm leading-6 text-slate-300">{message}</p></div></main>;
}
