import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Place = { name: string; lat: number; lng: number };
type CachedPlace = { expiresAt: number; places: Place[] };
const placeCache = new Map<string, CachedPlace>();
let lastPublicGeocodeAt = 0;

/** A user-triggered, cached proxy which respects Nominatim's public 1 req/s policy. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length > 120) return NextResponse.json({ error: "Enter a place name." }, { status: 400 });

  const cacheKey = query.toLocaleLowerCase();
  const cached = placeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return NextResponse.json({ places: cached.places });

  const pause = Math.max(0, 1_050 - (Date.now() - lastPublicGeocodeAt));
  if (pause) await new Promise((resolve) => setTimeout(resolve, pause));
  lastPublicGeocodeAt = Date.now();

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("q", query);
    const response = await fetch(url, {
      headers: { "User-Agent": "JVerseAI/0.1 (interactive map search; contact@jverseai.space)", Accept: "application/json" },
      next: { revalidate: 3_600 },
    });
    if (!response.ok) throw new Error("Place lookup is unavailable.");
    const records = await response.json() as Array<{ display_name?: string; lat?: string; lon?: string }>;
    const places = records.flatMap((record): Place[] => record.lat && record.lon && Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lon))
      ? [{ name: record.display_name ?? query, lat: Number(record.lat), lng: Number(record.lon) }]
      : []);
    placeCache.set(cacheKey, { places, expiresAt: Date.now() + 3_600_000 });
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ error: "Place lookup is unavailable. Try again shortly." }, { status: 502 });
  }
}
