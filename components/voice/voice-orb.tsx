"use client";

import { motion } from "framer-motion";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";

const stateClass: Record<VoiceState, string> = {
  idle: "bg-cyan-300/25 shadow-[0_0_22px_rgba(34,211,238,.28)]",
  listening: "bg-cyan-200 shadow-[0_0_34px_rgba(34,211,238,.78)]",
  thinking: "bg-violet-300 shadow-[0_0_34px_rgba(167,139,250,.72)]",
  speaking: "bg-emerald-300 shadow-[0_0_34px_rgba(110,231,183,.72)]",
  error: "bg-rose-300 shadow-[0_0_30px_rgba(253,164,175,.65)]",
};

export function VoiceOrb({ state, compact = false }: { state: VoiceState; compact?: boolean }) {
  return (
    <motion.span
      aria-hidden="true"
      animate={state === "idle" ? { scale: 1, opacity: 0.75 } : { scale: [1, 1.18, 1], opacity: [0.72, 1, 0.72] }}
      transition={{ duration: state === "speaking" ? 0.7 : 1.35, repeat: state === "idle" ? 0 : Infinity, ease: "easeInOut" }}
      className={`relative grid shrink-0 place-items-center rounded-full ${compact ? "h-8 w-8" : "h-14 w-14"} ${stateClass[state]}`}
    >
      <span className={`rounded-full bg-[#071326]/80 ${compact ? "h-3 w-3" : "h-5 w-5"}`} />
      {state === "listening" ? <span className="absolute inset-0 rounded-full border border-cyan-100/80" /> : null}
    </motion.span>
  );
}
