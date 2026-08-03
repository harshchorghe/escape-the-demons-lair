"use client";

import React, { useState, useEffect } from "react";
import { Timer, Shield, Users, Server, Trophy, Clock } from "lucide-react";
import { pythonApi } from "@/lib/pythonApi";
import { LeaderboardModal } from "./LeaderboardModal";

interface HeaderHUDProps {
  teamCode: string;
  myRole: 'player1' | 'player2';
  currentLevel: 1 | 2 | 3 | 4;
  timeRemaining: number;
  totalTimeElapsed?: number;
  onOpenPythonConfig: () => void;
}

export const HeaderHUD: React.FC<HeaderHUDProps> = ({
  teamCode,
  myRole,
  currentLevel,
  timeRemaining,
  totalTimeElapsed = 0,
  onOpenPythonConfig,
}) => {
  const [pythonStatus, setPythonStatus] = useState<'online' | 'offline'>('offline');
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  useEffect(() => {
    const check = async () => {
      const res = await pythonApi.checkHealth();
      setPythonStatus(res.status);
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(Math.max(0, sec) / 60);
    const s = Math.max(0, sec) % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const levelTitles = {
    1: "Level 1: Haunted Rooms",
    2: "Level 2: Demon Doors",
    3: "Final Level: Throne Room",
    4: "Escaped Demon's Lair",
  };

  return (
    <>
      <header className="w-full bg-zinc-950/90 border-b border-red-900/50 backdrop-blur-md px-4 py-3 sticky top-0 z-40 text-zinc-100 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Brand & Team Code */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-red-950/60 border border-red-800/60 px-3 py-1.5 rounded-lg">
              <Shield className="w-4 h-4 text-red-500 animate-pulse" />
              <span className="font-mono font-bold text-sm tracking-wider text-red-400">
                {teamCode ? `TEAM: ${teamCode}` : "ESCAPE DEMON'S LAIR"}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs font-mono">
              <Users className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-zinc-300">
                Role: <strong className="text-amber-400">{myRole === 'player1' ? 'Player 1 (Navigator)' : 'Player 2 (Decrypter)'}</strong>
              </span>
            </div>
          </div>

          {/* Center: Active Level */}
          <div className="flex items-center gap-2 bg-zinc-900/80 border border-red-900/30 px-4 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-mono font-semibold text-zinc-200 uppercase tracking-widest">
              {levelTitles[currentLevel]}
            </span>
          </div>

          {/* Right: Timers, Leaderboard & Python Badge */}
          <div className="flex items-center gap-2.5">
            {/* Level Countdown Timer & Total Time Taken */}
            {currentLevel !== 4 && (
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs border ${
                    timeRemaining < 30 ? 'bg-red-950/90 border-red-600 text-red-400 animate-bounce' : 'bg-zinc-900 border-zinc-800 text-amber-400'
                  }`}
                  title="Level Countdown Timer"
                >
                  <Timer className="w-3.5 h-3.5" />
                  <span className="font-bold">{formatSeconds(timeRemaining)}</span>
                </div>

                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs border bg-cyan-950/40 border-cyan-800/60 text-cyan-300 shadow-sm"
                  title="Total Time Taken by Team Across All Levels"
                >
                  <Clock className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
                  <span className="font-bold">{formatSeconds(totalTimeElapsed)}</span>
                  <span className="text-[10px] text-cyan-400/70 font-sans uppercase">Total</span>
                </div>
              </div>
            )}

            {/* Leaderboard Button */}
            <button
              onClick={() => setIsLeaderboardOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-amber-950/50 border border-amber-500/40 text-amber-300 hover:bg-amber-900/60 transition-all font-bold"
              title="View Leaderboard Rankings"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Leaderboard</span>
            </button>

            {/* Python Config Badge */}
            <button
              onClick={onOpenPythonConfig}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                pythonStatus === 'online'
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
              }`}
              title="Configure Python Backend API"
            >
              <Server className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Python API:</span>
              <span className={`w-2 h-2 rounded-full ${pythonStatus === 'online' ? 'bg-emerald-400' : 'bg-amber-500'}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Leaderboard Modal */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        currentTeamCode={teamCode}
      />
    </>
  );
};
