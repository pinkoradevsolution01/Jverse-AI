import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ actionId: string }> }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const agentUrl = process.env.PYTHON_AGENT_URL;
  if (!url || !key || !agentUrl) return NextResponse.json({ error: { code: "desktop_unavailable", message: "The JVerse desktop agent is not configured." } }, { status: 503 });
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } });
  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !session?.access_token) return NextResponse.json({ error: { code: "unauthenticated", message: "Authentication is required for desktop actions." } }, { status: 401 });
  const { actionId } = await params;
  try {
    const upstream = await fetch(`${agentUrl.replace(/\/$/, "")}/v1/desktop/actions/${encodeURIComponent(actionId)}/approve`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
    return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: { code: "desktop_unavailable", message: "The Python Agent is offline." } }, { status: 503 });
  }
}
