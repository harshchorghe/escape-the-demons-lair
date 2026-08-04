"use client";

import React, { useState, useEffect, useRef } from "react";
import { GameGameState, gameSync } from "@/lib/gameStore";
import { pythonApi } from "@/lib/pythonApi";
import { Level2LockedScreen } from "@/components/screens/Level2LockedScreen";
import { 
  Camera, 
  CameraOff, 
  Sliders, 
  Keyboard, 
  Trophy, 
  AlertTriangle, 
  Award,
  Sparkles,
  RotateCcw,
  Play,
  Video
} from "lucide-react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";

interface Level2ScreenProps {
  state: GameGameState;
  myRole: 'player1' | 'player2';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

interface Pipe {
  x: number;
  topHeight: number;
  bottomHeight: number;
  passed: boolean;
  width: number;
}

export const Level2Screen: React.FC<Level2ScreenProps> = ({ state, myRole }) => {
  const router = useRouter();

  // React State
  const [controlMode, setControlMode] = useState<'gesture' | 'manual'>('manual');
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [gestureDetected, setGestureDetected] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Stats
  const [crashCount, setCrashCount] = useState(0);
  const [feedback, setFeedback] = useState<{ success?: boolean; message: string }>({ message: '' });

  // Refs for Game Loop and Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Camera & Hand Tracking Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const handLandmarkerRef = useRef<any>(null);
  const handDetectionLoopRef = useRef<number | null>(null);
  const handsCloseRef = useRef(false);
  const gestureFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Game Variables (Stored in Refs for smooth 60fps loop access)
  const birdRef = useRef({
    x: 100,
    y: 200,
    vy: 0,
    radius: 12,
    angle: 0,
    flapTimer: 0,
  });

  const pipesRef = useRef<Pipe[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const bgScrollXRef = useRef(0);
  const skylineScrollXRef = useRef(0);
  const groundScrollXRef = useRef(0);
  
  const lastJumpTimeRef = useRef(0);
  const scoreRef = useRef(0);
  const targetScore = 10;

  // Refs mirroring state for use inside long-running loops (hand detection, keyboard handler)
  // This prevents stale closures from capturing old state values
  const isPlayingRef = useRef(isPlaying);
  const isGameOverRef = useRef(isGameOver);
  const isSuccessRef = useRef(isSuccess);
  const countdownRef = useRef(countdown);
  const controlModeRef = useRef(controlMode);
  const isCameraEnabledRef = useRef(isCameraEnabled);

  // Keep refs in sync with state
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isGameOverRef.current = isGameOver; }, [isGameOver]);
  useEffect(() => { isSuccessRef.current = isSuccess; }, [isSuccess]);
  useEffect(() => { countdownRef.current = countdown; }, [countdown]);
  useEffect(() => { controlModeRef.current = controlMode; }, [controlMode]);
  useEffect(() => { isCameraEnabledRef.current = isCameraEnabled; }, [isCameraEnabled]);

  // Constants
  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 520;
  const GROUND_HEIGHT = 70;
  const GRAVITY = 0.32;
  const JUMP_STRENGTH = -6.2;
  const MAX_FALL_SPEED = 9;
  const PIPE_SPEED = 2;
  const PIPE_SPAWN_INTERVAL = 110; // Frames
  const PIPE_GAP = 145; // Pixel gap for bird to fly through

  // Handle high score load from local storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('demons_lair_l2_highscore');
      if (saved) setHighScore(parseInt(saved, 10));
    }
  }, []);

  // Update high score
  const updateHighScore = (newScore: number) => {
    if (newScore > highScore) {
      setHighScore(newScore);
      if (typeof window !== 'undefined') {
        localStorage.setItem('demons_lair_l2_highscore', newScore.toString());
      }
    }
  };

  // 2. Camera & Hand Gesture Integration (MediaPipe Hands)
  const enableCamera = async () => {
    if (isCameraEnabled || isCameraLoading) return;
    setIsCameraLoading(true);
    setFeedback({ message: '⏳ Loading hand tracking model... This may take a moment.' });

    try {
      // Dynamic import to avoid SSR/build issues with WebAssembly
      const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU"
        },
        numHands: 2,
        runningMode: "VIDEO"
      });

      handLandmarkerRef.current = handLandmarker;

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' }
      });
      cameraStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraEnabled(true);
      setIsCameraLoading(false);
      setControlMode('gesture');
      setFeedback({ success: true, message: '📷 Camera connected! Show both hands and clap to fly!' });

      // Start detection loop
      startHandDetection();
    } catch (err) {
      console.error("Camera/Hand tracking setup failed:", err);
      setIsCameraLoading(false);
      setFeedback({ message: '❌ Camera access denied or hand tracking failed. Check browser permissions.' });
    }
  };

  const disableCamera = () => {
    if (handDetectionLoopRef.current) {
      cancelAnimationFrame(handDetectionLoopRef.current);
      handDetectionLoopRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (handLandmarkerRef.current) {
      handLandmarkerRef.current.close();
      handLandmarkerRef.current = null;
    }
    if (gestureFlashTimerRef.current) {
      clearTimeout(gestureFlashTimerRef.current);
    }
    setIsCameraEnabled(false);
    setControlMode('manual');
    handsCloseRef.current = false;
    setGestureDetected(false);
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      disableCamera();
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync mode changes — auto-enable camera when gesture mode selected
  useEffect(() => {
    if (controlMode === 'gesture' && !isCameraEnabled && !isCameraLoading) {
      enableCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlMode]);

  // Ref to always hold the latest triggerJump function
  const triggerJumpRef = useRef<() => void>(() => {});

  // Hand Detection Loop (runs in requestAnimationFrame for real-time tracking)
  // Uses refs instead of state to avoid stale closures
  const prevHandPosRef = useRef<{ y: number; x: number; time: number } | null>(null);
  const prevDistanceRef = useRef<number | null>(null);

  const startHandDetection = () => {
    let lastTimestamp = 0;

    const detectFrame = () => {
      if (!handLandmarkerRef.current || !videoRef.current || !isCameraEnabledRef.current) return;
      if (videoRef.current.readyState < 2) {
        handDetectionLoopRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      // Ensure monotonically increasing timestamps for MediaPipe
      const now = performance.now();
      if (now <= lastTimestamp) {
        handDetectionLoopRef.current = requestAnimationFrame(detectFrame);
        return;
      }
      lastTimestamp = now;

      const results = handLandmarkerRef.current.detectForVideo(videoRef.current, now);
      const currentTime = Date.now();
      let triggered = false;

      if (results.landmarks && results.landmarks.length > 0) {
        // --- 1. Two-Hand Ultra-Fast Clap Detection ---
        if (results.landmarks.length >= 2) {
          const hand1 = results.landmarks[0][9]; // Palm center (MIDDLE_FINGER_MCP)
          const hand2 = results.landmarks[1][9];
          const dx = hand1.x - hand2.x;
          const dy = hand1.y - hand2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Fast Clap Detection Trigger:
          // A) Hands are close together (< 0.28 normalized distance)
          // B) Rapid distance drop (hands coming together fast)
          // C) Hands moving apart after touching
          if (distance < 0.28) {
            triggered = true;
          } else if (prevDistanceRef.current !== null) {
            const distanceDelta = prevDistanceRef.current - distance; // Positive if hands moving closer
            if (distanceDelta > 0.04) {
              // Rapid clap motion detected in flight!
              triggered = true;
            }
          }

          prevDistanceRef.current = distance;
        } else {
          prevDistanceRef.current = null;
        }

        // --- 2. Single-Hand Fast Motion & Velocity Spike Fallback ---
        if (!triggered && results.landmarks[0]) {
          const primaryPalm = results.landmarks[0][9]; // Palm center
          const wrist = results.landmarks[0][0]; // Wrist

          if (prevHandPosRef.current) {
            const dt = currentTime - prevHandPosRef.current.time;
            const deltaY = prevHandPosRef.current.y - primaryPalm.y; // Positive = UP
            const deltaX = Math.abs(primaryPalm.x - prevHandPosRef.current.x);
            const speed = Math.sqrt(deltaY * deltaY + deltaX * deltaX);

            // Trigger on any fast upward jerk OR rapid hand gesture spike (> 0.04 in < 150ms)
            if (dt > 0 && dt < 150 && (deltaY > 0.035 || speed > 0.05)) {
              triggered = true;
            }
          }
          prevHandPosRef.current = { y: primaryPalm.y, x: primaryPalm.x, time: currentTime };
        }

        // --- 3. Execute Jump if Triggered ---
        if (triggered && controlModeRef.current === 'gesture') {
          if (currentTime - lastJumpTimeRef.current > 60) { // 60ms ultra-fast cooldown for high speed clapping
            lastJumpTimeRef.current = currentTime;
            triggerJumpRef.current();

            // Flash visual feedback
            setGestureDetected(true);
            if (gestureFlashTimerRef.current) clearTimeout(gestureFlashTimerRef.current);
            gestureFlashTimerRef.current = setTimeout(() => setGestureDetected(false), 250);
          }
        }
      } else {
        prevDistanceRef.current = null;
      }

      handDetectionLoopRef.current = requestAnimationFrame(detectFrame);
    };

    handDetectionLoopRef.current = requestAnimationFrame(detectFrame);
  };

  // 3. Flappy Bird Mechanics
  const triggerJump = () => {
    if (isGameOverRef.current || isSuccessRef.current || countdownRef.current !== null) return;

    if (!isPlayingRef.current) {
      initiateCountdown();
      return;
    }

    // Set upward velocity
    birdRef.current.vy = JUMP_STRENGTH;
    birdRef.current.flapTimer = 8; // Flapping wings effect frames

    // Spawn jump puff particles
    spawnPuffParticles();
  };

  // Keep the ref pointing to the latest triggerJump
  triggerJumpRef.current = triggerJump;

  // Initiate the 5-second countdown before the game starts
  const initiateCountdown = () => {
    if (countdown !== null) return; // Already counting down
    // Reset bird position for the countdown visual
    birdRef.current.y = 200;
    birdRef.current.vy = 0;
    birdRef.current.angle = 0;
    pipesRef.current = [];
    particlesRef.current = [];
    scoreRef.current = 0;
    setScore(0);
    setIsGameOver(false);
    setIsSuccess(false);
    setFeedback({ message: '' });
    setCountdown(5);
  };

  // Countdown ticker effect
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      // Countdown finished — start the game!
      setCountdown(null);
      setIsPlaying(true);
      return;
    }
    const timer = setTimeout(() => {
      setCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const startGame = () => {
    // Reset variables
    birdRef.current.y = 200;
    birdRef.current.vy = 0;
    birdRef.current.angle = 0;
    
    pipesRef.current = [];
    particlesRef.current = [];
    scoreRef.current = 0;
    setScore(0);
    setIsPlaying(true);
    setIsGameOver(false);
    setFeedback({ message: '' });
  };

  // Keyboard controls listener (uses ref to always call latest triggerJump)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        triggerJumpRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Particles generator
  const spawnPuffParticles = () => {
    const { x, y } = birdRef.current;
    for (let i = 0; i < 4; i++) {
      particlesRef.current.push({
        x: x - 5,
        y: y + 4,
        vx: -1.5 - Math.random() * 2,
        vy: (Math.random() - 0.5) * 1.5,
        size: 3 + Math.random() * 4,
        color: 'rgba(255, 255, 255, 0.45)',
        alpha: 1,
        decay: 0.03 + Math.random() * 0.02
      });
    }
  };

  const spawnExplosionParticles = () => {
    const { x, y } = birdRef.current;
    // Yellow, orange, red feathers & ash particles
    const colors = ['#facc15', '#f97316', '#ef4444', '#78350f', '#3f3f46'];
    for (let i = 0; i < 25; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2, // Slight bias upward
        size: 2 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.015 + Math.random() * 0.015
      });
    }
  };

  // Pipe spawn utility
  const spawnPipe = () => {
    const minHeight = 50;
    const maxHeight = CANVAS_HEIGHT - GROUND_HEIGHT - PIPE_GAP - minHeight;
    const topHeight = Math.floor(minHeight + Math.random() * (maxHeight - minHeight));
    const bottomHeight = CANVAS_HEIGHT - GROUND_HEIGHT - topHeight - PIPE_GAP;

    pipesRef.current.push({
      x: CANVAS_WIDTH,
      topHeight,
      bottomHeight,
      passed: false,
      width: 62,
    });
  };

  // Crash penalty and game restart trigger
  const handleCrash = () => {
    setIsPlaying(false);
    setIsGameOver(true);
    setCrashCount(prev => prev + 1);
    spawnExplosionParticles();

    setFeedback({ 
      success: false, 
      message: `💥 Demonic Trap Triggered! −15 seconds penalty!` 
    });

    // Update global state with time penalty
    gameSync.updateState((prev) => {
      const nextTime = Math.max(0, prev.timeRemaining - 15);
      return {
        ...prev,
        timeRemaining: nextTime,
        timePenalties: prev.timePenalties + 15,
        gameStatus: nextTime <= 0 ? 'disqualified' : prev.gameStatus,
      };
    });
  };

  // Level progression victory sequence
  const triggerVictory = () => {
    setIsPlaying(false);
    setIsSuccess(true);
    setFeedback({ success: true, message: "🎉 Cavern Escaped! Portal to the Throne Room opened!" });

    // Confetti explosion!
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });

    const now = Date.now();
    const l3Sec = state.level3Duration || 300;
    if (state.teamCode) {
      pythonApi.startRoomTimer(state.teamCode, 3);
    }

    // Sync game state to advance to level 3
    setTimeout(() => {
      gameSync.updateState({
        currentLevel: 3,
        timeRemaining: l3Sec,
        levelStartTime: now,
        timePenalties: 0,
      });
      router.push('/level3');
    }, 1800);
  };

  // 4. Main 60 FPS Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameCount = 0;

    const loop = () => {
      frameCount++;
      
      // Clear canvas
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // --- 1. Physics Updates (When Playing) ---
      if (isPlaying && !isGameOver && !isSuccess) {
        // Bird physics
        const bird = birdRef.current;
        bird.vy += GRAVITY;
        if (bird.vy > MAX_FALL_SPEED) bird.vy = MAX_FALL_SPEED;
        bird.y += bird.vy;

        // Angle rotation based on velocity
        bird.angle = Math.min(Math.PI / 4, Math.max(-Math.PI / 7, bird.vy * 0.08));

        // Decrement wing flap timer
        if (bird.flapTimer > 0) bird.flapTimer--;

        // Ceiling collision
        if (bird.y - bird.radius < 0) {
          bird.y = bird.radius;
          bird.vy = 0.5; // Bounce slightly
        }

        // Ground collision
        if (bird.y + bird.radius > CANVAS_HEIGHT - GROUND_HEIGHT) {
          handleCrash();
        }

        // Scroll Background & Parallax skyline
        bgScrollXRef.current = (bgScrollXRef.current - 0.5) % CANVAS_WIDTH;
        skylineScrollXRef.current = (skylineScrollXRef.current - 0.9) % CANVAS_WIDTH;
        groundScrollXRef.current = (groundScrollXRef.current - PIPE_SPEED) % CANVAS_WIDTH;

        // Spawn pipes
        if (frameCount % PIPE_SPAWN_INTERVAL === 0) {
          spawnPipe();
        }

        // Update pipes
        for (let i = pipesRef.current.length - 1; i >= 0; i--) {
          const pipe = pipesRef.current[i];
          pipe.x -= PIPE_SPEED;

          // Check score pass
          if (!pipe.passed && pipe.x + pipe.width / 2 < bird.x) {
            pipe.passed = true;
            scoreRef.current += 1;
            setScore(scoreRef.current);
            updateHighScore(scoreRef.current);
            
            // Check victory condition
            if (scoreRef.current >= targetScore) {
              triggerVictory();
            }
          }

          // Check collision
          const birdBox = {
            left: bird.x - bird.radius + 2,
            right: bird.x + bird.radius - 2,
            top: bird.y - bird.radius + 2,
            bottom: bird.y + bird.radius - 2,
          };

          const topPipeBox = {
            left: pipe.x,
            right: pipe.x + pipe.width,
            top: 0,
            bottom: pipe.topHeight,
          };

          const bottomPipeBox = {
            left: pipe.x,
            right: pipe.x + pipe.width,
            top: CANVAS_HEIGHT - GROUND_HEIGHT - pipe.bottomHeight,
            bottom: CANVAS_HEIGHT - GROUND_HEIGHT,
          };

          const checkCollision = (box1: typeof birdBox, box2: typeof topPipeBox) => {
            return (
              box1.right > box2.left &&
              box1.left < box2.right &&
              box1.bottom > box2.top &&
              box1.top < box2.bottom
            );
          };

          if (checkCollision(birdBox, topPipeBox) || checkCollision(birdBox, bottomPipeBox)) {
            handleCrash();
          }

          // Delete offscreen pipes
          if (pipe.x + pipe.width < 0) {
            pipesRef.current.splice(i, 1);
          }
        }
      }

      // Update particles (always update, even during gameover/lobby)
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
        }
      }

      // --- 2. Canvas Rendering ---
      
      // Draw Sky background gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      skyGrad.addColorStop(0, '#0284c7'); // sky-500 deep
      skyGrad.addColorStop(0.6, '#38bdf8'); // sky-400 light
      skyGrad.addColorStop(0.9, '#e0f2fe'); // sky-100 near horizon
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Parallax clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      const cloudX = bgScrollXRef.current;
      for (let offset = 0; offset <= 1; offset++) {
        const cx = cloudX + offset * CANVAS_WIDTH;
        ctx.beginPath();
        ctx.arc(cx + 40, 70, 20, 0, Math.PI * 2);
        ctx.arc(cx + 65, 60, 28, 0, Math.PI * 2);
        ctx.arc(cx + 90, 70, 20, 0, Math.PI * 2);
        ctx.arc(cx + 65, 80, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx + 250, 110, 15, 0, Math.PI * 2);
        ctx.arc(cx + 270, 100, 22, 0, Math.PI * 2);
        ctx.arc(cx + 290, 110, 15, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Parallax City Skyline at bottom
      ctx.fillStyle = '#0f172a'; // Slate-900 silhouette
      const skylineX = skylineScrollXRef.current;
      for (let offset = 0; offset <= 1; offset++) {
        const sx = skylineX + offset * CANVAS_WIDTH;
        // Simple pixel city layout
        ctx.fillRect(sx + 10, CANVAS_HEIGHT - GROUND_HEIGHT - 60, 25, 60);
        ctx.fillRect(sx + 45, CANVAS_HEIGHT - GROUND_HEIGHT - 90, 30, 90);
        ctx.fillRect(sx + 85, CANVAS_HEIGHT - GROUND_HEIGHT - 50, 20, 50);
        ctx.fillRect(sx + 115, CANVAS_HEIGHT - GROUND_HEIGHT - 80, 35, 80);
        ctx.fillRect(sx + 160, CANVAS_HEIGHT - GROUND_HEIGHT - 40, 25, 40);
        ctx.fillRect(sx + 195, CANVAS_HEIGHT - GROUND_HEIGHT - 100, 35, 100);
        ctx.fillRect(sx + 240, CANVAS_HEIGHT - GROUND_HEIGHT - 60, 20, 60);
        ctx.fillRect(sx + 270, CANVAS_HEIGHT - GROUND_HEIGHT - 75, 40, 75);
        ctx.fillRect(sx + 320, CANVAS_HEIGHT - GROUND_HEIGHT - 50, 25, 50);
        ctx.fillRect(sx + 355, CANVAS_HEIGHT - GROUND_HEIGHT - 90, 30, 90);
      }

      // Draw City Window lights (subtle glows)
      ctx.fillStyle = 'rgba(253, 224, 71, 0.4)'; // translucent yellow
      for (let offset = 0; offset <= 1; offset++) {
        const sx = skylineX + offset * CANVAS_WIDTH;
        ctx.fillRect(sx + 50, CANVAS_HEIGHT - GROUND_HEIGHT - 80, 4, 6);
        ctx.fillRect(sx + 65, CANVAS_HEIGHT - GROUND_HEIGHT - 70, 4, 6);
        ctx.fillRect(sx + 120, CANVAS_HEIGHT - GROUND_HEIGHT - 60, 4, 6);
        ctx.fillRect(sx + 135, CANVAS_HEIGHT - GROUND_HEIGHT - 70, 4, 6);
        ctx.fillRect(sx + 205, CANVAS_HEIGHT - GROUND_HEIGHT - 85, 4, 6);
        ctx.fillRect(sx + 215, CANVAS_HEIGHT - GROUND_HEIGHT - 65, 4, 6);
        ctx.fillRect(sx + 280, CANVAS_HEIGHT - GROUND_HEIGHT - 60, 4, 6);
        ctx.fillRect(sx + 295, CANVAS_HEIGHT - GROUND_HEIGHT - 45, 4, 6);
        ctx.fillRect(sx + 365, CANVAS_HEIGHT - GROUND_HEIGHT - 80, 4, 6);
      }

      // Draw Pipes
      pipesRef.current.forEach((pipe) => {
        // Set colors
        const darkGreen = "#15803d"; // green-700
        const lightGreen = "#4ade80"; // green-400
        const mainGreen = "#22c55e"; // green-500
        
        ctx.strokeStyle = '#052e16'; // outline black-green
        ctx.lineWidth = 2.5;

        // --- Top Pipe ---
        // Main body
        ctx.fillStyle = mainGreen;
        ctx.beginPath();
        ctx.rect(pipe.x, 0, pipe.width, pipe.topHeight);
        ctx.fill();
        ctx.stroke();

        // Shading/Highlight on body
        ctx.fillStyle = lightGreen;
        ctx.fillRect(pipe.x + 4, 0, 6, pipe.topHeight);
        ctx.fillStyle = darkGreen;
        ctx.fillRect(pipe.x + pipe.width - 12, 0, 8, pipe.topHeight);

        // Pipe Lip
        ctx.fillStyle = mainGreen;
        ctx.beginPath();
        ctx.rect(pipe.x - 4, pipe.topHeight - 22, pipe.width + 8, 22);
        ctx.fill();
        ctx.stroke();

        // Lip Highlight & Shading
        ctx.fillStyle = lightGreen;
        ctx.fillRect(pipe.x - 2, pipe.topHeight - 20, 6, 18);
        ctx.fillStyle = darkGreen;
        ctx.fillRect(pipe.x + pipe.width - 2, pipe.topHeight - 20, 4, 18);

        // --- Bottom Pipe ---
        const bottomY = CANVAS_HEIGHT - GROUND_HEIGHT - pipe.bottomHeight;
        // Main body
        ctx.fillStyle = mainGreen;
        ctx.beginPath();
        ctx.rect(pipe.x, bottomY, pipe.width, pipe.bottomHeight);
        ctx.fill();
        ctx.stroke();

        // Shading/Highlight on body
        ctx.fillStyle = lightGreen;
        ctx.fillRect(pipe.x + 4, bottomY, 6, pipe.bottomHeight);
        ctx.fillStyle = darkGreen;
        ctx.fillRect(pipe.x + pipe.width - 12, bottomY, 8, pipe.bottomHeight);

        // Pipe Lip
        ctx.fillStyle = mainGreen;
        ctx.beginPath();
        ctx.rect(pipe.x - 4, bottomY, pipe.width + 8, 22);
        ctx.fill();
        ctx.stroke();

        // Lip Highlight & Shading
        ctx.fillStyle = lightGreen;
        ctx.fillRect(pipe.x - 2, bottomY + 2, 6, 18);
        ctx.fillStyle = darkGreen;
        ctx.fillRect(pipe.x + pipe.width - 2, bottomY + 2, 4, 18);
      });

      // Draw Ground
      const groundGrad = ctx.createLinearGradient(0, CANVAS_HEIGHT - GROUND_HEIGHT, 0, CANVAS_HEIGHT);
      groundGrad.addColorStop(0, '#eab308'); // yellow-500 grass divider
      groundGrad.addColorStop(0.08, '#a16207'); // brown border
      groundGrad.addColorStop(0.2, '#78350f'); // dirt dark
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);

      // Draw scrolling Grass border lines
      ctx.fillStyle = '#22c55e'; // green grass
      ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, 6);

      ctx.fillStyle = '#15803d'; // darker grass texture
      const groundX = groundScrollXRef.current;
      for (let gx = groundX; gx < CANVAS_WIDTH + 40; gx += 16) {
        ctx.beginPath();
        ctx.moveTo(gx, CANVAS_HEIGHT - GROUND_HEIGHT + 6);
        ctx.lineTo(gx - 6, CANVAS_HEIGHT - GROUND_HEIGHT + 14);
        ctx.lineTo(gx - 2, CANVAS_HEIGHT - GROUND_HEIGHT + 14);
        ctx.closePath();
        ctx.fill();
      }

      // Draw Particles
      particlesRef.current.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw Bird (Phoenix/Flappy Bird)
      const bird = birdRef.current;
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(bird.angle);

      // Black outline style
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;

      // 1. Draw Tail feathers (Black/Grey)
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      ctx.lineTo(-21, -6);
      ctx.lineTo(-19, 0);
      ctx.lineTo(-21, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2. Draw Yellow Body
      ctx.fillStyle = '#facc15'; // yellow-400
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 3. Draw Beak (Orange)
      ctx.fillStyle = '#f97316'; // orange-500
      ctx.beginPath();
      ctx.moveTo(13, -1);
      ctx.lineTo(23, 2);
      ctx.lineTo(12, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 4. Draw wing (flaps depending on velocity or timer)
      ctx.fillStyle = '#eab308'; // darker yellow
      ctx.save();
      ctx.translate(-4, 2);
      if (bird.flapTimer > 0) {
        ctx.rotate(-0.4); // Wing flapped up
      } else {
        ctx.rotate(0.3); // Wing down
      }
      ctx.beginPath();
      ctx.ellipse(-3, 0, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 5. Draw Eye (Big white round eye)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(6, -4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pupil (Black dot)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(7.5, -4, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 6. Draw Red Santa-like Hat on head
      // Fur trim (white base band)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      // Drawn relative to bird center (around head area top)
      ctx.roundRect(-10, -17, 18, 5, 2.5);
      ctx.fill();
      ctx.stroke();

      // Hat body (red triangle pointing back/up)
      ctx.fillStyle = '#ef4444'; // red-500
      ctx.beginPath();
      ctx.moveTo(-8, -17);
      ctx.lineTo(6, -17);
      ctx.lineTo(-4, -28); // Apex of the hat
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pom-pom fluff (white circle at apex)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-4, -29, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      // Draw a subtle dark overlay on Canvas when not active playing
      if (!isPlaying) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      animationFrameIdRef.current = requestAnimationFrame(loop);
    };

    animationFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isPlaying, isGameOver, isSuccess, state.l1IsCompleted]);

  // 1. Lock screen check
  if (!state.l1IsCompleted) {
    return <Level2LockedScreen state={state} />;
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Title Header */}
      <div className="text-center space-y-2">
        <p className="text-xs font-mono tracking-widest text-purple-400 uppercase">Level 2 · Cavern of Echoes</p>
        <h2 className="text-3xl font-extrabold text-white font-serif flex items-center justify-center gap-2">
          <span>Gesture to Flap</span>
          <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
        </h2>
        <p className="text-sm text-zinc-400 max-w-lg mx-auto">
          The Exit Portal is locked. Navigate the Phoenix through the toxic pillars to escape. 
          Clap your hands in front of the camera to fly!
        </p>
      </div>

      {/* Main Co-op HUD warnings & alerts */}
      {feedback.message && (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-mono transition-all justify-center max-w-xl mx-auto ${
          feedback.success
            ? 'bg-emerald-950/60 border-emerald-600/40 text-emerald-300'
            : 'bg-red-950/60 border-red-700/40 text-red-300'
        }`}>
          {feedback.success
            ? <Award className="w-4 h-4 shrink-0 text-emerald-400 animate-bounce" />
            : <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Left/Center Column: Canvas Game (7 cols on md+) */}
        <div className="md:col-span-7 flex flex-col items-center">
          <div className="relative border-4 border-zinc-800 rounded-3xl overflow-hidden shadow-2xl bg-zinc-950 group select-none">
            
            {/* Score HUD overlays */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/60 border border-zinc-700/60 px-3 py-1.5 rounded-xl text-white font-mono text-sm shadow">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span>Score: <strong className="text-yellow-400 font-bold">{score}</strong> / {targetScore}</span>
            </div>

            <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-black/60 border border-zinc-700/60 px-3 py-1.5 rounded-xl text-zinc-300 font-mono text-sm shadow">
              <span>Best: {highScore}</span>
            </div>

            {/* Canvas Element */}
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onClick={triggerJump}
              className="cursor-pointer block touch-none"
            />

            {/* HTML absolute visual overlays for menus / retry / countdown */}

            {/* Countdown Overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm font-mono text-center select-none">
                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-widest text-zinc-400">Get Ready!</p>
                  <div className="w-28 h-28 rounded-full bg-purple-950/80 border-4 border-purple-500 flex items-center justify-center mx-auto shadow-2xl shadow-purple-900/60 animate-pulse">
                    <span className="text-6xl font-extrabold text-white" style={{ textShadow: '0 0 20px rgba(168,85,247,0.6)' }}>
                      {countdown === 0 ? 'GO!' : countdown}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400">Prepare to <span className="text-yellow-400 font-bold">{controlMode === 'gesture' ? 'clap your hands' : 'press space'}</span>!</p>
                </div>
              </div>
            )}

            {/* Game Over / Start / Victory Overlays (only when NOT counting down) */}
            {countdown === null && (!isPlaying || isGameOver || isSuccess) && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs font-mono p-6 text-center select-none">
                {isGameOver && (
                  <div className="space-y-6 animate-in fade-in zoom-in duration-200">
                    <div className="w-16 h-16 rounded-full bg-red-950/80 border border-red-700/60 flex items-center justify-center mx-auto shadow-lg shadow-red-950 animate-bounce">
                      <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-extrabold text-red-500 uppercase tracking-wider animate-pulse">Crashed!</h3>
                      <p className="text-sm text-zinc-300 font-sans">Demonic traps triggered a <span className="text-red-400 font-bold">-15s</span> penalty!</p>
                    </div>
                    <button
                      onClick={initiateCountdown}
                      className="px-6 py-3 bg-red-700 hover:bg-red-600 border-2 border-red-500 text-white rounded-xl font-bold flex items-center gap-2 mx-auto active:scale-95 transition-all shadow-lg shadow-red-900/40 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Try Again
                    </button>
                  </div>
                )}
                
                {isSuccess && (
                  <div className="space-y-6 animate-in fade-in zoom-in duration-200">
                    <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950 animate-bounce">
                      <Award className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-extrabold text-emerald-400 uppercase tracking-wider">Victory!</h3>
                      <p className="text-sm text-zinc-300 font-sans">You scored {targetScore} points and escaped!</p>
                    </div>
                    <div className="text-xs text-zinc-500 font-mono animate-pulse">Opening portal to Level 3...</div>
                  </div>
                )}

                {!isPlaying && !isGameOver && !isSuccess && (
                  <div className="space-y-6 animate-in fade-in zoom-in duration-200">
                    <div className="w-16 h-16 rounded-full bg-purple-950/80 border border-purple-700/60 flex items-center justify-center mx-auto shadow-lg shadow-purple-950">
                      <Sparkles className="w-8 h-8 text-purple-400 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-extrabold text-yellow-400 uppercase tracking-wider">Demonic Cavern</h3>
                      <p className="text-xs text-zinc-300 max-w-[280px] leading-relaxed font-sans">
                        Navigate the Phoenix through the toxic pillars to score <strong className="text-yellow-400">{targetScore} points</strong>.
                      </p>
                    </div>
                    <button
                      onClick={initiateCountdown}
                      className="px-8 py-3.5 bg-purple-700 hover:bg-purple-600 text-white border-2 border-purple-500 rounded-xl font-bold flex items-center gap-2 mx-auto active:scale-95 transition-all shadow-lg shadow-purple-900/40 cursor-pointer text-sm"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      Start Escape
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-zinc-500 font-mono flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5" />
            Tip: Press [Spacebar] or Click the screen to flap manually anytime.
          </p>
        </div>

        {/* Right Column: Controls & Camera Panel (5 cols on md+) */}
        <div className="md:col-span-5 space-y-5">
          
          {/* 1. Control Mode Toggle */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-mono uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              Control Settings
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setControlMode('manual')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-mono font-bold border transition-all cursor-pointer ${
                  controlMode === 'manual'
                    ? 'bg-zinc-800 border-zinc-600 text-white shadow-lg'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                }`}
              >
                <Keyboard className="w-4 h-4" />
                Manual Mode
              </button>

              <button
                onClick={() => setControlMode('gesture')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-mono font-bold border transition-all cursor-pointer ${
                  controlMode === 'gesture'
                    ? 'bg-purple-950/70 border-purple-800/80 text-purple-200 shadow-lg shadow-purple-950/30'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                }`}
              >
                <Camera className="w-4 h-4" />
                Gesture Mode
              </button>
            </div>
          </div>

          {/* 2. Camera & Hand Tracking Card */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-mono uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-2">
                <Video className="w-4 h-4 text-purple-400 animate-pulse" />
                Hand Tracking
              </h3>
              {isCameraEnabled ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-emerald-950/50 border border-emerald-800 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                  TRACKING
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-zinc-950 border border-zinc-800 text-zinc-600 px-2 py-0.5 rounded-full font-bold">
                  OFF
                </span>
              )}
            </div>

            {/* Camera Enable / Disable Button */}
            {!isCameraEnabled ? (
              <button
                onClick={enableCamera}
                disabled={isCameraLoading}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-purple-700 hover:bg-purple-600 active:scale-[0.98] text-white font-mono font-bold text-sm transition-all shadow-lg shadow-purple-900/30 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                {isCameraLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading Hand Tracker...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 animate-bounce" />
                    Enable Camera &amp; Hand Tracking
                  </>
                )}
              </button>
            ) : (
              <div className="flex gap-2">
                <div className="flex-1 text-center py-3 rounded-xl border border-emerald-800/50 bg-emerald-950/30 text-emerald-300 font-mono font-bold text-xs flex items-center justify-center gap-1.5">
                  ⚡ High-Sensitivity: Clap fast or flick hands!
                </div>
                <button
                  onClick={disableCamera}
                  className="py-3 px-4 rounded-xl bg-red-950/60 border border-red-900/60 text-red-400 hover:bg-red-900 hover:text-white font-mono transition-all cursor-pointer"
                  title="Disable Camera"
                >
                  <CameraOff className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Live Camera Preview */}
            <div className="space-y-2">
              <div className="relative w-full aspect-[4/3] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-inner">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover -scale-x-100"
                  playsInline
                  muted
                />
                {!isCameraEnabled && !isCameraLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <CameraOff className="w-8 h-8 text-zinc-700" />
                    <span className="text-[10px] font-mono text-zinc-600">Camera off</span>
                  </div>
                )}
                {isCameraLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950/90">
                    <div className="w-8 h-8 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <span className="text-[10px] font-mono text-purple-400 animate-pulse">Loading model...</span>
                  </div>
                )}
                {/* Gesture detected flash border */}
                {gestureDetected && (
                  <div className="absolute inset-0 border-4 border-yellow-400 rounded-xl pointer-events-none animate-pulse" />
                )}
                {gestureDetected && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-yellow-500/90 text-black text-xs font-mono font-bold px-3 py-1 rounded-full shadow-lg">
                    👏 CLAP DETECTED!
                  </div>
                )}
              </div>
              <p className="text-[10px] text-zinc-600 font-mono text-center">
                {isCameraEnabled
                  ? 'Ultra-fast tracking active (60ms response)'
                  : 'Enable camera to use hand gesture control'}
              </p>
            </div>
          </div>

          {/* 3. Cooperative Level Penalties & Stats Card */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-mono uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Lair Warnings
            </h3>

            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <span className="text-xs font-mono text-zinc-400">Total Crashes:</span>
              <span className={`text-sm font-mono font-bold ${crashCount > 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                {crashCount}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-mono text-zinc-400">Time Penalties:</span>
              <span className={`text-sm font-mono font-bold ${crashCount > 0 ? 'text-red-500 font-extrabold animate-pulse' : 'text-zinc-500'}`}>
                −{crashCount * 15}s total
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
