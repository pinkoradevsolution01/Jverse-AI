"use client";
import dynamic from "next/dynamic";

const AiCoreCanvas = dynamic(() => import("./ai-core-canvas").then((module) => module.AiCoreCanvas), { ssr: false });
export function AiCore() {
  return <div className="relative h-44 overflow-hidden rounded-3xl border border-cyan-300/20 bg-[#071326]">
    <AiCoreCanvas />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-[#071326] px-4 pb-3 pt-10">
      <span className="text-[10px] font-bold tracking-[.18em] text-cyan-200">JVERSE CORE</span>
      <span className="flex items-center gap-2 text-xs text-cyan-100"><i className="signal-dot h-1.5 w-1.5 rounded-full bg-cyan-300" /> READY</span>
    </div>
  </div>;
}

