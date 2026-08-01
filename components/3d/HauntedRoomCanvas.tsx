"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface HauntedRoomCanvasProps {
  currentRoom: number;
  completedRooms: number[];
  onSelectRoom?: (roomId: number) => void;
}

export const HauntedRoomCanvas: React.FC<HauntedRoomCanvasProps> = ({
  currentRoom,
  completedRooms,
  onSelectRoom,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06060c);
    scene.fog = new THREE.FogExp2(0x0a0512, 0.04);

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 3, 10);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x221133, 1.2);
    scene.add(ambientLight);

    const torchLight1 = new THREE.PointLight(0xff6600, 3, 15);
    torchLight1.position.set(-5, 4, -2);
    scene.add(torchLight1);

    const torchLight2 = new THREE.PointLight(0x9900ff, 3, 15);
    torchLight2.position.set(5, 4, -2);
    scene.add(torchLight2);

    const altarLight = new THREE.PointLight(0x00ffff, 4, 12);
    altarLight.position.set(0, 2, -1);
    scene.add(altarLight);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x111118,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Grid details on floor
    const grid = new THREE.GridHelper(30, 30, 0xff0055, 0x221133);
    grid.position.y = 0.01;
    scene.add(grid);

    // 3 Haunted Room Pillars / Altars
    const roomObjects: THREE.Group[] = [];

    for (let i = 1; i <= 3; i++) {
      const roomGroup = new THREE.Group();
      const posX = (i - 2) * 5;

      // Base Pillar
      const pillarGeo = new THREE.CylinderGeometry(0.8, 1, 3, 8);
      const isCompleted = completedRooms.includes(i);
      const isCurrent = currentRoom === i;

      let pillarColor = 0x333344;
      if (isCompleted) pillarColor = 0x00ff88;
      else if (isCurrent) pillarColor = 0xff0055;

      const pillarMat = new THREE.MeshStandardMaterial({
        color: pillarColor,
        roughness: 0.3,
        metalness: 0.7,
        wireframe: isCurrent,
      });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.y = 1.5;
      roomGroup.add(pillar);

      // Floating Orb on top
      const orbGeo = new THREE.IcosahedronGeometry(0.6, 2);
      const orbMat = new THREE.MeshStandardMaterial({
        color: isCompleted ? 0x00ffff : isCurrent ? 0xff3300 : 0x666688,
        emissive: isCompleted ? 0x00aaaa : isCurrent ? 0x990000 : 0x111122,
        emissiveIntensity: 0.8,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.y = 3.6;
      orb.name = `orb_${i}`;
      roomGroup.add(orb);

      // Light beam for current room
      if (isCurrent || isCompleted) {
        const beamGeo = new THREE.CylinderGeometry(0.1, 0.4, 6, 8);
        const beamMat = new THREE.MeshBasicMaterial({
          color: isCompleted ? 0x00ffff : 0xff0066,
          transparent: true,
          opacity: 0.4,
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.y = 4.5;
        roomGroup.add(beam);
      }

      roomGroup.position.set(posX, 0, -2);
      scene.add(roomGroup);
      roomObjects.push(roomGroup);
    }

    // Floating particles
    const particleCount = 150;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 20;
      particlePositions[i + 1] = Math.random() * 8;
      particlePositions[i + 2] = (Math.random() - 0.5) * 20;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xaa55ff,
      size: 0.08,
      transparent: true,
      opacity: 0.7,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Flickering torch
      torchLight1.intensity = 2.5 + Math.sin(elapsedTime * 8) * 0.5;
      torchLight2.intensity = 2.5 + Math.cos(elapsedTime * 6) * 0.5;
      altarLight.intensity = 3.5 + Math.sin(elapsedTime * 4) * 0.8;

      // Animate room orbs
      roomObjects.forEach((group, index) => {
        const orb = group.children[1];
        if (orb) {
          orb.rotation.y = elapsedTime * (0.8 + index * 0.2);
          orb.rotation.x = Math.sin(elapsedTime + index) * 0.3;
          orb.position.y = 3.6 + Math.sin(elapsedTime * 2 + index) * 0.15;
        }
      });

      // Slowly rotate particle field
      particles.rotation.y = elapsedTime * 0.05;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // Resize Handler
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
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [currentRoom, completedRooms]);

  return (
    <div className="relative w-full h-72 md:h-96 rounded-2xl overflow-hidden border border-red-900/40 shadow-2xl bg-black/80">
      <div ref={mountRef} className="w-full h-full" />
      <div className="absolute top-3 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-red-500/30 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-mono tracking-wider text-red-200 uppercase">
          3D Haunted Chamber • Room {currentRoom}/3
        </span>
      </div>
    </div>
  );
};
