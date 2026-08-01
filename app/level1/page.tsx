"use client";

import React, { useState, useEffect } from "react";
import { GameGameState, INITIAL_GAME_STATE, gameSync } from "@/lib/gameStore";
import { Level1Screen } from "@/components/screens/Level1Screen";
import { FinalLevelScreen } from "@/components/screens/FinalLevelScreen";
import { HeaderHUD } from "@/components/ui/HeaderHUD";
import { PythonConfigModal } from "@/components/ui/PythonConfigModal";
import { VictoryScreen } from "@/components/screens/VictoryScreen";
import { DisqualifiedScreen } from "@/components/screens/DisqualifiedScreen";
import { useRouter } from "next/navigation";
import { Skull } from "lucide-react";

export default function Level1Page() {
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

      // Redirect back to lobby if game hasn't been created or is reset to lobby
      if (state.gameStatus === 'lobby' && !state.teamCode) {
        router.replace('/');
      }

      // Redirect to Level 3 when Level 1 is completed or level advances
      if (state.gameStatus === 'playing' && (state.currentLevel === 3 || state.l1IsCompleted)) {
        router.replace('/level3');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Level 1 Timer Tick (2-minute countdown) - Hosted by Player 1
  useEffect(() => {
    if (gameState.gameStatus !== 'playing' || gameState.currentLevel !== 1) return;
    if (myRole !== 'player1') return; // Only Player 1 ticks the timer to prevent Firebase race conditions

    const interval = setInterval(() => {
      gameSync.updateState((prev) => {
        if (prev.gameStatus !== 'playing' || prev.currentLevel !== 1) return prev;

        const nextTime = prev.timeRemaining - 1;
        const nextTotal = prev.totalTimeElapsed + 1;

        if (nextTime <= 0) {
          return {
            timeRemaining: 0,
            totalTimeElapsed: nextTotal,
            gameStatus: 'disqualified',
          };
        }

        return {
          timeRemaining: nextTime,
          totalTimeElapsed: nextTotal,
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
          <span>Entering Level 1: Haunted Rooms...</span>
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
        {/* Active Level 1 Screen */}
        {gameState.gameStatus === 'playing' && gameState.currentLevel === 1 && (
          <Level1Screen state={gameState} myRole={myRole} />
        )}

        {/* Level 1 Completed — Awaiting Player 2 on Level 2 */}
        {gameState.gameStatus === 'playing' && gameState.currentLevel === 2 && (
          <div className="w-full max-w-md text-center space-y-6 bg-zinc-950/90 border border-emerald-900/60 rounded-2xl p-8 shadow-2xl">
            <div className="relative w-20 h-20 mx-auto">
              <div className="w-20 h-20 rounded-full bg-emerald-950/80 border-2 border-emerald-600/60 flex items-center justify-center">
                <Skull className="w-9 h-9 text-emerald-400" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                <span className="text-black text-xs font-extrabold">✓</span>
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-emerald-400 font-serif">Level 1 Cleared!</h2>
              <p className="text-sm text-zinc-400 mt-2">
                The Haunted Chambers have been conquered!
              </p>
            </div>
            <div className="space-y-2">
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 font-mono">
                ✅ Player 1 mission complete — {gameState.l1CompletedRooms.length}/2 rooms cleared
              </div>
              <div className="p-3 bg-purple-950/40 border border-purple-800/40 rounded-xl text-xs text-purple-300 font-mono animate-pulse">
                ⏳ Waiting for Player 2 to navigate the Demon Doors...
              </div>
            </div>
            <p className="text-xs text-zinc-500 font-mono">
              The final level unlocks when Player 2 escapes Level 2.
            </p>
          </div>
        )}

        {/* Level 3: Final Throne Room */}
        {gameState.gameStatus === 'playing' && gameState.currentLevel === 3 && (
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
        Escape the Demon's Lair · Level 1: Haunted Rooms · {gameState.teamName || "Demon Slayers"}
      </footer>

      <PythonConfigModal isOpen={isPythonConfigOpen} onClose={() => setIsPythonConfigOpen(false)} />
    </div>
  );
}
