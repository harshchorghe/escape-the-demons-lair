"use client";

import React, { useEffect, useState } from "react";
import { GameGameState, gameSync, INITIAL_GAME_STATE } from "@/lib/gameStore";
import { saveTeamScore, getAllTeamsLeaderboard } from "@/lib/leaderboardService";
import { Skull, AlertOctagon, RotateCcw, Flame } from "lucide-react";
import { useRouter } from "next/navigation";

interface DisqualifiedScreenProps {
  state: GameGameState;
}

export const DisqualifiedScreen: React.FC<DisqualifiedScreenProps> = ({ state }) => {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    const recordFailAndFetch = async () => {
      const rankTime = state.totalTimeElapsed || 0;

      await saveTeamScore({
        teamCode: state.teamCode || 'LAIR-FAIL',
        teamName: state.teamName || 'Fallen Heroes',
        player1: state.player1Name || 'Player 1',
        player2: state.player2Name || 'Player 2',
        levelsCompleted: state.currentLevel > 1 ? state.currentLevel - 1 : 0,
        totalTimeSeconds: rankTime,
        gameStatus: 'disqualified',
        date: new Date().toISOString().split('T')[0],
      });

      const topData = await getAllTeamsLeaderboard(10);
      setLeaderboard(topData);
    };

    recordFailAndFetch();
  }, [state.teamCode, state.teamName, state.player1Name, state.player2Name, state.currentLevel, state.totalTimeElapsed]);

  const handleReturnToLobby = () => {
    gameSync.resetGame();
    router.push('/');
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center py-10 px-4">
      {/* Skull and Flame Icon */}
      <div className="relative mb-6">
        <div className="w-28 h-28 rounded-full bg-red-950/80 border-4 border-red-700/80 flex items-center justify-center shadow-2xl shadow-red-950 animate-pulse">
          <Skull className="w-16 h-16 text-red-500" />
        </div>
        <Flame className="w-6 h-6 text-orange-500 absolute -top-3 -right-2 animate-bounce" />
        <Flame className="w-5 h-5 text-red-600 absolute -bottom-2 -left-2 animate-bounce delay-100" />
      </div>

      {/* Disqualification Banner */}
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex items-center gap-2 bg-red-950 border border-red-800 px-4 py-1 rounded-full text-red-400 font-mono text-xs uppercase tracking-widest">
          <AlertOctagon className="w-4 h-4 text-red-500" />
          AUTOMATIC DISQUALIFICATION
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-red-600 font-serif tracking-tight drop-shadow-lg">
          TEAM DISQUALIFIED
        </h1>
        <p className="text-sm text-zinc-300 max-w-md mx-auto leading-relaxed font-mono">
          Time expired before your squad could escape the Demon's Lair. The abyssal shadows have consumed the mission.
        </p>
      </div>

      {/* Team Details Panel */}
      <div className="w-full bg-zinc-950/90 border border-red-900/60 rounded-2xl p-6 shadow-2xl space-y-4 mb-8">
        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-zinc-800 text-center sm:text-left">
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Team Name</span>
            <div className="text-lg font-bold text-white truncate">{state.teamName || "Demon Slayers"}</div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Team Code</span>
            <div className="text-lg font-mono font-bold text-red-500">{state.teamCode}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 block uppercase text-[10px] mb-1">Player 1</span>
            <span className="text-zinc-200 font-semibold">{state.player1Name || "Player 1"}</span>
          </div>
          <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 block uppercase text-[10px] mb-1">Player 2</span>
            <span className="text-zinc-200 font-semibold">{state.player2Name || "Player 2"}</span>
          </div>
        </div>

        <div className="bg-red-950/40 border border-red-900/50 p-4 rounded-xl space-y-2 text-xs font-mono">
          <div className="flex justify-between items-center text-red-300">
            <span>Disqualification Reason:</span>
            <span className="font-bold text-red-400">Timer Reached 0:00</span>
          </div>
          <div className="flex justify-between items-center text-zinc-400">
            <span>Failed at Level:</span>
            <span className="font-bold text-white">Level {state.currentLevel}</span>
          </div>
          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-3 rounded-lg">
            <span className="text-zinc-400">Total Time Survived:</span>
            <span className="font-bold text-cyan-400">
              {Math.floor((state.totalTimeElapsed || 0) / 60)}m {(state.totalTimeElapsed || 0) % 60}s
            </span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleReturnToLobby}
        className="w-full bg-gradient-to-r from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-white font-mono text-sm py-4 rounded-xl font-bold transition-all shadow-xl shadow-red-950/60 flex items-center justify-center gap-3 border border-red-600/50"
      >
        <RotateCcw className="w-5 h-5" />
        RETURN TO LOBBY & RESTART MISSION
      </button>
    </div>
  );
};
