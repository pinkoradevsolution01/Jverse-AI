"use client";
import { Canvas } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";

function Orb() {
  return <Float speed={1.4} rotationIntensity={0.45} floatIntensity={0.7}>
    <mesh>
      <icosahedronGeometry args={[1, 5]} />
      <MeshDistortMaterial color="#00e5ff" emissive="#00b8d4" emissiveIntensity={1.4} distort={0.25} speed={1.6} roughness={.2} />
    </mesh>
  </Float>;
}

export function AiCoreCanvas() {
  return <Canvas camera={{ position: [0, 0, 3.4], fov: 45 }} dpr={[1, 1.5]}>
    <ambientLight intensity={1.1} />
    <pointLight position={[2, 2, 3]} intensity={5} color="#7c3aed" />
    <Orb />
  </Canvas>;
}
