"use client";

import React, { useState, useEffect } from "react";
import { GameGameState, gameSync, ANCIENT_SEALS } from "@/lib/gameStore";
import { pythonApi, FinalCrystalData, FALLBACK_FINAL_CRYSTALS } from "@/lib/pythonApi";
import { puzzleService } from "@/lib/puzzleService";
import { CheckCircle, AlertCircle, Zap, Lock, Clock, User } from "lucide-react";

interface FinalLevelScreenProps {
  state: GameGameState;
  myRole: 'player1' | 'player2';
}

const CRYSTAL_CONFIG = [
  { id: 1, emoji: "🔥", name: "Inferno",  color: "from-red-900/50 to-red-950/70 border-red-700/50",    ring: "ring-red-500",    glow: "shadow-red-900/60" },
  { id: 2, emoji: "👁️", name: "Shadow",   color: "from-purple-900/50 to-purple-950/70 border-purple-700/50", ring: "ring-purple-500", glow: "shadow-purple-900/60" },
  { id: 3, emoji: "⚡", name: "Thunder",  color: "from-blue-900/50 to-blue-950/70 border-blue-700/50",  ring: "ring-blue-500",   glow: "shadow-blue-900/60" },
  { id: 4, emoji: "💀", name: "Void",     color: "from-zinc-800/50 to-zinc-900/70 border-zinc-600/50",  ring: "ring-zinc-400",   glow: "shadow-zinc-800/60" },
];

export const FinalLevelScreen: React.FC<FinalLevelScreenProps> = ({ state, myRole }) => {
  const assignedIds = myRole === 'player1' ? [1, 2] : [3, 4];
  const [crystals, setCrystals] = useState<FinalCrystalData[]>(FALLBACK_FINAL_CRYSTALS);
  const [activeCrystalId, setActiveCrystalId] = useState<number>(assignedIds[0]);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ success?: boolean; message: string }>({ message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [selectedSealId, setSelectedSealId] = useState<string | null>(null);

  useEffect(() => {
    puzzleService.getAssignedSetForTeam(3, state.teamCode).then((assignedCrystals) => {
      if (Array.isArray(assignedCrystals) && assignedCrystals.length > 0) {
        setCrystals(assignedCrystals);
      }
    });
  }, [state.teamCode]);

  const destroyed = state.l3DestroyedCrystals;
  const allDone = destroyed.length === 4;
  const myDone = assignedIds.every((id) => destroyed.includes(id));
  const partnerDone = assignedIds === assignedIds ? (myRole === 'player1' ? [3, 4].every(id => destroyed.includes(id)) : [1, 2].every(id => destroyed.includes(id))) : false;
  const activeCrystal = crystals.find((c) => c.crystalId === activeCrystalId) || crystals[0];
  const isL2Complete = state.currentLevel === 3 || state.l2UnlockedDoors?.length > 0;

  // ── LOCKED (waiting for P2 to clear Level 2) ──────────────────────
  if (!isL2Complete) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-12 flex flex-col items-center gap-8">
        <div className="w-20 h-20 rounded-full bg-amber-950/60 border-2 border-amber-500/50 flex items-center justify-center text-4xl animate-pulse">
          🔒
        </div>
        <div className="text-center space-y-2">
          <p className="text-xs font-mono tracking-widest text-amber-400 uppercase">Final Level · Locked</p>
          <h2 className="text-2xl font-extrabold text-white font-serif">Waiting for Player 2</h2>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">
            Player 2 is navigating the Demon Doors. The Throne Room unlocks the moment they escape Level 2.
          </p>
        </div>
        <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-emerald-400 font-mono">
              <User className="w-4 h-4" /> {state.player1Name || 'Player 1'}
            </div>
            <span className="text-xs bg-emerald-900/60 border border-emerald-600/40 text-emerald-400 px-2.5 py-1 rounded-full font-mono font-bold">Level 1 ✓</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-purple-400 font-mono">
              <User className="w-4 h-4" /> {state.player2Name || 'Player 2'}
            </div>
            <span className="text-xs bg-purple-900/60 border border-purple-600/40 text-purple-400 px-2.5 py-1 rounded-full font-mono font-bold flex items-center gap-1">
              <Clock className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} /> In Level 2…
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── MY TASKS DONE, WAITING FOR PARTNER ────────────────────────────
  if (myDone && !allDone) {
    const partnerName = myRole === 'player1' ? (state.player2Name || 'Player 2') : (state.player1Name || 'Player 1');
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-12 flex flex-col items-center gap-8">
        <div className="w-20 h-20 rounded-full bg-emerald-950/60 border-2 border-emerald-500/50 flex items-center justify-center text-4xl">
          ✅
        </div>
        <div className="text-center space-y-2">
          <p className="text-xs font-mono tracking-widest text-emerald-400 uppercase">Your tasks complete!</p>
          <h2 className="text-2xl font-extrabold text-white font-serif">Waiting for {partnerName}</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            You've shattered your 2 crystals. Hold on while your partner finishes theirs!
          </p>
        </div>
        {/* Crystal status overview */}
        <div className="grid grid-cols-4 gap-3 w-full">
          {CRYSTAL_CONFIG.map((cfg) => {
            const done = destroyed.includes(cfg.id);
            const mine = assignedIds.includes(cfg.id);
            return (
              <div key={cfg.id} className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${done ? 'bg-emerald-950/40 border-emerald-600/40' : 'bg-zinc-900/60 border-zinc-800'}`}>
                <span className="text-xl">{done ? '✅' : cfg.emoji}</span>
                <span className={`text-[10px] font-mono font-bold ${mine ? 'text-amber-400' : 'text-zinc-500'}`}>
                  {mine ? 'Mine' : 'Partner'}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 animate-pulse">
          <Clock className="w-3.5 h-3.5" /> Timer still running — {partnerName} is working on it…
        </div>
      </div>
    );
  }

  // ── SEAL SELECTION (all 4 destroyed) ──────────────────────────────
  if (allDone) {
    const handleSeal = () => {
      if (!selectedSealId) return;
      const seal = ANCIENT_SEALS.find(s => s.id === selectedSealId);
      if (!seal?.isCorrect) {
        setFeedback({ success: false, message: `${seal?.name} rejected! −30s penalty.` });
        gameSync.updateState(prev => ({ ...prev, timeRemaining: Math.max(1, prev.timeRemaining - 30), timePenalties: prev.timePenalties + 30 }));
        return;
      }
      gameSync.updateState({ selectedSeal: selectedSealId, isDemonSealed: true, currentLevel: 4, gameStatus: 'victory' });
    };

    return (
      <div className="w-full max-w-xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="text-4xl animate-bounce">✨</div>
          <p className="text-xs font-mono tracking-widest text-amber-400 uppercase">All Crystals Shattered!</p>
          <h2 className="text-2xl font-extrabold text-white font-serif">Choose the Ancient Seal</h2>
          <p className="text-sm text-zinc-400">One seal binds the Demon Lord forever. Choose wisely.</p>
        </div>

        {feedback.message && (
          <div className="flex items-center gap-3 bg-red-950/60 border border-red-700/40 text-red-300 rounded-xl px-4 py-3 text-sm font-mono">
            <AlertCircle className="w-4 h-4 shrink-0" /> {feedback.message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {ANCIENT_SEALS.map((seal) => (
            <button
              key={seal.id}
              onClick={() => setSelectedSealId(seal.id)}
              className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedSealId === seal.id
                  ? 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/30'
                  : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{seal.name}</span>
                {selectedSealId === seal.id && <CheckCircle className="w-4 h-4 text-amber-400" />}
              </div>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{seal.description}</p>
            </button>
          ))}
        </div>

        <button
          onClick={handleSeal}
          disabled={!selectedSealId}
          className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-black font-extrabold font-mono text-base transition-all cursor-pointer"
        >
          🔐 Execute Binding Seal
        </button>
      </div>
    );
  }

  // ── ACTIVE CRYSTAL PHASE ──────────────────────────────────────────
  const handleShatter = async (overrideAnswer?: string) => {
    const answer = overrideAnswer || userAnswer;
    if (!answer.trim()) return;
    if (!assignedIds.includes(activeCrystalId)) {
      setFeedback({ success: false, message: "That crystal belongs to your partner!" });
      return;
    }
    setSubmitting(true);
    const result = await pythonApi.verifyAnswer(activeCrystal.puzzle.id, answer);
    setFeedback(result);
    setSubmitting(false);
    if (result.success) {
      const updated = Array.from(new Set([...destroyed, activeCrystalId]));
      if (updated.length === 4) {
        gameSync.updateState({ l3DestroyedCrystals: updated, collectedSealFragments: 4, selectedSeal: 'CELESTIAL', isDemonSealed: true, currentLevel: 4, gameStatus: 'victory' });
      } else {
        gameSync.updateState({ l3DestroyedCrystals: updated, collectedSealFragments: updated.length });
        const next = assignedIds.find(id => !updated.includes(id));
        if (next) { setActiveCrystalId(next); setUserAnswer(''); setFeedback({ message: '' }); }
      }
    }
  };

  const cfg = CRYSTAL_CONFIG.find(c => c.id === activeCrystalId)!;
  const isMine = assignedIds.includes(activeCrystalId);
  const isDone = destroyed.includes(activeCrystalId);

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <p className="text-xs font-mono tracking-widest text-red-400 uppercase">Level 3 · Throne Room</p>
        <h2 className="text-2xl font-extrabold text-white font-serif">Shatter Your Crystals</h2>
        <p className="text-xs text-zinc-400 font-mono">
          You: <strong className="text-amber-400">Crystals {assignedIds.join(' & ')}</strong> · Partner: <strong className="text-purple-400">Crystals {(myRole === 'player1' ? [3,4] : [1,2]).join(' & ')}</strong>
        </p>
      </div>

      {/* Crystal progress dots */}
      <div className="flex items-center justify-center gap-3">
        {CRYSTAL_CONFIG.map((c) => {
          const done = destroyed.includes(c.id);
          const mine = assignedIds.includes(c.id);
          const active = activeCrystalId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => { setActiveCrystalId(c.id); setUserAnswer(''); setFeedback({ message: '' }); }}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                done
                  ? 'bg-emerald-950/40 border-emerald-600/40 opacity-80'
                  : active
                  ? `bg-gradient-to-br ${c.color} ${c.ring} ring-2`
                  : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-600'
              } ${mine ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
            >
              <span className="text-xl">{done ? '✅' : c.emoji}</span>
              <span className={`text-[9px] font-mono font-bold ${mine ? 'text-amber-400' : 'text-zinc-500'}`}>
                {done ? 'Done' : mine ? 'Mine' : 'Theirs'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active crystal card */}
      <div className={`bg-gradient-to-br ${cfg.color} rounded-2xl border p-6 shadow-xl ${cfg.glow} space-y-5`}>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{cfg.emoji}</span>
          <div>
            <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider">{isMine ? '⚡ Your task' : '🔒 Partner\'s task'}</p>
            <h3 className="text-xl font-extrabold text-white">{activeCrystal.name}</h3>
          </div>
          {isDone && <span className="ml-auto text-emerald-400 text-2xl">✅</span>}
          {!isMine && !isDone && <Lock className="ml-auto w-5 h-5 text-zinc-500" />}
        </div>

        {isMine && !isDone && (
          <div className="space-y-4">
            <div className="bg-black/30 rounded-xl p-4 space-y-2">
              <p className="text-xs font-mono text-amber-400 font-bold">{activeCrystal.puzzle.title}</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{activeCrystal.puzzle.description}</p>
              {activeCrystal.puzzle.initialCode && (
                <pre className="bg-black/60 rounded-lg p-3 text-xs font-mono text-emerald-400 overflow-x-auto mt-2">
                  {activeCrystal.puzzle.initialCode}
                </pre>
              )}
            </div>

            {activeCrystal.puzzle.options ? (
              <div className="grid grid-cols-2 gap-2">
                {activeCrystal.puzzle.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => { setUserAnswer(opt); handleShatter(opt); }}
                    disabled={submitting}
                    className={`py-3 px-4 rounded-xl text-sm font-mono font-bold border transition-all cursor-pointer ${
                      userAnswer === opt ? 'bg-red-700 border-red-500 text-white' : 'bg-black/30 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                    } ${submitting ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleShatter()}
                  placeholder="Your answer..."
                  className="w-full bg-black/40 border border-zinc-700 focus:border-red-500 text-white font-mono text-sm px-4 py-3 rounded-xl outline-none transition-colors placeholder:text-zinc-600"
                />
                <button
                  onClick={() => handleShatter()}
                  disabled={submitting || !userAnswer.trim()}
                  className="w-full py-3 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-mono font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4" /> {submitting ? 'Checking...' : `Shatter Crystal`}
                </button>
              </div>
            )}

            {feedback.message && (
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-mono border ${
                feedback.success
                  ? 'bg-emerald-950/60 border-emerald-600/40 text-emerald-300'
                  : 'bg-red-950/60 border-red-700/40 text-red-300'
              }`}>
                {feedback.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {feedback.message}
              </div>
            )}
          </div>
        )}

        {!isMine && !isDone && (
          <p className="text-sm text-zinc-500 font-mono text-center">
            This crystal belongs to your partner. Focus on yours!
          </p>
        )}

        {isDone && (
          <p className="text-sm text-emerald-400 font-mono text-center">Crystal shattered! Fragment collected ✓</p>
        )}
      </div>

      {/* Mini overall progress */}
      <div className="text-center text-xs text-zinc-500 font-mono">
        {destroyed.length}/4 crystals shattered · {4 - destroyed.length} remaining
      </div>
    </div>
  );
};
