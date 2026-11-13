"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Car, Footprints, LocateFixed, MapPinned, Navigation, Route, Search, Sparkles, Timer, Bike } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import type { MapPoint } from "./map-canvas";
import { VoiceControl } from "../voice/voice-control";

const MapCanvas = dynamic(() => import("./map-canvas").then((module) => module.MapCanvas), { ssr: false, loading: () => <div className="jv-map-loading">Initializing global map…</div> });

type RouteMode = "walk" | "motorcycle" | "car" | "bus";
type RouteResult = { distanceKm: number; durationMinutes: number; geometry: MapPoint[]; estimated?: boolean };
const modes: Array<{ id: RouteMode; label: string; profile: "foot" | "driving"; icon: typeof Footprints }> = [
  { id: "walk", label: "Walk", profile: "foot", icon: Footprints },
  { id: "motorcycle", label: "Motorcycle", profile: "driving", icon: Bike },
  { id: "car", label: "Car", profile: "driving", icon: Car },
  { id: "bus", label: "Bus", profile: "driving", icon: Navigation },
];

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
function distance(km: number) { return `${number.format(km)} km`; }
function duration(minutes: number) { return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m` : `${Math.max(1, Math.round(minutes))} min`; }

export function JVerseMapWorkspace({ immersive = false, initialPlace, controlsVisible = true, onVoiceCommand }: { immersive?: boolean; initialPlace?: string; controlsVisible?: boolean; onVoiceCommand?: (command: string) => void }) {
  const searchParams = useSearchParams();
  const requestedPlace = initialPlace?.trim() ?? searchParams.get("place")?.trim() ?? "";
  const [query, setQuery] = useState(requestedPlace);
  const [destination, setDestination] = useState<MapPoint | null>(null);
  const [matches, setMatches] = useState<MapPoint[]>([]);
  const [origin, setOrigin] = useState<MapPoint | null>(null);
  const [routes, setRoutes] = useState<Partial<Record<RouteMode, RouteResult>>>({});
  const [selectedMode, setSelectedMode] = useState<RouteMode>("car");
  const [notice, setNotice] = useState("Say “open map to [place]” or search for a destination.");
  const [searching, setSearching] = useState(false);
  const [routing, setRouting] = useState(false);
  const appliedQuery = useRef("");

  async function findPlace(value = query) {
    const placeName = value.trim();
    if (!placeName) return;
    setSearching(true); setNotice("Locating destination on the global map…");
    try {
      const response = await fetch(`/api/maps/search?q=${encodeURIComponent(placeName)}`);
      const body = await response.json() as { places?: MapPoint[]; error?: string };
      const first = body.places?.[0];
      if (!response.ok || !first) throw new Error(body.error ?? "No location was found.");
      setDestination(first); setMatches(body.places ?? []); setQuery(first.name ?? placeName); setRoutes({}); setNotice(body.places && body.places.length > 1 ? "Best match pinned. Select another match below if needed." : "Destination pinned. Use your location to calculate routes.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Location search failed."); }
    finally { setSearching(false); }
  }

  useEffect(() => {
    if (!requestedPlace || appliedQuery.current === requestedPlace) return;
    appliedQuery.current = requestedPlace;
    void findPlace(requestedPlace);
  // A voice/map command changes only through the URL.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedPlace]);

  function useCurrentLocation() {
    if (!navigator.geolocation) { setNotice("This device does not provide location services."); return; }
    setNotice("Requesting your current location…");
    navigator.geolocation.getCurrentPosition(
      (position) => { setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude, name: "Your location" }); setRoutes({}); setNotice(destination ? "Your location is ready. Calculate routes when you are ready." : "Your location is ready. Search for a destination."); },
      (error) => setNotice(error.code === error.PERMISSION_DENIED
        ? "Location permission was not granted. In Windows, enable Settings › Privacy & security › Location, then reopen JVerse AI."
        : "Your location could not be determined. Check that location services are enabled and try again."),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  async function calculateRoutes() {
    if (!origin || !destination) { setNotice("Choose a destination and enable your location first."); return; }
    setRouting(true); setNotice("Calculating walking and road routes…");
    const pair = `${origin.lat},${origin.lng}`; const target = `${destination.lat},${destination.lng}`;
    try {
      const request = async (profile: "foot" | "driving") => {
        const response = await fetch(`/api/maps/route?from=${encodeURIComponent(pair)}&to=${encodeURIComponent(target)}&profile=${profile}`);
        const body = await response.json() as RouteResult & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "A route could not be calculated.");
        return body;
      };
      const [walk, drive] = await Promise.all([request("foot"), request("driving")]);
      setRoutes({
        walk,
        car: drive,
        motorcycle: { ...drive, durationMinutes: drive.durationMinutes * .84, estimated: true },
        bus: { ...drive, durationMinutes: (drive.durationMinutes * 1.45) + 6, estimated: true },
      });
      setNotice("Routes ready. Choose a travel mode to view its path and distance.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Route calculation failed."); }
    finally { setRouting(false); }
  }

  const activeRoute = routes[selectedMode];
  const submit = (event: FormEvent) => { event.preventDefault(); void findPlace(); };

  return <section className={`jv-map-workspace ${immersive ? "jv-map-immersive" : ""} ${controlsVisible ? "jv-map-controls-open" : "jv-map-controls-hidden"}`}>
    {!immersive || controlsVisible ? <header className="jv-map-header"><div><p className="jv-label text-cyan-300">JVERSE // GLOBAL NAVIGATION</p><h1><MapPinned /> AI Map</h1><p>Voice-ready place search, live pinning, and distance-aware route planning.</p></div><span className="jv-status"><i className="jv-status-dot" /> GLOBAL MAP ONLINE</span></header> : <div className="jv-map-immersive-status"><MapPinned size={16} /> JVERSE AI MAP <i /> {destination ? "DESTINATION LOCKED" : "GLOBAL NAVIGATION"}</div>}
    <div className="jv-map-grid">
      <aside className="jv-map-panel jv-map-controls">
        <form onSubmit={submit}><label>Destination</label><div><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Baguio City, Philippines" /><button disabled={searching}>{searching ? "Searching" : "Pin"}</button></div></form>
        <button type="button" className="jv-map-location" onClick={useCurrentLocation}><LocateFixed size={17} /> Use my current location</button>
        <button type="button" className="jv-map-route-button" onClick={() => void calculateRoutes()} disabled={routing || !origin || !destination}><Route size={17} /> {routing ? "Calculating routes…" : "Get directions"}</button>
        {onVoiceCommand ? <VoiceControl className="jv-map-voice-controls" onTranscript={onVoiceCommand} /> : null}
        <p className="jv-map-notice" role="status"><Sparkles size={15} /> {notice}</p>
        {destination ? <div className="jv-map-place"><span>DESTINATION PINNED</span><b>{destination.name}</b><small>{destination.lat.toFixed(5)}, {destination.lng.toFixed(5)}</small></div> : null}
        {matches.length > 1 ? <div className="jv-map-matches"><span>MATCHES</span>{matches.slice(0, 4).map((place) => <button type="button" key={`${place.lat}:${place.lng}`} onClick={() => { setDestination(place); setQuery(place.name ?? query); setRoutes({}); setNotice("Destination updated. Calculate routes when ready."); }}>{place.name}</button>)}</div> : null}
      </aside>
      <div className="jv-map-canvas-wrap"><MapCanvas origin={origin} destination={destination} route={activeRoute?.geometry ?? []} /><div className="jv-map-scan" aria-hidden /><div className="jv-map-attribution">Map data © OpenStreetMap contributors</div></div>
      <aside className="jv-map-panel jv-route-panel"><div className="jv-route-title"><Timer size={18} /><span>ROUTE INTELLIGENCE</span></div><div className="jv-mode-list">{modes.map(({ id, label, icon: Icon }) => { const item = routes[id]; return <button type="button" key={id} disabled={!item} onClick={() => setSelectedMode(id)} className={selectedMode === id ? "is-selected" : ""}><Icon size={19} /><span><b>{label}</b><small>{id === "bus" ? "Road-based transit estimate" : id === "motorcycle" ? "Road speed estimate" : "Road network route"}</small></span><em>{item ? <><strong>{distance(item.distanceKm)}</strong>{duration(item.durationMinutes)}</> : "—"}</em></button>; })}</div><p className="jv-route-disclaimer">Walking, driving, and motorcycle use OpenStreetMap road networks. Bus time is an estimate; live transit schedules require a local transit provider.</p></aside>
    </div>
    {immersive && !controlsVisible && onVoiceCommand ? <VoiceControl autoStart className="jv-map-voice-capture" onTranscript={onVoiceCommand} /> : null}
  </section>;
}
