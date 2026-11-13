"use client";

import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { Component, type ReactNode, useMemo, useRef } from "react";
import * as THREE from "three";

type GlobeFocus = { lat: number; lng: number; label: string } | null;

type Props = {
  focus?: GlobeFocus;
  onUnavailable?: () => void;
};

const CONNECTIONS = [
  [[37.7749, -122.4194], [14.5995, 120.9842]],
  [[51.5072, -0.1276], [40.7128, -74.006]],
  [[35.6762, 139.6503], [1.3521, 103.8198]],
  [[25.2048, 55.2708], [51.5072, -0.1276]],
  [[-33.8688, 151.2093], [1.3521, 103.8198]],
  [[-23.5505, -46.6333], [40.7128, -74.006]],
  [[-1.2921, 36.8219], [25.2048, 55.2708]],
] as const;

const HUBS = [
  [37.7749, -122.4194], [40.7128, -74.006], [51.5072, -0.1276], [35.6762, 139.6503],
  [14.5995, 120.9842], [1.3521, 103.8198], [25.2048, 55.2708], [-33.8688, 151.2093],
  [-23.5505, -46.6333], [-1.2921, 36.8219],
] as const;

function pointOnGlobe(lat: number, lng: number, radius = 2.06) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function ConnectionArc({ from, to, accent = false }: { from: readonly number[]; to: readonly number[]; accent?: boolean }) {
  const points = useMemo(() => {
    const start = pointOnGlobe(from[0], from[1]);
    const end = pointOnGlobe(to[0], to[1]);
    const midpoint = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(3.05);
    return new THREE.QuadraticBezierCurve3(start, midpoint, end).getPoints(72);
  }, [from, to]);

  return <Line points={points} color={accent ? "#c45cff" : "#4eeeff"} lineWidth={1.25} transparent opacity={0.9} />;
}

function NetworkGlobe({ focus }: { focus?: GlobeFocus }) {
  const group = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y += 0.00085;
    if (pulse.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 2.1) * 0.07;
      pulse.current.scale.setScalar(scale);
    }
  });

  const longitudeRings = useMemo(() => Array.from({ length: 12 }, (_, index) => index * (Math.PI / 12)), []);
  const latitudeRings = useMemo(() => [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2], []);

  return (
    <group ref={group} rotation={[0.25, -0.8, 0]}>
      <mesh>
        <sphereGeometry args={[2, 56, 44]} />
        <meshBasicMaterial color="#04284b" transparent opacity={0.34} wireframe />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.985, 56, 44]} />
        <meshBasicMaterial color="#02101f" transparent opacity={0.9} />
      </mesh>
      {longitudeRings.map((rotation, index) => (
        <mesh key={`longitude-${index}`} rotation={[0, rotation, 0]}>
          <torusGeometry args={[2.015, 0.006, 5, 96]} />
          <meshBasicMaterial color="#0a8fcf" transparent opacity={0.38} />
        </mesh>
      ))}
      {latitudeRings.map((latitude) => {
        const radius = 2.015 * Math.cos(latitude);
        return (
          <mesh key={`latitude-${latitude}`} position={[0, 2.015 * Math.sin(latitude), 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[Math.max(radius, 0.06), 0.006, 5, 96]} />
            <meshBasicMaterial color="#0a8fcf" transparent opacity={0.4} />
          </mesh>
        );
      })}
      {CONNECTIONS.map(([from, to], index) => <ConnectionArc key={`arc-${index}`} from={from} to={to} accent={index % 3 === 0} />)}
      {HUBS.map(([lat, lng], index) => (
        <group key={`hub-${index}`} position={pointOnGlobe(lat, lng, 2.1)}>
          <mesh><sphereGeometry args={[index % 3 === 0 ? 0.065 : 0.04, 16, 16]} /><meshBasicMaterial color={index % 3 === 0 ? "#e472ff" : "#62f4ff"} /></mesh>
          <pointLight color={index % 3 === 0 ? "#e472ff" : "#62f4ff"} intensity={0.55} distance={1.2} />
        </group>
      ))}
      {focus ? (
        <group ref={pulse} position={pointOnGlobe(focus.lat, focus.lng, 2.14)}>
          <mesh><sphereGeometry args={[0.1, 20, 20]} /><meshBasicMaterial color="#ffd42a" /></mesh>
          <mesh><ringGeometry args={[0.15, 0.19, 36]} /><meshBasicMaterial color="#ffd42a" transparent opacity={0.85} side={THREE.DoubleSide} /></mesh>
          <pointLight color="#ffd42a" intensity={1.5} distance={2.5} />
        </group>
      ) : null}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -2.68, 0]}>
        <ringGeometry args={[1.9, 2.72, 96]} />
        <meshBasicMaterial color="#09d8ff" transparent opacity={0.23} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

class GlobeBoundary extends Component<{ children: ReactNode; onUnavailable?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function MapGlobeCanvas({ focus, onUnavailable }: Props) {
  return (
    <GlobeBoundary onUnavailable={onUnavailable}>
      <Canvas className="jv-map-globe-canvas" camera={{ position: [0, 0.25, 7.25], fov: 42 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
        <color attach="background" args={["#010611"]} />
        <fog attach="fog" args={["#010611", 7, 14]} />
        <ambientLight intensity={0.72} color="#177fc0" />
        <pointLight position={[4, 5, 4]} color="#0eeeff" intensity={3.2} />
        <pointLight position={[-4, -1, 3]} color="#bd57ff" intensity={2.4} />
        <Stars radius={80} depth={34} count={1800} factor={2.2} saturation={0} fade speed={0.45} />
        <NetworkGlobe focus={focus} />
        <OrbitControls enablePan={false} minDistance={4.8} maxDistance={10} minPolarAngle={0.55} maxPolarAngle={2.35} autoRotate={false} />
      </Canvas>
    </GlobeBoundary>
  );
}
