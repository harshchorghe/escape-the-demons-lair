"use client";

import React, { useState } from "react";
import { RotateCw, Sparkles, HelpCircle, RefreshCw } from "lucide-react";

interface RubiksCubePuzzleProps {
  onSolve: (answer: string) => void;
}

// 6 faces of a 2x2 Rubik's cube:
// 0: Front (Red), 1: Right (Blue), 2: Back (Orange), 3: Left (Green), 4: Top (Yellow), 5: Bottom (Purple/White)
type FaceColor = 'red' | 'blue' | 'amber' | 'emerald' | 'purple' | 'cyan';

const FACE_COLORS: Record<FaceColor, string> = {
  red: 'bg-red-600 border-red-400 shadow-red-500/50',
  blue: 'bg-blue-600 border-blue-400 shadow-blue-500/50',
  amber: 'bg-amber-500 border-amber-300 shadow-amber-500/50',
  emerald: 'bg-emerald-600 border-emerald-400 shadow-emerald-500/50',
  purple: 'bg-purple-600 border-purple-400 shadow-purple-500/50',
  cyan: 'bg-cyan-500 border-cyan-300 shadow-cyan-500/50',
};

const FACE_NAMES = ["Front (Flame)", "Right (Abyss)", "Back (Amber)", "Left (Nature)", "Top (Void)", "Bottom (Crystal)"];

// Solved cube state: each face has 4 tiles of its own color
const SOLVED_STATE: FaceColor[][] = [
  ['red', 'red', 'red', 'red'],
  ['blue', 'blue', 'blue', 'blue'],
  ['amber', 'amber', 'amber', 'amber'],
  ['emerald', 'emerald', 'emerald', 'emerald'],
  ['purple', 'purple', 'purple', 'purple'],
  ['cyan', 'cyan', 'cyan', 'cyan'],
];

// Preset scrambles (3 moves from solved) so it's fun & solvable in 60s
const SCRAMBLED_STATE: FaceColor[][] = [
  ['red', 'blue', 'red', 'blue'],
  ['blue', 'purple', 'blue', 'purple'],
  ['amber', 'amber', 'amber', 'amber'],
  ['emerald', 'emerald', 'emerald', 'emerald'],
  ['purple', 'red', 'purple', 'red'],
  ['cyan', 'cyan', 'cyan', 'cyan'],
];

export const RubiksCubePuzzle: React.FC<RubiksCubePuzzleProps> = ({ onSolve }) => {
  const [cube, setCube] = useState<FaceColor[][]>(SCRAMBLED_STATE);
  const [moveCount, setMoveCount] = useState<number>(0);
  const [solved, setSolved] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<number>(0); // active face tab

  // Check if solved
  const isSolved = (state: FaceColor[][]): boolean => {
    return state.every((face) => face.every((color) => color === face[0]));
  };

  const handleStateChange = (newState: FaceColor[][]) => {
    setCube(newState);
    const newMoves = moveCount + 1;
    setMoveCount(newMoves);
    if (isSolved(newState)) {
      setSolved(true);
      setTimeout(() => onSolve("RUBIK_SOLVED"), 500);
    }
  };

  // Rotate a face clockwise
  const rotateFaceCW = (faceIdx: number) => {
    const next = cube.map((f) => [...f]);
    const f = next[faceIdx];
    next[faceIdx] = [f[2], f[0], f[3], f[1]];
    handleStateChange(next);
  };

  // Shift Top Row horizontally
  const shiftTopRowRight = () => {
    const next = cube.map((f) => [...f]);
    const fTop = [next[0][0], next[0][1]];
    const rTop = [next[1][0], next[1][1]];
    const bTop = [next[2][0], next[2][1]];
    const lTop = [next[3][0], next[3][1]];

    next[0][0] = lTop[0]; next[0][1] = lTop[1];
    next[1][0] = fTop[0]; next[1][1] = fTop[1];
    next[2][0] = rTop[0]; next[2][1] = rTop[1];
    next[3][0] = bTop[0]; next[3][1] = bTop[1];
    handleStateChange(next);
  };

  // Shift Bottom Row horizontally
  const shiftBottomRowRight = () => {
    const next = cube.map((f) => [...f]);
    const fBot = [next[0][2], next[0][3]];
    const rBot = [next[1][2], next[1][3]];
    const bBot = [next[2][2], next[2][3]];
    const lBot = [next[3][2], next[3][3]];

    next[0][2] = lBot[0]; next[0][3] = lBot[1];
    next[1][2] = fBot[0]; next[1][3] = fBot[1];
    next[2][2] = rBot[0]; next[2][3] = rBot[1];
    next[3][2] = bBot[0]; next[3][1] = bBot[1];
    handleStateChange(next);
  };

  // Shift Right Column vertically
  const shiftRightColUp = () => {
    const next = cube.map((f) => [...f]);
    const fCol = [next[0][1], next[0][3]];
    const tCol = [next[4][1], next[4][3]];
    const bCol = [next[2][2], next[2][0]];
    const botCol = [next[5][1], next[5][3]];

    next[0][1] = botCol[0]; next[0][3] = botCol[1];
    next[4][1] = fCol[0];   next[4][3] = fCol[1];
    next[2][2] = tCol[0];   next[2][0] = tCol[1];
    next[5][1] = bCol[0];   next[5][3] = bCol[1];
    handleStateChange(next);
  };

  const handleReset = () => {
    setCube(SCRAMBLED_STATE);
    setMoveCount(0);
    setSolved(false);
  };

  const handleAutoSolve = () => {
    setCube(SOLVED_STATE);
    setSolved(true);
    setTimeout(() => onSolve("RUBIK_SOLVED"), 400);
  };

  return (
    <div className="space-y-5 bg-black/40 backdrop-blur-md border border-red-900/40 rounded-2xl p-5 text-white">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <h3 className="text-lg font-bold font-serif text-red-400 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            The Rubik's Orb of Chaos
          </h3>
          <p className="text-xs text-zinc-400">
            Align all colors so every face of the orb has a uniform color palette.
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono text-zinc-400">Moves: <strong className="text-white">{moveCount}</strong></span>
        </div>
      </div>

      {/* Face Selector Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {FACE_NAMES.map((name, idx) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === idx
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Main Cube Grid View & Rotators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Active Face 2x2 Display */}
        <div className="flex flex-col items-center justify-center p-4 bg-zinc-950/80 rounded-xl border border-zinc-800 relative">
          <span className="text-xs font-mono text-zinc-400 mb-3 font-bold uppercase tracking-wider">
            Viewing: {FACE_NAMES[activeTab]}
          </span>

          <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl">
            {cube[activeTab].map((color, tileIdx) => (
              <div
                key={tileIdx}
                className={`w-16 h-16 rounded-lg border-2 shadow-md transition-all duration-300 transform hover:scale-105 flex items-center justify-center font-mono font-bold text-xs text-white/90 ${FACE_COLORS[color]}`}
              >
                {color.substring(0, 3).toUpperCase()}
              </div>
            ))}
          </div>

          <button
            onClick={() => rotateFaceCW(activeTab)}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-red-950/80 hover:bg-red-900 border border-red-700 rounded-xl text-xs font-mono font-bold text-red-200 transition-all cursor-pointer active:scale-95"
          >
            <RotateCw className="w-4 h-4 text-red-400" />
            Rotate Face Clockwise
          </button>
        </div>

        {/* Global Controls */}
        <div className="space-y-3">
          <span className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider block">
            Multi-Face Controls
          </span>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={shiftTopRowRight}
              className="px-3 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-mono font-bold text-zinc-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 text-blue-400" />
              Shift Top Row →
            </button>
            <button
              onClick={shiftBottomRowRight}
              className="px-3 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-mono font-bold text-zinc-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
              Shift Bottom Row →
            </button>
            <button
              onClick={shiftRightColUp}
              className="px-3 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-mono font-bold text-zinc-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer col-span-2"
            >
              <RotateCw className="w-3.5 h-3.5 text-purple-400" />
              Shift Right Column ↑
            </button>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-zinc-800">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Scramble
            </button>

            <button
              onClick={() => setShowHint(!showHint)}
              className="flex items-center gap-1 text-xs font-mono text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {showHint ? 'Hide Hint' : 'Show Hint'}
            </button>
          </div>

          {showHint && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-xl text-xs font-mono text-amber-300 space-y-1">
              <p>💡 <strong>Hint:</strong> Shift Top Row → then Rotate Face Clockwise on Front face twice to line up all matching colors!</p>
              <button
                onClick={handleAutoSolve}
                className="mt-1 text-[11px] underline text-amber-400 hover:text-white cursor-pointer"
              >
                Instant Altar Channeling (Auto Solve)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Success banner */}
      {solved && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500 rounded-xl text-center space-y-1 animate-bounce">
          <p className="text-emerald-300 font-extrabold font-serif text-lg">✨ Rubik's Orb Solved! Altar Energy Restored!</p>
          <p className="text-xs text-emerald-400 font-mono">Teleporting room progress...</p>
        </div>
      )}
    </div>
  );
};
