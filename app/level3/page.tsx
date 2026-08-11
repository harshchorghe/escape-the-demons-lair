"use client";

import React, { useState, useEffect } from "react";
import { GameGameState, INITIAL_GAME_STATE, gameSync } from "@/lib/gameStore";
import { useGameTimer } from "@/hooks/useGameTimer";
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

  // Auto-register team on leaderboard as soon as they reach/play Level 3
  useEffect(() => {
    if (gameState.teamCode && gameState.currentLevel >= 3) {
      import('@/lib/leaderboardService').then(({ saveTeamScore }) => {
        saveTeamScore({
          teamCode: gameState.teamCode,
          teamName: gameState.teamName || 'Demon Slayers',
          player1: gameState.player1Name || 'Player 1',
          player2: gameState.player2Name || 'Player 2',
          phoneNumber: gameState.phoneNumber || '',
          department: gameState.department || '',
          levelsCompleted: 3,
          totalTimeSeconds: gameState.totalTimeElapsed || 0,
          gameStatus: gameState.gameStatus === 'victory' ? 'victory' : 'playing',
          date: new Date().toISOString().split('T')[0],
        });
      });
    }
  }, [gameState.teamCode, gameState.teamName, gameState.player1Name, gameState.player2Name, gameState.phoneNumber, gameState.department, gameState.currentLevel, gameState.totalTimeElapsed, gameState.gameStatus]);

  // Universal synchronized game timer tick
  useGameTimer(gameState, myRole);

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
        totalTimeElapsed={gameState.totalTimeElapsed}
        onOpenPythonConfig={() => setIsPythonConfigOpen(true)}
      />

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Active Final Throne Room Level 3 */}
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
        Escape the Demon's Lair · Final Level 3: Throne Room · {gameState.teamName || "Demon Slayers"}
      </footer>

      <PythonConfigModal isOpen={isPythonConfigOpen} onClose={() => setIsPythonConfigOpen(false)} />
    </div>
  );
}
