import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export default function PublicHome() {
  return <section className="mx-auto grid min-h-[calc(100vh-92px)] max-w-6xl place-items-center py-16 text-center"><div><p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold tracking-[.14em] text-cyan-200"><Sparkles size={13}/> INTELLIGENT WORKSPACE</p><h1 className="mt-7 text-5xl font-semibold tracking-tight sm:text-7xl">A clearer way to<br/><span className="text-zinc-500">command your work.</span></h1><p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-zinc-400">JVerse AI brings your conversations, knowledge, and projects into one calm command center.</p><Link href="/dashboard" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-[#050816] shadow-[0_0_32px_rgba(0,229,255,.25)]">Enter workspace <ArrowRight size={17}/></Link></div></section>;
}
