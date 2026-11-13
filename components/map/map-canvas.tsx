"use client";

import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";

export type MapPoint = { lat: number; lng: number; name?: string };

const originIcon = L.divIcon({ className: "jv-map-marker-wrap", html: '<span class="jv-map-marker jv-map-marker-origin"></span>', iconSize: [22, 22], iconAnchor: [11, 11] });
const destinationIcon = L.divIcon({ className: "jv-map-marker-wrap", html: '<span class="jv-map-marker jv-map-marker-destination"></span>', iconSize: [28, 28], iconAnchor: [14, 14] });

function MapFocus({ origin, destination }: { origin: MapPoint | null; destination: MapPoint | null }) {
  const map = useMap();
  useEffect(() => {
    if (origin && destination) map.fitBounds([[origin.lat, origin.lng], [destination.lat, destination.lng]], { padding: [58, 58], maxZoom: 14 });
    else if (destination) map.flyTo([destination.lat, destination.lng], 13, { duration: 1.25 });
    else if (origin) map.flyTo([origin.lat, origin.lng], 13, { duration: 1.25 });
  }, [destination, map, origin]);
  return null;
}

export function MapCanvas({ origin, destination, route }: { origin: MapPoint | null; destination: MapPoint | null; route: MapPoint[] }) {
  return <MapContainer className="jv-leaflet-map" center={[18.5, 9]} zoom={2} zoomControl={false} worldCopyJump>
    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
    <MapFocus origin={origin} destination={destination} />
    {route.length > 1 ? <Polyline positions={route.map((point) => [point.lat, point.lng])} pathOptions={{ color: "#19e5ff", weight: 5, opacity: .88, lineCap: "round" }} /> : null}
    {origin ? <Marker position={[origin.lat, origin.lng]} icon={originIcon}><Tooltip direction="top" offset={[0, -12]} permanent>Your location</Tooltip></Marker> : null}
    {destination ? <Marker position={[destination.lat, destination.lng]} icon={destinationIcon}><Tooltip direction="top" offset={[0, -16]} permanent>{destination.name ?? "Destination"}</Tooltip></Marker> : null}
  </MapContainer>;
}
