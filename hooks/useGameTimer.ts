"use client";

import { useEffect } from "react";
import { GameGameState, gameSync } from "@/lib/gameStore";
import { pythonApi } from "@/lib/pythonApi";

/**
 * Universal synchronized game timer hook for Escape the Demon's Lair.
 * Integrates Backend Timer API & Timestamp calculations for 100% stutter-free countdowns.
 */
export function useGameTimer(gameState: GameGameState, myRole: 'player1' | 'player2') {
  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;

    const interval = setInterval(async () => {
      const freshState = gameSync.getState();
      if (freshState.gameStatus !== 'playing') return;

      const now = Date.now();
      const isPlayer1Driver = myRole === 'player1';
      const isPlayer2Fallback = myRole === 'player2' && (now - (freshState.lastUpdated || 0) > 1800);

      if (!isPlayer1Driver && !isPlayer2Fallback) return;

      // Check Python backend API sync if connected
      let backendSynced: { timeRemaining?: number; totalTimeElapsed?: number } | null = null;
      if (freshState.teamCode) {
        backendSynced = await pythonApi.syncRoomTimer(freshState.teamCode, freshState.timePenalties || 0);
      }

      gameSync.updateState((prev) => {
        if (prev.gameStatus !== 'playing') return prev;

        let nextTime: number;
        let nextTotal: number;

        if (backendSynced && typeof backendSynced.timeRemaining === 'number' && typeof backendSynced.totalTimeElapsed === 'number') {
          nextTime = backendSynced.timeRemaining;
          nextTotal = backendSynced.totalTimeElapsed;
        } else {
          // Timestamp-based calculation fallback
          const missionStart = prev.missionStartTime || now;
          const levelStart = prev.levelStartTime || now;

          const levelDuration = prev.currentLevel === 1 
            ? (prev.level1Duration || 60) 
            : prev.currentLevel === 2 
            ? (prev.level2Duration || 120) 
            : (prev.level3Duration || 300);

          const elapsedLevelSec = Math.floor((now - levelStart) / 1000);
          const elapsedMissionSec = Math.floor((now - missionStart) / 1000);

          nextTime = Math.max(0, levelDuration - elapsedLevelSec - (prev.timePenalties || 0));
          nextTotal = elapsedMissionSec;
        }

        const nextL3 = prev.currentLevel === 3 ? (prev.l3TimeElapsed || 0) + 1 : (prev.l3TimeElapsed || 0);

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
  }, [gameState.gameStatus, myRole]);
}
