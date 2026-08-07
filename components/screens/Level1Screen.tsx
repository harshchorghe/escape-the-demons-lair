"use client";

import React, { useState, useEffect } from "react";
import { GameGameState, gameSync } from "@/lib/gameStore";
import { pythonApi, Level1RoomData, FALLBACK_L1_ROOMS } from "@/lib/pythonApi";
import { puzzleService } from "@/lib/puzzleService";
import { CheckCircle, Timer, AlertCircle, ArrowRight } from "lucide-react";
import BackgroundVideo from "../3d/BackgroundVideo";
import { GravityShiftPuzzle } from "../puzzles/GravityShiftPuzzle";

interface Level1ScreenProps {
  state: GameGameState;
  myRole: 'player1' | 'player2';
}

const ROOM_ICON = "🌀";
const ROOM_COLOR = "from-red-900/40 to-red-950/60 border-red-700/50 hover:border-red-500";

export const Level1Screen: React.FC<Level1ScreenProps> = ({ state }) => {
  const [rooms, setRooms] = useState<Level1RoomData[]>(FALLBACK_L1_ROOMS);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(1); // Auto-start room 1 directly
  const [roomTimer, setRoomTimer] = useState<number>(90);
  const [feedback, setFeedback] = useState<{ success?: boolean; message: string }>({ message: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    puzzleService.getAssignedSetForTeam(1, state.teamCode).then((assignedRooms) => {
      if (Array.isArray(assignedRooms) && assignedRooms.length > 0) {
        setRooms(assignedRooms);
      }
    });
  }, [state.teamCode]);

  // 60s room countdown
  useEffect(() => {
    if (activeRoomId === null || state.gameStatus !== 'playing') return;
    setRoomTimer(90);
    const interval = setInterval(() => {
      setRoomTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleRoomTimeout(activeRoomId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId]);

  const handleRoomTimeout = (failedId: number) => {
    const fresh = gameSync.getState();
    const updatedFailed = Array.from(new Set([...(fresh.l1FailedRooms || []), failedId]));
    // Single room — any timeout means disqualified
    gameSync.updateState({ l1FailedRooms: updatedFailed, gameStatus: 'disqualified' });
  };

  const handleEnterRoom = (roomId: number) => {
    if ((state.l1CompletedRooms || []).includes(roomId) || (state.l1FailedRooms || []).includes(roomId)) return;
    setActiveRoomId(roomId);
    setFeedback({ message: '' });
  };

  const handleSubmit = async (overrideAnswer?: string) => {
    if (activeRoomId === null) return;
    const answer = overrideAnswer || "GRAVITY_SOLVED";
    setSubmitting(true);
    const room = rooms.find((r) => r.roomId === activeRoomId) || rooms[0];
    const result = await pythonApi.verifyAnswer(room.puzzle.id, answer);
    setFeedback(result);
    setSubmitting(false);
    if (result.success) {
      const fresh = gameSync.getState();
      const currentCompleted = fresh.l1CompletedRooms || [];
      const updatedCompleted = Array.from(new Set([...currentCompleted, activeRoomId]));
      // Single room — completing it immediately advances to level 2
      const now = Date.now();
      const l2Sec = fresh.level2Duration || 120;
      if (fresh.teamCode) {
        pythonApi.startRoomTimer(fresh.teamCode, 2);
      }
      gameSync.updateState({
        l1CompletedRooms: updatedCompleted,
        l1IsCompleted: true,
        currentLevel: 2,
        timeRemaining: l2Sec,
        levelStartTime: now,
        timePenalties: 0,
      });
    }
  };

  const currentRoom = activeRoomId !== null ? rooms.find((r) => r.roomId === activeRoomId) || rooms[0] : null;
  const completed = (state.l1CompletedRooms || []).length;
  const failed = (state.l1FailedRooms || []).length;
  const timerPct = (roomTimer / 90) * 100;
  const timerColor = roomTimer <= 15 ? "bg-red-500" : roomTimer <= 35 ? "bg-amber-500" : "bg-emerald-500";

  // ── ROOM SELECTION HUB ──────────────────────────────────────────────
  if (activeRoomId === null) {
    return (
      <div className="relative w-full min-h-screen overflow-hidden">
        <BackgroundVideo src="/videos/level_1.mp4" />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-8 space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <p className="text-xs font-mono tracking-widest text-red-400 uppercase">Level 1 · Anti-Gravity Chamber</p>
            <h2 className="text-3xl font-extrabold text-white font-serif">Enter the Gravity Vault</h2>
            <p className="text-sm text-zinc-400">Clear the <strong className="text-emerald-400">Abyssal Labyrinth</strong> to advance. Collect all <strong className="text-amber-400">4 rune keys</strong> then reach the exit. You have <strong className="text-red-400">90 seconds</strong>.</p>
          </div>

          {/* Timeout warning */}
          {feedback.message && (
            <div className="flex items-center gap-3 bg-amber-950/60 border border-amber-600/40 rounded-xl px-4 py-3 text-sm text-amber-300 font-mono">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              {feedback.message}
            </div>
          )}

          {/* Single room card */}
          <div className="grid grid-cols-1 gap-4">
            {rooms.slice(0, 1).map((room) => {
              const isDone = (state.l1CompletedRooms || []).includes(room.roomId);
              const isFailed = (state.l1FailedRooms || []).includes(room.roomId);
              const isLocked = isDone || isFailed;

              return (
                <button
                  key={room.roomId}
                  onClick={() => handleEnterRoom(room.roomId)}
                  disabled={isLocked}
                  className={`w-full text-left rounded-2xl border p-5 bg-gradient-to-br transition-all duration-300 group ${
                    isDone
                      ? 'border-emerald-600/50 from-emerald-950/50 to-emerald-950/30 opacity-80 cursor-default'
                      : isFailed
                      ? 'border-zinc-700/40 from-zinc-950 to-zinc-950 opacity-50 cursor-default'
                      : `${ROOM_COLOR} cursor-pointer hover:scale-[1.01] active:scale-[0.99]`
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0 ${
                      isDone ? 'bg-emerald-900/60' : isFailed ? 'bg-zinc-900/60' : 'bg-black/30'
                    }`}>
                      {isDone ? <CheckCircle className="w-8 h-8 text-emerald-400" /> : isFailed ? '💀' : ROOM_ICON}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-500">⚔️ Moderate Difficulty</span>
                        {isDone && <span className="text-[10px] bg-emerald-900/80 text-emerald-400 border border-emerald-600/40 font-mono px-2 py-0.5 rounded-full font-bold">CLEARED ✓</span>}
                        {isFailed && <span className="text-[10px] bg-red-950/80 text-red-400 border border-red-800/40 font-mono px-2 py-0.5 rounded-full font-bold">TIMED OUT</span>}
                      </div>
                      <h3 className="text-lg font-bold text-white">{room.name}</h3>
                      <p className="text-xs text-zinc-400 mt-1">{room.description}</p>
                      <div className="flex gap-3 mt-2">
                        <span className="text-[10px] font-mono bg-amber-950/60 text-amber-400 border border-amber-800/40 px-2 py-0.5 rounded-full">🗝️ 4 Keys Required</span>
                        <span className="text-[10px] font-mono bg-red-950/60 text-red-400 border border-red-800/40 px-2 py-0.5 rounded-full">⏱ 90 Seconds</span>
                        <span className="text-[10px] font-mono bg-zinc-900/80 text-zinc-400 border border-zinc-700/40 px-2 py-0.5 rounded-full">💀 Multiple Traps</span>
                      </div>
                    </div>
                    {!isLocked && (
                      <ArrowRight className="w-5 h-5 text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── ACTIVE ROOM ─────────────────────────────────────────────────────
  if (!currentRoom) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Top bar: back + timer */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveRoomId(null)}
          className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          ← Back to Gravity Vaults
        </button>
        <div className="flex-1" />
        <div className={`flex items-center gap-2 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border ${
          roomTimer <= 10
            ? 'bg-red-950/80 border-red-600 text-red-400 animate-pulse'
            : roomTimer <= 25
            ? 'bg-amber-950/60 border-amber-600/50 text-amber-300'
            : 'bg-zinc-900 border-zinc-800 text-zinc-300'
        }`}>
          <Timer className="w-3.5 h-3.5" />
          {roomTimer}s
        </div>
      </div>

      {/* Timer bar */}
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${timerColor}`}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      {/* Render Gravity Shift Puzzle for the active chamber */}
      <GravityShiftPuzzle
        chamberId={activeRoomId}
        onSolve={(answer) => handleSubmit(answer)}
      />

      {/* Feedback message */}
      {feedback.message && (
        <div className={`flex items-start gap-3 p-3 rounded-xl text-sm font-mono border ${
          feedback.success
            ? 'bg-emerald-950/60 border-emerald-600/40 text-emerald-300'
            : 'bg-red-950/60 border-red-600/40 text-red-300'
        }`}>
          {feedback.success ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          {feedback.message}
        </div>
      )}
    </div>
  );
};
