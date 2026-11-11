import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <main className="grid-bg min-h-screen px-5 py-6 text-white sm:px-10"><header className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/" className="flex items-center gap-3 font-semibold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300 text-[#050816]">J</span>JVERSE <span className="text-cyan-300">AI</span></Link><Link href="/dashboard" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200">Open workspace</Link></header>{children}</main>;
}
