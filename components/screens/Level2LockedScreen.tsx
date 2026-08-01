"use client";

import React from "react";
import { GameGameState } from "@/lib/gameStore";
import { Lock, Eye, CheckCircle2, Flame, Clock } from "lucide-react";

interface Level2LockedScreenProps {
  state: GameGameState;
}

export const Level2LockedScreen: React.FC<Level2LockedScreenProps> = ({ state }) => {
  const completed = state.l1CompletedRooms.length;
  const total = 2;
  const pct = Math.min(100, Math.round((completed / total) * 100));

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4">
      {/* Skull/Lock Icon */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-purple-950/60 border-2 border-purple-700/60 flex items-center justify-center shadow-2xl shadow-purple-950">
          <Lock className="w-12 h-12 text-purple-400 animate-pulse" />
        </div>
        {/* Flame decorations */}
        <Flame className="w-5 h-5 text-orange-500/60 absolute -top-2 -left-2 animate-bounce" />
        <Flame className="w-4 h-4 text-red-500/50 absolute -bottom-1 -right-2 animate-bounce delay-150" />
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-purple-950/60 border border-purple-800/60 px-4 py-1.5 rounded-full text-purple-400 font-mono text-xs uppercase tracking-widest mb-3">
          <Lock className="w-3.5 h-3.5" />
          Level 2 — Demon Doors
        </div>
        <h2 className="text-3xl font-extrabold text-white font-serif mb-2">
          Awaiting Player 1...
        </h2>
        <p className="text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
          The Demon Doors are sealed until{" "}
          <span className="text-red-400 font-semibold">{state.player1Name || "Player 1"}</span>{" "}
          clears 2 Haunted Rooms in Level 1.
        </p>
      </div>

      {/* Progress Panel */}
      <div className="w-full bg-zinc-900/80 border border-purple-900/40 rounded-2xl p-5 shadow-xl mb-6">
        {/* Team Info */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800">
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Mission Team</span>
            <div className="text-base font-bold text-white">{state.teamName || "Demon Slayers"}</div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Code</span>
            <div className="text-base font-mono font-bold text-red-500">{state.teamCode}</div>
          </div>
        </div>

        {/* Live Room Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
              <Eye className="w-3.5 h-3.5 inline mr-1 text-red-400" />
              Player 1 — Haunted Rooms Progress
            </span>
            <span className="text-sm font-bold text-white font-mono">{completed}/{total}</span>
          </div>

          {/* Room Status Bubbles */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[1, 2, 3].map((room) => {
              const done = state.l1CompletedRooms.includes(room);
              return (
                <div
                  key={room}
                  className={`rounded-xl p-3 border text-center transition-all duration-500 ${
                    done
                      ? "bg-emerald-950/50 border-emerald-500/60 shadow-lg shadow-emerald-950/30"
                      : "bg-zinc-900 border-zinc-800"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-zinc-700 mx-auto mb-1 animate-pulse bg-zinc-800" />
                  )}
                  <span className={`text-[10px] font-mono uppercase ${done ? "text-emerald-400" : "text-zinc-600"}`}>
                    {done ? "Cleared" : "Room " + room}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-600 to-orange-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-mono text-zinc-600">0%</span>
            <span className={`text-[10px] font-mono font-bold ${pct === 100 ? "text-emerald-400" : "text-zinc-500"}`}>
              {pct}% Complete
            </span>
            <span className="text-[10px] font-mono text-zinc-600">100%</span>
          </div>
        </div>

        {/* Waiting Message */}
        <div className="flex items-center gap-2 p-3 bg-purple-950/30 border border-purple-800/40 rounded-lg">
          <Clock className="w-4 h-4 text-purple-400 flex-shrink-0 animate-spin" style={{ animationDuration: "3s" }} />
          <span className="text-xs text-zinc-400 font-mono">
            {completed === 0
              ? "Player 1 has not started yet. The doors will open automatically..."
              : completed === 3
              ? "Level 1 Complete! Unlocking your doors now..."
              : `${total - completed} room${total - completed > 1 ? "s" : ""} remaining before your doors open...`}
          </span>
        </div>
      </div>

      {/* Atmospheric Hint */}
      <p className="text-center text-[11px] text-zinc-600 font-mono max-w-xs">
        "Behind these doors await the Demon's riddles — patience is your greatest weapon."
      </p>
    </div>
  );
};
