"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThroneRoomCanvasProps {
  destroyedCrystals: number[];
  onCrystalClick: (crystalId: number) => void;
}

export const ThroneRoomCanvas: React.FC<ThroneRoomCanvasProps> = ({
  destroyedCrystals,
  onCrystalClick,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050003);
    scene.fog = new THREE.FogExp2(0x18000a, 0.03);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 4, 11);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x330011, 1.2);
    scene.add(ambientLight);

    const demonLight = new THREE.PointLight(0xff0033, 6, 25);
    demonLight.position.set(0, 7, -8);
    scene.add(demonLight);

    // Demon Throne Silhouette Background
    const throneGeo = new THREE.BoxGeometry(4, 7, 1);
    const throneMat = new THREE.MeshStandardMaterial({
      color: 0x110005,
      roughness: 0.2,
      metalness: 0.9,
    });
    const throne = new THREE.Mesh(throneGeo, throneMat);
    throne.position.set(0, 3.5, -7);
    scene.add(throne);

    // Demon Eyes
    const eyeGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.6, 5.5, -6.4);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.6, 5.5, -6.4);
    scene.add(leftEye, rightEye);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0c0307,
      roughness: 0.6,
      metalness: 0.5,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // 4 Floating Demon Crystals
    const crystalColors = [0xff2200, 0x9900ff, 0x00ccff, 0xff0066];
    const crystalMeshes: THREE.Mesh[] = [];

    for (let i = 1; i <= 4; i++) {
      const isDestroyed = destroyedCrystals.includes(i);
      const posX = (i - 2.5) * 3.6;

      // Pedestal
      const pedGeo = new THREE.CylinderGeometry(0.6, 0.8, 2, 6);
      const pedMat = new THREE.MeshStandardMaterial({ color: 0x22111a });
      const ped = new THREE.Mesh(pedGeo, pedMat);
      ped.position.set(posX, 1, -1);
      scene.add(ped);

      // Octahedron Crystal
      const crystalGeo = new THREE.OctahedronGeometry(0.8, 0);
      const crystalMat = new THREE.MeshStandardMaterial({
        color: isDestroyed ? 0x222222 : crystalColors[i - 1],
        emissive: isDestroyed ? 0x000000 : crystalColors[i - 1],
        emissiveIntensity: isDestroyed ? 0 : 0.8,
        transparent: isDestroyed,
        opacity: isDestroyed ? 0.3 : 1,
        wireframe: isDestroyed,
      });
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.set(posX, 3.2, -1);
      crystal.name = `crystal_${i}`;
      scene.add(crystal);
      crystalMeshes.push(crystal);
    }

    // Raycaster for Crystal Clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(crystalMeshes);

      if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        const crystalIdStr = hitObj.name.replace("crystal_", "");
        const crystalId = parseInt(crystalIdStr, 10);
        if (crystalId) {
          onCrystalClick(crystalId);
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

      // Pulsing Demon Light
      demonLight.intensity = 5 + Math.sin(time * 4) * 2;

      crystalMeshes.forEach((mesh, idx) => {
        const crystalId = idx + 1;
        if (!destroyedCrystals.includes(crystalId)) {
          mesh.rotation.y = time * 0.8;
          mesh.rotation.x = Math.sin(time + idx) * 0.3;
          mesh.position.y = 3.2 + Math.sin(time * 2 + idx) * 0.2;
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
  }, [destroyedCrystals, onCrystalClick]);

  return (
    <div className="relative w-full h-72 md:h-96 rounded-2xl overflow-hidden border border-red-800/50 shadow-2xl bg-black/90 cursor-pointer">
      <div ref={mountRef} className="w-full h-full" />
      <div className="absolute top-3 left-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-red-500/40 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
        <span className="text-xs font-mono tracking-wider text-red-200 uppercase">
          Final Level • Demon's Throne Room ({4 - destroyedCrystals.length} Crystals Remaining)
        </span>
      </div>
    </div>
  );
};
