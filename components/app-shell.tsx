"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Bell, Bot, BrainCircuit, ChevronLeft, Command, FolderKanban, LayoutDashboard, Menu, MessageSquare, Search, Settings, X } from "lucide-react";
import { useShell } from "./shell-provider";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/knowledge", label: "Knowledge", icon: BrainCircuit },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/developer", label: "Developer", icon: Bot },
];

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const close = useShell((s) => s.setMobileNavOpen);
  return <nav className="space-y-1">{nav.map(({ href, label, icon: Icon }) => {
    const active = pathname.startsWith(href);
    return <Link onClick={() => mobile && close(false)} href={href} key={href} className={"group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition " + (active ? "bg-cyan-300/10 text-cyan-100 ring-1 ring-inset ring-cyan-300/25" : "text-zinc-400 hover:bg-white/5 hover:text-white")}>
      <Icon size={18} /><span>{label}</span>{active && <i className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#00e5ff]" />}
    </Link>;
  })}</nav>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentRoute = nav.find((item) => pathname.startsWith(item.href))?.label ?? "Workspace";
  const sidebar = useShell((s) => s.sidebar);
  const toggle = useShell((s) => s.toggleSidebar);
  const mobileOpen = useShell((s) => s.mobileNavOpen);
  const setMobile = useShell((s) => s.setMobileNavOpen);
  const commandOpen = useShell((s) => s.commandOpen);
  const setCommand = useShell((s) => s.setCommandOpen);
  const notifications = useShell((s) => s.notificationOpen);
  const setNotifications = useShell((s) => s.setNotificationOpen);

  // The dashboard is an immersive command center with its own full-screen navigation.
  if (pathname === "/dashboard") {
    return <MotionConfig reducedMotion="user"><main id="main-content">{children}</main></MotionConfig>;
  }

  return <MotionConfig reducedMotion="user">
    <div className="min-h-screen text-white">
      <a href="#main-content" className="absolute left-4 top-4 z-[80] -translate-y-16 rounded-md bg-cyan-300 px-3 py-2 text-sm font-bold text-[#050816] focus:translate-y-0">Skip to content</a>
      <aside className={"glass fixed inset-y-4 left-4 z-30 hidden flex-col rounded-3xl p-3 transition-all duration-300 lg:flex " + (sidebar === "expanded" ? "w-64" : "w-20")}>
        <div className="mb-8 flex h-10 items-center gap-3 px-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300 text-[#050816] shadow-[0_0_25px_rgba(0,229,255,.35)]"><Bot size={20}/></span>{sidebar === "expanded" && <b className="tracking-tight">JVERSE <em className="not-italic text-cyan-300">AI</em></b>}</div>
        {sidebar === "expanded" && <button onClick={() => setCommand(true)} className="mb-6 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-zinc-400 hover:text-white"><Search size={15}/><span>Search anything</span><kbd className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[10px]">⌘ K</kbd></button>}
        <Navigation />
        <div className="mt-auto border-t border-white/10 pt-3"><Link href="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white"><Settings size={18}/>{sidebar === "expanded" && "Settings"}</Link><button onClick={toggle} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white"><ChevronLeft className={sidebar === "compact" ? "rotate-180" : ""} size={18}/>{sidebar === "expanded" && "Collapse sidebar"}</button></div>
      </aside>
      <div className={"min-h-screen transition-all duration-300 " + (sidebar === "expanded" ? "lg:pl-80" : "lg:pl-28")}>
        <header className="flex h-20 items-center justify-between px-4 sm:px-7"><button onClick={() => setMobile(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 lg:hidden"><Menu size={19}/></button><div><p className="text-[10px] font-bold tracking-[.18em] text-cyan-300">JVERSE // INTELLIGENCE WORKSPACE</p><p className="mt-1 text-sm font-medium text-zinc-200">{currentRoute}</p></div><div className="ml-auto flex items-center gap-2"><button onClick={() => setCommand(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:text-cyan-200"><Command size={17}/></button><button onClick={() => setNotifications(!notifications)} className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:text-cyan-200"><Bell size={17}/><i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-400"/></button><div className="ml-2 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-violet-500 text-sm font-bold text-[#050816]">JV</div></div></header>
        <main id="main-content" className="px-4 pb-8 sm:px-7">{children}</main>
      </div>
      <AnimatePresence>{mobileOpen && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-[#02040d]/75 backdrop-blur-sm lg:hidden"><motion.aside initial={{x:-320}} animate={{x:0}} exit={{x:-320}} transition={{type:"spring", damping:28, stiffness:300}} className="glass h-full w-80 rounded-none border-y-0 border-l-0 p-5"><div className="mb-8 flex items-center justify-between"><b>JVERSE <span className="text-cyan-300">AI</span></b><button onClick={() => setMobile(false)} className="rounded-lg p-2 text-zinc-300"><X size={19}/></button></div><Navigation mobile/></motion.aside></motion.div>}</AnimatePresence>
      <AnimatePresence>{commandOpen && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setCommand(false)} className="fixed inset-0 z-50 grid place-items-start bg-[#02040d]/70 px-4 pt-[16vh] backdrop-blur-sm"><motion.div onClick={(e) => e.stopPropagation()} initial={{y:-12, scale:.98}} animate={{y:0, scale:1}} exit={{y:-12,scale:.98}} className="glass w-full max-w-xl rounded-2xl p-3"><div className="flex items-center gap-3 border-b border-white/10 p-3 text-zinc-400"><Search size={18}/><input autoFocus placeholder="Search pages and commands..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"/><kbd className="text-xs">ESC</kbd></div><div className="p-2 text-xs text-zinc-500">Navigate</div><Navigation /></motion.div></motion.div>}</AnimatePresence>
      <AnimatePresence>{notifications && <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} className="glass fixed right-5 top-20 z-40 w-80 rounded-2xl p-4"><div className="mb-4 flex justify-between"><b className="text-sm">Notifications</b><button onClick={() => setNotifications(false)} className="text-xs text-cyan-300">Close</button></div><div className="rounded-xl border border-white/10 bg-white/[.03] p-3 text-sm text-zinc-300">Your JVerse workspace is ready for configuration.</div></motion.div>}</AnimatePresence>
    </div>
  </MotionConfig>;
}

