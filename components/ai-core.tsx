"use client";
import dynamic from "next/dynamic";

const AiCoreCanvas = dynamic(() => import("./ai-core-canvas").then((module) => module.AiCoreCanvas), { ssr: false });
export function AiCore() {
  return <div className="relative h-44 overflow-hidden rounded-3xl border border-cyan-300/20 bg-[#071326]">
    <>
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(0,229,255,.24),transparent_15%),radial-gradient(circle_at_50%_48%,rgba(124,58,237,.18),transparent_38%),linear-gradient(135deg,rgba(0,229,255,.05),transparent_48%,rgba(124,58,237,.10))]" />
      <div aria-hidden className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/30 bg-cyan-300/10 shadow-[0_0_44px_rgba(0,229,255,.48)]" />
      <div aria-hidden className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border border-cyan-100/70 bg-cyan-200/25 shadow-[0_0_32px_rgba(0,229,255,.75)]" />
      <div aria-hidden className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/15" />
      <div aria-hidden className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-300/10" />
      <div aria-hidden className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(0,229,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,.08)_1px,transparent_1px)] [background-size:22px_22px]" />
    </>
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-[#071326] px-4 pb-3 pt-10">
      <span className="text-[10px] font-bold tracking-[.18em] text-cyan-200">JVERSE CORE</span>
      <span className="flex items-center gap-2 text-xs text-cyan-100"><i className="signal-dot h-1.5 w-1.5 rounded-full bg-cyan-300" /> READY</span>
    </div>
  </div>;
}

