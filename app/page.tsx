"use client";

import React, { useState, useEffect } from "react";
import { GameGameState, INITIAL_GAME_STATE, gameSync } from "@/lib/gameStore";
import { HeaderHUD } from "@/components/ui/HeaderHUD";
import { PythonConfigModal } from "@/components/ui/PythonConfigModal";
import { LobbyScreen } from "@/components/screens/LobbyScreen";
import { FinalLevelScreen } from "@/components/screens/FinalLevelScreen";
import { VictoryScreen } from "@/components/screens/VictoryScreen";
import { DisqualifiedScreen } from "@/components/screens/DisqualifiedScreen";
import { ShieldAlert, Skull } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameGameState>(INITIAL_GAME_STATE);
  const [myRole, setMyRole] = useState<'player1' | 'player2'>('player1');
  const [isPythonConfigOpen, setIsPythonConfigOpen] = useState<boolean>(false);

  // Subscribe to real-time game state updates (cross-tab & Firebase)
  useEffect(() => {
    const unsubscribe = gameSync.subscribe((state) => {
      setGameState(state);
      // Auto-redirect players based on level status
      if (state.gameStatus === 'playing') {
        if (state.currentLevel === 3) {
          router.push('/level3');
        } else {
          const storedRole = typeof window !== 'undefined'
            ? window.sessionStorage.getItem('my_role') as 'player1' | 'player2' | null
            : null;
          const role = storedRole || myRole;
          router.push(role === 'player1' ? '/level1' : '/level2');
        }
      }
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRole]);

  const handleSetMyRole = (role: 'player1' | 'player2') => {
    setMyRole(role);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('my_role', role);
    }
  };

  const handleStartMission = () => {
    const role = typeof window !== 'undefined'
      ? window.sessionStorage.getItem('my_role') as 'player1' | 'player2' | null
      : null;
    router.push((role || myRole) === 'player1' ? '/level1' : '/level2');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-red-900 selection:text-white font-sans">
      {/* Header HUD Bar */}
      <HeaderHUD
        teamCode={gameState.teamCode}
        myRole={myRole}
        currentLevel={gameState.currentLevel}
        timeRemaining={gameState.timeRemaining}
        totalTimeElapsed={gameState.totalTimeElapsed}
        onOpenPythonConfig={() => setIsPythonConfigOpen(true)}
      />

      {/* Main Content Area - only lobby shown here; levels have dedicated routes */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Lobby Screen */}
        {gameState.gameStatus === 'lobby' && (
          <LobbyScreen
            state={gameState}
            myRole={myRole}
            setMyRole={handleSetMyRole}
            onStartMission={handleStartMission}
          />
        )}

        {/* Victory Screen */}
        {(gameState.gameStatus === 'victory' || gameState.currentLevel === 4) && (
          <VictoryScreen state={gameState} />
        )}

        {/* Automatic Disqualification Screen */}
        {(gameState.gameStatus === 'disqualified' || gameState.gameStatus === 'gameover') && (
          <DisqualifiedScreen state={gameState} />
        )}

        {/* Active Final Throne Room Level 3 */}
        {gameState.gameStatus === 'playing' && gameState.currentLevel === 3 && (
          <FinalLevelScreen state={gameState} myRole={myRole} />
        )}

        {/* Redirect hint when playing Levels 1 or 2 */}
        {gameState.gameStatus === 'playing' && gameState.currentLevel < 3 && (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-700/40 flex items-center justify-center mx-auto mb-4">
              <Skull className="w-6 h-6 text-red-500 animate-pulse" />
            </div>
            <p className="text-zinc-400 text-sm font-mono">Redirecting to your level...</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-900 bg-zinc-950 px-4 py-3 text-center text-xs font-mono text-zinc-600">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Escape the Demon's Lair • Next.js + Three.js + Firebase + Python Backend</span>
          <span className="flex items-center gap-1 text-zinc-500">
            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
            Co-op Mission Rule Engine Active
          </span>
        </div>
      </footer>

      {/* Python Config Modal */}
      <PythonConfigModal
        isOpen={isPythonConfigOpen}
        onClose={() => setIsPythonConfigOpen(false)}
      />
    </div>
  );
}
