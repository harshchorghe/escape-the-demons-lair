"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface DemonDoorCanvasProps {
  selectedDoorId: number;
  unlockedDoors: number[];
  onDoorClick: (doorId: number) => void;
}

export const DemonDoorCanvas: React.FC<DemonDoorCanvasProps> = ({
  selectedDoorId,
  unlockedDoors,
  onDoorClick,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0204);
    scene.fog = new THREE.FogExp2(0x1a0205, 0.035);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 3.5, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x440a00, 1.5);
    scene.add(ambientLight);

    const redGlowLight = new THREE.PointLight(0xff1100, 5, 20);
    redGlowLight.position.set(0, 5, -2);
    scene.add(redGlowLight);

    // Lava Floor
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x110200,
      emissive: 0x440800,
      emissiveIntensity: 0.5,
      roughness: 0.9,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // 3 Demon Doors
    const doors: THREE.Group[] = [];

    const doorColors = [0xff2200, 0x9900ff, 0x00ccff];

    for (let i = 1; i <= 3; i++) {
      const doorGroup = new THREE.Group();
      const posX = (i - 2) * 4.5;

      const isUnlocked = unlockedDoors.includes(i);
      const isSelected = selectedDoorId === i;

      // Outer Archway
      const archGeo = new THREE.BoxGeometry(2.6, 4.5, 0.6);
      const archMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a24,
        roughness: 0.4,
        metalness: 0.8,
      });
      const arch = new THREE.Mesh(archGeo, archMat);
      arch.position.y = 2.25;
      doorGroup.add(arch);

      // Door Surface
      const doorPanelGeo = new THREE.PlaneGeometry(2, 4);
      const doorPanelMat = new THREE.MeshStandardMaterial({
        color: isUnlocked ? 0x00ff88 : isSelected ? doorColors[i - 1] : 0x220505,
        emissive: isUnlocked ? 0x00aa44 : isSelected ? doorColors[i - 1] : 0x440000,
        emissiveIntensity: isSelected || isUnlocked ? 0.9 : 0.2,
      });
      const doorPanel = new THREE.Mesh(doorPanelGeo, doorPanelMat);
      doorPanel.position.set(0, 2.25, 0.32);
      doorGroup.add(doorPanel);

      // Glowing Central Rune Emblem
      const emblemGeo = new THREE.RingGeometry(0.3, 0.6, 8);
      const emblemMat = new THREE.MeshBasicMaterial({
        color: isUnlocked ? 0x00ffff : doorColors[i - 1],
        side: THREE.DoubleSide,
      });
      const emblem = new THREE.Mesh(emblemGeo, emblemMat);
      emblem.position.set(0, 2.8, 0.35);
      doorGroup.add(emblem);

      doorGroup.position.set(posX, 0, -2);
      scene.add(doorGroup);
      doors.push(doorGroup);
    }

    // Raycaster for door clicking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        let curr: THREE.Object3D | null = hit.object;
        while (curr && curr.parent !== scene) {
          const index = doors.indexOf(curr as THREE.Group);
          if (index !== -1) {
            onDoorClick(index + 1);
            return;
          }
          curr = curr.parent;
        }
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener("click", handlePointerDown);

    // Animation loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const time = clock.getElapsedTime();
      redGlowLight.intensity = 4 + Math.sin(time * 5) * 1.5;

      doors.forEach((group, index) => {
        const emblem = group.children[2];
        if (emblem) {
          emblem.rotation.z = time * (index % 2 === 0 ? 0.5 : -0.5);
        }
      });

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      domElem.removeEventListener("click", handlePointerDown);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [selectedDoorId, unlockedDoors, onDoorClick]);

  return (
    <div className="relative w-full h-72 md:h-96 rounded-2xl overflow-hidden border border-purple-900/40 shadow-2xl bg-black/90 cursor-pointer">
      <div ref={mountRef} className="w-full h-full" />
      <div className="absolute top-3 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-purple-500/30 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
        <span className="text-xs font-mono tracking-wider text-purple-200 uppercase">
          Level 2 • Click Demon Door to Select
        </span>
      </div>
    </div>
  );
};
