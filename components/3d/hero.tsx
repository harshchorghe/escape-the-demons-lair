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
  const idleTimeout = useRef<number | null>(null);

  const { scene, animations } = useGLTF("/models/hero.glb");
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);

  const { actions, mixer } = useAnimations(animations, clonedScene);

  useFrame((_, delta) => {
    mixer?.update(delta);
  });

  useEffect(() => {
    if (!actions || !mixer) return;

    const findAction = (names: string[]) => {
      for (const name of names) {
        if (actions[name]) return actions[name];
      }
      return undefined;
    };

    const idle = findAction([
      "idle",
      "Idle",
      "idle_pose",
      "IdlePose",
      "stand",
      "Stand",
      "idleAnimation",
    ]);

    const jump = findAction([
      "jump",
      "Jump",
      "hop",
      "Hop",
    ]);

    const attack = findAction([
      "attack",
      "Attack",
      "slash",
      "Slash",
      "punch",
      "Punch",
    ]);

    const sequence = [idle, jump, attack].filter(
      (a): a is THREE.AnimationAction => !!a
    );

    if (sequence.length === 0) return;

    sequence.forEach((action) => {
      action.enabled = true;
      action.clampWhenFinished = true;
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(1);
    });

    let currentIndex = 0;
    let currentAction = sequence[currentIndex];

    const playCurrent = () => {
      currentAction.reset();

      if (currentAction === idle) {
        currentAction.setLoop(THREE.LoopRepeat, Infinity);
      } else {
        currentAction.setLoop(THREE.LoopOnce, 1);
      }

      currentAction.fadeIn(0.5).play();

      // Only keep idle for 1.5 seconds
      if (currentAction === idle) {
        idleTimeout.current = window.setTimeout(() => {
          const previous = currentAction;

          currentIndex = (currentIndex + 1) % sequence.length;
          currentAction = sequence[currentIndex];

          previous.crossFadeTo(currentAction, 0.5, true);

          playCurrent();
        }, 3000);
      }
    };

    playCurrent();

    const onFinished = () => {
      if (currentAction === idle) return;

      const previous = currentAction;

      currentIndex = (currentIndex + 1) % sequence.length;
      currentAction = sequence[currentIndex];

      previous.crossFadeTo(currentAction, 0.5, true);

      playCurrent();
    };

    mixer.addEventListener("finished", onFinished);

    return () => {
      mixer.removeEventListener("finished", onFinished);

      if (idleTimeout.current) {
        clearTimeout(idleTimeout.current);
      }

      sequence.forEach((action) => {
        action.stop();
      });
    };
  }, [actions, mixer]);

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

useGLTF.preload("/models/hero.glb");