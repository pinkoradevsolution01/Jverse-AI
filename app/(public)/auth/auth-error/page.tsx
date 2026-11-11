import Link from "next/link";
export default function Page() { return <main className="grid min-h-[calc(100vh-100px)] place-items-center text-center"><div><p className="text-lg font-semibold">We could not complete that sign-in.</p><p className="mt-2 text-sm text-zinc-500">The link may be expired or the provider configuration needs attention.</p><Link className="mt-5 inline-block rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-[#050816]" href="/auth/sign-in">Return to sign in</Link></div></main>; }

