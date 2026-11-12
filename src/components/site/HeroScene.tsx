"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Edges, Float } from "@react-three/drei";
import type { Group, Mesh } from "three";

const BAR_COLORS = ["#ffe14d", "#6ec1ff", "#ff8fd0", "#ff8a3d", "#35ed81"];

function Bar({ i, color }: { i: number; color: string }) {
  const mesh = useRef<Mesh>(null);
  const [hover, setHover] = useState(false);
  const bounce = useRef(0);
  const target = 0.9 + i * 0.75;

  useFrame((s, dt) => {
    const m = mesh.current;
    if (!m) return;
    // rise on load, staggered
    const t = Math.max(0, s.clock.elapsedTime - i * 0.18);
    const rise = 1 - Math.pow(1 - Math.min(t / 1.1, 1), 3);
    bounce.current = Math.max(0, bounce.current - dt * 2.5);
    const pulse = Math.sin(s.clock.elapsedTime * 2 + i) * 0.04;
    const h = target * rise * (1 + pulse + bounce.current * 0.35 + (hover ? 0.12 : 0));
    m.scale.y = Math.max(h, 0.001);
    m.position.y = h / 2;
  });

  return (
    <mesh
      ref={mesh}
      position={[(i - 2) * 1.05, 0, 0]}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}
      onClick={(e) => { e.stopPropagation(); bounce.current = 1; }}
    >
      <boxGeometry args={[0.85, 1, 0.85]} />
      <meshStandardMaterial color={color} flatShading />
      <Edges color="#030a21" lineWidth={2} />
    </mesh>
  );
}

function Shape({ kind, color, pos, scale = 1, speed = 1 }: { kind: "ico" | "torus" | "octa" | "cone"; color: string; pos: [number, number, number]; scale?: number; speed?: number }) {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.x += dt * 0.6 * speed;
    ref.current.rotation.y += dt * 0.8 * speed;
  });
  return (
    <Float speed={2 * speed} rotationIntensity={0.4} floatIntensity={1.4}>
      <mesh ref={ref} position={pos} scale={scale}>
        {kind === "ico" && <icosahedronGeometry args={[0.7, 0]} />}
        {kind === "torus" && <torusGeometry args={[0.55, 0.22, 10, 24]} />}
        {kind === "octa" && <octahedronGeometry args={[0.65, 0]} />}
        {kind === "cone" && <coneGeometry args={[0.55, 1.1, 4]} />}
        <meshStandardMaterial color={color} flatShading />
        <Edges color="#030a21" lineWidth={2} />
      </mesh>
    </Float>
  );
}

function Rig() {
  const group = useRef<Group>(null);
  useFrame((s) => {
    const g = group.current;
    if (!g) return;
    // pointer-reactive tilt, eased
    g.rotation.y += (s.pointer.x * 0.7 - 0.35 - g.rotation.y) * 0.06;
    g.rotation.x += (-s.pointer.y * 0.35 + 0.15 - g.rotation.x) * 0.06;
  });
  return (
    <group ref={group} position={[0, -1.6, 0]}>
      {BAR_COLORS.map((c, i) => <Bar key={c} i={i} color={c} />)}
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[5.6, 0.24, 1.4]} />
        <meshStandardMaterial color="#030a21" flatShading />
      </mesh>
      <Shape kind="octa" color="#35ed81" pos={[-2.9, 3.4, 0.6]} scale={1.1} />
      <Shape kind="torus" color="#ff8fd0" pos={[3, 2.6, 0.4]} scale={1.1} speed={1.3} />
      <Shape kind="ico" color="#6ec1ff" pos={[-2.6, 0.9, 1.4]} scale={0.7} speed={0.8} />
      <Shape kind="cone" color="#ffe14d" pos={[2.4, 4.4, -0.5]} scale={0.8} speed={1.1} />
    </group>
  );
}

export default function HeroScene() {
  return (
    <Canvas camera={{ position: [0, 1.4, 11], fov: 40 }} dpr={[1, 2]} aria-label="Interactive 3D growth chart. Click a bar to bounce it.">
      <ambientLight intensity={1.9} />
      <directionalLight position={[4, 6, 5]} intensity={1.3} />
      <directionalLight position={[-5, 2, -3]} intensity={0.6} />
      <Rig />
    </Canvas>
  );
}
