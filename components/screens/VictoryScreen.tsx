"use client";

import React, { useEffect, useState } from "react";
import { GameGameState, gameSync } from "@/lib/gameStore";
import { saveTeamScore, getAllTeamsLeaderboard, LeaderboardEntry } from "@/lib/leaderboardService";
import confetti from "canvas-confetti";
import { Trophy, Clock, ShieldCheck, RotateCcw, Award } from "lucide-react";

interface VictoryScreenProps {
  state: GameGameState;
}

export const VictoryScreen: React.FC<VictoryScreenProps> = ({ state }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    // Trigger victory confetti burst!
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#ff0055", "#00ffff", "#ffcc00", "#9900ff"],
      });
    } catch {
      // Confetti fallback
    }

    const recordScoreAndFetch = async () => {
      const finalTotalTime = state.totalTimeElapsed || 0;

      // Save score to Firestore & Local storage with 3 levels completed!
      await saveTeamScore({
        teamCode: state.teamCode || 'LAIR-XX',
        teamName: state.teamName || 'Demon Slayers',
        player1: state.player1Name || 'Player 1',
        player2: state.player2Name || 'Player 2',
        levelsCompleted: 3,
        totalTimeSeconds: finalTotalTime,
        gameStatus: 'victory',
        date: new Date().toISOString().split('T')[0],
      });

      // Fetch updated ranked leaderboard
      const topData = await getAllTeamsLeaderboard(15);
      setLeaderboard(topData);
    };

    recordScoreAndFetch();
  }, [state.teamCode, state.teamName, state.player1Name, state.player2Name, state.totalTimeElapsed]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  const handlePlayAgain = () => {
    gameSync.updateState({
      gameStatus: 'lobby',
      teamCode: '',
      currentLevel: 1,
      l1CompletedRooms: [],
      l2UnlockedDoors: [],
      l3DestroyedCrystals: [],
      collectedSealFragments: 0,
      selectedSeal: null,
      isDemonSealed: false,
      l3TimeElapsed: 0,
      totalTimeElapsed: 0,
      timePenalties: 0,
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-8 flex flex-col items-center">
      {/* Trophy & Victory Banner */}
      <div className="text-center space-y-3">
        <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto text-amber-400 shadow-2xl shadow-amber-500/40 animate-bounce">
          <Trophy className="w-10 h-10" />
        </div>
        <div className="inline-flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/50 px-4 py-1.5 rounded-full text-emerald-300 font-mono text-xs uppercase tracking-widest">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Mission Complete • Demon Lord Defeated!
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white font-serif tracking-tight">
          Escaped the Demon's Lair!
        </h1>
        <p className="text-sm text-zinc-400 max-w-lg mx-auto">
          Through perfect co-op hand gesture spellcasting, code mastery, and team synergy, your team vanquished Malakor!
        </p>
      </div>

      {/* Mission Summary Stats Card */}
      <div className="w-full bg-zinc-950/90 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
        <h3 className="text-lg font-bold text-amber-400 font-mono flex items-center gap-2">
          <Award className="w-5 h-5" /> Team Escaped Mission Summary
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
            <span className="text-xs font-mono text-zinc-400 uppercase block">Team Code</span>
            <span className="text-lg font-mono font-bold text-white">{state.teamCode || 'LAIR-DEMO'}</span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
            <span className="text-xs font-mono text-zinc-400 uppercase block">Demons Slain</span>
            <span className="text-lg font-mono font-bold text-red-500 flex items-center justify-center gap-1">
              🔥 50 / 50
            </span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
            <span className="text-xs font-mono text-zinc-400 uppercase block">Total Time</span>
            <span className="text-lg font-mono font-bold text-cyan-400">
              {formatSeconds(state.totalTimeElapsed || 0)}
            </span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
            <span className="text-xs font-mono text-zinc-400 uppercase block">Level 3 Time</span>
            <span className="text-lg font-mono font-bold text-emerald-400">
              {formatSeconds(state.l3TimeElapsed || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Firebase / Local Leaderboard */}
      <div className="w-full bg-zinc-950/90 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-xl font-bold text-white font-serif flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" /> Shortest Time Leaderboard
          </h3>
          <span className="text-xs font-mono text-zinc-400">Firebase Firestore Ranked</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800 uppercase">
                <th className="pb-2">Rank</th>
                <th className="pb-2">Team Code</th>
                <th className="pb-2">Players</th>
                <th className="pb-2 text-right">Completion Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {leaderboard.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`text-zinc-300 ${
                    item.teamCode === state.teamCode ? 'bg-amber-950/40 text-amber-200 font-bold' : ''
                  }`}
                >
                  <td className="py-3 flex items-center gap-2">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </td>
                  <td className="py-3 text-red-400 font-bold">{item.teamCode}</td>
                  <td className="py-3">{item.player1} & {item.player2}</td>
                  <td className="py-3 text-right font-bold text-emerald-400">
                    <Clock className="w-3.5 h-3.5 inline mr-1" />
                    {formatSeconds(item.totalTimeSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restart Button */}
      <button
        onClick={handlePlayAgain}
        className="bg-red-700 hover:bg-red-600 text-white font-mono text-sm px-8 py-3.5 rounded-xl font-bold transition-all shadow-xl shadow-red-950/60 flex items-center gap-2"
      >
        <RotateCcw className="w-4 h-4" /> Start New Mission
      </button>
    </div>
  );
};
