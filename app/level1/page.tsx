"use client";

import React, { useState, useEffect } from "react";
import { GameGameState, INITIAL_GAME_STATE, gameSync } from "@/lib/gameStore";
import { Level1Screen } from "@/components/screens/Level1Screen";
import { HeaderHUD } from "@/components/ui/HeaderHUD";
import { PythonConfigModal } from "@/components/ui/PythonConfigModal";
import { VictoryScreen } from "@/components/screens/VictoryScreen";
import { useRouter } from "next/navigation";
import { RotateCcw, Skull } from "lucide-react";

export default function Level1Page() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameGameState>(INITIAL_GAME_STATE);
  const [isPythonConfigOpen, setIsPythonConfigOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = gameSync.subscribe((state) => {
      setGameState(state);

      // Redirect back to lobby if game hasn't started
      if (state.gameStatus === 'lobby') {
        router.replace('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Timer tick for Level 1
  useEffect(() => {
    if (gameState.gameStatus !== 'playing' || gameState.currentLevel !== 1) return;
    const interval = setInterval(() => {
      gameSync.updateState((prev) => {
        if (prev.gameStatus !== 'playing') return prev;
        const nextTime = prev.timeRemaining - 1;
        const nextTotal = prev.totalTimeElapsed + 1;
        if (nextTime <= 0) {
          return { ...prev, timeRemaining: 0, totalTimeElapsed: nextTotal, gameStatus: 'gameover' };
        }
        return { ...prev, timeRemaining: nextTime, totalTimeElapsed: nextTotal };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState.gameStatus, gameState.currentLevel]);

  const handleRetry = () => {
    gameSync.updateState({ gameStatus: 'playing', timeRemaining: 120 });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-red-900 selection:text-white font-sans">
      <HeaderHUD
        teamCode={gameState.teamCode}
        myRole="player1"
        currentLevel={gameState.currentLevel}
        timeRemaining={gameState.timeRemaining}
        totalTimeElapsed={gameState.totalTimeElapsed}
        timePenalties={gameState.timePenalties}
        onOpenPythonConfig={() => setIsPythonConfigOpen(true)}
      />

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {gameState.gameStatus === 'playing' && gameState.currentLevel === 1 && (
          <Level1Screen state={gameState} myRole="player1" />
        )}

        {gameState.gameStatus === 'playing' && gameState.currentLevel === 2 && (
          <div className="w-full max-w-md text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center mx-auto text-emerald-500">
              <Skull className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-extrabold text-emerald-400 font-serif">Level 1 Complete!</h2>
            <p className="text-sm text-zinc-400">
              All Haunted Rooms cleared. Player 2's Demon Doors have been unlocked.
            </p>
            <p className="text-xs text-zinc-500 font-mono">
              Waiting for Player 2 to complete Level 2 before entering the Throne Room...
            </p>
          </div>
        )}

        {(gameState.gameStatus === 'victory' || gameState.currentLevel === 4) && (
          <VictoryScreen state={gameState} />
        )}

        {gameState.gameStatus === 'gameover' && (
          <div className="w-full max-w-md bg-zinc-950/90 border border-red-900/80 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-950/80 border border-red-700/60 flex items-center justify-center mx-auto text-red-500 animate-pulse">
              <Skull className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-extrabold text-red-500 font-serif">Time Expired!</h2>
            <p className="text-xs text-zinc-400">
              The darkness consumed the Haunted Rooms before all chambers were cleared.
            </p>
            <button
              onClick={handleRetry}
              className="w-full bg-red-700 hover:bg-red-600 text-white font-mono text-sm py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-950/50 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Retry Level 1
            </button>
          </div>
        )}
      </main>

      <footer className="w-full border-t border-zinc-900 bg-zinc-950 px-4 py-3 text-center text-xs font-mono text-zinc-600">
        Escape the Demon's Lair · Level 1: Haunted Rooms · {gameState.teamName || "Demon Slayers"}
      </footer>

      <PythonConfigModal isOpen={isPythonConfigOpen} onClose={() => setIsPythonConfigOpen(false)} />
    </div>
  );
}
