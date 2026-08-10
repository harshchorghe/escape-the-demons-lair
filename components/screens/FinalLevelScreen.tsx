"use client";

import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GameGameState, gameSync } from "@/lib/gameStore";
import { DemonSlayerCharacter } from "@/components/level3/DemonSlayerCharacter";
import { EffectsEngine } from "@/components/level3/EffectsEngine";
import { CombatEngine, CombatStats } from "@/components/level3/CombatEngine";
import { sound } from "@/components/level3/SoundSynthesizer";
import { Flame, Volume2, VolumeX, HelpCircle } from "lucide-react";

interface FinalLevelScreenProps {
  state: GameGameState;
  myRole: 'player1' | 'player2';
}

export const FinalLevelScreen: React.FC<FinalLevelScreenProps> = ({ state, myRole }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const combatRef = useRef<CombatEngine | null>(null);
  const characterRef = useRef<DemonSlayerCharacter | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const [stats, setStats] = useState<CombatStats>({
    playerHp: 100,
    playerMaxHp: 100,
    demonHp: 1,
    demonMaxHp: 1,
    combo: 0,
    announcement: '',
    isDemonDefeated: false,
    demonsDefeated: 0,
    totalDemons: 75,
  });

  const [isMuted, setIsMuted] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  const isL2Complete = state.currentLevel >= 3;

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
    if (combatRef.current && typeof state.l3DemonsDefeated === 'number') {
      if (state.l3DemonsDefeated > combatRef.current.demonsDefeated) {
        combatRef.current.demonsDefeated = state.l3DemonsDefeated;
        combatRef.current.notifyStats();
      }
    }
  }, [state]);

  // ── Player HP values for dual display ──
  const p1Hp = myRole === 'player1' ? stats.playerHp : (state.p1Pos?.hp ?? 100);
  const p2Hp = myRole === 'player2' ? stats.playerHp : (state.p2Pos?.hp ?? 100);
  const p1MaxHp = 100;
  const p2MaxHp = 100;

  // Initialize 3D Engine
  useEffect(() => {
    if (!mountRef.current || !isL2Complete) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Fog — Crimson Demon Throne Room
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a0000);
    scene.fog = new THREE.FogExp2(0x330800, 0.032);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.05, 120);
    camera.position.set(0, 3.2, 6.5);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;

    // Append canvas
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 15;

    // 5. Environment, Lights & Atmosphere
    const { demonFire, floorGlow } = buildArena(scene);
    const embers = buildSkySphere(scene);

    // Load tatami.glb as arena floor
    let tatamiModel: THREE.Group | null = null;
    let isMounted = true;
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('/models/tatami.glb', (gltf) => {
      if (!isMounted) return;
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      model.position.x = -center.x;
      model.position.z = -center.z;
      const scaleFactor = 32 / Math.max(size.x, size.z);
      model.scale.setScalar(scaleFactor);
      model.updateMatrixWorld(true);
      const scaledBox = new THREE.Box3().setFromObject(model);
      model.position.y = -scaledBox.max.y;
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      tatamiModel = model;
      scene.add(model);
    });

    // 6. Character & Partner Character (GLB Models)
    const p1ModelUrl = '/models/player1.glb';
    const p2ModelUrl = '/models/player2.glb';

    const localModelUrl = myRole === 'player1' ? p1ModelUrl : p2ModelUrl;
    const remoteModelUrl = myRole === 'player1' ? p2ModelUrl : p1ModelUrl;

    const P1_SPAWN_X = -1.8;
    const P2_SPAWN_X = 1.8;
    const SPAWN_Z = 0;
    const MIN_PLAYER_SEPARATION = 3.0;

    const localSpawnX = myRole === 'player1' ? P1_SPAWN_X : P2_SPAWN_X;
    const remoteSpawnX = myRole === 'player1' ? P2_SPAWN_X : P1_SPAWN_X;

    const character = new DemonSlayerCharacter(scene, localModelUrl);
    character.group.position.set(localSpawnX, 0, SPAWN_Z);
    characterRef.current = character;

    const partnerCharacter = new DemonSlayerCharacter(scene, remoteModelUrl);
    partnerCharacter.group.position.set(remoteSpawnX, 0, SPAWN_Z);

    // Initial spawn: BroadcastChannel only — partner is loading at the same time,
    // their first 3-second position sync will confirm state. No Firestore write needed here.
    const initPosData = {
      x: localSpawnX,
      z: SPAWN_Z,
      rot: 0,
      state: 'idle',
      alive: true,
      hp: 100,
    };
    if (myRole === 'player1') {
      gameSync.broadcastLocal({ p1Pos: initPosData });
    } else {
      gameSync.broadcastLocal({ p2Pos: initPosData });
    }

    const effects = new EffectsEngine(scene, camera);

    const combat = new CombatEngine(
      scene,
      character,
      effects,
      {
        onStatsChange: (newStats) => {
          setStats(newStats);
        },
        onAnnouncement: (text) => {
          setAnnouncementText(text);
          setShowAnnouncement(true);
          setTimeout(() => setShowAnnouncement(false), 2000);
        },
        onDemonDefeated: (count) => {
          // Write to Firestore every 5 kills to batch updates.
          // Victory at exactly 75 is handled by onAllDemonsDefeated which always writes immediately.
          if (count % 5 === 0) {
            gameSync.updateState({ l3DemonsDefeated: count });
          } else {
            // BroadcastChannel only — same-device tabs see the count instantly
            gameSync.broadcastLocal({ l3DemonsDefeated: count });
          }
        },
        onAllDemonsDefeated: () => {
          const level3DurationSec = state.level3Duration || 240;
          const l3TimeSpent = Math.max(1, level3DurationSec - state.timeRemaining);

          gameSync.updateState({
            l3DemonHp: 0,
            l3DemonsDefeated: 75,
            l3TimeElapsed: l3TimeSpent,
            currentLevel: 4,
            gameStatus: 'victory',
            isDemonSealed: true,
          });

          // Save run to global leaderboard
          import('@/lib/leaderboardService').then(({ saveTeamScore }) => {
            saveTeamScore({
              teamCode: state.teamCode || 'TEAM-' + Math.floor(Math.random() * 9000 + 1000),
              teamName: state.teamName || 'Demon Slayers',
              player1: state.player1Name || 'Player 1',
              player2: state.player2Name || 'Player 2',
              levelsCompleted: 3,
              totalTimeSeconds: l3TimeSpent,
              gameStatus: 'victory',
              date: new Date().toLocaleDateString(),
            });
          });
        }
      },
      state.l3DemonsDefeated || 0,
      partnerCharacter,
      myRole
    );
    combatRef.current = combat;

    // 7. Input State Loop
    const keys: Record<string, boolean> = {
      w: false, a: false, s: false, d: false,
      ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (keys.hasOwnProperty(e.key)) keys[e.key] = true;

      if (e.key === 'x' || e.key === 'X') {
        combat.playerMeleeAttack();
      } else if (e.key === ' ') {
        e.preventDefault();
        combat.playerDash();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
    };

    const handleCanvasClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.hud-panel') || target.closest('button')) return;
      combat.playerMeleeAttack();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    renderer.domElement.addEventListener('click', handleCanvasClick);

    // 8. Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 9. Main Animation Loop
    const clock = new THREE.Clock();
    let animFrameId: number;
    let frameCounter = 0;
    let elapsedTime = 0;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      frameCounter++;

      const deltaTime = Math.min(clock.getDelta(), 0.1);
      elapsedTime += deltaTime;

      const moveDir = new THREE.Vector3();
      if (keys.w || keys.ArrowUp) moveDir.z -= 1;
      if (keys.s || keys.ArrowDown) moveDir.z += 1;
      if (keys.a || keys.ArrowLeft) moveDir.x -= 1;
      if (keys.d || keys.ArrowRight) moveDir.x += 1;

      const isMoving = moveDir.lengthSq() > 0;

      if (isMoving && combat.playerHp > 0) {
        moveDir.normalize();

        const cameraAngle = Math.atan2(
          camera.position.x - character.group.position.x,
          camera.position.z - character.group.position.z
        );

        const rotatedMove = moveDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);

        const moveSpeed = 4.5;
        character.group.position.addScaledVector(rotatedMove, deltaTime * moveSpeed);

        if (character.group.position.length() > 13.5) {
          character.group.position.setLength(13.5);
        }

        const targetRotation = Math.atan2(rotatedMove.x, rotatedMove.z);
        character.group.rotation.y = THREE.MathUtils.lerp(
          character.group.rotation.y,
          targetRotation,
          0.15
        );
      }

      // Broadcast local position via BroadcastChannel only (same-device tabs, instant, zero Firestore cost).
      // Cross-device position is NOT synced — HP, death, demon count and victory are synced instead.
      if (frameCounter % 3 === 0) {
        const charPos = character.group.position;
        const charRot = character.group.rotation.y;
        const isLocalAlive = combat.playerHp > 0 && character.state !== 'die';
        const localPosData = {
          x: charPos.x,
          z: charPos.z,
          rot: charRot,
          state: character.state,
          alive: isLocalAlive,
          hp: combat.playerHp
        };

        if (myRole === 'player1') {
          gameSync.broadcastLocal({ p1Pos: localPosData });
        } else {
          gameSync.broadcastLocal({ p2Pos: localPosData });
        }
      }

      // Smoothly update remote partner position & animation
      const partnerPosData = myRole === 'player1' ? stateRef.current.p2Pos : stateRef.current.p1Pos;
      if (partnerPosData && partnerCharacter) {
        const isPartnerAlive =
          partnerPosData.alive !== false &&
          partnerPosData.state !== 'die' &&
          (partnerPosData.hp === undefined || partnerPosData.hp > 0);

        if (!isPartnerAlive) {
          partnerCharacter.setState('die');
          partnerCharacter.update(deltaTime, false);
          const deathDur = partnerCharacter.playerModel.getDeathDuration();
          if (partnerCharacter.animTime >= deathDur + 0.5) {
            partnerCharacter.group.visible = false;
            if (partnerCharacter.group.parent) {
              partnerCharacter.group.parent.remove(partnerCharacter.group);
            }
          }
        } else {
          partnerCharacter.group.visible = true;
          const prevX = partnerCharacter.group.position.x;
          const prevZ = partnerCharacter.group.position.z;

          // Safety check: prevent models from overlapping if synced positions are too close
          let targetX = partnerPosData.x;
          let targetZ = partnerPosData.z;
          const distToLocal = Math.hypot(targetX - character.group.position.x, targetZ - character.group.position.z);
          if (distToLocal < 1.2) {
            const sideOffset = myRole === 'player1' ? 3.0 : -3.0;
            targetX = character.group.position.x + sideOffset;
          }

          partnerCharacter.group.position.x = THREE.MathUtils.lerp(partnerCharacter.group.position.x, targetX, 0.2);
          partnerCharacter.group.position.z = THREE.MathUtils.lerp(partnerCharacter.group.position.z, targetZ, 0.2);
          partnerCharacter.group.rotation.y = THREE.MathUtils.lerp(partnerCharacter.group.rotation.y, partnerPosData.rot, 0.2);

          const distSq = (partnerCharacter.group.position.x - prevX) ** 2 + (partnerCharacter.group.position.z - prevZ) ** 2;
          const isPartnerMoving = distSq > 0.0005;

          const remoteState = partnerPosData.state || 'idle';
          if (remoteState === 'slash') {
            partnerCharacter.setState('slash');
          } else if (isPartnerMoving) {
            partnerCharacter.setState('walk');
          } else {
            partnerCharacter.setState('idle');
          }

          partnerCharacter.update(deltaTime, isPartnerMoving);
        }
      }

      character.update(deltaTime, isMoving, moveDir);
      effects.update(deltaTime);
      combat.update(deltaTime);

      // Check Team Disqualification condition
      const isLocalAlive = combat.playerHp > 0 && character.state !== 'die';
      const isPartnerAlive = partnerPosData
        ? (partnerPosData.alive !== false && partnerPosData.state !== 'die' && (partnerPosData.hp === undefined || partnerPosData.hp > 0))
        : true;

      if (!isLocalAlive && !isPartnerAlive) {
        if (stateRef.current.gameStatus === 'playing' && stateRef.current.currentLevel === 3 && !stateRef.current.isDemonSealed) {
          gameSync.updateState({ gameStatus: 'disqualified' });
        }
      }

      // Animate embers & pulse lighting
      if (embers) {
        const ePos = embers.geometry.attributes.position.array as Float32Array;
        for (let ei = 0; ei < ePos.length; ei += 3) {
          ePos[ei + 1] += deltaTime * 1.2;
          if (ePos[ei + 1] > 20) ePos[ei + 1] = -3;
        }
        embers.geometry.attributes.position.needsUpdate = true;
      }

      demonFire.intensity = 4 + Math.sin(elapsedTime * 3.5) * 1.5;
      floorGlow.intensity = 3 + Math.sin(elapsedTime * 2.8 + 1.2) * 1.0;

      const charPos = character.group.position;
      controls.target.lerp(new THREE.Vector3(charPos.x, charPos.y + 1.2, charPos.z), 0.1);
      controls.update();

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      isMounted = false;
      if (tatamiModel) scene.remove(tatamiModel);
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      character.dispose();
      partnerCharacter.dispose();
      effects.dispose();
      renderer.dispose();
      rendererRef.current = null;
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isL2Complete]);

  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  if (!isL2Complete) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-12 flex flex-col items-center gap-8 text-center">
        <div className="w-20 h-20 rounded-full bg-amber-950/60 border-2 border-amber-500/50 flex items-center justify-center text-4xl animate-pulse">
          🔒
        </div>
        <div className="space-y-2">
          <p className="text-xs font-mono tracking-widest text-amber-400 uppercase">Final Level 3 · Locked</p>
          <h2 className="text-2xl font-extrabold text-white font-serif">Waiting for Partner</h2>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">
            Your partner is clearing Level 2. The 3D Demon Slayer Arena unlocks when Level 2 is completed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-80px)] min-h-[600px] rounded-3xl overflow-hidden border border-red-900/60 bg-zinc-950 shadow-2xl">
      {/* Dynamic 3D WebGL Canvas */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing" />

      {/* Red Hit Screen Overlay for Damage Flash */}
      <div id="damage-flash" className="pointer-events-none z-10" />

      {/* HUD OVERLAY */}
      <div className="relative z-20 w-full h-full p-4 pointer-events-none flex flex-col justify-between">

        {/* TOP BAR */}
        <div className="flex items-start justify-between gap-4">

          {/* Top Left: Spacer / Announcement alignment */}
          <div className="w-48 hidden md:block" />

          {/* Top Center: Combo Counter & Live Announcement */}
          <div className="flex flex-col items-center justify-center text-center space-y-2 mx-auto pointer-events-auto">
            {stats.combo > 0 && (
              <div className="animate-bounce" id="combo-container">
                <div className="text-5xl font-black font-serif text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]" id="combo-count">
                  {stats.combo}
                </div>
                <div className="text-[10px] font-mono font-extrabold tracking-widest text-white uppercase">
                  COMBO HITS
                </div>
              </div>
            )}

            {showAnnouncement && (
              <div className="bg-black/85 border border-amber-400 text-amber-300 font-serif font-extrabold text-sm sm:text-base px-6 py-2 rounded-full shadow-[0_0_25px_rgba(251,191,36,0.5)] transition-all animate-pulse" id="announcement">
                {announcementText}
              </div>
            )}
          </div>

          {/* Top Right: Player Health & Demons Defeated HUD Panel */}
          <div className="hud-panel pointer-events-auto bg-zinc-950/85 backdrop-blur-md border border-zinc-800 p-3.5 rounded-2xl w-64 space-y-3 shadow-2xl">
            {/* Player 1 Health */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px] font-mono font-bold">
                <span className="text-cyan-400 uppercase tracking-wider">{state.player1Name || 'PLAYER 1'}</span>
                <span className="text-zinc-300">{Math.round(Math.max(0, p1Hp))} / {p1MaxHp}</span>
              </div>
              <div className="w-full h-2.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  style={{ width: `${Math.max(0, (p1Hp / p1MaxHp) * 100)}%` }}
                />
              </div>
            </div>

            {/* Player 2 Health */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px] font-mono font-bold">
                <span className="text-amber-400 uppercase tracking-wider">{state.player2Name || 'PLAYER 2'}</span>
                <span className="text-zinc-300">{Math.round(Math.max(0, p2Hp))} / {p2MaxHp}</span>
              </div>
              <div className="w-full h-2.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                  style={{ width: `${Math.max(0, (p2Hp / p2MaxHp) * 100)}%` }}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-800/80" />

            {/* Demons Defeated Counter */}
            <div className="flex items-center justify-between text-[11px] font-mono font-bold">
              <span className="text-red-400 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse" /> DEMONS DEFEATED
              </span>
              <span className="text-amber-400 font-extrabold text-xs">
                {state.l3DemonsDefeated || stats.demonsDefeated || 0} / 75
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className="flex items-end justify-between">

          {/* Bottom Left: Sound + Help Utility Group */}
          <div className="hud-panel pointer-events-auto bg-zinc-950/85 backdrop-blur-md border border-zinc-800 p-2 rounded-2xl flex items-center gap-2 shadow-2xl">
            <button
              onClick={handleToggleSound}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-300 transition-colors flex items-center gap-1.5 text-xs font-mono font-medium"
              title="Toggle Audio SFX"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
              <span>Sound</span>
            </button>

            <button
              onClick={() => setIsHelpOpen(true)}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-300 transition-colors flex items-center gap-1.5 text-xs font-mono font-medium"
              title="Controls Help Guide"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Help</span>
            </button>
          </div>

          {/* Bottom Right: Spacer (Clean & empty) */}
          <div />

        </div>

      </div>

      {/* Controls Help Guide Modal */}
      {isHelpOpen && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-serif font-extrabold text-amber-400">
                CONTROLS <span className="text-xs text-zinc-400 font-sans">操作方法</span>
              </h3>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="text-zinc-400 hover:text-white text-xl font-bold px-2"
              >
                ×
              </button>
            </div>

            <table className="w-full text-xs font-mono border-collapse">
              <tbody>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2.5">
                    <kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-amber-300">X</kbd> / <span className="text-zinc-400">Click</span>
                  </td>
                  <td className="py-2.5 text-zinc-300 font-semibold">Attack</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2.5">
                    <kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-amber-300">SPACE</kbd>
                  </td>
                  <td className="py-2.5 text-zinc-300 font-semibold">Dash</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2.5">
                    <kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-amber-300">W A S D</kbd> / <kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-amber-300">Arrows</kbd>
                  </td>
                  <td className="py-2.5 text-zinc-300 font-semibold">Movement</td>
                </tr>
                <tr>
                  <td className="py-2.5">
                    <span className="text-zinc-400">Mouse Drag</span>
                  </td>
                  <td className="py-2.5 text-zinc-300 font-semibold">360° Orbit Camera</td>
                </tr>
              </tbody>
            </table>

            <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-3 text-[10px] font-mono text-red-300 space-y-1">
              <p className="font-bold text-red-400 uppercase tracking-wider">COMBAT RULES</p>
              <p>• Approach a demon and strike with X or Click to defeat it</p>
              <p>• Eliminate all 75 demons with your partner to win!</p>
            </div>

            <button
              onClick={() => setIsHelpOpen(false)}
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-mono font-extrabold rounded-xl transition-colors"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Arena Builder Helpers
function buildArena(scene: THREE.Scene): { demonFire: THREE.PointLight; floorGlow: THREE.PointLight } {
  // 1. Soft Warm Ambient Light
  const ambient = new THREE.AmbientLight(0xffe2d0, 1.4);
  scene.add(ambient);

  // 2. Key Directional Light
  const fireKey = new THREE.DirectionalLight(0xffd5a6, 2.6);
  fireKey.position.set(6, 16, 10);
  fireKey.castShadow = true;
  fireKey.shadow.mapSize.width = 2048;
  fireKey.shadow.mapSize.height = 2048;
  fireKey.shadow.bias = -0.0002;
  scene.add(fireKey);

  // 3. Hemisphere Fill Light
  const fillHemi = new THREE.HemisphereLight(0xffbe88, 0x661800, 1.4);
  fillHemi.position.set(0, 18, 0);
  scene.add(fillHemi);

  // 4. Rim Light
  const rimLight = new THREE.DirectionalLight(0xff5500, 1.8);
  rimLight.position.set(0, 6, -12);
  scene.add(rimLight);

  // Pulsing demon fire behind throne
  const demonFire = new THREE.PointLight(0xff3300, 4.5, 22);
  demonFire.position.set(0, 4, -9);
  scene.add(demonFire);

  // Ground-level orange glow
  const floorGlow = new THREE.PointLight(0xff7700, 3.5, 20);
  floorGlow.position.set(0, 0.8, 3);
  scene.add(floorGlow);

  // Character overhead spotlight
  const charSpot = new THREE.SpotLight(0xffe8d0, 2.5, 18, Math.PI * 0.22, 0.5, 1.0);
  charSpot.position.set(0, 10, 3);
  charSpot.target.position.set(0, 0.8, 0);
  scene.add(charSpot);
  scene.add(charSpot.target);

  buildToriiGate(scene, 0, 0, -12);
  buildLantern(scene, -6, 0, -8);
  buildLantern(scene, 6, 0, -8);
  buildLantern(scene, -8, 0, 4);
  buildLantern(scene, 8, 0, 4);
  buildLantern(scene, -4, 0, 8);
  buildLantern(scene, 4, 0, 8);

  return { demonFire, floorGlow };
}

function buildSkySphere(scene: THREE.Scene): THREE.Points {
  const skyGeo = new THREE.SphereGeometry(80, 32, 32);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x150000,
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  const emberCount = 200;
  const emberGeo = new THREE.BufferGeometry();
  const emberPos = new Float32Array(emberCount * 3);
  const emberCol = new Float32Array(emberCount * 3);

  for (let i = 0; i < emberCount; i++) {
    emberPos[i * 3]     = (Math.random() - 0.5) * 30;
    emberPos[i * 3 + 1] = Math.random() * 22 - 3;
    emberPos[i * 3 + 2] = (Math.random() - 0.5) * 30;
    const t = Math.random();
    emberCol[i * 3]     = 1.0;
    emberCol[i * 3 + 1] = 0.15 + t * 0.45;
    emberCol[i * 3 + 2] = 0.0;
  }

  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  emberGeo.setAttribute('color',    new THREE.BufferAttribute(emberCol, 3));

  const emberMat = new THREE.PointsMaterial({
    size: 0.07,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
  });

  const embers = new THREE.Points(emberGeo, emberMat);
  scene.add(embers);

  return embers;
}

function buildToriiGate(scene: THREE.Scene, x: number, y: number, z: number) {
  const toriiMat = new THREE.MeshStandardMaterial({ color: 0xb30000, roughness: 0.4 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });

  const gate = new THREE.Group();
  gate.position.set(x, y, z);

  const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 6, 12), toriiMat);
  p1.position.set(-3.5, 3, 0);
  p1.castShadow = true;
  gate.add(p1);

  const p2 = p1.clone();
  p2.position.set(3.5, 3, 0);
  gate.add(p2);

  const b1 = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.4, 0.5), toriiMat);
  b1.position.set(0, 5.5, 0);
  b1.castShadow = true;
  gate.add(b1);

  const b2 = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.5, 0.6), blackMat);
  b2.position.set(0, 6.0, 0);
  b2.castShadow = true;
  gate.add(b2);

  scene.add(gate);
}

function buildLantern(scene: THREE.Scene, x: number, y: number, z: number) {
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x444455 });
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

  const lantern = new THREE.Group();
  lantern.position.set(x, y, z);

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.6), stoneMat);
  base.position.y = 0.6;
  lantern.add(base);

  const fire = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.35), fireMat);
  fire.position.y = 1.4;
  lantern.add(fire);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.4, 4), stoneMat);
  roof.position.y = 1.75;
  roof.rotation.y = Math.PI / 4;
  lantern.add(roof);

  const pLight = new THREE.PointLight(0xffaa00, 0.8, 6);
  pLight.position.y = 1.4;
  lantern.add(pLight);

  scene.add(lantern);
}
