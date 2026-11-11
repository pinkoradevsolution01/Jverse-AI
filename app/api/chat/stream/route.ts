import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { parseChatStreamRequest } from "../../../../lib/ai/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: { code: "chat_unavailable", message } }, { status });
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const controlPlaneUrl = process.env.AI_CONTROL_PLANE_URL;
  const controlPlaneToken = process.env.AI_CONTROL_PLANE_TOKEN;

  if (!supabaseUrl || !supabaseKey) {
    return errorResponse("Supabase session validation is not configured.", 503);
  }

  if (!controlPlaneUrl || !controlPlaneToken) {
    return errorResponse("The JVerse AI control plane is not configured.", 503);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => undefined,
    },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return errorResponse("Authentication is required to start a chat.", 401);
  }

  const payload = parseChatStreamRequest(await request.json().catch(() => null));
  if (!payload) {
    return NextResponse.json(
      { error: { code: "invalid_chat_request", message: "A valid workspace, optional conversation, and message are required." } },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${controlPlaneUrl.replace(/\/$/, "")}/v1/chat/stream`, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        "X-JVerse-Control-Plane-Token": controlPlaneToken,
        "X-JVerse-User-Id": user.id,
      },
      body: JSON.stringify(payload),
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    return errorResponse("The JVerse AI control plane is offline.", 503);
  }

  if (!upstream.ok || !upstream.body) {
    return errorResponse("The AI provider could not start a response.", upstream.status || 502);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
