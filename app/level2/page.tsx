"use client";

import React, { useState, useEffect } from "react";
import { GameGameState, INITIAL_GAME_STATE, gameSync } from "@/lib/gameStore";
import { useGameTimer } from "@/hooks/useGameTimer";
import { Level2Screen } from "@/components/screens/Level2Screen";
import { FinalLevelScreen } from "@/components/screens/FinalLevelScreen";
import { HeaderHUD } from "@/components/ui/HeaderHUD";
import { PythonConfigModal } from "@/components/ui/PythonConfigModal";
import { VictoryScreen } from "@/components/screens/VictoryScreen";
import { DisqualifiedScreen } from "@/components/screens/DisqualifiedScreen";
import BackgroundVideo from "@/components/3d/BackgroundVideo";
import { useRouter } from "next/navigation";
import { Skull } from "lucide-react";

export default function Level2Page() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameGameState>(INITIAL_GAME_STATE);
  const [isPythonConfigOpen, setIsPythonConfigOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [myRole, setMyRole] = useState<'player1' | 'player2'>('player2');

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

      // Redirect to Level 3 when Player 2 picks correct door
      if (state.gameStatus === 'playing' && state.currentLevel === 3) {
        router.replace('/level3');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Universal synchronized game timer tick
  useGameTimer(gameState, myRole);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-mono text-sm">
        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-6 py-4 rounded-xl shadow-2xl">
          <Skull className="w-5 h-5 text-purple-500 animate-spin" style={{ animationDuration: '2s' }} />
          <span>Entering Level 2: Demon Doors...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-purple-900 selection:text-white font-sans overflow-hidden">
      {/* Background Video for Level 2 */}
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
        <BackgroundVideo src="/videos/level_2.mp4" />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/60 to-zinc-950/90" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <HeaderHUD
          teamCode={gameState.teamCode}
          myRole={myRole}
          currentLevel={gameState.currentLevel}
          timeRemaining={gameState.timeRemaining}
          totalTimeElapsed={gameState.totalTimeElapsed}
          onOpenPythonConfig={() => setIsPythonConfigOpen(true)}
        />

        <main className="flex-1 flex flex-col items-center justify-center p-4">
          {/* Level 2: Demon Doors (shows locked screen until l1IsCompleted, then active doors) */}
          {gameState.gameStatus === 'playing' && gameState.currentLevel >= 1 && gameState.currentLevel <= 2 && (
            <Level2Screen state={gameState} myRole={myRole} />
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

        <footer className="w-full border-t border-zinc-900/80 bg-zinc-950/80 backdrop-blur-sm px-4 py-3 text-center text-xs font-mono text-zinc-600">
          Escape the Demon's Lair · Level 2: Demon Doors · {gameState.teamName || "Demon Slayers"}
        </footer>
      </div>

      <PythonConfigModal isOpen={isPythonConfigOpen} onClose={() => setIsPythonConfigOpen(false)} />
    </div>
  );
}
