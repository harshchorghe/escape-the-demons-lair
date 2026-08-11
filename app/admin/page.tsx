"use client";

import React, { useState, useEffect } from "react";
import { getAllTeamsLeaderboard, subscribeToLeaderboard, LeaderboardEntry } from "@/lib/leaderboardService";
import { Shield, RefreshCw, CheckCircle2, Trophy, Clock, XCircle, Lock, KeyRound, Eye, EyeOff, LogOut } from "lucide-react";
import Link from "next/link";

const ADMIN_PASSWORD = "Harsh@viva1136";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedAuth = sessionStorage.getItem("demons_lair_admin_auth");
      if (storedAuth === "true") {
        setIsAuthenticated(true);
      }
    }
  }, []);

  const loadLeaderboard = async () => {
    setLoadingLeaderboard(true);
    const data = await getAllTeamsLeaderboard(50);
    setLeaderboard(data);
    setLoadingLeaderboard(false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadLeaderboard();
      const unsubscribe = subscribeToLeaderboard((data) => {
        setLeaderboard(data);
      });
      return () => unsubscribe();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setErrorMsg("");
      if (typeof window !== "undefined") {
        sessionStorage.setItem("demons_lair_admin_auth", "true");
      }
    } else {
      setErrorMsg("Access Denied: Invalid Master Admin Password.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPasswordInput("");
    setErrorMsg("");
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("demons_lair_admin_auth");
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  // ── 1. PASSWORD AUTHENTICATION SCREEN ──
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 font-sans selection:bg-red-900 selection:text-white">
        <div className="w-full max-w-md bg-zinc-950/90 border border-red-900/60 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-700/60 flex items-center justify-center text-red-500 mx-auto shadow-lg shadow-red-950/50">
              <Lock className="w-8 h-8" />
            </div>
            <div className="inline-flex items-center gap-1.5 bg-red-950/60 border border-red-700/50 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase text-red-400">
              <Shield className="w-3.5 h-3.5" /> Restricted Access
            </div>
            <h2 className="text-2xl font-bold text-white font-serif">Admin Authentication</h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
              Please enter the master administrator password to access the Global Leaderboard.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-zinc-300 uppercase mb-1.5">
                Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter admin password..."
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-500 text-zinc-100 font-mono text-sm px-4 py-3 rounded-xl outline-none pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/80 border border-red-600/50 rounded-xl text-xs font-mono text-red-300 text-center">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-red-700 hover:bg-red-600 text-white font-mono text-sm py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" /> Unlock Admin Dashboard
            </button>
          </form>

          <div className="pt-2 text-center border-t border-zinc-900">
            <Link
              href="/"
              className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors inline-block"
            >
              ← Return to Game Lobby
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. AUTHENTICATED ADMIN DASHBOARD ──
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
            Global Game Leaderboard &amp; Rankings
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="text-xs font-mono text-red-400 hover:text-red-300 border border-red-900/60 hover:border-red-700 bg-red-950/40 px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Lock Admin
          </button>

          <Link
            href="/"
            className="text-xs font-mono text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 bg-zinc-900 px-4 py-2 rounded-xl transition-all"
          >
            ← Return to Game Lobby
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-8">
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
      </main>
    </div>
  );
}
