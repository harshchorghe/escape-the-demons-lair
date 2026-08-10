"use client";

import React, { useState, useEffect } from "react";
import { puzzleService } from "@/lib/puzzleService";
import { getAllTeamsLeaderboard, LeaderboardEntry } from "@/lib/leaderboardService";
import { Shield, Sparkles, RefreshCw, CheckCircle2, AlertCircle, Database, DoorOpen, Trophy, Clock, Users, XCircle, Award } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
  const [loading, setLoading] = useState<{ [key: number]: boolean }>({});
  const [messages, setMessages] = useState<{ [key: number]: { success: boolean; text: string } }>({});
  const [storedSets, setStoredSets] = useState<{ 1: any[]; 3: any[] }>({ 1: [], 3: [] });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const loadAllStored = async () => {
    const s1 = await puzzleService.fetchAllStoredSets(1);
    const s3 = await puzzleService.fetchAllStoredSets(3);
    setStoredSets({ 1: s1, 3: s3 });
  };

  const loadLeaderboard = async () => {
    setLoadingLeaderboard(true);
    const data = await getAllTeamsLeaderboard(50);
    setLeaderboard(data);
    setLoadingLeaderboard(false);
  };

  useEffect(() => {
    loadAllStored();
    loadLeaderboard();
  }, []);

  const handleSeedLevel = async (level: 1 | 3) => {
    setLoading((prev) => ({ ...prev, [level]: true }));
    setMessages((prev) => ({ ...prev, [level]: { success: true, text: `Generating 10 Question Sets via Gemini AI...` } }));

    const res = await puzzleService.seedLevelPuzzles(level, 10);

    setLoading((prev) => ({ ...prev, [level]: false }));
    if (res.count > 0) {
      setMessages((prev) => ({ ...prev, [level]: { success: true, text: res.message } }));
      loadAllStored();
    } else {
      setMessages((prev) => ({ ...prev, [level]: { success: false, text: res.message } }));
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-red-900 selection:text-white">
      {/* Top Header Bar */}
      <header className="w-full bg-zinc-950/90 border-b border-red-900/50 px-6 py-4 sticky top-0 z-40 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-red-950/80 border border-red-700/60 px-3 py-1.5 rounded-xl text-red-400 font-mono text-xs uppercase tracking-widest font-bold">
            <Shield className="w-4 h-4 text-red-500 animate-pulse" />
            ADMIN CONTROL PANEL
          </div>
          <h1 className="text-xl font-bold text-white font-serif hidden sm:block">
            Gemini AI Question Generator &amp; Global Leaderboard
          </h1>
        </div>

        <Link
          href="/"
          className="text-xs font-mono text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 bg-zinc-900 px-4 py-2 rounded-xl transition-all"
        >
          ← Return to Game Lobby
        </Link>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-8">
        {/* Title Header */}
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-purple-950/60 border border-purple-800/60 px-4 py-1.5 rounded-full text-purple-300 font-mono text-xs uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Google Gemini AI Dynamic Question Engine
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white font-serif">
            Firestore Admin Control Dashboard
          </h2>
          <p className="text-sm text-zinc-400">
            Manage question sets, seed AI dynamic content, and inspect confidential team leaderboard rankings.
          </p>
        </div>

        {/* --- DEDICATED ADMIN LEADERBOARD SECTION --- */}
        <div className="bg-zinc-950/90 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-500/50 flex items-center justify-center text-amber-400">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white font-serif flex items-center gap-2">
                  Global Game Leaderboard &amp; Rankings
                </h3>
                <p className="text-xs text-zinc-400 font-mono">
                  Confidential Admin View • Ranked by lowest total completion time
                </p>
              </div>
            </div>

            <button
              onClick={loadLeaderboard}
              disabled={loadingLeaderboard}
              className="text-xs font-mono text-amber-300 hover:text-white flex items-center gap-1.5 bg-amber-950/60 border border-amber-500/40 hover:bg-amber-900/60 px-4 py-2 rounded-xl transition-all font-bold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLeaderboard ? 'animate-spin' : ''}`} />
              Refresh Leaderboard
            </button>
          </div>

          <div className="overflow-x-auto">
            {leaderboard.length === 0 ? (
              <div className="p-8 bg-zinc-900/60 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-500 text-center">
                {loadingLeaderboard ? "Loading leaderboard rankings..." : "No team scores recorded in Firestore yet."}
              </div>
            ) : (
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800 uppercase tracking-wider text-[11px]">
                    <th className="pb-3 px-3">Rank</th>
                    <th className="pb-3 px-3">Team Code</th>
                    <th className="pb-3 px-3">Team Name</th>
                    <th className="pb-3 px-3">Department</th>
                    <th className="pb-3 px-3">Phone</th>
                    <th className="pb-3 px-3">Players</th>
                    <th className="pb-3 px-3 text-center">Levels Cleared</th>
                    <th className="pb-3 px-3 text-center">Status</th>
                    <th className="pb-3 px-3 text-right">Completion Time</th>
                    <th className="pb-3 px-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {leaderboard.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-zinc-900/60 transition-colors text-zinc-300">
                      <td className="py-3.5 px-3 font-bold">
                        {idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `#${idx + 1}`}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-red-400">{item.teamCode}</td>
                      <td className="py-3.5 px-3 text-white font-semibold">{item.teamName || 'Demon Slayers'}</td>
                      <td className="py-3.5 px-3 text-purple-300 font-medium">{item.department || '—'}</td>
                      <td className="py-3.5 px-3 text-amber-300 font-mono">{item.phoneNumber || '—'}</td>
                      <td className="py-3.5 px-3 text-zinc-400">
                        {item.player1} &amp; {item.player2}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold">
                        <span className="bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg text-zinc-300">
                          {item.levelsCompleted || 0} / 3
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {item.gameStatus === 'victory' || item.levelsCompleted === 3 ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-950/60 border border-emerald-600/40 text-emerald-400 text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> VICTORY
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-red-950/60 border border-red-700/40 text-red-400 text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" /> DISQUALIFIED
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-cyan-400">
                        <Clock className="w-3.5 h-3.5 inline mr-1" />
                        {formatSeconds(item.totalTimeSeconds)}
                      </td>
                      <td className="py-3.5 px-3 text-right text-zinc-500 text-[11px]">
                        {item.date || 'Today'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 3 Level Generator Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Level 1 Card */}
          <div className="bg-zinc-950/90 border border-red-900/60 rounded-2xl p-6 shadow-2xl flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-700/50 flex items-center justify-center text-red-400 text-2xl">
                  🔮
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
                  {storedSets[1].length} / 10 Sets Stored
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Level 1: Haunted Rooms</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  10 Sets of logic puzzles, spectral riddles, and Python prime code challenges.
                </p>
              </div>

              {messages[1] && (
                <div className={`p-3 rounded-xl text-xs font-mono border flex items-start gap-2 ${
                  messages[1].success
                    ? 'bg-emerald-950/60 border-emerald-600/40 text-emerald-300'
                    : 'bg-red-950/60 border-red-600/40 text-red-300'
                }`}>
                  {messages[1].success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  {messages[1].text}
                </div>
              )}
            </div>

            <button
              onClick={() => handleSeedLevel(1)}
              disabled={loading[1]}
              className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-mono text-xs py-3.5 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading[1] ? 'animate-spin' : ''}`} />
              {loading[1] ? "Generating Level 1 Sets..." : "Fetch & Seed Level 1 Q/A"}
            </button>
          </div>

          {/* Level 2 Card (Door Choice Mode — No Q/A Required) */}
          <div className="bg-zinc-950/90 border border-purple-900/60 rounded-2xl p-6 shadow-2xl flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-purple-950/80 border border-purple-700/50 flex items-center justify-center text-purple-400 text-2xl">
                  🩸
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-purple-950 border border-purple-800 text-purple-300">
                  Door Choice Mode
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Level 2: Demon Doors</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Player 2 chooses between 3 Demon Doors (Blood Moon, Soul Chains, Abyssal Portal).
                </p>
              </div>

              <div className="p-3 bg-purple-950/40 border border-purple-800/40 rounded-xl text-xs font-mono text-purple-300 flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-purple-400 shrink-0" />
                Pure door choice mode — No Q/A generation required!
              </div>
            </div>

            <div className="w-full bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono text-xs py-3 rounded-xl font-bold text-center">
              Active Door Selection Engine
            </div>
          </div>

          {/* Level 3 Card */}
          <div className="bg-zinc-950/90 border border-cyan-900/60 rounded-2xl p-6 shadow-2xl flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-700/50 flex items-center justify-center text-cyan-400 text-2xl">
                  ⚡
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
                  {storedSets[3].length} / 10 Sets Stored
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Level 3: Throne Room</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  10 Sets of Inferno, Shadow, Thunder, and Void elemental crystal tasks.
                </p>
              </div>

              {messages[3] && (
                <div className={`p-3 rounded-xl text-xs font-mono border flex items-start gap-2 ${
                  messages[3].success
                    ? 'bg-emerald-950/60 border-emerald-600/40 text-emerald-300'
                    : 'bg-red-950/60 border-red-600/40 text-red-300'
                }`}>
                  {messages[3].success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  {messages[3].text}
                </div>
              )}
            </div>

            <button
              onClick={() => handleSeedLevel(3)}
              disabled={loading[3]}
              className="w-full bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-mono text-xs py-3.5 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading[3] ? 'animate-spin' : ''}`} />
              {loading[3] ? "Generating Level 3 Sets..." : "Fetch & Seed Level 3 Q/A"}
            </button>
          </div>
        </div>

        {/* Firestore Question Sets Inspection View */}
        <div className="bg-zinc-950/90 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-400" />
              <h3 className="text-xl font-bold text-white font-serif">Firestore Stored Question Sets Preview</h3>
            </div>
            <button
              onClick={loadAllStored}
              className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Preview
            </button>
          </div>

          <div className="space-y-6">
            {[1, 3].map((lvl) => (
              <div key={lvl} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-mono font-bold uppercase tracking-wider text-amber-400">
                    Level {lvl} Question Sets ({storedSets[lvl as 1|3].length} Sets in Firestore)
                  </h4>
                </div>

                {storedSets[lvl as 1|3].length === 0 ? (
                  <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-500 text-center">
                    No question sets stored in Firestore collection <code>level{lvl}_puzzles</code> yet. Click the button above to generate &amp; seed!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    {storedSets[lvl as 1|3].map((item: any) => (
                      <div key={item.id} className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="font-bold text-white uppercase">{item.id}</span>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            {lvl === 1 ? `${item.rooms?.length || 3} Rooms` : `${item.crystals?.length || 4} Crystals`}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-zinc-400 truncate">
                          {lvl === 1
                            ? item.rooms?.[0]?.puzzle?.title || 'Logic Set'
                            : item.crystals?.[0]?.puzzle?.title || 'Crystal Set'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

