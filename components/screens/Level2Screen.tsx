"use client";

import React, { useState, useEffect, useRef } from "react";
import { GameGameState, gameSync } from "@/lib/gameStore";
import { pythonApi } from "@/lib/pythonApi";
import { Level2LockedScreen } from "@/components/screens/Level2LockedScreen";
import { 
  Camera, 
  CameraOff, 
  Trophy, 
  AlertTriangle, 
  Award,
  Sparkles,
  RotateCcw,
  Play,
  Video,
  Heart,
  Skull
} from "lucide-react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { getLevel2PhysicsConfig, subscribeToLevel2PhysicsConfig, DEFAULT_LEVEL2_PHYSICS, Level2PhysicsConfig } from "@/lib/physicsService";

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
  const controlMode = 'gesture';
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
  const [lives, setLives] = useState(3);
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
  const pipeSpawnTimerRef = useRef(0);
  
  const lastJumpTimeRef = useRef(0);
  const scoreRef = useRef(0);

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

  // Remote Physics & Speed Configuration (Fetched from Firebase / Backend in real-time)
  const physicsRef = useRef<Level2PhysicsConfig>(DEFAULT_LEVEL2_PHYSICS);

  useEffect(() => {
    const unsubscribe = subscribeToLevel2PhysicsConfig((config) => {
      physicsRef.current = config;
    });
    return () => unsubscribe();
  }, []);

  // Constants (Canvas bounds)
  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 520;
  const GROUND_HEIGHT = 70;

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
        try {
          await videoRef.current.play();
        } catch (playErr: any) {
          if (playErr.name !== 'AbortError') {
            console.error("Camera play error:", playErr);
          }
        }
      }

      setIsCameraEnabled(true);
      setIsCameraLoading(false);
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

  // Auto-enable camera when Level 2 is unlocked & active
  useEffect(() => {
    if (state.l1IsCompleted && !isCameraEnabled && !isCameraLoading) {
      enableCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.l1IsCompleted]);

  // Ensure video element receives camera stream as soon as DOM element mounts
  useEffect(() => {
    if (isCameraEnabled && cameraStreamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== cameraStreamRef.current) {
        videoRef.current.srcObject = cameraStreamRef.current;
        videoRef.current.play().catch((playErr: any) => {
          if (playErr.name !== 'AbortError') {
            console.error("Camera play error:", playErr);
          }
        });
      }
    }
  }, [isCameraEnabled, state.l1IsCompleted]);

  // Ref to always hold the latest triggerJump function
  const triggerJumpRef = useRef<() => void>(() => {});

  // Hand Detection Loop (Pinch & Fist-Pump Gesture Recognition)
  // Uses refs to avoid stale closures inside requestAnimationFrame
  const isPinchedRef = useRef(false);
  const isFistClosedRef = useRef(false);

  const startHandDetection = () => {
    let lastTimestamp = 0;
    let lastProcessedTime = 0;

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

      // Throttle hand detection to ~20 FPS (every 45ms) to prevent main-thread lagging
      if (now - lastProcessedTime < 45) {
        handDetectionLoopRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      lastTimestamp = now;
      lastProcessedTime = now;

      const results = handLandmarkerRef.current.detectForVideo(videoRef.current, now);
      const currentTime = Date.now();
      let triggered = false;

      if (results.landmarks && results.landmarks.length > 0) {
        // Use primary hand (first detected hand)
        const hand = results.landmarks[0];

        const wrist = hand[0];
        const thumbTip = hand[4];
        const indexTip = hand[8];
        const middleTip = hand[12];
        const ringTip = hand[16];
        const pinkyTip = hand[20];

        // --- 1. Thumb-to-Index Pinch Detection ---
        const dxPinch = thumbTip.x - indexTip.x;
        const dyPinch = thumbTip.y - indexTip.y;
        const pinchDist = Math.sqrt(dxPinch * dxPinch + dyPinch * dyPinch);

        const PINCH_CLOSE = 0.06; // Fingers pinched together
        const PINCH_OPEN = 0.10;  // Fingers released

        if (pinchDist < PINCH_CLOSE) {
          isPinchedRef.current = true;
        } else if (pinchDist > PINCH_OPEN && isPinchedRef.current) {
          isPinchedRef.current = false;
          triggered = true; // Pinch-and-release triggers flap!
        }

        // --- 2. Open-Palm to Closed-Fist Pump Detection ---
        const distIndex = Math.sqrt((indexTip.x - wrist.x) ** 2 + (indexTip.y - wrist.y) ** 2);
        const distMiddle = Math.sqrt((middleTip.x - wrist.x) ** 2 + (middleTip.y - wrist.y) ** 2);
        const distRing = Math.sqrt((ringTip.x - wrist.x) ** 2 + (ringTip.y - wrist.y) ** 2);
        const distPinky = Math.sqrt((pinkyTip.x - wrist.x) ** 2 + (pinkyTip.y - wrist.y) ** 2);
        const avgFingerExtension = (distIndex + distMiddle + distRing + distPinky) / 4;

        const FIST_CLOSED = 0.20; // Closed fist (fingers curled in toward wrist)
        const FIST_OPEN = 0.32;   // Open palm

        if (avgFingerExtension < FIST_CLOSED) {
          if (!isFistClosedRef.current) {
            isFistClosedRef.current = true;
            triggered = true; // Fist clench triggers flap!
          }
        } else if (avgFingerExtension > FIST_OPEN) {
          if (isFistClosedRef.current) {
            isFistClosedRef.current = false;
            triggered = true; // Fist open triggers flap!
          }
        }

        // --- 3. Trigger Flap & Cooldown ---
        if (triggered && controlModeRef.current === 'gesture') {
          if (currentTime - lastJumpTimeRef.current > 180) { // 180ms cooldown for snappy gesture control
            lastJumpTimeRef.current = currentTime;
            triggerJumpRef.current();

            // Flash visual feedback
            setGestureDetected(true);
            if (gestureFlashTimerRef.current) clearTimeout(gestureFlashTimerRef.current);
            gestureFlashTimerRef.current = setTimeout(() => setGestureDetected(false), 300);
          }
        }
      } else {
        isPinchedRef.current = false;
        isFistClosedRef.current = false;
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

    // Set upward velocity from backend physics config
    birdRef.current.vy = physicsRef.current.jumpStrength;
    birdRef.current.flapTimer = 8; // Flapping wings effect frames

    // Spawn jump puff particles
    spawnPuffParticles();
  };

  // Keep the ref pointing to the latest triggerJump
  triggerJumpRef.current = triggerJump;

  // Initiate the 5-second countdown before the game starts
  const initiateCountdown = () => {
    if (lives <= 0) return; // Cannot retry if out of lives!
    if (countdown !== null) return; // Already counting down
    // Reset bird position for the countdown visual
    birdRef.current.y = 200;
    birdRef.current.vy = 0;
    birdRef.current.angle = 0;
    pipesRef.current = [];
    particlesRef.current = [];
    pipeSpawnTimerRef.current = 0;
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
      const now = Date.now();
      const l2Sec = state.level2Duration || 120;
      gameSync.updateState({
        l2IsStarted: true,
        levelStartTime: now,
        timeRemaining: l2Sec,
      });
      if (state.teamCode) {
        pythonApi.startRoomTimer(state.teamCode, 2);
      }
      return;
    }
    const timer = setTimeout(() => {
      setCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, state.level2Duration, state.teamCode]);

  const startGame = () => {
    // Reset variables
    birdRef.current.y = 200;
    birdRef.current.vy = 0;
    birdRef.current.angle = 0;
    
    pipesRef.current = [];
    particlesRef.current = [];
    pipeSpawnTimerRef.current = 0;
    scoreRef.current = 0;
    setScore(0);
    setIsPlaying(true);
    setIsGameOver(false);
    setFeedback({ message: '' });

    const now = Date.now();
    const l2Sec = state.level2Duration || 120;
    gameSync.updateState({
      l2IsStarted: true,
      levelStartTime: now,
      timeRemaining: l2Sec,
    });
    if (state.teamCode) {
      pythonApi.startRoomTimer(state.teamCode, 2);
    }
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
    const pipeGap = physicsRef.current.pipeGap || 200;
    const minHeight = 50;
    const maxHeight = Math.max(minHeight + 20, CANVAS_HEIGHT - GROUND_HEIGHT - pipeGap - minHeight);
    const topHeight = Math.floor(minHeight + Math.random() * (maxHeight - minHeight));
    const bottomHeight = CANVAS_HEIGHT - GROUND_HEIGHT - topHeight - pipeGap;

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
    spawnExplosionParticles();

    setCrashCount(prev => prev + 1);
    const newLives = Math.max(0, lives - 1);
    setLives(newLives);

    const penalty = physicsRef.current.timePenalty || 15;
    const maxLives = physicsRef.current.maxLives || 3;

    if (newLives > 0) {
      setFeedback({ 
        success: false, 
        message: `💥 Demonic Trap Triggered! −${penalty}s penalty! ${newLives} ${newLives === 1 ? 'life' : 'lives'} remaining.` 
      });

      // Update global state with time penalty
      gameSync.updateState((prev) => {
        const nextTime = Math.max(0, prev.timeRemaining - penalty);
        return {
          ...prev,
          timeRemaining: nextTime,
          timePenalties: prev.timePenalties + penalty,
          gameStatus: nextTime <= 0 ? 'disqualified' : prev.gameStatus,
        };
      });
    } else {
      setFeedback({ 
        success: false, 
        message: `☠️ No current lives left! ${maxLives}/${maxLives} attempts failed. Disqualified!` 
      });

      // Automatically transition to Disqualification Page after 2 seconds pop-up preview
      setTimeout(() => {
        gameSync.updateState((prev) => {
          if (prev.gameStatus !== 'disqualified') {
            return {
              ...prev,
              gameStatus: 'disqualified',
            };
          }
          return prev;
        });
      }, 2000);
    }
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
    let lastTime = performance.now();

    const loop = (nowTime: number = performance.now()) => {
      frameCount++;
      // Delta time normalization factor (16.67ms = 60 FPS = 1.0)
      const deltaMs = nowTime - lastTime;
      lastTime = nowTime;
      // Allow scaling down to 144Hz/240Hz monitors without forcing dt up to 0.5
      const dt = Math.min(Math.max(deltaMs / 16.67, 0.1), 2.5);

      const phys = physicsRef.current;
      
      // Clear canvas
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // --- 1. Physics Updates (When Playing) ---
      if (isPlaying && !isGameOver && !isSuccess) {
        // Bird physics with delta time
        const bird = birdRef.current;
        bird.vy += phys.gravity * dt;
        if (bird.vy > phys.maxFallSpeed) bird.vy = phys.maxFallSpeed;
        bird.y += bird.vy * dt;

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

        // Dynamic difficulty/speed boost threshold from Firebase config
        const speedBoostThreshold = phys.speedBoostThreshold || 15;
        const targetScore = phys.targetScore || 21;

        const isSpeedBoosted = scoreRef.current >= speedBoostThreshold;
        const baseSpeed = isSpeedBoosted ? phys.pipeSpeedBoost : phys.pipeSpeed;
        const currentPipeSpeed = baseSpeed * dt;
        const currentSpawnInterval = Math.max(30, Math.round(phys.pipeSpawnInterval * (isSpeedBoosted ? 0.68 : 1.0)));

        // Scroll Background & Parallax skyline
        bgScrollXRef.current = (bgScrollXRef.current - 0.5 * dt) % CANVAS_WIDTH;
        skylineScrollXRef.current = (skylineScrollXRef.current - 0.9 * dt) % CANVAS_WIDTH;
        groundScrollXRef.current = (groundScrollXRef.current - currentPipeSpeed) % CANVAS_WIDTH;

        // Time-accumulated pipe spawn (independent of display refresh rate / Hz)
        pipeSpawnTimerRef.current += dt;
        if (pipeSpawnTimerRef.current >= currentSpawnInterval) {
          spawnPipe();
          pipeSpawnTimerRef.current -= currentSpawnInterval;
        }

        // Update pipes
        for (let i = pipesRef.current.length - 1; i >= 0; i--) {
          const pipe = pipesRef.current[i];
          pipe.x -= currentPipeSpeed;

          // Check score pass
          if (!pipe.passed && pipe.x + pipe.width / 2 < bird.x) {
            pipe.passed = true;
            scoreRef.current += 1;
            const newScore = scoreRef.current;
            setScore(newScore);
            updateHighScore(newScore);

            if (newScore === speedBoostThreshold) {
              setFeedback({
                success: true,
                message: '⚡ SPEED BOOST! Winds accelerating for the final stretch! ⚡'
              });
            }

            // Sync score to Firebase Firestore state in real-time
            gameSync.updateState((prev) => ({
              ...prev,
              l2Score: Math.max(prev.l2Score || 0, newScore),
            }));

            // Automatically complete Level 2 when target pillars are passed!
            if (newScore >= targetScore) {
              triggerVictory();
            }
          }

          // Check collision (forgiving hitbox)
          const birdBox = {
            left: bird.x - bird.radius + 5,
            right: bird.x + bird.radius - 5,
            top: bird.y - bird.radius + 5,
            bottom: bird.y + bird.radius - 5,
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
      
      // Draw Sky background gradient — dramatic sunset palette
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      skyGrad.addColorStop(0,    '#1a0a2e'); // deep indigo-purple top
      skyGrad.addColorStop(0.18, '#3d1053'); // violet-purple
      skyGrad.addColorStop(0.35, '#8b2252'); // deep magenta-pink
      skyGrad.addColorStop(0.52, '#c94040'); // salmon-crimson
      skyGrad.addColorStop(0.68, '#e8521a'); // fiery orange-red
      skyGrad.addColorStop(0.82, '#f07010'); // deep amber-orange
      skyGrad.addColorStop(0.93, '#f5a020'); // warm golden amber
      skyGrad.addColorStop(1,    '#f0c040'); // bright horizon gold
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Parallax clouds — warm sunset-tinted wisps
      const cloudX = bgScrollXRef.current;
      for (let offset = 0; offset <= 1; offset++) {
        const cx = cloudX + offset * CANVAS_WIDTH;
        // Upper cool violet-pink cloud streak
        ctx.fillStyle = 'rgba(200, 140, 180, 0.30)';
        ctx.beginPath();
        ctx.arc(cx + 40, 70, 20, 0, Math.PI * 2);
        ctx.arc(cx + 65, 60, 28, 0, Math.PI * 2);
        ctx.arc(cx + 90, 70, 20, 0, Math.PI * 2);
        ctx.arc(cx + 65, 80, 15, 0, Math.PI * 2);
        ctx.fill();

        // Mid warm orange-pink cloud streak
        ctx.fillStyle = 'rgba(255, 180, 100, 0.28)';
        ctx.beginPath();
        ctx.arc(cx + 250, 110, 15, 0, Math.PI * 2);
        ctx.arc(cx + 270, 100, 22, 0, Math.PI * 2);
        ctx.arc(cx + 290, 110, 15, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Distant Mountain Silhouettes — deep purple dusk
      const bgX = bgScrollXRef.current * 0.4;
      for (let offset = 0; offset <= 1; offset++) {
        const mx = (bgX + offset * CANVAS_WIDTH) % (CANVAS_WIDTH * 2);
        // Furthest mountain — darkest silhouette
        ctx.fillStyle = 'rgba(30, 10, 50, 0.70)';
        ctx.beginPath();
        ctx.moveTo(mx - 40, CANVAS_HEIGHT - GROUND_HEIGHT);
        ctx.quadraticCurveTo(mx + 80, CANVAS_HEIGHT - GROUND_HEIGHT - 90, mx + 200, CANVAS_HEIGHT - GROUND_HEIGHT);
        ctx.quadraticCurveTo(mx + 300, CANVAS_HEIGHT - GROUND_HEIGHT - 120, mx + 440, CANVAS_HEIGHT - GROUND_HEIGHT);
        ctx.closePath();
        ctx.fill();
        // Nearer ridge — slightly lighter deep purple
        ctx.fillStyle = 'rgba(50, 15, 70, 0.55)';
        ctx.beginPath();
        ctx.moveTo(mx, CANVAS_HEIGHT - GROUND_HEIGHT);
        ctx.quadraticCurveTo(mx + 120, CANVAS_HEIGHT - GROUND_HEIGHT - 60, mx + 250, CANVAS_HEIGHT - GROUND_HEIGHT);
        ctx.quadraticCurveTo(mx + 350, CANVAS_HEIGHT - GROUND_HEIGHT - 75, mx + 460, CANVAS_HEIGHT - GROUND_HEIGHT);
        ctx.closePath();
        ctx.fill();
      }

      // Draw Parallax Japanese Pagodas Architecture Skyline at bottom
      const skylineX = skylineScrollXRef.current;
      for (let offset = 0; offset <= 1; offset++) {
        const sx = skylineX + offset * CANVAS_WIDTH;

        // Pagoda structures with detailed dimensions
        const pagodas = [
          { x: sx + 12, width: 38, height: 115, tiers: 4 },
          { x: sx + 72, width: 30, height: 80, tiers: 3 },
          { x: sx + 128, width: 44, height: 140, tiers: 5 },
          { x: sx + 192, width: 32, height: 90, tiers: 3 },
          { x: sx + 248, width: 40, height: 125, tiers: 4 },
          { x: sx + 312, width: 28, height: 70, tiers: 2 },
          { x: sx + 355, width: 36, height: 110, tiers: 4 },
        ];

        pagodas.forEach((p) => {
          const baseY = CANVAS_HEIGHT - GROUND_HEIGHT;
          const tierHeight = p.height / p.tiers;

          // 1. Foundation Base Stone Platform
          ctx.fillStyle = '#334155'; // Dark slate stone base
          ctx.fillRect(p.x - 2, baseY - 6, p.width + 4, 6);
          ctx.fillStyle = '#64748b'; // Highlight rim
          ctx.fillRect(p.x - 2, baseY - 6, p.width + 4, 1.5);

          // 2. Main Wooden Body Stem (Dark Timber + Vermilion Pillars)
          ctx.fillStyle = '#18181b'; // Dark wood timber
          ctx.fillRect(p.x + 4, baseY - p.height, p.width - 8, p.height);

          // Vermilion vertical corner posts
          ctx.fillStyle = '#991b1b';
          ctx.fillRect(p.x + 3, baseY - p.height, 3, p.height);
          ctx.fillRect(p.x + p.width - 6, baseY - p.height, 3, p.height);

          // 3. Draw Tiers with curved flared roofs, balconies, and wind bells
          for (let t = 0; t < p.tiers; t++) {
            const tierY = baseY - (t + 1) * tierHeight;
            const roofWidth = p.width + (p.tiers - t) * 5;
            const roofX = p.x + (p.width - roofWidth) / 2;

            // Balcony railing under roof
            ctx.fillStyle = '#7f1d1d'; // Crimson dark red balcony
            ctx.fillRect(roofX + 4, tierY + 12, roofWidth - 8, 3);
            ctx.fillStyle = '#f59e0b'; // Gold balcony posts
            ctx.fillRect(roofX + 6, tierY + 12, 1.5, 3);
            ctx.fillRect(roofX + roofWidth - 7.5, tierY + 12, 1.5, 3);

            // Shaded lattice window light
            ctx.fillStyle = 'rgba(254, 240, 138, 0.9)'; // Soft warm golden window glow
            ctx.fillRect(p.x + p.width / 2 - 3, tierY + 15, 6, 6);
            ctx.fillStyle = '#18181b'; // Lattice cross
            ctx.fillRect(p.x + p.width / 2 - 0.5, tierY + 15, 1, 6);
            ctx.fillRect(p.x + p.width / 2 - 3, tierY + 17.5, 6, 1);

            // Slate Roof Shading (Curved Eaves)
            ctx.fillStyle = '#1e293b'; // Slate tile dark shadow
            ctx.beginPath();
            ctx.moveTo(roofX - 6, tierY + 6);
            ctx.quadraticCurveTo(p.x + p.width / 2, tierY - 3, roofX + roofWidth + 6, tierY + 6);
            ctx.lineTo(roofX + roofWidth + 2, tierY + 11);
            ctx.quadraticCurveTo(p.x + p.width / 2, tierY + 2, roofX - 2, tierY + 11);
            ctx.closePath();
            ctx.fill();

            // Slate Roof Top Highlight
            ctx.fillStyle = '#475569';
            ctx.beginPath();
            ctx.moveTo(roofX - 5, tierY + 5);
            ctx.quadraticCurveTo(p.x + p.width / 2, tierY - 3, roofX + roofWidth + 5, tierY + 5);
            ctx.lineTo(roofX + roofWidth + 3, tierY + 7);
            ctx.quadraticCurveTo(p.x + p.width / 2, tierY - 1, roofX - 3, tierY + 7);
            ctx.closePath();
            ctx.fill();

            // Vermilion roof ridge beam
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(roofX, tierY + 9, roofWidth, 2);

            // Golden furin wind bells hanging at roof eave tips
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(roofX - 5, tierY + 7, 2, 3);
            ctx.fillRect(roofX + roofWidth + 3, tierY + 7, 2, 3);
          }

          // 4. Golden Sorin Spire Top on Pagoda Peak
          const topY = baseY - p.height;
          // Spire shaft
          ctx.fillStyle = '#d97706'; // Gold bronze
          ctx.fillRect(p.x + p.width / 2 - 1, topY - 22, 2, 22);

          // Spire rings (Kuragata / Nine rings)
          ctx.fillStyle = '#fbbf24'; // Bright gold
          for (let r = 0; r < 4; r++) {
            const ringY = topY - 8 - r * 3.5;
            ctx.fillRect(p.x + p.width / 2 - 3.5 + r * 0.4, ringY, 7 - r * 0.8, 1.8);
          }

          // Top Sacred Jewel (Hoju)
          ctx.beginPath();
          ctx.arc(p.x + p.width / 2, topY - 24, 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Draw Vermilion Temple Pipes / Pillars
      pipesRef.current.forEach((pipe) => {
        // Japanese Temple Vermilion Red & Gold palette
        const mainRed = "#dc2626"; // red-600 vermilion
        const darkRed = "#991b1b"; // red-800 deep shade
        const lightRed = "#f87171"; // red-400 highlight
        const goldAccent = "#fbbf24"; // amber-400 gold trim
        
        ctx.strokeStyle = '#450a0a'; // Dark maroon border
        ctx.lineWidth = 2.5;

        // --- Top Pipe ---
        // Main body
        ctx.fillStyle = mainRed;
        ctx.beginPath();
        ctx.rect(pipe.x, 0, pipe.width, pipe.topHeight);
        ctx.fill();
        ctx.stroke();

        // Shading/Highlight on body
        ctx.fillStyle = lightRed;
        ctx.fillRect(pipe.x + 4, 0, 5, pipe.topHeight);
        ctx.fillStyle = darkRed;
        ctx.fillRect(pipe.x + pipe.width - 12, 0, 8, pipe.topHeight);

        // Gold Trim Line
        ctx.fillStyle = goldAccent;
        ctx.fillRect(pipe.x + 2, pipe.topHeight - 26, pipe.width - 4, 3);

        // Pipe Lip
        ctx.fillStyle = darkRed;
        ctx.beginPath();
        ctx.rect(pipe.x - 4, pipe.topHeight - 22, pipe.width + 8, 22);
        ctx.fill();
        ctx.stroke();

        // Lip Highlight & Gold Trim
        ctx.fillStyle = lightRed;
        ctx.fillRect(pipe.x - 2, pipe.topHeight - 20, 5, 18);
        ctx.fillStyle = goldAccent;
        ctx.fillRect(pipe.x - 4, pipe.topHeight - 4, pipe.width + 8, 4);

        // --- Bottom Pipe ---
        const bottomY = CANVAS_HEIGHT - GROUND_HEIGHT - pipe.bottomHeight;
        // Main body
        ctx.fillStyle = mainRed;
        ctx.beginPath();
        ctx.rect(pipe.x, bottomY, pipe.width, pipe.bottomHeight);
        ctx.fill();
        ctx.stroke();

        // Shading/Highlight on body
        ctx.fillStyle = lightRed;
        ctx.fillRect(pipe.x + 4, bottomY, 5, pipe.bottomHeight);
        ctx.fillStyle = darkRed;
        ctx.fillRect(pipe.x + pipe.width - 12, bottomY, 8, pipe.bottomHeight);

        // Gold Trim Line
        ctx.fillStyle = goldAccent;
        ctx.fillRect(pipe.x + 2, bottomY + 23, pipe.width - 4, 3);

        // Pipe Lip
        ctx.fillStyle = darkRed;
        ctx.beginPath();
        ctx.rect(pipe.x - 4, bottomY, pipe.width + 8, 22);
        ctx.fill();
        ctx.stroke();

        // Lip Highlight & Gold Trim
        ctx.fillStyle = lightRed;
        ctx.fillRect(pipe.x - 2, bottomY + 2, 5, 18);
        ctx.fillStyle = goldAccent;
        ctx.fillRect(pipe.x - 4, bottomY, pipe.width + 8, 4);
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

      // Draw Crow (Black Raven / Crow with Red Hat)
      const bird = birdRef.current;
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(bird.angle);

      // Black outline style
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;

      // 1. Draw Tail Feathers (Sharp Crow Tail - Charcoal/Black)
      ctx.fillStyle = '#111116';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-24, -8);
      ctx.lineTo(-20, -2);
      ctx.lineTo(-25, 3);
      ctx.lineTo(-20, 5);
      ctx.lineTo(-23, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2. Draw Black Crow Body (Dark Charcoal/Raven Black)
      ctx.fillStyle = '#1e1e24'; // Raven black
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Body feather highlight
      ctx.fillStyle = '#3f3f46';
      ctx.beginPath();
      ctx.ellipse(-2, -4, 10, 5, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // 3. Draw Sharp Crow Beak (Dark Grey / Black Crow Beak)
      ctx.fillStyle = '#27272a'; // Dark slate grey beak
      ctx.beginPath();
      ctx.moveTo(12, -2);
      ctx.quadraticCurveTo(20, -1, 26, 4); // Slightly hooked upper beak
      ctx.lineTo(13, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Beak highlight line
      ctx.strokeStyle = '#71717a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(23, 3);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';

      // 4. Draw Wing (Crow wing flaps up & down)
      ctx.fillStyle = '#09090b'; // Deepest black wing
      ctx.save();
      ctx.translate(-4, 2);
      if (bird.flapTimer > 0) {
        ctx.rotate(-0.45); // Wing flapped up
      } else {
        ctx.rotate(0.35); // Wing down
      }
      ctx.beginPath();
      ctx.ellipse(-3, 0, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Wing feather lines
      ctx.strokeStyle = '#3f3f46';
      ctx.beginPath();
      ctx.moveTo(-8, -2);
      ctx.lineTo(2, 2);
      ctx.stroke();
      ctx.strokeStyle = '#000000';
      ctx.restore();

      // 5. Draw Eye (Sharp Crow Eye - White circle with pupil)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(6, -4, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pupil (Black dot)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(7.5, -4, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Eye catchlight (white reflection dot)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(8.5, -5, 1, 0, Math.PI * 2);
      ctx.fill();

      // 6. Draw Red Hat on Crow Head
      // Fur trim (white base band)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
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
          The Exit Portal is locked. Navigate the Phoenix through 21 toxic pillars to escape. 
          Make a fist or pinch your fingers in front of the camera to fly!
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
          <div className="relative border-4 border-zinc-800 rounded-3xl overflow-hidden shadow-2xl bg-zinc-950 group select-none w-full max-w-[400px]">
            
            {/* Score HUD overlays */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/60 border border-zinc-700/60 px-3 py-1.5 rounded-xl text-white font-mono text-sm shadow">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span>Pillars: <strong className="text-yellow-400 font-bold">{score} / {physicsRef.current.targetScore || 21}</strong></span>
              {score >= (physicsRef.current.speedBoostThreshold || 15) && (
                <span className="ml-1 text-[10px] font-bold bg-amber-500/20 border border-amber-500/50 text-amber-400 px-1.5 py-0.5 rounded animate-pulse">
                  ⚡ SPEED BOOST
                </span>
              )}
            </div>

            <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-black/60 border border-zinc-700/60 px-3 py-1.5 rounded-xl text-zinc-300 font-mono text-sm shadow">
              <span className="text-xs uppercase text-zinc-400 font-bold mr-1">Lives:</span>
              {[1, 2, 3].map((i) => (
                <Heart
                  key={i}
                  className={`w-4 h-4 transition-all ${
                    i <= lives
                      ? 'fill-red-500 text-red-500 animate-pulse'
                      : 'fill-zinc-800 text-zinc-700'
                  }`}
                />
              ))}
            </div>

            {/* Canvas Element */}
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onClick={triggerJump}
              onTouchStart={(e) => {
                e.preventDefault();
                triggerJumpRef.current();
              }}
              className="cursor-pointer block touch-none w-full max-w-[400px] h-auto aspect-[400/520]"
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
                  <p className="text-sm text-zinc-400">Prepare to <span className="text-yellow-400 font-bold">clench fist or pinch</span>!</p>
                </div>
              </div>
            )}

            {/* Game Over / Start / Victory Overlays (only when NOT counting down) */}
            {countdown === null && (!isPlaying || isGameOver || isSuccess) && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs font-mono p-6 text-center select-none">
                {isGameOver && (
                  <div className="space-y-6 animate-in fade-in zoom-in duration-200">
                    {lives > 0 ? (
                      <>
                        <div className="w-16 h-16 rounded-full bg-red-950/80 border border-red-700/60 flex items-center justify-center mx-auto shadow-lg shadow-red-950 animate-bounce">
                          <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-2xl font-extrabold text-red-500 uppercase tracking-wider animate-pulse">
                            Crashed!
                          </h3>
                          <p className="text-sm text-zinc-300 font-sans">
                            Demonic traps triggered a <span className="text-red-400 font-bold">-15s</span> penalty!
                          </p>
                          <div className="flex justify-center gap-1 items-center pt-2">
                            {[1, 2, 3].map((i) => (
                              <Heart
                                key={i}
                                className={`w-5 h-5 ${
                                  i <= lives
                                    ? 'fill-red-500 text-red-500'
                                    : 'fill-zinc-900 text-zinc-700'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={initiateCountdown}
                            className="px-6 py-3 bg-red-700 hover:bg-red-600 border-2 border-red-500 text-white rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-red-900/40 cursor-pointer text-xs"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Try Again ({lives} {lives === 1 ? 'Life' : 'Lives'} Left)
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-5">
                        <div className="w-20 h-20 rounded-full bg-red-950 border-4 border-red-600 flex items-center justify-center mx-auto shadow-2xl shadow-red-950 animate-bounce">
                          <AlertTriangle className="w-10 h-10 text-red-500" />
                        </div>
                        <div className="space-y-2">
                          <div className="inline-block bg-red-950/80 border border-red-800 text-red-400 font-mono text-[10px] uppercase px-3 py-1 rounded-full font-bold tracking-widest">
                            0 / 3 Lives Remaining
                          </div>
                          <h3 className="text-2xl font-black text-red-500 uppercase tracking-wider animate-pulse font-serif">
                            NO CURRENT LIVES LEFT!
                          </h3>
                          <p className="text-xs text-zinc-300 font-sans max-w-[280px] mx-auto leading-relaxed">
                            All 3 attempts failed without clearing 21 obstacles. Your team has been disqualified!
                          </p>
                          <div className="flex justify-center gap-2 items-center pt-2">
                            {[1, 2, 3].map((i) => (
                              <Heart
                                key={i}
                                className="w-6 h-6 fill-zinc-900 text-zinc-700 stroke-[1.5]"
                              />
                            ))}
                          </div>
                        </div>
                        <div className="text-xs font-mono text-zinc-500 animate-pulse">
                          Redirecting to Disqualification Page...
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {isSuccess && (
                  <div className="space-y-6 animate-in fade-in zoom-in duration-200">
                    <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950 animate-bounce">
                      <Award className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-extrabold text-emerald-400 uppercase tracking-wider">Level 2 Complete!</h3>
                      <p className="text-sm text-zinc-300 font-sans">Total Score Recorded: <strong className="text-yellow-400 font-bold">{score} points</strong>!</p>
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
                        Fly through <strong className="text-yellow-400">{physicsRef.current.targetScore || 21} toxic pillars</strong> to unlock the portal to Level 3!
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={initiateCountdown}
                        className="px-8 py-3.5 bg-purple-700 hover:bg-purple-600 text-white border-2 border-purple-500 rounded-xl font-bold flex items-center justify-center gap-2 mx-auto active:scale-95 transition-all shadow-lg shadow-purple-900/40 cursor-pointer text-sm"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        Start Escape
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-zinc-500 font-mono flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Tip: Make a fist or pinch your fingers in front of the camera to fly!
          </p>
        </div>

        {/* Right Column: Controls & Camera Panel (5 cols on md+) */}
        <div className="md:col-span-5 space-y-5">
          
          {/* 1. Camera & Hand Tracking Card */}
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
                <div className="flex-1 text-center py-3 rounded-xl border border-purple-800/50 bg-purple-950/30 text-purple-200 font-mono font-bold text-xs flex items-center justify-center gap-1.5">
                  ✊ Clench fist or pinch fingers to flap!
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
                    ✊ GESTURE DETECTED!
                  </div>
                )}
              </div>
              <p className="text-[10px] text-zinc-600 font-mono text-center">
                {isCameraEnabled
                  ? 'Close fist or pinch thumb & index finger to flap'
                  : 'Enable camera to use hand gesture control'}
              </p>
            </div>
          </div>

          {/* 3. Cooperative Level Penalties & Stats Card */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-mono uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Lair Status &amp; Lives
            </h3>

            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <span className="text-xs font-mono text-zinc-400">Remaining Lives:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((i) => (
                  <Heart
                    key={i}
                    className={`w-4 h-4 ${
                      i <= lives
                        ? 'fill-red-500 text-red-500'
                        : 'fill-zinc-800 text-zinc-700'
                    }`}
                  />
                ))}
              </div>
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
