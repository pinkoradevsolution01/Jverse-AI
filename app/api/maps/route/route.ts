import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Coordinate = { lat: number; lng: number };
const allowedProfiles = new Set(["driving", "foot", "cycling"]);

function coordinate(value: string | null): Coordinate | null {
  if (!value) return null;
  const [latText, lngText] = value.split(",");
  const lat = Number(latText); const lng = Number(lngText);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export async function GET(request: NextRequest) {
  const from = coordinate(request.nextUrl.searchParams.get("from"));
  const to = coordinate(request.nextUrl.searchParams.get("to"));
  const profile = request.nextUrl.searchParams.get("profile") ?? "driving";
  if (!from || !to || !allowedProfiles.has(profile)) return NextResponse.json({ error: "A valid start, destination, and travel mode are required." }, { status: 400 });

  try {
    const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const response = await fetch(`https://router.project-osrm.org/route/v1/${profile}/${coordinates}?overview=full&geometries=geojson&steps=false`, {
      headers: { Accept: "application/json" }, next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error("Route service unavailable.");
    const payload = await response.json() as { code?: string; routes?: Array<{ distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }> };
    const route = payload.routes?.[0];
    if (payload.code !== "Ok" || !route) throw new Error("No route found.");
    return NextResponse.json({
      distanceKm: route.distance / 1_000,
      durationMinutes: route.duration / 60,
      geometry: (route.geometry?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })),
    });
  } catch {
    return NextResponse.json({ error: "Route calculation is unavailable. Try again shortly." }, { status: 502 });
  }
}
