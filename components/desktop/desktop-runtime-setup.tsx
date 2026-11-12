"use client";

import { Check, Download, ExternalLink, LoaderCircle, MonitorCog, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { desktopCapabilities } from "../../lib/electron/client";

type ComponentStatus = { id: "ollama" | "qwen" | "python" | "voice"; label: string; status: "ready" | "missing" | "setup_required"; detail: string };

export function DesktopRuntimeSetup() {
  const [components, setComponents] = useState<ComponentStatus[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const available = desktopCapabilities().available;

  const refresh = useCallback(async () => {
    if (!window.jverseDesktop) return;
    setLoading(true);
    try { setComponents((await window.jverseDesktop.runtime.status()).components); }
    catch { setNotice("JVerse could not inspect local AI runtimes."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!window.jverseDesktop) return;
    void refresh();
    return window.jverseDesktop.runtime.onProgress((message) => setNotice(message));
  }, [refresh]);

  if (!available) return <div className="jv-panel mt-6 p-5"><div className="flex items-start gap-3"><MonitorCog className="mt-0.5 text-cyan-300" size={20} /><div><p className="text-sm font-semibold">Use JVerse Desktop for local AI</p><p className="mt-1 text-xs leading-5 text-zinc-400">Download the desktop app to run Ollama, Qwen, Whisper, Piper, and desktop automation privately on your computer.</p></div></div></div>;

  const runQwenSetup = async () => {
    setLoading(true); setNotice("Preparing local Qwen setup…");
    try { await window.jverseDesktop?.runtime.installQwen(); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Qwen setup failed."); }
    finally { setLoading(false); }
  };
  const openInstaller = async (id: "ollama" | "python") => {
    try { await window.jverseDesktop?.runtime.openInstaller(id); setNotice(`Opening the official ${id === "ollama" ? "Ollama" : "Python"} installer page.`); }
    catch { setNotice("The official installer page could not be opened."); }
  };

  return <section className="jv-panel mt-6 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="jv-label text-cyan-300">DESKTOP FIRST-RUN SETUP</p><h2 className="mt-2 text-lg font-semibold">Local AI Runtime</h2><p className="mt-1 max-w-xl text-xs leading-5 text-zinc-400">JVerse runs your AI models on this computer. System installers open only from official sources; model downloads require your explicit action.</p></div><button type="button" onClick={() => void refresh()} disabled={loading} className="jv-control inline-flex items-center gap-2 px-3 py-2 text-xs text-cyan-100"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">{components.map((component) => <div key={component.id} className="rounded-xl border border-white/10 bg-black/15 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{component.label}</p>{component.status === "ready" ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300"><Check size={13} /> READY</span> : <span className="text-[10px] font-bold text-amber-200">SETUP NEEDED</span>}</div><p className="mt-1 min-h-8 text-xs leading-4 text-zinc-500">{component.detail}</p>{component.status !== "ready" && component.id === "qwen" ? <button type="button" onClick={() => void runQwenSetup()} disabled={loading} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-200 hover:text-cyan-100"><Download size={14} /> Download Qwen 2.5</button> : null}{component.status !== "ready" && (component.id === "ollama" || component.id === "python") ? <button type="button" onClick={() => void openInstaller(component.id as "ollama" | "python")} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-200 hover:text-cyan-100"><ExternalLink size={14} /> Official installer</button> : null}</div>)}</div>
    {loading ? <p className="mt-4 flex items-center gap-2 text-xs text-cyan-100"><LoaderCircle className="animate-spin" size={14} /> {notice || "Checking your setup…"}</p> : notice ? <p role="status" className="mt-4 text-xs text-cyan-100">{notice}</p> : null}
  </section>;
}
