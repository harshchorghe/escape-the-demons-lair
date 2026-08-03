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
    const timeoutRefs = useRef<number[]>([]);
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

      const findActionByNames = (names: string[]) => {
        for (const name of names) {
          const action = actions[name];
          if (action) return action;
        }
        return undefined;
      };

      const idleAction = findActionByNames(["idle", "Idle", "idle_pose", "IdlePose", "stand", "Stand", "idleAnimation"]);
      const jumpAction = findActionByNames(["jump", "Jump", "hop", "Hop"]);
      const attackAction = findActionByNames(["attack", "Attack", "slash", "Slash", "punch", "Punch"]);
      const sequence = [idleAction, jumpAction, attackAction].filter((action): action is THREE.AnimationAction => !!action);

      if (sequence.length === 0) return;

      let step = 0;

      const playStep = () => {
        const currentAction = sequence[step];

        sequence.forEach((action, index) => {
          if (index === step) {
            action.reset();
            action.setLoop(THREE.LoopRepeat, 1);
            action.clampWhenFinished = true;
            action.fadeIn(0.35);
            action.play();
          } else {
            action.fadeOut(0.35);
            action.stop();
          }
        });

        const clipDuration = currentAction?.getClip()?.duration ?? 1;
        const timeoutId = window.setTimeout(() => {
          step = (step + 1) % sequence.length;
          playStep();
        }, Math.max(clipDuration * 1000 - 120, 300));

        timeoutRefs.current.push(timeoutId);
      };

      playStep();

      return () => {
        timeoutRefs.current.forEach((id) => window.clearTimeout(id));
        timeoutRefs.current = [];
        sequence.forEach((action) => {
          action.fadeOut(0.18);
          action.stop();
        });
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