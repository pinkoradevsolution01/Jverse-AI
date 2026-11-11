import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable(message: string, status = 503) {
  return NextResponse.json({ error: { code: "desktop_unavailable", message } }, { status });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const agentUrl = process.env.PYTHON_AGENT_URL;
  if (!url || !key || !agentUrl) return unavailable("The JVerse desktop agent is not configured.");

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } });
  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !session?.access_token) return unavailable("Authentication is required for desktop actions.", 401);

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") return unavailable("A desktop action payload is required.", 400);
  try {
    const upstream = await fetch(`${agentUrl.replace(/\/$/, "")}/v1/desktop/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(payload), cache: "no-store",
    });
    return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" } });
  } catch {
    return unavailable("The Python Agent is offline.");
  }
}
