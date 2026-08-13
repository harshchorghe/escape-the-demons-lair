"use client";

import React, { useState } from "react";
import BackgroundVideo from "@/components/3d/BackgroundVideo";
import { useVideoSrc } from "@/hooks/useVideoSrc";
import { Lock, KeyRound, ShieldAlert, Eye, EyeOff, ArrowRight } from "lucide-react";

interface PasswordScreenProps {
  onAuthenticated: () => void;
}

export const PasswordScreen: React.FC<PasswordScreenProps> = ({ onAuthenticated }) => {
  const videoSrc = useVideoSrc('lobby', '/videos/login.mp4');
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const CORRECT_PASSWORD = "Harsh@11viva";

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passwordInput.trim()) {
      setErrorMsg("Please enter the security password.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    setTimeout(() => {
      if (passwordInput === CORRECT_PASSWORD) {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem("game_authenticated", "true");
        }
        onAuthenticated();
      } else {
        setErrorMsg("Access Denied: Incorrect Password!");
        setIsSubmitting(false);
      }
    }, 300);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 selection:bg-red-900 selection:text-white font-sans overflow-hidden">
      <BackgroundVideo src={videoSrc} />
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs z-10" />

      <div className="relative z-20 w-full max-w-md">
        <div className="bg-zinc-950/90 border border-red-900/60 rounded-3xl p-8 shadow-2xl shadow-red-950/40 backdrop-blur-md transition-all">
          {/* Top Header Badge */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-red-950/80 border border-red-700/50 px-4 py-1.5 rounded-full text-red-400 font-mono text-xs uppercase tracking-widest mb-4">
              <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
              Security Gateway Locked
            </div>

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-950 to-zinc-900 border border-red-600/50 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-950/60">
              <Lock className="w-8 h-8 text-red-400 animate-pulse" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-serif tracking-tight drop-shadow-md">
              Demon's Lair Access
            </h1>
            <p className="text-xs text-zinc-400 mt-2 font-sans">
              Enter the master access password to unlock the lobby and start mission control.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-zinc-300 uppercase mb-2 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-red-400" /> Passcode Authentication
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter Password..."
                  className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 text-white font-mono text-sm px-4 py-3 rounded-xl outline-none transition-all pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/90 border border-red-600/60 rounded-xl text-xs font-mono text-red-300 text-center animate-shake flex items-center justify-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white font-mono text-sm py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-950/60 flex items-center justify-center gap-2 cursor-pointer border border-red-500/30 active:scale-[0.99]"
            >
              {isSubmitting ? (
                <span>Verifying Access...</span>
              ) : (
                <>
                  Unlock Lair Lobby <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Note */}
          <div className="mt-6 pt-4 border-t border-zinc-900 text-center">
            <p className="text-[11px] font-mono text-zinc-500">
              Escape the Demon's Lair · Password Guard Enabled
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
