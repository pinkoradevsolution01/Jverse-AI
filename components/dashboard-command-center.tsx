"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, BarChart3, Bot, Box, BrainCircuit, BriefcaseBusiness, CalendarDays,
  ChevronRight, Cloud, Code2, Database, Dumbbell, FileText, GraduationCap,
  HardDrive, Home, ImageIcon, Layers3, MapPinned, Maximize2, MessageSquare, Mic, Minimize2, PlusSquare,
  Send, Settings, Sparkles, Volume2, Wifi, Zap,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { VoiceControl } from "./voice/voice-control";
import type { VoiceState } from "./voice/voice-orb";
import { BrandLogo } from "./brand-logo";
import { JVerseMapWorkspace } from "./map/jverse-map-workspace";

type Module = {
  title: string;
  subtitle: string;
  href: string;
  icon: typeof MessageSquare;
};

const modules: Module[] = [
  { title: "Chat Assistant", subtitle: "General Q&A, tasks, ideas", href: "/chat", icon: MessageSquare },
  { title: "Code Assistant", subtitle: "Generate, debug, explain", href: "/developer", icon: Code2 },
  { title: "Project Manager", subtitle: "Plan, track, and organize", href: "/projects", icon: FileText },
  { title: "Business Assistant", subtitle: "Planning, sales insights", href: "/projects", icon: BarChart3 },
  { title: "Health & Fitness", subtitle: "Goals, routines, progress", href: "/chat?prompt=Help%20me%20plan%20a%20healthy%20routine", icon: Dumbbell },
  { title: "Learning Hub", subtitle: "Skills, notes, and study", href: "/knowledge", icon: GraduationCap },
];

const quickActions = [
  { label: "New Task", icon: PlusSquare, prompt: "Help me create a new task plan." },
  { label: "Schedule", icon: CalendarDays, prompt: "Help me plan my schedule." },
  { label: "Notes", icon: FileText, prompt: "Help me organize my notes." },
  { label: "Generate", icon: ImageIcon, prompt: "Help me generate an idea." },
  { label: "Analyze", icon: Sparkles, prompt: "Help me analyze my latest project." },
  { label: "My Apps", icon: Box, prompt: "Show me how to manage my desktop apps." },
];

function JVerseMark({ small = false }: { small?: boolean }) {
  return <BrandLogo decorative className={`jv-brand-mark ${small ? "jv-brand-mark-small" : ""}`} />;
}

function StatusBar({ label, value, width, icon: Icon }: { label: string; value: string; width: string; icon: typeof Activity }) {
  return <div className="jv-status-row">
    <span className="jv-status-icon"><Icon size={18} /></span>
    <div className="min-w-0 flex-1"><div className="flex justify-between gap-2 text-xs font-semibold text-slate-100"><span>{label}</span><span>{value}</span></div><i className="jv-status-track"><b style={{ width }} /></i></div>
  </div>;
}

function mapPlaceFromCommand(command: string) {
  if (!/\b(map|directions?|navigate|route)\b/i.test(command)) return null;
  const place = command
    .replace(/^\s*(?:hey\s+)?jverse[\s,:-]*/i, "")
    .replace(/^(?:please\s+)?(?:open|show|launch)\s+(?:(?:a|the)\s+)?map(?:\s+(?:to|in|at|for|of))?\s*/i, "")
    .replace(/^map(?:\s+(?:to|in|at|for|of))?\s*/i, "")
    .replace(/^(?:get\s+)?directions?\s+(?:to|for)\s*/i, "")
    .replace(/^navigate\s+(?:to\s*)?/i, "")
    .replace(/^route\s+(?:to\s*)?/i, "")
    .trim();
  return place || "";
}

export function DashboardCommandCenter() {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [draft, setDraft] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [response, setResponse] = useState("");
  const [running, setRunning] = useState(false);
  const [responseExpanded, setResponseExpanded] = useState(false);
  const [mapOverlay, setMapOverlay] = useState<{ place: string } | null>(null);
  const [mapControlsOpen, setMapControlsOpen] = useState(false);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const time = now ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }).format(now) : "--:--";
  const date = now ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(now) : "Synchronizing";
  const playLocalSpeech = async (text: string) => {
    const bytes = await window.jverseDesktop!.localAgent.speak(text);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const url = URL.createObjectURL(new Blob([copy.buffer], { type: "audio/wav" }));
    const player = new Audio(url);
    player.onended = () => { URL.revokeObjectURL(url); setVoiceState("idle"); };
    player.onerror = () => { URL.revokeObjectURL(url); setVoiceState("error"); };
    await player.play();
  };
  const launchPrompt = async (prompt: string) => {
    if (!prompt.trim() || running) return;
    const closeMap = /\b(?:close|hide|exit)\s+(?:the\s+)?(?:ai\s+)?map\b/i.test(prompt);
    const openMapControls = /\b(?:open|show)\s+(?:the\s+)?(?:map\s+)?(?:buttons|controls|directions)\b/i.test(prompt);
    if (mapOverlay && closeMap) { setMapOverlay(null); setMapControlsOpen(false); return; }
    if (mapOverlay && openMapControls) { setMapControlsOpen(true); return; }
    const mapPlace = mapPlaceFromCommand(prompt);
    if (mapPlace !== null) {
      setMapOverlay({ place: mapPlace });
      setMapControlsOpen(openMapControls);
      return;
    }
    // Browser users enter the authenticated Chat workspace. Desktop users can
    // receive a private local response directly from the animated core.
    if (!window.jverseDesktop?.localAgent) {
      router.push(`/chat?prompt=${encodeURIComponent(prompt)}`);
      return;
    }
    setRunning(true);
    setResponse("");
    setVoiceState("thinking");
    const requestId = crypto.randomUUID();
    let answer = "";
    const unsubscribe = window.jverseDesktop.localAgent.onEvent(({ requestId: receivedId, event }) => {
      if (receivedId !== requestId || !event || typeof event !== "object") return;
      const message = event as { type?: string; payload?: { text?: unknown } };
      if (message.type !== "delta" || typeof message.payload?.text !== "string") return;
      answer += message.payload.text;
      setResponse(answer);
    });
    try {
      await window.jverseDesktop.localAgent.chat(requestId, prompt.trim());
      if (!answer.trim()) throw new Error("The local Agent did not return a response.");
      setVoiceState("speaking");
      await playLocalSpeech(answer);
    } catch (error) {
      setVoiceState("error");
      setResponse(error instanceof Error ? error.message : "JVerse could not complete that command.");
    } finally {
      unsubscribe();
      setRunning(false);
    }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void launchPrompt(draft); setDraft(""); };
  const coreLabel: Record<VoiceState, string> = { idle: "ONLINE", listening: "LISTENING", processing: "PROCESSING", thinking: "THINKING", speaking: "SPEAKING", error: "CHECK VOICE" };

  return <div className="jv-command-center">
    <div className="jv-command-noise" aria-hidden />
    <header className="jv-command-header">
      <section className="jv-header-card jv-clock-card"><strong>{time}</strong><span>{date}</span></section>
      <section className="jv-header-card jv-weather-card"><Cloud className="text-cyan-300" size={31} /><div><strong>28°C</strong><span>JVerse Local</span></div></section>
      <Link href="/dashboard" aria-label="JVerse AI dashboard" className="jv-command-logo"><JVerseMark /><span>JVERSE <b>AI</b><em>YOUR PERSONAL AI ASSISTANT</em></span></Link>
      <section className="jv-header-card jv-network-card"><Wifi className="text-cyan-300" size={23} /><div><strong>Online</strong><span><Cloud size={14} /> Local sync</span></div></section>
      <section className="jv-header-card jv-resource-card"><p><b>CPU 12%</b><i><em style={{ width: "22%" }} /></i><span>12%</span></p><p><b>RAM</b><i><em style={{ width: "48%" }} /></i><span>48%</span></p></section>
    </header>

    <aside className="jv-icon-rail" aria-label="Primary navigation">
      <Link href="/dashboard" aria-label="Dashboard"><Home /></Link><Link href="/chat" aria-label="Chat"><MessageSquare /></Link><Link href="/knowledge" aria-label="Knowledge"><Box /></Link><Link href="/map" aria-label="AI Map"><MapPinned /></Link><Link href="/developer" aria-label="Developer"><Code2 /></Link><Link href="/projects" aria-label="Projects"><BarChart3 /></Link><Link href="/settings" aria-label="Settings"><Settings /></Link>
    </aside>

    <main className="jv-command-main">
      <section className="jv-module-panel jv-hud-box">
        <h2><Layers3 /> AI MODULES <span /></h2>
        <div className="jv-module-list">{modules.map(({ title, subtitle, href, icon: Icon }) => <Link href={href} key={title} className="jv-module-card"><span><Icon size={29} /></span><div><b>{title}</b><small>{subtitle}</small></div><ChevronRight size={22} /></Link>)}</div>
      </section>

      <section className="jv-core-column">
        <section className="jv-reactor-stage" aria-label={`JVerse AI core: ${coreLabel[voiceState]}`}>
          <div className="jv-reactor-cross jv-reactor-cross-x" /><div className="jv-reactor-cross jv-reactor-cross-y" />
          <motion.button type="button" onClick={() => void launchPrompt("Hello JVerse. What can you help me with today?")} className={`jv-command-reactor jv-command-reactor-${voiceState}`} whileTap={{ scale: 0.97 }} aria-label="Ask JVerse AI for help">
            <span className="jv-reactor-halo jv-reactor-halo-a" /><span className="jv-reactor-halo jv-reactor-halo-b" /><span className="jv-reactor-tick-ring" /><span className="jv-reactor-progress" /><span className="jv-reactor-scanline" />
            <span className="jv-reactor-core"><JVerseMark /><strong>JVERSE <b>AI</b></strong><em>{coreLabel[voiceState]}</em></span>
          </motion.button>
          <p className="jv-reactor-caption"><Bot size={15} /> JVERSE CORE // {coreLabel[voiceState]}</p>
        </section>
        {response ? <button type="button" className="jv-response-dock" onClick={() => setResponseExpanded(true)} aria-label="Open JVerse response in reading mode"><span><Bot size={15} /> JVERSE RESPONSE <em>{running ? "STREAMING" : "COMPLETE"}</em></span><p>{response}</p><Maximize2 size={16} /></button> : null}
      </section>

      <section className="jv-right-stack">
        <div className="jv-hud-box jv-system-panel"><h2><Activity /> SYSTEM STATUS</h2><StatusBar label="AI Engine" value="100%" width="100%" icon={BrainCircuit} /><StatusBar label="Knowledge Base" value="98%" width="98%" icon={Layers3} /><StatusBar label="Local Resources" value="92%" width="92%" icon={Database} /></div>
        <div className="jv-hud-box jv-actions-panel"><h2><Zap /> QUICK ACTIONS</h2><div>{quickActions.map(({ label, icon: Icon, prompt }) => <button type="button" key={label} onClick={() => void launchPrompt(prompt)}><Icon size={28} /><span>{label}</span></button>)}</div></div>
      </section>
    </main>

    <footer className="jv-command-footer">
      <div className="jv-footer-ident"><Activity size={39} /><p><b>JVerse AI v2.0</b><span>AI • Productivity • Development • Business</span></p></div>
      <form onSubmit={submit} className="jv-command-input"><Mic size={23} /><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask JVerse AI anything..." aria-label="Ask JVerse AI anything" /><VoiceControl onTranscript={(prompt) => void launchPrompt(prompt)} onStateChange={setVoiceState} /><button type="submit" aria-label="Send command" disabled={!draft.trim() || running}><Send size={25} /></button></form>
      <div className="jv-footer-powered"><BarChart3 className="text-cyan-300" size={40} /><JVerseMark small /><span>Powered by JVerse</span></div>
    </footer>
    <div className="jv-command-corners" aria-hidden><i /><i /><i /><i /></div>
    <AnimatePresence>{responseExpanded && response ? <motion.div className="jv-response-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setResponseExpanded(false)}>
      <motion.section role="dialog" aria-modal="true" aria-label="JVerse AI response" className="jv-response-modal" initial={{ opacity: 0, y: 24, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: .97 }} onClick={(event) => event.stopPropagation()}>
        <header><span><JVerseMark small /><b>JVERSE AI</b><em>{running ? "STREAMING RESPONSE" : "RESPONSE COMPLETE"}</em></span><button type="button" onClick={() => setResponseExpanded(false)}><Minimize2 size={17} /> Minimize</button></header>
        <article aria-live="polite">{response}</article>
        <footer><i className={running ? "is-live" : ""} />{running ? "JVerse is still responding…" : "Click Minimize to return to the command center."}</footer>
      </motion.section>
    </motion.div> : null}</AnimatePresence>
    <AnimatePresence>{mapOverlay ? <motion.section className="jv-ai-map-overlay" aria-label="JVerse AI Map" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .98 }} transition={{ duration: .42, ease: "easeOut" }}>
      <JVerseMapWorkspace immersive initialPlace={mapOverlay.place} controlsVisible={mapControlsOpen} onVoiceCommand={(command) => void launchPrompt(command)} />
    </motion.section> : null}</AnimatePresence>
  </div>;
}
