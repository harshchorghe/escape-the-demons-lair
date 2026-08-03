"use client";

import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";

interface HeroProps {
    position?: [number, number, number];
    scale?: number;
    rotation?: [number, number, number];
}

export default function Hero({
    position = [0, 0, 0],
    scale = 1,
    rotation = [0, 0, 0],
}: HeroProps) {

    const heroRef = useRef<THREE.Object3D>(null);
    const { scene, animations } = useGLTF("/models/hero.glb");
    const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
    const { actions, mixer } = useAnimations(animations, clonedScene);

    useEffect(() => {
      console.log("hero.glb animations.length:", animations.length);
      console.log("hero.glb animation names:", animations.map((clip) => clip.name));
      console.log("hero.glb action keys:", Object.keys(actions));
    }, [actions, animations]);

    useFrame((_, delta) => {
      if (mixer) {
        mixer.update(delta);
      }
    });

    useEffect(() => {
      if (!actions || Object.keys(actions).length === 0) return;

      const firstClipName = animations[0]?.name;
      const preferredAction = firstClipName
        ? actions[firstClipName]
        : Object.values(actions)[0];

      if (!preferredAction) return;

      preferredAction.reset();
      preferredAction.setLoop(THREE.LoopRepeat, Infinity);
      preferredAction.fadeIn(0.3);
      preferredAction.play();

      return () => {
        preferredAction.fadeOut(0.3);
        preferredAction.stop();
      };
    }, [actions, animations]);
    
    return (
        <primitive
            ref={heroRef}
            object={clonedScene}
            position={position}
            rotation={rotation}
            scale={scale}
        />
    );
}