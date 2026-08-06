"use client";

import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GameGameState, gameSync } from "@/lib/gameStore";
import { DemonSlayerCharacter } from "@/components/level3/DemonSlayerCharacter";
import { EffectsEngine } from "@/components/level3/EffectsEngine";
import { CombatEngine, CombatStats } from "@/components/level3/CombatEngine";
import { sound } from "@/components/level3/SoundSynthesizer";
import { Eye, Flame, ShieldAlert, Sparkles, Volume2, VolumeX, Camera, HelpCircle, Download, Zap, Heart, Swords, Crosshair } from "lucide-react";

interface FinalLevelScreenProps {
  state: GameGameState;
  myRole: 'player1' | 'player2';
}

export const FinalLevelScreen: React.FC<FinalLevelScreenProps> = ({ state, myRole }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const combatRef = useRef<CombatEngine | null>(null);
  const characterRef = useRef<DemonSlayerCharacter | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const [stats, setStats] = useState<CombatStats>({
    playerHp: 100,
    playerMaxHp: 100,
    playerStamina: 100,
    playerMaxStamina: 100,
    demonHp: 150,
    demonMaxHp: 150,
    combo: 0,
    announcement: 'OWNDAYS TANJIRO FRAME ACTIVE!',
    isDemonDefeated: false,
    demonsDefeated: 0,
    totalDemons: 75,
  });

  const [currentStyle, setCurrentStyle] = useState<'water' | 'flame' | 'thunder'>('water');
  const [hasGlasses, setHasGlasses] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [announcementText, setAnnouncementText] = useState("OWNDAYS TANJIRO FRAME ACTIVE!");
  const [showAnnouncement, setShowAnnouncement] = useState(true);

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

  // Initialize 3D Engine
  useEffect(() => {
    if (!mountRef.current || !isL2Complete) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06060e);
    scene.fog = new THREE.FogExp2(0x080814, 0.028);

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

    // Append canvas
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 15;

    // 5. Environment & Lights
    buildArena(scene);
    buildSkySphere(scene);

    // 6. Character & Partner Character for Duo Arena
    const character = new DemonSlayerCharacter(scene);
    if (myRole === 'player2') {
      character.setBreathingStyle('thunder');
    }
    characterRef.current = character;

    // Partner Character in scene for co-op feel
    const partnerCharacter = new DemonSlayerCharacter(scene);
    partnerCharacter.group.position.set(myRole === 'player1' ? 1.8 : -1.8, 0, 0);
    partnerCharacter.setBreathingStyle(myRole === 'player1' ? 'thunder' : 'water');

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
          gameSync.updateState({ l3DemonsDefeated: count });
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
      state.l3DemonsDefeated || 0
    );
    combatRef.current = combat;

    // 7. Input State Loop
    const keys: Record<string, boolean> = {
      w: false, a: false, s: false, d: false,
      ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
      Shift: false
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (keys.hasOwnProperty(e.key)) keys[e.key] = true;

      if (e.key === 'j' || e.key === 'J') combat.playerLightSlash();
      else if (e.key === 'k' || e.key === 'K') combat.playerSpecialAttack(character.breathingStyle);
      else if (e.key === 'x' || e.key === 'X') combat.playerExecutionFinisher();
      else if (e.key === ' ') combat.playerDash();
      else if (e.key === 'Shift') combat.setPlayerBlocking(true);
      else if (e.key === 'h' || e.key === 'H') combat.playerHeal();
      else if (e.key === 'g' || e.key === 'G') {
        const active = character.toggleGlasses();
        setHasGlasses(active);
      }
      else if (e.key === 'n' || e.key === 'N') combat.spawnDemonTarget();
      else if (e.key === '1') switchStyle('water');
      else if (e.key === '2') switchStyle('flame');
      else if (e.key === '3') switchStyle('thunder');
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
      if (e.key === 'Shift') combat.setPlayerBlocking(false);
    };

    const handleCanvasClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.hud-panel') || target.closest('button')) return;
      combat.playerLightSlash();
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

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      frameCounter++;

      const deltaTime = Math.min(clock.getDelta(), 0.1);

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

      // Broadcast local player's 3D position over network/broadcast channel every 6 frames (~10Hz)
      if (frameCounter % 6 === 0) {
        const charPos = character.group.position;
        const charRot = character.group.rotation.y;
        if (myRole === 'player1') {
          gameSync.updateState({ p1Pos: { x: charPos.x, z: charPos.z, rot: charRot, state: character.state } });
        } else {
          gameSync.updateState({ p2Pos: { x: charPos.x, z: charPos.z, rot: charRot, state: character.state } });
        }
      }

      // Smoothly update remote partner character's 3D position & movement in partner's screen
      const partnerData = myRole === 'player1' ? stateRef.current.p2Pos : stateRef.current.p1Pos;
      if (partnerData && partnerCharacter) {
        const prevX = partnerCharacter.group.position.x;
        const prevZ = partnerCharacter.group.position.z;

        partnerCharacter.group.position.x = THREE.MathUtils.lerp(partnerCharacter.group.position.x, partnerData.x, 0.2);
        partnerCharacter.group.position.z = THREE.MathUtils.lerp(partnerCharacter.group.position.z, partnerData.z, 0.2);
        partnerCharacter.group.rotation.y = THREE.MathUtils.lerp(partnerCharacter.group.rotation.y, partnerData.rot, 0.2);

        const distSq = (partnerCharacter.group.position.x - prevX) ** 2 + (partnerCharacter.group.position.z - prevZ) ** 2;
        const isPartnerMoving = distSq > 0.0005;

        partnerCharacter.update(deltaTime, isPartnerMoving, new THREE.Vector3());
      }

      character.update(deltaTime, isMoving, moveDir);
      effects.update(deltaTime);
      combat.update(deltaTime);

      const charPos = character.group.position;
      controls.target.lerp(new THREE.Vector3(charPos.x, charPos.y + 1.2, charPos.z), 0.1);
      controls.update();

      renderer.render(scene, camera);
    };

    animate();

    // Clean up
    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      effects.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isL2Complete]);

  const switchStyle = (style: 'water' | 'flame' | 'thunder') => {
    setCurrentStyle(style);
    if (characterRef.current) {
      characterRef.current.setBreathingStyle(style);
    }
    if (combatRef.current) {
      if (style === 'water') combatRef.current.showAnnouncement("EQUIPPED OWNDAYS TANJIRO FRAME!");
      else if (style === 'flame') combatRef.current.showAnnouncement("EQUIPPED OWNDAYS RENGOKU FRAME!");
      else if (style === 'thunder') combatRef.current.showAnnouncement("EQUIPPED OWNDAYS ZENITSU FRAME!");
    }
  };

  const handleToggleGlasses = () => {
    if (characterRef.current) {
      const active = characterRef.current.toggleGlasses();
      setHasGlasses(active);
      if (combatRef.current) {
        combatRef.current.showAnnouncement(active ? "OWNDAYS GLASSES EQUIPPED!" : "GLASSES REMOVED");
      }
    }
  };

  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const handleResetCamera = () => {
    if (characterRef.current && cameraRef.current) {
      const charPos = characterRef.current.group.position;
      cameraRef.current.position.set(charPos.x, charPos.y + 3.5, charPos.z + 7);
    }
  };

  const handleExportBlender = () => {
    if (characterRef.current) {
      characterRef.current.exportBlenderOBJ();
      if (combatRef.current) {
        combatRef.current.showAnnouncement("EXPORTED BLENDER 3D MODEL (.OBJ)!");
      }
    }
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
        
        {/* TOP BAR: Player Stats & Target Info */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          
          {/* Top Left: Character Status Panel */}
          <div className="hud-panel pointer-events-auto bg-zinc-950/80 backdrop-blur-md border border-zinc-800 p-3.5 rounded-2xl w-full max-w-xs space-y-3 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/30 to-black border-2 border-cyan-400 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(0,210,255,0.4)]">
                {currentStyle === 'water' ? '👓' : currentStyle === 'flame' ? '🔥' : '⚡'}
              </div>
              <div>
                <h3 className="text-xs font-extrabold font-serif text-white tracking-wider flex items-center gap-1">
                  OWNDAYS SLAYER <span className="text-[10px] text-amber-400 font-sans">鬼殺隊</span>
                </h3>
                <p className="text-[11px] text-cyan-400 font-mono font-semibold">
                  {currentStyle === 'water' ? 'Tanjiro Frame • 水の呼吸' : currentStyle === 'flame' ? 'Kyojuro Frame • 炎の呼吸' : 'Zenitsu Frame • 雷の呼吸'}
                </p>
              </div>
            </div>

            {/* Health Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono font-bold text-zinc-300">
                <span>HEALTH (HP)</span>
                <span>{stats.playerHp} / {stats.playerMaxHp}</span>
              </div>
              <div className="w-full h-3 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  style={{ width: `${(stats.playerHp / stats.playerMaxHp) * 100}%` }}
                />
              </div>
            </div>

            {/* Stamina Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono font-bold text-zinc-300">
                <span>BREATHING STAMINA</span>
                <span>{stats.playerStamina} / {stats.playerMaxStamina}</span>
              </div>
              <div className="w-full h-2.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                  style={{ width: `${(stats.playerStamina / stats.playerMaxStamina) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Top Center: 75 Demons Elimination Tracker, Combo Counter & Live Announcement */}
          <div className="flex flex-col items-center justify-center text-center space-y-2 mx-auto pointer-events-auto">
            {/* 75 Demons Elimination Challenge Badge */}
            <div className="bg-zinc-950/90 border border-red-800/80 px-5 py-2.5 rounded-2xl shadow-2xl space-y-1 max-w-xs">
              <div className="flex items-center justify-between text-[11px] font-mono font-extrabold gap-4">
                <span className="text-red-400 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse" /> DEMONS DEFEATED
                </span>
                <span className="text-amber-400 font-extrabold text-xs">
                  {state.l3DemonsDefeated || stats.demonsDefeated || 0} / 75
                </span>
              </div>
              <div className="w-full h-3 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 transition-all duration-500 shadow-[0_0_12px_rgba(239,68,68,0.7)]"
                  style={{ width: `${Math.min(100, Math.round(((state.l3DemonsDefeated || stats.demonsDefeated || 0) / 75) * 100))}%` }}
                />
              </div>
              <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                Defeat all 75 Demons fast to rank #1 on Leaderboard!
              </p>
            </div>

            {stats.combo > 0 && (
              <div className="animate-bounce">
                <div className="text-5xl font-black font-serif text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]">
                  {stats.combo}
                </div>
                <div className="text-[10px] font-mono font-extrabold tracking-widest text-white uppercase">
                  COMBO HITS
                </div>
              </div>
            )}

            {showAnnouncement && (
              <div className="bg-black/85 border border-amber-400 text-amber-300 font-serif font-extrabold text-sm sm:text-base px-6 py-2 rounded-full shadow-[0_0_25px_rgba(251,191,36,0.5)] transition-all animate-pulse">
                {announcementText}
              </div>
            )}
          </div>

          {/* Top Right: Style Selector & Demon Target HP */}
          <div className="hud-panel pointer-events-auto bg-zinc-950/80 backdrop-blur-md border border-zinc-800 p-3.5 rounded-2xl w-full max-w-xs space-y-3 shadow-2xl">
            <div className="text-[10px] font-mono font-extrabold text-amber-400 uppercase tracking-widest text-center border-b border-zinc-800 pb-1">
              OWNDAYS KIMETSU COLLECTION
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => switchStyle('water')}
                className={`py-1.5 px-1 rounded-xl border text-[10px] font-mono font-bold transition-all flex flex-col items-center gap-0.5 ${
                  currentStyle === 'water'
                    ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <span>🌊</span>
                <span>Tanjiro</span>
              </button>

              <button
                onClick={() => switchStyle('flame')}
                className={`py-1.5 px-1 rounded-xl border text-[10px] font-mono font-bold transition-all flex flex-col items-center gap-0.5 ${
                  currentStyle === 'flame'
                    ? 'bg-orange-950/80 border-orange-500 text-orange-200 shadow-[0_0_12px_rgba(249,115,22,0.4)]'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <span>🔥</span>
                <span>Kyojuro</span>
              </button>

              <button
                onClick={() => switchStyle('thunder')}
                className={`py-1.5 px-1 rounded-xl border text-[10px] font-mono font-bold transition-all flex flex-col items-center gap-0.5 ${
                  currentStyle === 'thunder'
                    ? 'bg-yellow-950/80 border-yellow-400 text-yellow-200 shadow-[0_0_12px_rgba(250,204,21,0.4)]'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <span>⚡</span>
                <span>Zenitsu</span>
              </button>
            </div>

            {/* Demon Target Health Card */}
            <div className="bg-purple-950/40 border border-purple-800/50 p-2.5 rounded-xl space-y-1">
              <div className="flex justify-between text-[10px] font-mono font-bold">
                <span className="text-purple-400 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-purple-400" /> DEMON TARGET <span className="text-[9px]">鬼</span>
                </span>
                <span className="text-zinc-200">{stats.demonHp} / {stats.demonMaxHp}</span>
              </div>
              <div className="w-full h-2.5 bg-zinc-950 border border-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-pink-500 transition-all duration-300 shadow-[0_0_10px_rgba(168,85,247,0.6)]"
                  style={{ width: `${Math.max(0, (stats.demonHp / stats.demonMaxHp) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM BAR: Quick Action Controls & Utilities */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          
          {/* Action Grid */}
          <div className="hud-panel pointer-events-auto bg-zinc-950/85 backdrop-blur-md border border-zinc-800 p-2.5 rounded-2xl flex flex-wrap items-center gap-2 max-w-2xl shadow-2xl">
            <button
              onClick={() => combatRef.current?.playerLightSlash()}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-mono font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-transform active:scale-95"
            >
              <span className="bg-black/60 border border-zinc-700 px-1.5 py-0.5 rounded text-[10px] text-amber-400">J</span>
              <span>Light Slash</span>
            </button>

            <button
              onClick={() => combatRef.current?.playerSpecialAttack(currentStyle)}
              className="bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500 text-cyan-200 text-xs font-mono font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-transform active:scale-95"
            >
              <span className="bg-black/60 border border-cyan-700 px-1.5 py-0.5 rounded text-[10px] text-cyan-300">K</span>
              <span>
                {currentStyle === 'water' ? 'Water Form 1' : currentStyle === 'flame' ? 'Flame Form 1' : 'Thunder Form 1'}
              </span>
            </button>

            <button
              onClick={() => combatRef.current?.playerExecutionFinisher()}
              className="bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-mono font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.6)] animate-pulse transition-transform active:scale-95"
            >
              <span className="bg-black/60 border border-red-700 px-1.5 py-0.5 rounded text-[10px] text-yellow-300">X</span>
              <span>⚔️ Defeat Demon</span>
            </button>

            <button
              onClick={() => combatRef.current?.playerDash()}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-mono font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-transform active:scale-95"
            >
              <span className="bg-black/60 border border-zinc-700 px-1.5 py-0.5 rounded text-[10px] text-amber-400">SPACE</span>
              <span>Dash</span>
            </button>

            <button
              onMouseDown={() => combatRef.current?.setPlayerBlocking(true)}
              onMouseUp={() => combatRef.current?.setPlayerBlocking(false)}
              onTouchStart={() => combatRef.current?.setPlayerBlocking(true)}
              onTouchEnd={() => combatRef.current?.setPlayerBlocking(false)}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-mono font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-transform active:scale-95"
            >
              <span className="bg-black/60 border border-zinc-700 px-1.5 py-0.5 rounded text-[10px] text-amber-400">SHIFT</span>
              <span>Parry</span>
            </button>

            <button
              onClick={() => combatRef.current?.playerHeal()}
              className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500 text-emerald-200 text-xs font-mono font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-transform active:scale-95"
            >
              <span className="bg-black/60 border border-emerald-700 px-1.5 py-0.5 rounded text-[10px] text-emerald-300">H</span>
              <span>Heal</span>
            </button>

            <button
              onClick={() => combatRef.current?.spawnDemonTarget()}
              className="bg-purple-950/80 hover:bg-purple-900 border border-purple-500 text-purple-200 text-xs font-mono font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-transform active:scale-95"
            >
              <span className="bg-black/60 border border-purple-700 px-1.5 py-0.5 rounded text-[10px] text-purple-300">N</span>
              <span>Spawn Demon</span>
            </button>

            <button
              onClick={handleToggleGlasses}
              className="bg-yellow-950/80 hover:bg-yellow-900 border border-yellow-500 text-yellow-200 text-xs font-mono font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-transform active:scale-95"
            >
              <span className="bg-black/60 border border-yellow-700 px-1.5 py-0.5 rounded text-[10px] text-yellow-300">G</span>
              <span>{hasGlasses ? 'Glasses ON' : 'Glasses OFF'}</span>
            </button>
          </div>

          {/* Utility Buttons */}
          <div className="hud-panel pointer-events-auto bg-zinc-950/85 backdrop-blur-md border border-zinc-800 p-2.5 rounded-2xl flex items-center gap-2 shadow-2xl ml-auto">
            <button
              onClick={handleExportBlender}
              title="Export 3D Model for Blender"
              className="bg-gradient-to-r from-amber-600/40 to-orange-600/40 hover:from-amber-600 hover:to-orange-600 border border-amber-500 text-amber-200 text-xs font-mono font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(245,158,11,0.3)]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export 3D</span>
            </button>

            <button
              onClick={handleToggleSound}
              className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-300 transition-colors"
              title="Toggle Audio SFX"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            <button
              onClick={handleResetCamera}
              className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-300 transition-colors"
              title="Reset Camera View"
            >
              <Camera className="w-4 h-4 text-cyan-400" />
            </button>

            <button
              onClick={() => setIsHelpOpen(true)}
              className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-300 transition-colors"
              title="Controls Help"
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
            </button>
          </div>

        </div>

      </div>

      {/* Controls Help Modal */}
      {isHelpOpen && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-serif font-extrabold text-amber-400">
                CONTROLS LEGEND <span className="text-xs text-zinc-400 font-sans">操作方法</span>
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
                  <td className="py-2"><kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-amber-300">W A S D</kbd> / <kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-amber-300">Arrows</kbd></td>
                  <td className="py-2 text-zinc-300">Move Character</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2"><kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-amber-300">J</kbd> / <span className="text-zinc-400">Click</span></td>
                  <td className="py-2 text-zinc-300">Light Katana Slash</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2"><kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-amber-300">K</kbd></td>
                  <td className="py-2 text-zinc-300">Special Breathing Technique</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2"><kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-amber-300">X</kbd></td>
                  <td className="py-2 text-zinc-300">⚔️ Defeat Demon Instant Finisher</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2"><kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-amber-300">SPACE</kbd></td>
                  <td className="py-2 text-zinc-300">Dodge / Dash</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2"><kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-amber-300">SHIFT</kbd></td>
                  <td className="py-2 text-zinc-300">Parry / Guard (-75% damage)</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2"><kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-amber-300">H</kbd></td>
                  <td className="py-2 text-zinc-300">Gourd Heal</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2"><kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-amber-300">G</kbd></td>
                  <td className="py-2 text-zinc-300">Toggle OWNDAYS Kimetsu Glasses</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2"><kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-amber-300">N</kbd></td>
                  <td className="py-2 text-zinc-300">Spawn / Respawn Demon Target</td>
                </tr>
                <tr className="border-b border-zinc-800/60">
                  <td className="py-2"><kbd className="bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-amber-300">1 2 3</kbd></td>
                  <td className="py-2 text-zinc-300">Switch OWNDAYS Glasses & Form</td>
                </tr>
                <tr>
                  <td className="py-2"><span className="text-zinc-400">Mouse Drag</span></td>
                  <td className="py-2 text-zinc-300">360° Orbit Camera</td>
                </tr>
              </tbody>
            </table>

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
function buildArena(scene: THREE.Scene) {
  const ambient = new THREE.AmbientLight(0x151828, 0.5);
  scene.add(ambient);

  const moonKey = new THREE.DirectionalLight(0x8cb4f0, 2.2);
  moonKey.position.set(8, 18, 12);
  moonKey.castShadow = true;
  moonKey.shadow.mapSize.width = 2048;
  moonKey.shadow.mapSize.height = 2048;
  moonKey.shadow.bias = -0.0002;
  scene.add(moonKey);

  const fillLight = new THREE.DirectionalLight(0xffa050, 0.55);
  fillLight.position.set(-6, 1.5, 5);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0x00e8d2, 1.4);
  rimLight.position.set(0, 4, -9);
  scene.add(rimLight);

  const charSpot = new THREE.SpotLight(0xffd0a0, 2.2, 14, Math.PI * 0.18, 0.55, 1.2);
  charSpot.position.set(0, 9, 2);
  charSpot.target.position.set(0, 0.8, 0);
  scene.add(charSpot);
  scene.add(charSpot.target);

  const groundGeo = new THREE.CylinderGeometry(16, 17, 0.5, 48, 4);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0e0e1a,
    roughness: 0.45,
    metalness: 0.35,
    envMapIntensity: 0.8,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -0.25;
  ground.receiveShadow = true;
  scene.add(ground);

  for (let i = 0; i < 3; i++) {
    const r1 = 4 + i * 3.5;
    const rGeo = new THREE.RingGeometry(r1, r1 + 0.06, 48);
    const rMat = new THREE.MeshBasicMaterial({
      color: i === 0 ? 0x00d2ff : 0x334455,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: i === 0 ? 0.55 : 0.2,
    });
    const ring = new THREE.Mesh(rGeo, rMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);
  }

  buildToriiGate(scene, 0, 0, -12);
  buildLantern(scene, -6, 0, -8);
  buildLantern(scene, 6, 0, -8);
  buildLantern(scene, -8, 0, 4);
  buildLantern(scene, 8, 0, 4);
  buildLantern(scene, -4, 0, 8);
  buildLantern(scene, 4, 0, 8);
}

function buildSkySphere(scene: THREE.Scene) {
  const skyGeo = new THREE.SphereGeometry(80, 32, 32);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x04040e,
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  const starGeo = new THREE.BufferGeometry();
  const starCount = 1200;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 160;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.12,
    transparent: true,
    opacity: 0.8,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
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
