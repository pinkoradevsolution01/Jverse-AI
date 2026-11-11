"use client";
import { FormEvent, useState } from "react";
import { createClient } from "../../lib/supabase/browser";

export function ProfileForm() {
  const [displayName, setDisplayName] = useState(""); const [status, setStatus] = useState("");
  async function save(event: FormEvent) { event.preventDefault(); try { const supabase = createClient(); const { data } = await supabase.auth.getUser(); if (!data.user) return; const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", data.user.id); setStatus(error ? error.message : "Profile saved."); } catch { setStatus("Profile updates require Supabase configuration."); } }
  return <form onSubmit={save} className="glass max-w-xl rounded-2xl p-5"><p className="text-sm font-semibold">Profile</p><label className="mt-5 block text-xs text-zinc-400">Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-cyan-300/50"/></label><button className="mt-4 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-[#050816]">Save profile</button>{status && <p aria-live="polite" className="mt-3 text-xs text-zinc-500">{status}</p>}</form>;
}
