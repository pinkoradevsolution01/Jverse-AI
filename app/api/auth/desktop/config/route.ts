import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return NextResponse.json({ error: "authentication_unavailable" }, { status: 503 });
  return NextResponse.json({ supabaseUrl, publishableKey }, { headers: { "Cache-Control": "no-store" } });
}
