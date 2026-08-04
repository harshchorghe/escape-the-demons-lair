"use client";

import React, { useState, useEffect } from "react";
import { GameGameState, gameSync } from "@/lib/gameStore";
import { pythonApi } from "@/lib/pythonApi";
import { HandGestureDetector } from "@/components/ui/HandGestureDetector";
import { Flame, Swords, Shield, HeartHandshake, Eye, Sparkles, AlertTriangle } from "lucide-react";

interface FinalLevelScreenProps {
  state: GameGameState;
  myRole: 'player1' | 'player2';
}

export const FinalLevelScreen: React.FC<FinalLevelScreenProps> = ({ state, myRole }) => {
  const [battleLogs, setBattleLogs] = useState<string[]>([
    "⚔️ First-Person Arena Active! Defeat Malakor using your hand gestures!",
  ]);
  const [isAttacking, setIsAttacking] = useState(false);
  const [bossHitEffect, setBossHitEffect] = useState(false);
  const [floatingDamage, setFloatingDamage] = useState<{ amount: number; isCombo: boolean; id: number } | null>(null);

  const demonHp = state.l3DemonHp ?? 500;
  const maxHp = state.l3MaxDemonHp ?? 500;
  const hpPercent = Math.max(0, Math.min(100, Math.round((demonHp / maxHp) * 100)));
  const isL2Complete = state.currentLevel === 3 || state.l1IsCompleted;

  // Stance shift simulation based on HP thresholds
  useEffect(() => {
    let nextStance: 'idle' | 'charging' | 'vulnerable' | 'enraged' = 'idle';
    if (demonHp < 150) {
      nextStance = 'enraged';
    } else if (demonHp % 120 < 40) {
      nextStance = 'charging';
    } else if (demonHp % 120 > 80) {
      nextStance = 'vulnerable';
    }

    if (state.l3DemonStance !== nextStance) {
      gameSync.updateState({ l3DemonStance: nextStance });
    }
  }, [demonHp, state.l3DemonStance]);

  // Execute Player Gesture Attack
  const handleGestureDetected = async (gesture: 'FIST' | 'PALM' | 'PEACE') => {
    if (isAttacking || demonHp <= 0) return;
    setIsAttacking(true);
    setBossHitEffect(true);
    setTimeout(() => setBossHitEffect(false), 600);

    const partnerGesture = myRole === 'player1' ? state.l3Player2Gesture : state.l3Player1Gesture;

    const updateObj: Partial<GameGameState> = myRole === 'player1'
      ? { l3Player1Gesture: gesture }
      : { l3Player2Gesture: gesture };

    gameSync.updateState(updateObj);

    // Call Python backend or local API damage calculator
    const result = await pythonApi.attackDemonLord(myRole, gesture, demonHp, partnerGesture);

    // Trigger floating 1st-person damage text
    setFloatingDamage({ amount: result.damage, isCombo: result.isCombo, id: Date.now() });
    setTimeout(() => setFloatingDamage(null), 1200);

    // Append to battle ticker
    setBattleLogs((prev) => [result.message, ...prev.slice(0, 4)]);

    const nextCombo = result.isCombo ? (state.l3ComboCount || 0) + 1 : state.l3ComboCount;

    if (result.isDefeated) {
      const level3DurationSec = state.level3Duration || 210;
      const l3TimeSpent = Math.max(1, level3DurationSec - state.timeRemaining);

      gameSync.updateState({
        l3DemonHp: 0,
        l3ComboCount: nextCombo,
        l3TimeElapsed: l3TimeSpent,
        currentLevel: 4,
        gameStatus: 'victory',
        isDemonSealed: true,
      });
    } else {
      gameSync.updateState({
        l3DemonHp: result.newHp,
        l3ComboCount: nextCombo,
      });
    }

    setIsAttacking(false);
  };

  if (!isL2Complete) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-12 flex flex-col items-center gap-8 text-center">
        <div className="w-20 h-20 rounded-full bg-amber-950/60 border-2 border-amber-500/50 flex items-center justify-center text-4xl animate-pulse">
          🔒
        </div>
        <div className="space-y-2">
          <p className="text-xs font-mono tracking-widest text-amber-400 uppercase">Final Level 3 · Locked</p>
          <h2 className="text-2xl font-extrabold text-white font-serif">Waiting for Partner</h2>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">
            Your partner is clearing Level 2. The First-Person Throne Room unlocks when Level 2 is completed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-2 py-4 space-y-4 font-sans">
      {/* HUD Bar */}
      <div className="flex items-center justify-between bg-zinc-950/90 border border-red-900/50 px-4 py-2.5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-red-500 animate-pulse" />
          <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-widest">
            First-Person Battle View · Level 3
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-xl text-xs font-mono">
            <span className="text-zinc-400">Synergy:</span>
            <span className="font-bold text-amber-400">🔥 x{state.l3ComboCount || 0}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-xl text-xs font-mono">
            <span className="text-zinc-400">Time Left:</span>
            <span className="font-bold text-cyan-400">
              ⏱️ {Math.floor(state.timeRemaining / 60)}:{(state.timeRemaining % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>

      {/* FIRST PERSON PERSPECTIVE ARENA */}
      <div className={`relative w-full h-[380px] sm:h-[420px] bg-gradient-to-b from-black via-red-950/60 to-zinc-950 border-2 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 flex flex-col items-center justify-between p-4 ${
        bossHitEffect ? 'border-red-500 ring-8 ring-red-500/40 scale-[0.99]' : 'border-red-900/60'
      }`}>
        {/* Dungeon Room Background FX */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-red-900/30 via-transparent to-transparent pointer-events-none" />

        {/* TOP CENTER: OPPOSING DEMON LORD (MALAKOR) IN 1ST PERSON VIEW */}
        <div className="relative z-10 flex flex-col items-center text-center space-y-2 mt-2">
          {/* Boss HP Bar */}
          <div className="w-72 sm:w-96 space-y-1 bg-black/80 border border-red-900/80 p-2.5 rounded-2xl shadow-2xl backdrop-blur-md">
            <div className="flex justify-between text-xs font-mono font-bold">
              <span className="text-red-400 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-red-500" /> MALAKOR, DEMON LORD
              </span>
              <span className="text-zinc-200">{demonHp} / {maxHp} HP</span>
            </div>

            <div className="w-full h-4 bg-zinc-950 border border-zinc-800 rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                  hpPercent > 50 ? 'from-red-600 to-amber-500' : hpPercent > 20 ? 'from-amber-600 to-red-600' : 'from-purple-700 to-red-700 animate-pulse'
                }`}
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          {/* Dynamic Stance Alert */}
          {state.l3DemonStance === 'charging' && (
            <div className="bg-amber-500/90 text-black px-3 py-1 rounded-full text-xs font-mono font-extrabold flex items-center gap-1 shadow-lg animate-bounce">
              <AlertTriangle className="w-3.5 h-3.5" /> CHARGING HELLFIRE! CAST ✋ AEGIS SHIELD!
            </div>
          )}
          {state.l3DemonStance === 'vulnerable' && (
            <div className="bg-emerald-500/90 text-black px-3 py-1 rounded-full text-xs font-mono font-extrabold flex items-center gap-1 shadow-lg animate-bounce">
              <Sparkles className="w-3.5 h-3.5" /> EXPOSED! EXECUTE ✊ FIST OR ✌️ V-SIGN!
            </div>
          )}

          {/* Giant Demon Avatar Directly Opposite the Players */}
          <div className="relative my-2">
            <div className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-b from-red-950 to-black border-4 border-red-600 flex items-center justify-center text-7xl sm:text-8xl shadow-2xl shadow-red-900/90 transition-transform ${
              bossHitEffect ? 'scale-110 rotate-6 filter brightness-150' : 'animate-pulse'
            }`}>
              👹
            </div>

            {/* 1st-Person Floating Damage Number Effect */}
            {floatingDamage && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl font-extrabold font-mono text-amber-300 drop-shadow-[0_5px_5px_rgba(255,0,0,0.8)] animate-ping pointer-events-none">
                -{floatingDamage.amount} HP {floatingDamage.isCombo && '💥 CRITICAL!'}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM FIELD: FIRST PERSON PLAYER POV SPELLCASTING PROJECTILES */}
        <div className="relative z-10 w-full flex items-end justify-between px-6 pb-2">
          {/* Player 1 Left POV Hand */}
          <div className="flex items-center gap-2 bg-black/70 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs font-mono">
            <span className="text-2xl">🧙‍♂️</span>
            <div>
              <span className="text-zinc-400 block text-[10px]">P1 Mage ({state.player1Name || 'P1'})</span>
              <span className="text-amber-400 font-bold">
                {state.l3Player1Gesture ? `Cast ${state.l3Player1Gesture}` : 'Ready...'}
              </span>
            </div>
          </div>

          {/* Center Battle Ticker */}
          <div className="hidden sm:block text-center max-w-sm bg-black/80 border border-zinc-800 px-4 py-1.5 rounded-xl text-[11px] font-mono text-zinc-300 truncate">
            {battleLogs[0] || 'Perform hand gestures to attack Malakor directly!'}
          </div>

          {/* Player 2 Right POV Hand */}
          <div className="flex items-center gap-2 bg-black/70 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs font-mono">
            <div>
              <span className="text-zinc-400 block text-[10px] text-right">P2 Paladin ({state.player2Name || 'P2'})</span>
              <span className="text-amber-400 font-bold block text-right">
                {state.l3Player2Gesture ? `Cast ${state.l3Player2Gesture}` : 'Ready...'}
              </span>
            </div>
            <span className="text-2xl">🛡️</span>
          </div>
        </div>
      </div>

      {/* DUAL PLAYER GESTURE CONTROLS & FEEDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Player Gesture Camera & Cards */}
        <HandGestureDetector
          playerRole={myRole}
          onGestureDetected={handleGestureDetected}
          disabled={isAttacking || demonHp <= 0}
        />

        {/* Partner Info & Battle Ticker */}
        <div className="bg-zinc-950/90 border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  Partner ({myRole === 'player1' ? (state.player2Name || 'Player 2') : (state.player1Name || 'Player 1')})
                </h4>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded text-xs font-mono text-amber-400 font-bold">
                Last: {myRole === 'player1' ? (state.l3Player2Gesture || 'None') : (state.l3Player1Gesture || 'None')}
              </div>
            </div>

            <p className="text-xs text-zinc-400 font-mono leading-relaxed">
              Facing Malakor in First Person! Execute hand gestures simultaneously to land <strong className="text-amber-400">Team Synergy Combos</strong>!
            </p>
          </div>

          {/* Live Battle Log */}
          <div className="bg-black/80 border border-zinc-800 rounded-xl p-3 space-y-1 font-mono text-xs max-h-32 overflow-y-auto">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold block border-b border-zinc-800 pb-1">
              Live Battle Log
            </span>
            {battleLogs.map((log, i) => (
              <div key={i} className={`text-[11px] leading-tight ${i === 0 ? 'text-amber-300 font-bold' : 'text-zinc-400'}`}>
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
