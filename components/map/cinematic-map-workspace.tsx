"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { VoiceControl } from "../voice/voice-control";
import { parseMapVoiceCommand, type MapTravelMode } from "../../lib/maps/voice-command";

type Point = { lat: number; lng: number; name: string };
type Route = { distanceKm: number; durationMinutes: number; geometry: Point[]; source: "road" | "flight" };
type Mode = MapTravelMode;

export type CinematicMapWorkspaceProps = {
  immersive?: boolean;
  initialPlace?: string;
  controlsVisible?: boolean;
  onVoiceCommand?: (command: string) => void | Promise<void>;
  onClose?: () => void;
  response?: string;
  responseStreaming?: boolean;
  onOpenResponse?: () => void;
  onCancel?: () => void;
};

const MANILA: Point = { lat: 14.5995, lng: 120.9842, name: "Manila, Philippines" };
const MapCanvas = dynamic(() => import("./map-canvas").then((module) => module.MapCanvas), { ssr: false, loading: () => <div className="jv-map-globe-loading">INITIALIZING LIVE MAP…</div> });
const MapGlobeCanvas = dynamic(() => import("./map-globe-canvas").then((module) => module.MapGlobeCanvas), { ssr: false, loading: () => <div className="jv-map-globe-loading">INITIALIZING GLOBAL NETWORK…</div> });

function numberLabel(value: number) { return value < 10 ? `${value.toFixed(1)} km` : `${Math.round(value)} km`; }
function timeLabel(value: number) {
  const mins = Math.max(1, Math.round(value));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} hr${mins >= 120 ? "s" : ""}${mins % 60 ? ` ${mins % 60} min` : ""}`;
}

const TRAVEL_MODES: Array<{ id: Mode; label: string; detail: string }> = [
  { id: "walk", label: "Walk", detail: "Walking route" },
  { id: "motorcycle", label: "Motorcycle", detail: "Road speed estimate" },
  { id: "car", label: "Car", detail: "Driving route" },
  { id: "bus", label: "Bus", detail: "Road transit estimate" },
  { id: "airplane", label: "Airplane", detail: "Direct flight estimate" },
];

function straightLineKm(from: Point, to: Point) {
  const radians = (value: number) => value * Math.PI / 180;
  const latitude = radians(to.lat - from.lat);
  const longitude = radians(to.lng - from.lng);
  const a = Math.sin(latitude / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(longitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function CinematicMapWorkspace({ immersive = false, initialPlace = "", controlsVisible = false, onVoiceCommand, onClose, response = "", responseStreaming = false, onOpenResponse, onCancel }: CinematicMapWorkspaceProps) {
  const [view, setView] = useState<"globe" | "map">(initialPlace ? "map" : "globe");
  const [controlsOpen, setControlsOpen] = useState(controlsVisible);
  const [globeFailed, setGlobeFailed] = useState(false);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState(initialPlace);
  const [places, setPlaces] = useState<Point[]>([]);
  const [origin, setOrigin] = useState<Point>(MANILA);
  const [destination, setDestination] = useState<Point | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [mode, setMode] = useState<Mode>("car");
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Voice navigation is ready. Say “open controls” to reveal map options.");

  useEffect(() => setControlsOpen(controlsVisible), [controlsVisible]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && immersive) onClose?.(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [immersive, onClose]);

  const search = useCallback(async (term: string, select = false) => {
    const clean = term.trim();
    if (!clean) return null;
    setBusy(true); setNotice(`Scanning the global network for ${clean}…`);
    try {
      const response = await fetch(`/api/maps/search?q=${encodeURIComponent(clean)}`);
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.places)) throw new Error(body.error || "Location search failed.");
      const results = body.places.map((place: Point) => ({ lat: Number(place.lat), lng: Number(place.lng), name: place.name }));
      setPlaces(results);
      if (!results.length) { setNotice("No locations matched. Try a city, landmark, or full address."); return null; }
      if (select) {
        setDestination(results[0]); setQuery(results[0].name); setPlaces([]); setView("map"); setNotice(`Destination acquired: ${results[0].name}`);
        return results[0] as Point;
      }
      setNotice(`${results.length} location match${results.length === 1 ? "" : "es"} found.`);
      return results[0] as Point;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Location search is temporarily unavailable.");
      return null;
    } finally { setBusy(false); }
  }, []);

  const calculateRoute = useCallback(async (nextMode: Mode, from = origin, to = destination) => {
    if (!to) { setNotice("Name a destination before requesting directions."); return; }
    setMode(nextMode);
    setModePickerOpen(true);
    setBusy(true);
    setNotice(`Calculating ${nextMode === "airplane" ? "flight" : nextMode} directions…`);
    try {
      if (nextMode === "airplane") {
        const distanceKm = straightLineKm(from, to);
        setRoute({ distanceKm, durationMinutes: distanceKm / 800 * 60 + 90, geometry: [from, to], source: "flight" });
      } else {
        const profile = nextMode === "walk" ? "foot" : "driving";
        const response = await fetch(`/api/maps/route?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}&profile=${profile}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Route calculation failed.");
        const baseMinutes = Number(body.durationMinutes);
        const durationMinutes = nextMode === "motorcycle" ? baseMinutes * .84 : nextMode === "bus" ? baseMinutes * 1.45 + 6 : baseMinutes;
        setRoute({ distanceKm: Number(body.distanceKm), durationMinutes, geometry: body.geometry, source: "road" });
      }
      setView("map");
      setNotice(`${nextMode === "airplane" ? "Flight" : "Route"} ready: ${from.name} to ${to.name}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Route calculation is temporarily unavailable."); }
    finally { setBusy(false); }
  }, [destination, origin]);

  const requestDirections = useCallback(() => {
    if (!destination) { setNotice("Name a destination before requesting directions."); return; }
    setModePickerOpen(true);
    setNotice("How would you like to travel? Choose Walk, Motorcycle, Car, Bus, or Airplane.");
  }, [destination]);

  const choose = useCallback(async (place: Point, calculate = false) => {
    setDestination(place); setQuery(place.name); setPlaces([]); setView("map"); setNotice(`Destination acquired: ${place.name}`);
    if (calculate) await calculateRoute(mode, origin, place);
  }, [calculateRoute, mode, origin]);

  const currentLocation = useCallback(() => {
    if (!navigator.geolocation) { setNotice("Location services are not available in this application."); return; }
    setBusy(true); setNotice("Requesting your current location…");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const point = { lat: coords.latitude, lng: coords.longitude, name: "Your current location" };
      setOrigin(point); setNotice("Current location secured. Ask for directions when ready."); setBusy(false);
      if (destination && route) void calculateRoute(mode, point, destination);
    }, () => { setBusy(false); setNotice("Location permission was not granted. Enable it in Windows or choose a starting location manually."); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }, [calculateRoute, destination, mode, route]);

  const runCommand = useCallback(async (raw: string) => {
    const command = raw.trim();
    if (!command) return;
    setInput("");
    const parsed = parseMapVoiceCommand(command);
    if (parsed.intent === "close") { onClose?.(); return; }
    if (parsed.intent === "controls") { setControlsOpen(true); setNotice("Map controls are now visible."); return; }
    if (parsed.intent === "current_location") { currentLocation(); return; }
    if (parsed.intent === "open") { setView("globe"); setNotice("Global map interface opened. Name any city, landmark, or address."); return; }
    if (parsed.intent === "travel_mode" && parsed.mode && destination) { await calculateRoute(parsed.mode); return; }
    if (parsed.intent === "directions" && !parsed.place) { requestDirections(); return; }
    if ((parsed.intent === "search" || parsed.intent === "directions") && parsed.place) {
      const found = await search(parsed.place, true);
      if (!found) return;
      if (parsed.mode) { await calculateRoute(parsed.mode, origin, found); return; }
      if (parsed.intent === "directions") {
        setModePickerOpen(true);
        setNotice("Destination found. How would you like to travel: Walk, Motorcycle, Car, Bus, or Airplane?");
      }
      return;
    }
    setNotice("JVerse is processing your request…");
    await onVoiceCommand?.(command);
  }, [calculateRoute, currentLocation, destination, onClose, onVoiceCommand, requestDirections, search]);

  useEffect(() => { if (initialPlace) void search(initialPlace, true); }, [initialPlace, search]);

  const duration = useMemo(() => route?.durationMinutes ?? 0, [route]);

  return <section className={`jv-map-workspace jv-cinematic-map ${immersive ? "jv-map-immersive" : ""} ${controlsOpen ? "" : "jv-map-controls-hidden"}`}>
    <div className="jv-map-topline"><span className="signal-dot" /> JVERSE GLOBAL NAVIGATION <span>LIVE NETWORK</span></div>
    <div className="jv-map-visual-stage">
      <AnimatePresence mode="wait">
        {view === "globe" && !globeFailed ? <motion.div className="jv-map-globe-stage" key="globe" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: .45 }}>
          <MapGlobeCanvas focus={destination ? { lat: destination.lat, lng: destination.lng, label: destination.name } : null} onUnavailable={() => { setGlobeFailed(true); setView("map"); setNotice("3D rendering is unavailable; opening the live map."); }} />
          <div className="jv-map-globe-hud"><span>GLOBAL CONNECTIVITY</span><strong>JVERSE // ONLINE</strong><span>DRAG TO ORBIT · SCROLL TO ZOOM</span></div>
        </motion.div> : <motion.div className="jv-map-canvas-stage" key="map" initial={{ opacity: 0, clipPath: "circle(12% at 50% 50%)" }} animate={{ opacity: 1, clipPath: "circle(100% at 50% 50%)" }} transition={{ duration: .65 }}>
          <MapCanvas origin={origin} destination={destination} route={route?.geometry ?? []} />
          <div className="jv-map-live-badge"><span className="signal-dot" /> LIVE MAP {destination ? "// DESTINATION LOCKED" : "// READY"}</div>
        </motion.div>}
      </AnimatePresence>
    </div>
    <AnimatePresence>{controlsOpen ? <motion.aside className="jv-map-controls" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <label htmlFor="map-search">DESTINATION SEARCH</label><div className="jv-map-search-row"><input id="map-search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(query); }} placeholder="City, landmark, or address" /><button type="button" onClick={() => void search(query)}>SCAN</button></div>
      {places.length ? <div className="jv-map-matches">{places.map((place) => <button key={`${place.lat}-${place.lng}`} type="button" onClick={() => void choose(place)}>{place.name}</button>)}</div> : null}
      <div className="jv-map-control-actions"><button type="button" onClick={currentLocation}>USE MY LOCATION</button><button type="button" disabled={!destination || busy} onClick={requestDirections}>GET DIRECTIONS</button></div>
      {modePickerOpen ? <div className="jv-route-panel"><div><span>{route ? "ROUTE DISTANCE" : "SELECT TRAVEL MODE"}</span>{route ? <strong>{numberLabel(route.distanceKm)}</strong> : <strong>READY</strong>}</div><div className="jv-route-modes">{TRAVEL_MODES.map((item) => <button type="button" key={item.id} className={mode === item.id ? "is-active" : ""} disabled={busy} onClick={() => void calculateRoute(item.id)} title={item.detail}>{item.label}</button>)}</div><p>{route ? <>{mode.toUpperCase()} ESTIMATE <strong>{timeLabel(duration)}</strong>{route.source === "flight" ? " · DIRECT FLIGHT ESTIMATE" : ""}</> : "Choose how you would like to travel."}</p></div> : null}
    </motion.aside> : null}</AnimatePresence>
    <div className="jv-map-command-dock">{response ? <button type="button" className="jv-map-response-preview" onClick={onOpenResponse}><span>JVERSE RESPONSE <em>{responseStreaming ? "STREAMING" : "COMPLETE"}</em></span><p>{response}</p></button> : null}<div className="jv-map-status" aria-live="polite"><span className={busy ? "jv-map-status-pulse" : ""} />{notice}</div><div className="jv-map-command-row"><VoiceControl onTranscript={(prompt) => void runCommand(prompt)} onStateChange={() => undefined} /><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void runCommand(input); }} placeholder="Ask JVerse about a place, route, or anything else…" aria-label="Ask JVerse AI" /><button type="button" className="jv-map-send" onClick={responseStreaming ? onCancel : () => void runCommand(input)} aria-label={responseStreaming ? "Cancel JVerse request" : "Send to JVerse AI"} title={responseStreaming ? "Cancel request" : "Send to JVerse AI"}>{responseStreaming ? "×" : "➤"}</button></div></div>
  </section>;
}
