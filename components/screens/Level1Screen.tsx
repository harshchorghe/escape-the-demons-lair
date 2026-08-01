"use client";

import React, { useState, useEffect } from "react";
import { GameGameState, gameSync } from "@/lib/gameStore";
import { pythonApi, Level1RoomData, FALLBACK_L1_ROOMS } from "@/lib/pythonApi";
import { HauntedRoomCanvas } from "@/components/3d/HauntedRoomCanvas";
import { Code2, Flame, CheckCircle, ArrowRight, Zap, HelpCircle } from "lucide-react";

interface Level1ScreenProps {
  state: GameGameState;
  myRole: 'player1' | 'player2';
}

export const Level1Screen: React.FC<Level1ScreenProps> = ({ state }) => {
  const [rooms, setRooms] = useState<Level1RoomData[]>(FALLBACK_L1_ROOMS);
  const [activeRoomId, setActiveRoomId] = useState<number>(1);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [feedback, setFeedback] = useState<{ success?: boolean; message: string }>({ message: '' });
  const [showHint, setShowHint] = useState<boolean>(false);

  useEffect(() => {
    const fetchRooms = async () => {
      const data = await pythonApi.getLevel1Rooms();
      setRooms(data);
    };
    fetchRooms();
  }, []);

  const currentRoomData = rooms.find((r) => r.roomId === activeRoomId) || rooms[0];
  const isCurrentRoomCompleted = state.l1CompletedRooms.includes(activeRoomId);

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) return;
    setFeedback({ message: 'Verifying with Python Altar Engine...' });

    const result = await pythonApi.verifyAnswer(currentRoomData.puzzle.id, userAnswer);
    setFeedback(result);

    if (result.success) {
      const updatedRooms = Array.from(new Set([...state.l1CompletedRooms, activeRoomId]));
      
      // If all 3 rooms done, unlock Level 2 for Player 2
      if (updatedRooms.length === 3) {
        gameSync.updateState({
          l1CompletedRooms: updatedRooms,
          l1IsCompleted: true,
          currentLevel: 2,
          timeRemaining: 180, // 3 mins for Level 2
        });
      } else {
        gameSync.updateState({ l1CompletedRooms: updatedRooms });

        if (activeRoomId < 3) {
          setActiveRoomId(activeRoomId + 1);
          setUserAnswer('');
        }
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Top Level Banner */}
      <div className="bg-zinc-950/90 border border-red-900/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-xl font-bold font-serif text-red-400 flex items-center gap-2">
            <Flame className="w-5 h-5 text-red-500 animate-pulse" />
            Level 1: The 3 Haunted Rooms
          </h2>
          <p className="text-xs text-zinc-400">
            Player 1 must solve 3 spectral puzzles within 2 minutes to charge the Teleportation Altar.
          </p>
        </div>

        {/* Room Nav Tabs */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((rId) => {
            const done = state.l1CompletedRooms.includes(rId);
            const active = activeRoomId === rId;
            return (
              <button
                key={rId}
                onClick={() => {
                  setActiveRoomId(rId);
                  setUserAnswer('');
                  setFeedback({ message: '' });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                  active
                    ? 'bg-red-700 text-white border border-red-500 shadow-md'
                    : done
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-600/50'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                {done ? <CheckCircle className="w-3.5 h-3.5" /> : null}
                Room {rId}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3D Visual Scene */}
      <HauntedRoomCanvas
        currentRoom={activeRoomId}
        completedRooms={state.l1CompletedRooms}
        onSelectRoom={(id) => setActiveRoomId(id)}
      />

      {/* Active Puzzle Challenge Panel */}
      <div className="bg-zinc-950/90 border border-red-900/50 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div>
            <span className="text-xs font-mono text-red-400 uppercase tracking-widest">
              Haunted Room {currentRoomData.roomId} of 3
            </span>
            <h3 className="text-2xl font-bold text-white font-serif">{currentRoomData.name}</h3>
          </div>
          <span className="text-xs font-mono bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-zinc-300">
            Type: {currentRoomData.puzzle.type.toUpperCase()}
          </span>
        </div>

        <p className="text-sm text-zinc-300 leading-relaxed">{currentRoomData.description}</p>

        {/* Puzzle Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-mono text-sm font-semibold">
            <Code2 className="w-4 h-4" />
            {currentRoomData.puzzle.title}
          </div>
          <p className="text-xs text-zinc-300 font-mono leading-normal">
            {currentRoomData.puzzle.description}
          </p>

          {/* Initial Code Snippet if any */}
          {currentRoomData.puzzle.initialCode && (
            <div className="bg-black border border-zinc-800 rounded-lg p-3 overflow-x-auto">
              <pre className="text-xs font-mono text-emerald-400 leading-relaxed">
                {currentRoomData.puzzle.initialCode}
              </pre>
            </div>
          )}

          {/* Multiple Choice Options if available */}
          {currentRoomData.puzzle.options && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              {currentRoomData.puzzle.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setUserAnswer(opt)}
                  className={`p-2.5 rounded-lg text-xs font-mono text-center font-bold border transition-all ${
                    userAnswer === opt
                      ? 'bg-red-950 border-red-500 text-red-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Direct Input */}
          {!currentRoomData.puzzle.options && (
            <div className="pt-2">
              <label className="block text-xs font-mono text-zinc-400 uppercase mb-1">
                Enter Rune Code / Python Solution
              </label>
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Type answer here..."
                disabled={isCurrentRoomCompleted}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 text-zinc-100 font-mono text-sm px-3 py-2.5 rounded-lg outline-none"
              />
            </div>
          )}

          {/* Feedback Display */}
          {feedback.message && (
            <div
              className={`p-3 rounded-lg text-xs font-mono border ${
                feedback.success
                  ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                  : 'bg-red-950/50 border-red-500/50 text-red-300'
              }`}
            >
              {feedback.message}
            </div>
          )}

          {/* Hint Section */}
          {currentRoomData.puzzle.hint && (
            <div className="pt-1">
              <button
                onClick={() => setShowHint(!showHint)}
                className="text-xs font-mono text-amber-400/80 hover:text-amber-300 flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {showHint ? "Hide Spectral Hint" : "Need Spectral Hint?"}
              </button>
              {showHint && (
                <p className="mt-2 text-xs font-mono text-amber-300/90 bg-amber-950/30 border border-amber-800/40 p-2.5 rounded-lg">
                  💡 Hint: {currentRoomData.puzzle.hint}
                </p>
              )}
            </div>
          )}

          {/* Submit / Next Button */}
          <div className="pt-3">
            {!isCurrentRoomCompleted ? (
              <button
                onClick={handleSubmitAnswer}
                className="w-full bg-red-700 hover:bg-red-600 text-white font-mono text-sm py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-950/50 flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> Activate Room Teleportation Rune
              </button>
            ) : (
              <div className="p-3 bg-emerald-950/50 border border-emerald-600/50 rounded-xl text-center text-xs font-mono text-emerald-300 flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" /> Room {activeRoomId} Completed! Teleportation Rune Lit.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
