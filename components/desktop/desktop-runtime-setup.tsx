"use client";

import { Check, Download, ExternalLink, LoaderCircle, MonitorCog, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { desktopCapabilities } from "../../lib/electron/client";

type ComponentStatus = { id: "ollama" | "qwen" | "python" | "voice"; label: string; status: "ready" | "missing" | "setup_required"; detail: string };

export function DesktopRuntimeSetup() {
  const [components, setComponents] = useState<ComponentStatus[]>([]);
  const [agent, setAgent] = useState<{ status: "ready" | "stopped" | "setup_required"; detail: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const available = desktopCapabilities().available;
  const supportsLocalAgent = typeof window !== "undefined" && Boolean(window.jverseDesktop?.localAgent);

  const refresh = useCallback(async () => {
    if (!window.jverseDesktop) return;
    setLoading(true);
    try {
      const runtimeStatus = await window.jverseDesktop.runtime.status();
      setComponents(runtimeStatus.components);
      if (window.jverseDesktop.localAgent) setAgent(await window.jverseDesktop.localAgent.status());
      else setAgent({ status: "setup_required", detail: "This installed desktop app needs the current JVerse update before local chat and voice can start." });
    }
    catch { setNotice("JVerse could not inspect local AI runtimes."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!window.jverseDesktop) return;
    void refresh();
    const removeRuntimeProgress = window.jverseDesktop.runtime.onProgress((message) => setNotice(message));
    const removeAgentProgress = window.jverseDesktop.localAgent?.onProgress((message) => setNotice(message));
    return () => { removeRuntimeProgress(); removeAgentProgress?.(); };
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
  const prepareAgent = async () => {
    if (!window.jverseDesktop?.localAgent) {
      setNotice("Install JVerse AI Desktop 0.1.1 or newer, then reopen the app.");
      return;
    }
    setLoading(true); setNotice("Preparing the private local Agent. The first download can take several minutes.");
    try { await window.jverseDesktop?.localAgent.prepare(); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Local Agent setup failed."); }
    finally { setLoading(false); }
  };
  const startAgent = async () => {
    if (!window.jverseDesktop?.localAgent) {
      setNotice("Install JVerse AI Desktop 0.1.1 or newer, then reopen the app.");
      return;
    }
    setLoading(true); setNotice("Starting the local JVerse Agent…");
    try { await window.jverseDesktop?.localAgent.start(); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "The local Agent could not start."); }
    finally { setLoading(false); }
  };

  return <section id="desktop-runtime" className="jv-panel mt-6 scroll-mt-6 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="jv-label text-cyan-300">DESKTOP FIRST-RUN SETUP</p><h2 className="mt-2 text-lg font-semibold">Local AI Runtime</h2><p className="mt-1 max-w-xl text-xs leading-5 text-zinc-400">JVerse runs your AI models on this computer. System installers open only from official sources; model downloads require your explicit action.</p></div><button type="button" onClick={() => void refresh()} disabled={loading} className="jv-control inline-flex items-center gap-2 px-3 py-2 text-xs text-cyan-100"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">{components.map((component) => <div key={component.id} className="rounded-xl border border-white/10 bg-black/15 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{component.label}</p>{component.status === "ready" ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300"><Check size={13} /> READY</span> : <span className="text-[10px] font-bold text-amber-200">SETUP NEEDED</span>}</div><p className="mt-1 min-h-8 text-xs leading-4 text-zinc-500">{component.detail}</p>{component.status !== "ready" && component.id === "qwen" ? <button type="button" onClick={() => void runQwenSetup()} disabled={loading} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-200 hover:text-cyan-100"><Download size={14} /> Download Qwen 2.5</button> : null}{component.status !== "ready" && (component.id === "ollama" || component.id === "python") ? <button type="button" onClick={() => void openInstaller(component.id as "ollama" | "python")} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-200 hover:text-cyan-100"><ExternalLink size={14} /> Official installer</button> : null}</div>)}</div>
    {agent ? <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-cyan-100">Private Local Agent</p><p className="mt-1 text-xs text-zinc-400">{agent.detail}</p></div>{agent.status === "ready" ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300"><Check size={14} /> ONLINE</span> : !supportsLocalAgent ? <span className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-semibold text-amber-100">Desktop update required</span> : agent.status === "setup_required" ? <button type="button" disabled={loading} onClick={() => void prepareAgent()} className="jv-control px-3 py-2 text-xs font-semibold text-cyan-100">Prepare Local Agent</button> : <button type="button" disabled={loading} onClick={() => void startAgent()} className="jv-control px-3 py-2 text-xs font-semibold text-cyan-100">Start Local Agent</button>}</div><p className="mt-3 text-[11px] leading-5 text-zinc-500">Preparation installs Python packages plus open-source Whisper and Piper models in JVerse’s private application folder. It never uploads your audio or model prompts.</p></div> : null}
    {loading ? <p className="mt-4 flex items-center gap-2 text-xs text-cyan-100"><LoaderCircle className="animate-spin" size={14} /> {notice || "Checking your setup…"}</p> : notice ? <p role="status" className="mt-4 text-xs text-cyan-100">{notice}</p> : null}
  </section>;
}
