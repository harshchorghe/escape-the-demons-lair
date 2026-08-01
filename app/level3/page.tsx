"use client";

import React, { useState, useEffect } from "react";
import { GameGameState, INITIAL_GAME_STATE, gameSync } from "@/lib/gameStore";
import { FinalLevelScreen } from "@/components/screens/FinalLevelScreen";
import { HeaderHUD } from "@/components/ui/HeaderHUD";
import { PythonConfigModal } from "@/components/ui/PythonConfigModal";
import { VictoryScreen } from "@/components/screens/VictoryScreen";
import { DisqualifiedScreen } from "@/components/screens/DisqualifiedScreen";
import { useRouter } from "next/navigation";
import { Skull } from "lucide-react";

export default function Level3Page() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameGameState>(INITIAL_GAME_STATE);
  const [isPythonConfigOpen, setIsPythonConfigOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [myRole, setMyRole] = useState<'player1' | 'player2'>('player1');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = window.sessionStorage.getItem('my_role') as 'player1' | 'player2' | null;
      if (storedRole) setMyRole(storedRole);
    }

    const unsubscribe = gameSync.subscribe((state) => {
      setGameState(state);
      setIsLoaded(true);

      // Redirect back to lobby if game hasn't started
      if (state.gameStatus === 'lobby' && !state.teamCode) {
        router.replace('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Main Level 3 Synchronized Timer Tick (5-minute countdown for Final Level)
  useEffect(() => {
    if (gameState.gameStatus !== 'playing' || gameState.currentLevel !== 3) return;
    if (myRole !== 'player1') return; // Only Player 1 ticks the timer to prevent Firebase race conditions

    const interval = setInterval(() => {
      gameSync.updateState((prev) => {
        if (prev.gameStatus !== 'playing' || prev.currentLevel !== 3) return prev;

        const nextTime = prev.timeRemaining - 1;
        const nextTotal = prev.totalTimeElapsed + 1;
        const nextL3 = (prev.l3TimeElapsed || 0) + 1;

        if (nextTime <= 0) {
          return {
            timeRemaining: 0,
            totalTimeElapsed: nextTotal,
            l3TimeElapsed: nextL3,
            gameStatus: 'disqualified',
          };
        }

        return {
          timeRemaining: nextTime,
          totalTimeElapsed: nextTotal,
          l3TimeElapsed: nextL3,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.gameStatus, gameState.currentLevel]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-mono text-sm">
        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-6 py-4 rounded-xl shadow-2xl">
          <Skull className="w-5 h-5 text-red-500 animate-spin" style={{ animationDuration: '2s' }} />
          <span>Entering Final Level 3: Demon's Throne Room...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-red-900 selection:text-white font-sans">
      <HeaderHUD
        teamCode={gameState.teamCode}
        myRole={myRole}
        currentLevel={gameState.currentLevel}
        timeRemaining={gameState.timeRemaining}
        onOpenPythonConfig={() => setIsPythonConfigOpen(true)}
      />

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Active Final Throne Room Level 3 (Handles both locked state and active divided tasks) */}
        {gameState.gameStatus === 'playing' && (gameState.currentLevel === 3 || gameState.l1IsCompleted) && (
          <FinalLevelScreen state={gameState} myRole={myRole} />
        )}

        {/* Victory Screen */}
        {(gameState.gameStatus === 'victory' || gameState.currentLevel === 4) && (
          <VictoryScreen state={gameState} />
        )}

        {/* Automatic Disqualification / Game Over Screen */}
        {(gameState.gameStatus === 'disqualified' || gameState.gameStatus === 'gameover') && (
          <DisqualifiedScreen state={gameState} />
        )}
      </main>

      <footer className="w-full border-t border-zinc-900 bg-zinc-950 px-4 py-3 text-center text-xs font-mono text-zinc-600">
        Escape the Demon's Lair · Final Level 3: Throne Room · {gameState.teamName || "Demon Slayers"}
      </footer>

      <PythonConfigModal isOpen={isPythonConfigOpen} onClose={() => setIsPythonConfigOpen(false)} />
    </div>
  );
}
