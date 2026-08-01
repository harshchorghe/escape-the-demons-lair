"use client";

import React, { useState, useEffect } from "react";
import { GameGameState, gameSync } from "@/lib/gameStore";
import { pythonApi, Level2DoorData, FALLBACK_L2_DOORS } from "@/lib/pythonApi";
import { DemonDoorCanvas } from "@/components/3d/DemonDoorCanvas";
import { Level2LockedScreen } from "@/components/screens/Level2LockedScreen";
import { KeyRound, ShieldAlert, CheckCircle, Unlock, AlertTriangle } from "lucide-react";

interface Level2ScreenProps {
  state: GameGameState;
  myRole: 'player1' | 'player2';
}

export const Level2Screen: React.FC<Level2ScreenProps> = ({ state }) => {
  // Gate: show locked screen if Level 1 not yet completed
  if (!state.l1IsCompleted) {
    return <Level2LockedScreen state={state} />;
  }

  const [doors, setDoors] = useState<Level2DoorData[]>(FALLBACK_L2_DOORS);
  const [selectedDoorId, setSelectedDoorId] = useState<number>(1);
  const [cipherInput, setCipherInput] = useState<string>('');
  const [feedback, setFeedback] = useState<{ success?: boolean; message: string }>({ message: '' });

  useEffect(() => {
    const fetchDoors = async () => {
      const data = await pythonApi.getLevel2Doors();
      setDoors(data);
    };
    fetchDoors();
  }, []);

  const currentDoorData = doors.find((d) => d.doorId === selectedDoorId) || doors[0];
  const isDoorUnlocked = state.l2UnlockedDoors.includes(selectedDoorId);

  const handleUnlockDoor = async () => {
    if (!cipherInput.trim()) return;
    setFeedback({ message: 'Decrypting ancient door runes...' });

    const result = await pythonApi.verifyAnswer(currentDoorData.puzzle.id, cipherInput);

    if (result.success) {
      setFeedback({ success: true, message: result.message });
      const updatedUnlocked = Array.from(new Set([...state.l2UnlockedDoors, selectedDoorId]));

      // If all 3 doors unlocked, proceed to Final Throne Room Level 3!
      if (updatedUnlocked.length === 3) {
        gameSync.updateState({
          l2UnlockedDoors: updatedUnlocked,
          currentLevel: 3,
          timeRemaining: 300, // 5 mins for Final Level
        });
      } else {
        gameSync.updateState({ l2UnlockedDoors: updatedUnlocked });
        if (selectedDoorId < 3) {
          setSelectedDoorId(selectedDoorId + 1);
          setCipherInput('');
        }
      }
    } else {
      // Time penalty for incorrect door decoding!
      setFeedback({ success: false, message: `${result.message} (-15 sec Penalty Applied)` });
      gameSync.updateState((prev) => ({
        ...prev,
        timeRemaining: Math.max(1, prev.timeRemaining - 15),
        timePenalties: prev.timePenalties + 15,
      }));
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Level Header */}
      <div className="bg-zinc-950/90 border border-purple-900/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-xl font-bold font-serif text-purple-400 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-purple-500 animate-pulse" />
            Level 2: The 3 Demon Doors
          </h2>
          <p className="text-xs text-zinc-400">
            Player 2 must decode ciphers for 3 Demon Doors within 3 minutes. Wrong attempts cost -15 seconds!
          </p>
        </div>

        {/* Door Selector Tabs */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((dId) => {
            const unlocked = state.l2UnlockedDoors.includes(dId);
            const active = selectedDoorId === dId;
            return (
              <button
                key={dId}
                onClick={() => {
                  setSelectedDoorId(dId);
                  setCipherInput('');
                  setFeedback({ message: '' });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                  active
                    ? 'bg-purple-700 text-white border border-purple-500 shadow-md'
                    : unlocked
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-600/50'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                {unlocked ? <CheckCircle className="w-3.5 h-3.5" /> : null}
                Door {dId} {doors[dId - 1]?.symbol || ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3D Demon Door Scene */}
      <DemonDoorCanvas
        selectedDoorId={selectedDoorId}
        unlockedDoors={state.l2UnlockedDoors}
        onDoorClick={(id) => setSelectedDoorId(id)}
      />

      {/* Active Door Challenge Panel */}
      <div className="bg-zinc-950/90 border border-purple-900/50 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <span className="text-xs font-mono text-purple-400 uppercase tracking-widest">
              Demon Door {currentDoorData.doorId} of 3
            </span>
            <h3 className="text-2xl font-bold text-white font-serif flex items-center gap-2">
              <span>{currentDoorData.symbol}</span>
              <span>{currentDoorData.name}</span>
            </h3>
          </div>
          <span className="text-xs font-mono bg-purple-950/60 border border-purple-700/40 text-purple-300 px-3 py-1 rounded-full">
            Cipher Code Length: {currentDoorData.codeLength}
          </span>
        </div>

        {/* Cipher Box */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="text-purple-300 font-mono text-sm font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-purple-400" />
            {currentDoorData.puzzle.title}
          </div>
          <p className="text-xs text-zinc-300 font-mono leading-normal">
            {currentDoorData.puzzle.description}
          </p>

          <div className="pt-2">
            <label className="block text-xs font-mono text-zinc-400 uppercase mb-1">
              Enter Decoded Cipher Sequence
            </label>
            <input
              type="text"
              value={cipherInput}
              onChange={(e) => setCipherInput(e.target.value.toUpperCase())}
              placeholder="e.g. 101010 or ABJLI"
              disabled={isDoorUnlocked}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500 text-purple-200 font-mono text-base tracking-wider px-3 py-2.5 rounded-lg outline-none uppercase"
            />
          </div>

          {currentDoorData.puzzle.hint && (
            <div className="text-xs font-mono text-amber-300/90 bg-amber-950/20 border border-amber-900/30 p-2.5 rounded-lg">
              💡 Cipher Hint: {currentDoorData.puzzle.hint}
            </div>
          )}

          {feedback.message && (
            <div
              className={`p-3 rounded-lg text-xs font-mono border flex items-center gap-2 ${
                feedback.success
                  ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                  : 'bg-red-950/50 border-red-500/50 text-red-300 animate-bounce'
              }`}
            >
              {feedback.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="pt-2">
            {!isDoorUnlocked ? (
              <button
                onClick={handleUnlockDoor}
                className="w-full bg-purple-700 hover:bg-purple-600 text-white font-mono text-sm py-3 rounded-xl font-bold transition-all shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" /> Break Demon Seal & Open Door
              </button>
            ) : (
              <div className="p-3 bg-emerald-950/50 border border-emerald-600/50 rounded-xl text-center text-xs font-mono text-emerald-300 flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" /> Door {selectedDoorId} Unlocked & Passed!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
