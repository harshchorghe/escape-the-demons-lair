"use client";

import React, { useState, useEffect } from "react";
import { GameGameState, gameSync, ANCIENT_SEALS } from "@/lib/gameStore";
import { pythonApi, FinalCrystalData, FALLBACK_FINAL_CRYSTALS } from "@/lib/pythonApi";
import { ThroneRoomCanvas } from "@/components/3d/ThroneRoomCanvas";
import { Skull, Zap, ShieldAlert, Sparkles, CheckCircle2, Lock } from "lucide-react";

interface FinalLevelScreenProps {
  state: GameGameState;
  myRole: 'player1' | 'player2';
}

export const FinalLevelScreen: React.FC<FinalLevelScreenProps> = ({ state }) => {
  const [crystals, setCrystals] = useState<FinalCrystalData[]>(FALLBACK_FINAL_CRYSTALS);
  const [selectedCrystalId, setSelectedCrystalId] = useState<number>(1);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [feedback, setFeedback] = useState<{ success?: boolean; message: string }>({ message: '' });
  const [selectedSealId, setSelectedSealId] = useState<string | null>(state.selectedSeal);

  useEffect(() => {
    const fetchCrystals = async () => {
      const data = await pythonApi.getFinalCrystals();
      setCrystals(data);
    };
    fetchCrystals();
  }, []);

  const currentCrystal = crystals.find((c) => c.crystalId === selectedCrystalId) || crystals[0];
  const isCrystalDestroyed = state.l3DestroyedCrystals.includes(selectedCrystalId);
  const allCrystalsDestroyed = state.l3DestroyedCrystals.length === 4;

  const handleShatterCrystal = async () => {
    if (!userAnswer.trim()) return;
    setFeedback({ message: 'Focusing elemental magic...' });

    const result = await pythonApi.verifyAnswer(currentCrystal.puzzle.id, userAnswer);
    setFeedback(result);

    if (result.success) {
      const updatedDestroyed = Array.from(new Set([...state.l3DestroyedCrystals, selectedCrystalId]));
      gameSync.updateState({
        l3DestroyedCrystals: updatedDestroyed,
        collectedSealFragments: updatedDestroyed.length,
      });

      if (selectedCrystalId < 4) {
        setSelectedCrystalId(selectedCrystalId + 1);
        setUserAnswer('');
      }
    }
  };

  const handleExecuteSeal = () => {
    if (!selectedSealId) {
      setFeedback({ success: false, message: 'You must select an Ancient Seal to complete the binding!' });
      return;
    }

    const sealObj = ANCIENT_SEALS.find((s) => s.id === selectedSealId);
    if (!sealObj?.isCorrect) {
      setFeedback({
        success: false,
        message: `The ${sealObj?.name} failed to bind the Demon Lord! Time penalty -30s!`,
      });
      gameSync.updateState((prev) => ({
        ...prev,
        timeRemaining: Math.max(1, prev.timeRemaining - 30),
        timePenalties: prev.timePenalties + 30,
      }));
      return;
    }

    // Victory! Seal successful!
    gameSync.updateState({
      selectedSeal: selectedSealId,
      isDemonSealed: true,
      currentLevel: 4,
      gameStatus: 'victory',
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Title Header */}
      <div className="bg-zinc-950/90 border border-red-900/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        <div>
          <h2 className="text-2xl font-bold font-serif text-red-500 flex items-center gap-2">
            <Skull className="w-6 h-6 text-red-600 animate-bounce" />
            Final Level: Demon's Throne Room
          </h2>
          <p className="text-xs text-zinc-400">
            Cooperate to shatter all 4 Demon Crystals within 5 minutes, assemble Seal Fragments, and execute the correct Ancient Seal!
          </p>
        </div>

        {/* Seal Fragment Inventory Badge */}
        <div className="flex items-center gap-2 bg-amber-950/40 border border-amber-500/40 px-4 py-2 rounded-xl text-amber-300 font-mono text-xs">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
          <span>Seal Fragments: <strong>{state.collectedSealFragments}/4</strong></span>
        </div>
      </div>

      {/* 3D Throne Room Scene */}
      <ThroneRoomCanvas
        destroyedCrystals={state.l3DestroyedCrystals}
        onCrystalClick={(id) => setSelectedCrystalId(id)}
      />

      {/* Phase 1: Destroy Crystals */}
      {!allCrystalsDestroyed ? (
        <div className="bg-zinc-950/90 border border-red-900/50 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
            <div>
              <span className="text-xs font-mono text-red-400 uppercase tracking-widest">
                Targeting Crystal {selectedCrystalId} of 4
              </span>
              <h3 className="text-2xl font-bold text-white font-serif flex items-center gap-2">
                <span>{currentCrystal.rune}</span>
                <span>{currentCrystal.name}</span>
              </h3>
            </div>

            {/* Crystal Selection Buttons */}
            <div className="flex items-center gap-2">
              {crystals.map((c) => {
                const destroyed = state.l3DestroyedCrystals.includes(c.crystalId);
                const active = selectedCrystalId === c.crystalId;
                return (
                  <button
                    key={c.crystalId}
                    onClick={() => {
                      setSelectedCrystalId(c.crystalId);
                      setUserAnswer('');
                      setFeedback({ message: '' });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-all ${
                      active
                        ? 'bg-red-700 text-white border border-red-500 shadow-md'
                        : destroyed
                        ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 line-through'
                        : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800'
                    }`}
                  >
                    {c.rune} {c.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="text-amber-400 font-mono text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4" />
              {currentCrystal.puzzle.title}
            </div>
            <p className="text-xs text-zinc-300 font-mono">{currentCrystal.puzzle.description}</p>

            {currentCrystal.puzzle.initialCode && (
              <div className="bg-black border border-zinc-800 rounded-lg p-3 overflow-x-auto">
                <pre className="text-xs font-mono text-emerald-400">
                  {currentCrystal.puzzle.initialCode}
                </pre>
              </div>
            )}

            {currentCrystal.puzzle.options ? (
              <div className="grid grid-cols-2 gap-2 pt-2">
                {currentCrystal.puzzle.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setUserAnswer(opt)}
                    className={`p-2.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                      userAnswer === opt
                        ? 'bg-red-950 border-red-500 text-red-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="pt-2">
                <label className="block text-xs font-mono text-zinc-400 uppercase mb-1">
                  Enter Resonating Element Answer
                </label>
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="e.g. WATER"
                  disabled={isCrystalDestroyed}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 text-zinc-100 font-mono text-sm px-3 py-2.5 rounded-lg outline-none"
                />
              </div>
            )}

            {feedback.message && (
              <div
                className={`p-3 rounded-lg text-xs font-mono border ${
                  feedback.success
                    ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                    : 'bg-red-950/50 border-red-500/50 text-red-300'
                }`}
              >
                {feedback.message}
              </div>
            )}

            <div className="pt-2">
              {!isCrystalDestroyed ? (
                <button
                  onClick={handleShatterCrystal}
                  className="w-full bg-red-700 hover:bg-red-600 text-white font-mono text-sm py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-950/50 flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" /> Shatter {currentCrystal.name}
                </button>
              ) : (
                <div className="p-3 bg-emerald-950/50 border border-emerald-600/50 rounded-xl text-center text-xs font-mono text-emerald-300 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Crystal Destroyed! Fragment Collected.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Phase 2: Select Ancient Seal */
        <div className="bg-zinc-950/90 border border-amber-500/50 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-amber-950/60 border border-amber-700/60 px-4 py-1 rounded-full text-amber-400 text-xs font-mono uppercase mb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              All 4 Seal Fragments Collected!
            </div>
            <h3 className="text-3xl font-extrabold text-white font-serif mb-1">
              Select the Ancient Demon Seal
            </h3>
            <p className="text-xs text-zinc-400">
              Only ONE seal contains the true ancient spell to permanently trap the Demon Lord.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ANCIENT_SEALS.map((seal) => {
              const isSelected = selectedSealId === seal.id;
              return (
                <button
                  key={seal.id}
                  onClick={() => setSelectedSealId(seal.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-amber-950/60 border-amber-500 shadow-xl shadow-amber-950/50'
                      : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-sm text-amber-300">{seal.name}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{seal.description}</p>
                </button>
              );
            })}
          </div>

          {feedback.message && (
            <div className="p-3 bg-red-950/50 border border-red-500/50 rounded-lg text-xs font-mono text-red-300 text-center">
              {feedback.message}
            </div>
          )}

          <button
            onClick={handleExecuteSeal}
            className="w-full bg-amber-600 hover:bg-amber-500 text-black font-mono text-base py-3.5 rounded-xl font-extrabold shadow-lg shadow-amber-950/60 flex items-center justify-center gap-2"
          >
            <Lock className="w-5 h-5" /> Execute Ancient Binding & Escape Lair
          </button>
        </div>
      )}
    </div>
  );
};
