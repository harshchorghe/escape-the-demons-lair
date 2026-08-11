"use client";

import React, { useEffect } from "react";
import { GameGameState, gameSync } from "@/lib/gameStore";
import { saveTeamScore } from "@/lib/leaderboardService";
import { Skull, AlertOctagon, RotateCcw, Flame, Clock, Hourglass } from "lucide-react";
import { useRouter } from "next/navigation";

interface DisqualifiedScreenProps {
  state: GameGameState;
}

export const DisqualifiedScreen: React.FC<DisqualifiedScreenProps> = ({ state }) => {
  const router = useRouter();

  const isLevel3TimeUp = state.currentLevel === 3;

  useEffect(() => {
    const recordScoreOrFail = async () => {
      const rankTime = state.totalTimeElapsed || 0;

      await saveTeamScore({
        teamCode: state.teamCode || 'LAIR-RUN',
        teamName: state.teamName || 'Demon Slayers',
        player1: state.player1Name || 'Player 1',
        player2: state.player2Name || 'Player 2',
        phoneNumber: state.phoneNumber || '',
        department: state.department || '',
        levelsCompleted: isLevel3TimeUp ? 2 : (state.currentLevel > 1 ? state.currentLevel - 1 : 0),
        totalTimeSeconds: rankTime,
        gameStatus: 'disqualified',
        date: new Date().toISOString().split('T')[0],
      });
    };

    recordScoreOrFail();
  }, [state.teamCode, state.teamName, state.player1Name, state.player2Name, state.phoneNumber, state.department, state.currentLevel, state.totalTimeElapsed, isLevel3TimeUp]);

  const handleReturnToLobby = () => {
    gameSync.resetGame();
    router.push('/');
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center py-10 px-4">
      {/* Icon */}
      <div className="relative mb-6">
        {isLevel3TimeUp ? (
          <div className="w-28 h-28 rounded-full bg-amber-950/80 border-4 border-amber-500/80 flex items-center justify-center shadow-2xl shadow-amber-950 animate-pulse">
            <Hourglass className="w-14 h-14 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
        ) : (
          <div className="w-28 h-28 rounded-full bg-red-950/80 border-4 border-red-700/80 flex items-center justify-center shadow-2xl shadow-red-950 animate-pulse">
            <Skull className="w-16 h-16 text-red-500" />
          </div>
        )}
        <Flame className="w-6 h-6 text-orange-500 absolute -top-3 -right-2 animate-bounce" />
        <Flame className="w-5 h-5 text-red-600 absolute -bottom-2 -left-2 animate-bounce delay-100" />
      </div>

      {/* Header Banner */}
      <div className="text-center space-y-3 mb-8">
        {isLevel3TimeUp ? (
          <>
            <div className="inline-flex items-center gap-2 bg-amber-950 border border-amber-700 px-4 py-1 rounded-full text-amber-300 font-mono text-xs uppercase tracking-widest">
              <Clock className="w-4 h-4 text-amber-400" />
              MISSION TIME UP
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-amber-500 font-serif tracking-tight drop-shadow-lg">
              TIME UP!
            </h1>
            <p className="text-sm text-zinc-300 max-w-md mx-auto leading-relaxed font-mono">
              The Level 3 Throne Room battle timer has expired. Your total mission time survived and stats have been saved to the leaderboard!
            </p>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Team Details Panel */}
      <div className="w-full bg-zinc-950/90 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 mb-8">
        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-zinc-800 text-center sm:text-left">
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Team Name</span>
            <div className="text-lg font-bold text-white truncate">{state.teamName || "Demon Slayers"}</div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Team Code</span>
            <div className="text-lg font-mono font-bold text-amber-400">{state.teamCode}</div>
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

        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl space-y-2 text-xs font-mono">
          <div className="flex justify-between items-center text-zinc-300">
            <span>Status / Outcome:</span>
            <span className={`font-bold ${isLevel3TimeUp ? 'text-amber-400' : 'text-red-400'}`}>
              {isLevel3TimeUp ? 'Level 3 Time Expired' : 'Timer Reached 0:00'}
            </span>
          </div>
          <div className="flex justify-between items-center text-zinc-400">
            <span>Reached Level:</span>
            <span className="font-bold text-white">Level 3: Throne Room</span>
          </div>
          <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 p-3 rounded-lg">
            <span className="text-zinc-400">Total Mission Time Recorded:</span>
            <span className="font-bold text-cyan-400">
              {Math.floor((state.totalTimeElapsed || 0) / 60)}m {(state.totalTimeElapsed || 0) % 60}s
            </span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleReturnToLobby}
        className={`w-full font-mono text-sm py-4 rounded-xl font-bold transition-all shadow-xl flex items-center justify-center gap-3 border ${
          isLevel3TimeUp
            ? 'bg-gradient-to-r from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-white border-amber-500/50 shadow-amber-950/60'
            : 'bg-gradient-to-r from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-white border-red-600/50 shadow-red-950/60'
        }`}
      >
        <RotateCcw className="w-5 h-5" />
        RETURN TO LOBBY & RESTART MISSION
      </button>
    </div>
  );
};
