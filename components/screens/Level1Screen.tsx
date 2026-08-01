"use client";

import React, { useState, useEffect } from "react";
import { GameGameState, gameSync } from "@/lib/gameStore";
import { pythonApi, Level1RoomData, FALLBACK_L1_ROOMS } from "@/lib/pythonApi";
import { CheckCircle, Timer, AlertCircle, ArrowRight, RotateCcw, HelpCircle } from "lucide-react";

interface Level1ScreenProps {
  state: GameGameState;
  myRole: 'player1' | 'player2';
}

const ROOM_ICONS = ["🏚️", "💀", "🔮"];
const ROOM_COLORS = [
  "from-red-900/40 to-red-950/60 border-red-700/50 hover:border-red-500",
  "from-purple-900/40 to-purple-950/60 border-purple-700/50 hover:border-purple-500",
  "from-amber-900/40 to-amber-950/60 border-amber-700/50 hover:border-amber-500",
];
const ROOM_ACCENT = ["red", "purple", "amber"];

export const Level1Screen: React.FC<Level1ScreenProps> = ({ state }) => {
  const [rooms, setRooms] = useState<Level1RoomData[]>(FALLBACK_L1_ROOMS);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [roomTimer, setRoomTimer] = useState<number>(60);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [feedback, setFeedback] = useState<{ success?: boolean; message: string }>({ message: '' });
  const [showHint, setShowHint] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    pythonApi.getLevel1Rooms().then(setRooms);
  }, []);

  // 60s room countdown
  useEffect(() => {
    if (activeRoomId === null || state.gameStatus !== 'playing') return;
    setRoomTimer(60);
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
    if (updatedFailed.length >= 2) {
      gameSync.updateState({ l1FailedRooms: updatedFailed, gameStatus: 'disqualified' });
    } else {
      gameSync.updateState({ l1FailedRooms: updatedFailed });
      setActiveRoomId(null);
      setFeedback({ message: `⏰ Room ${failedId} timed out! Choose another room.` });
    }
  };

  const handleEnterRoom = (roomId: number) => {
    if (state.l1CompletedRooms.includes(roomId) || (state.l1FailedRooms || []).includes(roomId)) return;
    setActiveRoomId(roomId);
    setUserAnswer('');
    setFeedback({ message: '' });
    setShowHint(false);
  };

  const handleSubmit = async (overrideAnswer?: string) => {
    if (activeRoomId === null) return;
    const answer = overrideAnswer || userAnswer;
    if (!answer.trim()) return;
    setSubmitting(true);
    const room = rooms.find((r) => r.roomId === activeRoomId) || rooms[0];
    const result = await pythonApi.verifyAnswer(room.puzzle.id, answer);
    setFeedback(result);
    setSubmitting(false);
    if (result.success) {
      const updatedCompleted = Array.from(new Set([...state.l1CompletedRooms, activeRoomId]));
      if (updatedCompleted.length >= 2) {
        gameSync.updateState({ l1CompletedRooms: updatedCompleted, l1IsCompleted: true, currentLevel: 2, timeRemaining: 120 });
      } else {
        gameSync.updateState({ l1CompletedRooms: updatedCompleted });
        setTimeout(() => setActiveRoomId(null), 1200);
      }
    }
  };

  const currentRoom = activeRoomId !== null ? rooms.find((r) => r.roomId === activeRoomId) || rooms[0] : null;
  const completed = state.l1CompletedRooms.length;
  const failed = (state.l1FailedRooms || []).length;
  const timerPct = (roomTimer / 60) * 100;
  const timerColor = roomTimer <= 10 ? "bg-red-500" : roomTimer <= 25 ? "bg-amber-500" : "bg-emerald-500";

  // ── ROOM SELECTION HUB ──────────────────────────────────────────────
  if (activeRoomId === null) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-xs font-mono tracking-widest text-red-400 uppercase">Level 1 · Haunted Chambers</p>
          <h2 className="text-3xl font-extrabold text-white font-serif">Choose a Room</h2>
          <p className="text-sm text-zinc-400">Clear any <strong className="text-emerald-400">2 of 3 rooms</strong> to advance. Each room gives you <strong className="text-amber-400">60 seconds</strong>.</p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          {[0, 1].map((i) => (
            <div key={i} className={`flex-1 h-2 rounded-full transition-all duration-500 ${i < completed ? 'bg-emerald-500' : 'bg-zinc-800'}`} />
          ))}
          <span className="text-xs font-mono text-zinc-400 shrink-0">{completed}/2</span>
        </div>

        {/* Timeout warning */}
        {feedback.message && (
          <div className="flex items-center gap-3 bg-amber-950/60 border border-amber-600/40 rounded-xl px-4 py-3 text-sm text-amber-300 font-mono">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            {feedback.message}
          </div>
        )}

        {/* Room cards */}
        <div className="grid grid-cols-1 gap-4">
          {rooms.map((room, idx) => {
            const isDone = state.l1CompletedRooms.includes(room.roomId);
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
                    : `${ROOM_COLORS[idx]} cursor-pointer hover:scale-[1.01] active:scale-[0.99]`
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0 ${
                    isDone ? 'bg-emerald-900/60' : isFailed ? 'bg-zinc-900/60' : 'bg-black/30'
                  }`}>
                    {isDone ? <CheckCircle className="w-8 h-8 text-emerald-400" /> : isFailed ? '💀' : ROOM_ICONS[idx]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500">Room {room.roomId}</span>
                      {isDone && <span className="text-[10px] bg-emerald-900/80 text-emerald-400 border border-emerald-600/40 font-mono px-2 py-0.5 rounded-full font-bold">CLEARED ✓</span>}
                      {isFailed && <span className="text-[10px] bg-red-950/80 text-red-400 border border-red-800/40 font-mono px-2 py-0.5 rounded-full font-bold">TIMED OUT</span>}
                    </div>
                    <h3 className="text-lg font-bold text-white">{room.name}</h3>
                    <p className="text-xs text-zinc-400 truncate">{room.description}</p>
                  </div>
                  {!isLocked && (
                    <ArrowRight className="w-5 h-5 text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {failed > 0 && (
          <p className="text-center text-xs text-zinc-500 font-mono">
            ⚠️ {failed} room{failed > 1 ? 's' : ''} timed out · {2 - completed} more needed · {failed >= 2 ? 'Disqualified!' : 'Still in the game!'}
          </p>
        )}
      </div>
    );
  }

  // ── ACTIVE ROOM ─────────────────────────────────────────────────────
  if (!currentRoom) return null;
  const accent = ROOM_ACCENT[activeRoomId - 1];

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 space-y-5">
      {/* Top bar: back + timer */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveRoomId(null)}
          className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
        >
          ← Back
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

      {/* Room identity */}
      <div className="space-y-1">
        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Room {activeRoomId} · {currentRoom.puzzle.type}</p>
        <h2 className="text-2xl font-extrabold text-white font-serif">{currentRoom.name}</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">{currentRoom.description}</p>
      </div>

      {/* Puzzle card */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div>
          <p className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider mb-2">{currentRoom.puzzle.title}</p>
          <p className="text-sm text-zinc-300 leading-relaxed">{currentRoom.puzzle.description}</p>
        </div>

        {currentRoom.puzzle.initialCode && (
          <pre className="bg-black/60 border border-zinc-800 rounded-xl p-4 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed">
            {currentRoom.puzzle.initialCode}
          </pre>
        )}

        {/* Options or text input */}
        {currentRoom.puzzle.options ? (
          <div className="grid grid-cols-2 gap-2">
            {currentRoom.puzzle.options.map((opt) => (
              <button
                key={opt}
                onClick={() => { setUserAnswer(opt); handleSubmit(opt); }}
                disabled={submitting}
                className={`py-3 px-4 rounded-xl text-sm font-mono font-bold border transition-all cursor-pointer ${
                  userAnswer === opt
                    ? 'bg-red-700 border-red-500 text-white'
                    : 'bg-zinc-950 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800'
                } ${submitting ? 'opacity-60 cursor-wait' : ''}`}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Type your answer..."
              className="w-full bg-zinc-950 border border-zinc-700 focus:border-red-500 text-white font-mono text-sm px-4 py-3 rounded-xl outline-none transition-colors placeholder:text-zinc-600"
            />
            <button
              onClick={() => handleSubmit()}
              disabled={submitting || !userAnswer.trim()}
              className="w-full py-3 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-mono font-bold text-sm transition-all cursor-pointer"
            >
              {submitting ? 'Checking...' : 'Submit Answer →'}
            </button>
          </div>
        )}

        {/* Feedback */}
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

        {/* Hint */}
        {currentRoom.puzzle.hint && (
          <div>
            <button
              onClick={() => setShowHint(!showHint)}
              className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-amber-400 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {showHint ? 'Hide hint' : 'Show hint'}
            </button>
            {showHint && (
              <p className="mt-2 text-xs font-mono text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2">
                💡 {currentRoom.puzzle.hint}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
