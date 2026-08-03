"use client";

import { Suspense } from "react";
import { PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import Hero from "./hero";

export default function LobbyBackground() {
  return (
    <div className="h-full w-full">
      <Canvas
        className="h-full w-full"
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <PerspectiveCamera makeDefault position={[0, 1.65, 6.6]} fov={33} />
        <ambientLight intensity={2} />

        <directionalLight
          position={[5, 5, 5]}
          intensity={2}
        />

        <Suspense fallback={null}>
          <Hero position={[0.25, 0.18, 0]} scale={1.16} rotation={[0, -0.12, 0]} />
        </Suspense>
      </Canvas>
    </div>
  );
}