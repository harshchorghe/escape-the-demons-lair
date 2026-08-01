"use client";

import React, { useEffect, useState } from "react";
import { LeaderboardEntry, getAllTeamsLeaderboard } from "@/lib/leaderboardService";
import { Trophy, Clock, X, Flame, RefreshCw, Zap, Award, CheckCircle2, ShieldAlert } from "lucide-react";

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTeamCode?: string;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentTeamCode,
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchScores = async () => {
    setIsLoading(true);
    const data = await getAllTeamsLeaderboard(30);
    setLeaderboard(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchScores();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-zinc-950 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-zinc-900/90 border-b border-zinc-800 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-serif text-white flex items-center gap-2">
                Demon's Lair Global Leaderboard
              </h2>
              <p className="text-xs font-mono text-zinc-400">
                Top Ranks: <strong className="text-amber-400">3/3 Levels Completed</strong> sorted by <strong className="text-emerald-400">Fastest Time</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchScores}
              title="Refresh Leaderboard"
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="py-12 text-center font-mono text-xs text-zinc-400 space-y-2">
              <Flame className="w-6 h-6 text-amber-500 animate-bounce mx-auto" />
              <span>Fetching live team standings from Firestore...</span>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="py-12 text-center font-mono text-xs text-zinc-500 space-y-2">
              <Trophy className="w-8 h-8 text-zinc-700 mx-auto" />
              <p>No teams recorded in the database yet.</p>
              <p className="text-[11px] text-zinc-600">Be the first squad to escape all 3 levels!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800 uppercase tracking-wider text-[11px]">
                    <th className="pb-3 px-2">Rank</th>
                    <th className="pb-3 px-2">Team</th>
                    <th className="pb-3 px-2">Squad Players</th>
                    <th className="pb-3 px-2 text-center">Levels Cleared</th>
                    <th className="pb-3 px-2 text-right">Total Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {leaderboard.map((entry, idx) => {
                    const isMyTeam = currentTeamCode && entry.teamCode === currentTeamCode;
                    const levels = entry.levelsCompleted || (entry.gameStatus === 'victory' ? 3 : 0);

                    return (
                      <tr
                        key={entry.id || idx}
                        className={`transition-all ${
                          isMyTeam
                            ? "bg-amber-950/40 text-amber-200 font-bold border-l-2 border-amber-400"
                            : levels === 3 && idx === 0
                            ? "bg-amber-500/10 text-amber-300 font-bold"
                            : levels === 3
                            ? "bg-zinc-900/80 text-zinc-200 font-semibold"
                            : "text-zinc-400 hover:bg-zinc-900/50"
                        }`}
                      >
                        {/* Rank Column */}
                        <td className="py-3 px-2 font-bold">
                          {levels === 3 && idx === 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-black text-sm">
                              🥇 #1
                            </span>
                          ) : levels === 3 && idx === 1 ? (
                            <span className="inline-flex items-center gap-1 text-zinc-300 font-bold">
                              🥈 #2
                            </span>
                          ) : levels === 3 && idx === 2 ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                              🥉 #3
                            </span>
                          ) : (
                            <span className="text-zinc-500">#{idx + 1}</span>
                          )}
                        </td>

                        {/* Team Column */}
                        <td className="py-3 px-2">
                          <div className="font-bold text-white max-w-[130px] truncate">
                            {entry.teamName || "Demon Slayers"}
                          </div>
                          <div className="text-[10px] text-red-400 font-mono font-bold">
                            {entry.teamCode}
                          </div>
                        </td>

                        {/* Players Column */}
                        <td className="py-3 px-2 text-zinc-300 max-w-[140px] truncate">
                          {entry.player1 || "P1"} & {entry.player2 || "P2"}
                        </td>

                        {/* Levels Completed Column */}
                        <td className="py-3 px-2 text-center">
                          {levels === 3 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-emerald-950 border border-emerald-600/60 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              3/3 FULL ESCAPE
                            </span>
                          ) : levels === 2 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-purple-950 border border-purple-700/50 text-purple-300 px-2.5 py-0.5 rounded-full font-bold">
                              2/3 Levels
                            </span>
                          ) : levels === 1 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-zinc-900 border border-zinc-700 text-zinc-300 px-2.5 py-0.5 rounded-full">
                              1/3 Levels
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-red-950 border border-red-900 text-red-400 px-2.5 py-0.5 rounded-full">
                              <ShieldAlert className="w-3 h-3 text-red-500" />
                              Disqualified
                            </span>
                          )}
                        </td>

                        {/* Total Time Column */}
                        <td className="py-3 px-2 text-right font-bold text-emerald-400">
                          <Clock className="w-3.5 h-3.5 inline mr-1 text-emerald-500" />
                          {formatTime(entry.totalTimeSeconds)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-zinc-900/90 border-t border-zinc-800 px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-zinc-400">
          <span className="flex items-center gap-1 text-amber-400 font-bold">
            <Zap className="w-3.5 h-3.5" />
            Requirement: Complete all 3 levels to claim top ranks!
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition-all cursor-pointer"
          >
            Close Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
};
