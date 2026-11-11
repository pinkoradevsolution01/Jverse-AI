"use client";

import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("JVerse route error", error); }, [error]);
  return <main className="mx-auto grid min-h-screen max-w-xl place-items-center p-6 text-center"><section className="jv-panel p-8"><p className="jv-label text-rose-300">Workspace interruption</p><h1 className="mt-3 text-2xl font-semibold">JVerse could not load this view.</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Your data is safe. Retry the view, or return to the dashboard.</p>{error.digest ? <p className="mt-3 font-mono text-xs text-zinc-600">Reference: {error.digest}</p> : null}<button type="button" onClick={reset} className="mt-6 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-[#050816]">Try again</button></section></main>;
}
