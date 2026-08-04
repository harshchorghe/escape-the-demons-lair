"use client";

import React, { useRef, useState, useEffect } from "react";
import { Camera, CameraOff, Hand, Sparkles } from "lucide-react";

export type RecognizedGesture = 'FIST' | 'PALM' | 'PEACE' | null;

interface HandGestureDetectorProps {
  playerRole: 'player1' | 'player2';
  onGestureDetected: (gesture: 'FIST' | 'PALM' | 'PEACE') => void;
  disabled?: boolean;
}

export const GESTURE_INFO = {
  player1: [
    { type: 'FIST' as const, emoji: '✊', name: 'Inferno Strike', typeName: 'Heavy Damage', desc: 'Deals 45 damage to Malakor.' },
    { type: 'PALM' as const, emoji: '✋', name: 'Aegis Shield', typeName: 'Defensive Barrier', desc: 'Blocks attack & reflects 25 damage.' },
    { type: 'PEACE' as const, emoji: '✌️', name: 'Arcane Blast', typeName: 'Stun & Combo', desc: 'Deals 35 damage & triggers synergy.' },
  ],
  player2: [
    { type: 'FIST' as const, emoji: '✊', name: 'Holy Smite', typeName: 'Divine Damage', desc: 'Deals 45 damage to Malakor.' },
    { type: 'PALM' as const, emoji: '✋', name: 'Divine Barrier', typeName: 'Sacred Protection', desc: 'Shields team & deals 25 holy damage.' },
    { type: 'PEACE' as const, emoji: '✌️', name: 'Sunfire Burst', typeName: 'Light Surge', desc: 'Deals 35 damage & triggers synergy.' },
  ],
};

export const HandGestureDetector: React.FC<HandGestureDetectorProps> = ({
  playerRole,
  onGestureDetected,
  disabled = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [liveGesture, setLiveGesture] = useState<RecognizedGesture>(null);
  const [cooldown, setCooldown] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const lastTriggerTime = useRef<number>(0);
  const handsInstanceRef = useRef<any>(null);
  const cameraInstanceRef = useRef<any>(null);

  const spells = GESTURE_INFO[playerRole];

  // Cooldown countdown
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Dynamically load MediaPipe scripts
  const loadMediaPipeScripts = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).Hands && (window as any).Camera) {
        resolve();
        return;
      }

      const script1 = document.createElement("script");
      script1.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
      script1.crossOrigin = "anonymous";

      const script2 = document.createElement("script");
      script2.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
      script2.crossOrigin = "anonymous";

      let loadedCount = 0;
      const onLoad = () => {
        loadedCount++;
        if (loadedCount === 2) resolve();
      };
      const onError = (err: any) => reject(err);

      script1.onload = onLoad;
      script1.onerror = onError;
      script2.onload = onLoad;
      script2.onerror = onError;

      document.head.appendChild(script1);
      document.head.appendChild(script2);
    });
  };

  // Classify Hand Landmarks
  const classifyGesture = (landmarks: any[]): RecognizedGesture => {
    if (!landmarks || landmarks.length < 21) return null;

    const indexExtended = landmarks[8].y < landmarks[6].y;
    const middleExtended = landmarks[12].y < landmarks[10].y;
    const ringExtended = landmarks[16].y < landmarks[14].y;
    const pinkyExtended = landmarks[20].y < landmarks[18].y;

    const openCount = (indexExtended ? 1 : 0) + (middleExtended ? 1 : 0) + (ringExtended ? 1 : 0) + (pinkyExtended ? 1 : 0);

    // PALM: 3 or 4 fingers extended
    if (openCount >= 3) {
      return 'PALM';
    }

    // PEACE / V-SIGN: Index & Middle extended, Ring & Pinky folded
    if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
      return 'PEACE';
    }

    // FIST: 0 or 1 finger extended
    if (openCount <= 1) {
      return 'FIST';
    }

    return null;
  };

  // Draw Skeleton Landmarks
  const drawLandmarks = (ctx: CanvasRenderingContext2D, landmarks: any[]) => {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    const CONNECTIONS = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],
      [9,13],[13,14],[14,15],[15,16],
      [13,17],[17,18],[18,19],[19,20],[0,17]
    ];

    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 3;

    for (const [i, j] of CONNECTIONS) {
      const pt1 = landmarks[i];
      const pt2 = landmarks[j];
      ctx.beginPath();
      ctx.moveTo((1 - pt1.x) * w, pt1.y * h);
      ctx.lineTo((1 - pt2.x) * w, pt2.y * h);
      ctx.stroke();
    }

    for (const pt of landmarks) {
      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.arc((1 - pt.x) * w, pt.y * h, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  // Trigger gesture attack
  const triggerGesture = (gesture: 'FIST' | 'PALM' | 'PEACE') => {
    const now = Date.now();
    if (disabled || cooldown > 0 || now - lastTriggerTime.current < 1500) return;

    lastTriggerTime.current = now;
    setLiveGesture(gesture);
    onGestureDetected(gesture);
    setCooldown(2);

    setTimeout(() => setLiveGesture(null), 1500);
  };

  // Start Camera safely
  const startCamera = async () => {
    setCameraError(null);
    setIsAiLoading(true);

    try {
      // First ensure camera state is active so video element is rendered in DOM
      setIsCameraOn(true);

      await loadMediaPipeScripts();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      });

      // Wait a tick for React to attach videoRef if needed
      await new Promise((r) => setTimeout(r, 100));

      if (!videoRef.current) {
        throw new Error("Video element reference not found in DOM.");
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const hands = new (window as any).Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      hands.onResults((results: any) => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const landmarks = results.multiHandLandmarks[0];
          drawLandmarks(ctx, landmarks);

          const detected = classifyGesture(landmarks);
          if (detected) {
            setLiveGesture(detected);
            triggerGesture(detected);
          }
        }
        ctx.restore();
      });

      handsInstanceRef.current = hands;

      const camera = new (window as any).Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && handsInstanceRef.current) {
            await handsInstanceRef.current.send({ image: videoRef.current });
          }
        },
        width: 320,
        height: 240,
      });

      cameraInstanceRef.current = camera;
      await camera.start();

      setIsAiLoading(false);
    } catch (err: any) {
      console.warn("MediaPipe / Camera initialization error:", err);
      setCameraError(err.message || "Webcam vision unavailable. You can click the 3 gesture spell cards directly below!");
      setIsAiLoading(false);
      setIsCameraOn(false);
    }
  };

  const stopCamera = () => {
    if (cameraInstanceRef.current) {
      try { cameraInstanceRef.current.stop(); } catch {}
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="w-full bg-zinc-950/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3">
      {/* Header & Camera Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hand className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
            {playerRole === 'player1' ? 'P1 Mage Spells' : 'P2 Paladin Spells'}
          </h4>
        </div>

        <button
          onClick={isCameraOn ? stopCamera : startCamera}
          disabled={isAiLoading}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
            isCameraOn
              ? 'bg-red-950 border border-red-700 text-red-300 hover:bg-red-900'
              : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700'
          } ${isAiLoading ? 'opacity-60 cursor-wait' : ''}`}
        >
          {isCameraOn ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5 text-amber-400" />}
          {isAiLoading ? 'Loading AI...' : isCameraOn ? 'Turn Camera Off' : 'Enable Gesture Camera'}
        </button>
      </div>

      {/* Video & Canvas Elements (Always in DOM, toggled via CSS display) */}
      <div className={`relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-emerald-500/40 ${isCameraOn ? 'block' : 'hidden'}`}>
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover transform -scale-x-100"
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        {liveGesture && (
          <div className="absolute top-2 right-2 bg-amber-500/90 text-black px-3 py-1 rounded-lg font-mono font-extrabold text-xs flex items-center gap-1.5 shadow-lg animate-bounce">
            <span>{liveGesture === 'FIST' ? '✊' : liveGesture === 'PALM' ? '✋' : '✌️'}</span>
            <span>{spells.find((s) => s.type === liveGesture)?.name}</span>
          </div>
        )}

        <div className="absolute top-2 left-2 bg-black/70 border border-emerald-500/50 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> AI Vision Active
        </div>
      </div>

      {cameraError && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-2.5 text-[11px] font-mono text-amber-300">
          ⚠️ {cameraError}
        </div>
      )}

      {/* 3 Max Gestures Cards */}
      <div className="grid grid-cols-3 gap-2">
        {spells.map((spell) => {
          const isActive = liveGesture === spell.type;
          const isCooldown = cooldown > 0;

          return (
            <button
              key={spell.type}
              onClick={() => triggerGesture(spell.type)}
              disabled={disabled || isCooldown}
              className={`flex flex-col items-center justify-between p-2.5 rounded-xl border transition-all text-center relative overflow-hidden cursor-pointer ${
                isActive
                  ? 'bg-amber-950 border-amber-400 ring-2 ring-amber-400/50 scale-105'
                  : 'bg-zinc-900/80 border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-850'
              } ${isCooldown ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="text-2xl mb-0.5">{spell.emoji}</div>
              <div className="space-y-0.5 w-full">
                <span className="text-[11px] font-bold font-mono text-white block leading-tight">
                  {spell.name}
                </span>
                <span className="text-[9px] font-mono text-amber-400 block">
                  {spell.typeName}
                </span>
              </div>

              {isCooldown && (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center text-xs font-mono font-bold text-amber-400">
                  ⏳ {cooldown}s
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="text-center text-[9px] font-mono text-zinc-500">
        Perform hand gesture in front of webcam or click spell card to cast!
      </div>
    </div>
  );
};
