"use client";

import { Suspense } from "react";
import { PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import Hero from "./hero";

export default function LobbyBackground() {
  return (
    <div className="h-full w-full pointer-events-none">
      <Canvas
        className="h-full w-full"
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
    }}
      >
        <PerspectiveCamera makeDefault position={[0, 1.45, 5.8]} fov={33} />
        <ambientLight intensity={2} />

        <directionalLight
          position={[5, 5, 5]}
          intensity={2}
        />

        <Suspense fallback={null}>
          <Hero   position={[0.25, 0.30, 0]} scale={1.00} rotation={[0, -0.12, 0]} />
        </Suspense>
      </Canvas>
    </div>
  );
}