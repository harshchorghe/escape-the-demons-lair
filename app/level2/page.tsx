"use client";

import React, { useState, useEffect } from "react";
import { GameGameState, INITIAL_GAME_STATE, gameSync } from "@/lib/gameStore";
import { Level2Screen } from "@/components/screens/Level2Screen";
import { FinalLevelScreen } from "@/components/screens/FinalLevelScreen";
import { HeaderHUD } from "@/components/ui/HeaderHUD";
import { PythonConfigModal } from "@/components/ui/PythonConfigModal";
import { VictoryScreen } from "@/components/screens/VictoryScreen";
import { useRouter } from "next/navigation";
import { RotateCcw, Skull } from "lucide-react";

export default function Level2Page() {
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

  // Timer tick — only Level 2+ (Player 2's page manages Level 2 timer)
  useEffect(() => {
    if (gameState.gameStatus !== 'playing' || gameState.currentLevel !== 2) return;
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
    gameSync.updateState({ gameStatus: 'playing', timeRemaining: 180 });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-purple-900 selection:text-white font-sans">
      <HeaderHUD
        teamCode={gameState.teamCode}
        myRole="player2"
        currentLevel={gameState.currentLevel}
        timeRemaining={gameState.timeRemaining}
        totalTimeElapsed={gameState.totalTimeElapsed}
        timePenalties={gameState.timePenalties}
        onOpenPythonConfig={() => setIsPythonConfigOpen(true)}
      />

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Level 2: Demon Doors (shows locked screen until l1IsCompleted) */}
        {gameState.gameStatus === 'playing' && gameState.currentLevel >= 1 && gameState.currentLevel <= 2 && (
          <Level2Screen state={gameState} myRole="player2" />
        )}

        {/* Level 3: Final Throne Room */}
        {gameState.gameStatus === 'playing' && gameState.currentLevel === 3 && (
          <FinalLevelScreen state={gameState} myRole="player2" />
        )}

        {/* Victory */}
        {(gameState.gameStatus === 'victory' || gameState.currentLevel === 4) && (
          <VictoryScreen state={gameState} />
        )}

        {/* Game Over */}
        {gameState.gameStatus === 'gameover' && (
          <div className="w-full max-w-md bg-zinc-950/90 border border-purple-900/80 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-purple-950/80 border border-purple-700/60 flex items-center justify-center mx-auto text-purple-500 animate-pulse">
              <Skull className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-extrabold text-purple-400 font-serif">Time Expired!</h2>
            <p className="text-xs text-zinc-400">
              The Demon Doors sealed themselves before all ciphers were decoded.
            </p>
            <button
              onClick={handleRetry}
              className="w-full bg-purple-700 hover:bg-purple-600 text-white font-mono text-sm py-3 rounded-xl font-bold transition-all shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Retry Level 2
            </button>
          </div>
        )}
      </main>

      <footer className="w-full border-t border-zinc-900 bg-zinc-950 px-4 py-3 text-center text-xs font-mono text-zinc-600">
        Escape the Demon's Lair · Level 2: Demon Doors · {gameState.teamName || "Demon Slayers"}
      </footer>

      <PythonConfigModal isOpen={isPythonConfigOpen} onClose={() => setIsPythonConfigOpen(false)} />
    </div>
  );
}
