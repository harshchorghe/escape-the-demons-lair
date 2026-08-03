"use client";

import React, { useState, useEffect } from "react";
import { GameGameState, gameSync } from "@/lib/gameStore";
import { pythonApi, Level2DoorData, FALLBACK_L2_DOORS } from "@/lib/pythonApi";
import { puzzleService } from "@/lib/puzzleService";
import { Level2LockedScreen } from "@/components/screens/Level2LockedScreen";
import { CheckCircle, AlertCircle, DoorOpen } from "lucide-react";
import { useRouter } from "next/navigation";

interface Level2ScreenProps {
  state: GameGameState;
  myRole: 'player1' | 'player2';
}

const DOORS = [
  { id: 1, name: "Blood Moon Gate", emoji: "🩸", color: "from-red-900/40 to-red-950/60 border-red-700/50 hover:border-red-400 ring-red-500" },
  { id: 2, name: "Soul Chains Gate", emoji: "⛓️", color: "from-purple-900/40 to-purple-950/60 border-purple-700/50 hover:border-purple-400 ring-purple-500" },
  { id: 3, name: "Abyssal Portal",   emoji: "🌀", color: "from-blue-900/40 to-blue-950/60 border-blue-700/50 hover:border-blue-400 ring-blue-500" },
];

export const Level2Screen: React.FC<Level2ScreenProps> = ({ state }) => {
  const router = useRouter();
  const [doorData, setDoorData] = useState<Level2DoorData[]>(FALLBACK_L2_DOORS);
  const [failedIds, setFailedIds] = useState<number[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ success?: boolean; message: string }>({ message: '' });
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    puzzleService.getAssignedSetForTeam(2, state.teamCode).then((assignedDoors) => {
      if (Array.isArray(assignedDoors) && assignedDoors.length > 0) {
        setDoorData(assignedDoors);
      }
    });
  }, [state.teamCode]);

  if (!state.l1IsCompleted) return <Level2LockedScreen state={state} />;

  // Deterministic correct door from teamCode
  const correctId = (() => {
    if (!state.teamCode) return 2;
    let s = 0;
    for (let i = 0; i < state.teamCode.length; i++) s += state.teamCode.charCodeAt(i);
    return (s % 3) + 1;
  })();

  const handlePickDoor = (id: number) => {
    if (failedIds.includes(id) || locking || chosen !== null) return;
    setChosen(id);
    setLocking(true);

    if (id === correctId) {
      setFeedback({ success: true, message: "🎉 Correct door! Portal to the Throne Room opened!" });
      const now = Date.now();
      const l3Sec = state.level3Duration || 300;
      if (state.teamCode) {
        pythonApi.startRoomTimer(state.teamCode, 3);
      }
      gameSync.updateState({
        l2UnlockedDoors: [id],
        currentLevel: 3,
        timeRemaining: l3Sec,
        levelStartTime: now,
        timePenalties: 0,
      });
      setTimeout(() => router.push('/level3'), 800);
    } else {
      setFeedback({ success: false, message: `💀 Demonic Trap! −30 seconds penalty!` });
      setFailedIds((prev) => [...prev, id]);
      gameSync.updateState((prev) => ({
        ...prev,
        timeRemaining: Math.max(0, prev.timeRemaining - 30),
        timePenalties: prev.timePenalties + 30,
        gameStatus: Math.max(0, prev.timeRemaining - 30) <= 0 ? 'disqualified' : prev.gameStatus,
      }));
      setTimeout(() => { setChosen(null); setLocking(false); setFeedback({ message: '' }); }, 1500);
    }
  };

  const remaining = DOORS.filter((d) => !failedIds.includes(d.id));
  const isSuccess = chosen !== null && chosen === correctId;

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <p className="text-xs font-mono tracking-widest text-purple-400 uppercase">Level 2 · Demon Doors</p>
        <h2 className="text-3xl font-extrabold text-white font-serif">Choose the Escape Door</h2>
        <p className="text-sm text-zinc-400">
          One door leads to the Throne Room. Wrong doors deal a <strong className="text-red-400">−30s penalty</strong>.
        </p>
      </div>

      {/* Penalty counter */}
      {failedIds.length > 0 && (
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold bg-red-950/60 border border-red-700/40 text-red-400 px-4 py-2 rounded-full">
            <AlertCircle className="w-3.5 h-3.5" />
            {failedIds.length} trap{failedIds.length > 1 ? 's' : ''} hit · −{failedIds.length * 30}s total
          </span>
        </div>
      )}

      {/* Feedback */}
      {feedback.message && (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-mono transition-all ${
          feedback.success
            ? 'bg-emerald-950/60 border-emerald-600/40 text-emerald-300'
            : 'bg-red-950/60 border-red-700/40 text-red-300'
        }`}>
          {feedback.success
            ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            : <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />}
          {feedback.message}
        </div>
      )}

      {/* Door cards */}
      <div className="grid grid-cols-1 gap-4">
        {DOORS.map((door) => {
          const isFailed = failedIds.includes(door.id);
          const isChosen = chosen === door.id;
          const isWinner = isSuccess && isChosen;

          return (
            <button
              key={door.id}
              onClick={() => handlePickDoor(door.id)}
              disabled={isFailed || locking}
              className={`w-full text-left rounded-2xl border bg-gradient-to-br p-5 transition-all duration-300 group ${door.color} ${
                isFailed
                  ? 'opacity-40 cursor-default border-zinc-700/30 from-zinc-950 to-zinc-950'
                  : isWinner
                  ? 'border-emerald-500 from-emerald-950/60 to-emerald-950/30 ring-2 ring-emerald-500/30'
                  : isChosen && !isFailed
                  ? 'opacity-70 cursor-wait'
                  : 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 transition-all ${
                  isFailed ? 'bg-zinc-900/40 grayscale' : 'bg-black/30 group-hover:scale-110'
                }`}>
                  {isWinner ? '✅' : isFailed ? '💥' : door.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-0.5">Door {door.id}</p>
                  <h3 className="text-lg font-bold text-white">{door.name}</h3>
                  {isFailed && <p className="text-xs text-red-400 font-mono mt-0.5">Demonic Trap — Avoid!</p>}
                </div>
                {!isFailed && !locking && (
                  <DoorOpen className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-zinc-600 font-mono">
        {remaining.length} door{remaining.length !== 1 ? 's' : ''} remaining · Be bold, Decrypter!
      </p>
    </div>
  );
};
