"use client";

import React, { useState } from "react";
import { Sparkles, RefreshCw, HelpCircle, CheckCircle } from "lucide-react";

interface GemSliderPuzzleProps {
  onSolve: (answer: string) => void;
}

const RUNES = ["🔥", "💀", "👁️", "⚡", "🔮", "🗡️", "⛓️", "🩸"];
const TARGET_GRID = [1, 2, 3, 4, 5, 6, 7, 8, null];

// Easy solvable starting state (2 moves away from target for fast 60s gameplay!)
const INITIAL_GRID = [1, 2, 3, 4, 5, 6, 7, null, 8];

export const GemSliderPuzzle: React.FC<GemSliderPuzzleProps> = ({ onSolve }) => {
  const [grid, setGrid] = useState<(number | null)[]>(INITIAL_GRID);
  const [moveCount, setMoveCount] = useState<number>(0);
  const [isSolved, setIsSolved] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);

  const checkSolved = (currentGrid: (number | null)[]) => {
    const solved = currentGrid.every((val, idx) => val === TARGET_GRID[idx]);
    if (solved && !isSolved) {
      setIsSolved(true);
      setTimeout(() => onSolve("SLIDER_SOLVED"), 500);
    }
  };

  const handleTileClick = (index: number) => {
    if (grid[index] === null || isSolved) return;

    const emptyIndex = grid.indexOf(null);
    const row = Math.floor(index / 3);
    const col = index % 3;
    const emptyRow = Math.floor(emptyIndex / 3);
    const emptyCol = emptyIndex % 3;

    // Check if adjacent (same row & diff col by 1 OR same col & diff row by 1)
    const isAdjacent =
      (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
      (col === emptyCol && Math.abs(row - emptyRow) === 1);

    if (isAdjacent) {
      const newGrid = [...grid];
      newGrid[emptyIndex] = newGrid[index];
      newGrid[index] = null;
      setGrid(newGrid);
      setMoveCount(moveCount + 1);
      checkSolved(newGrid);
    }
  };

  const handleReset = () => {
    setGrid(INITIAL_GRID);
    setMoveCount(0);
    setIsSolved(false);
  };

  const handleAutoSolve = () => {
    setGrid(TARGET_GRID);
    setIsSolved(true);
    setTimeout(() => onSolve("SLIDER_SOLVED"), 400);
  };

  return (
    <div className="space-y-5 bg-black/40 backdrop-blur-md border border-purple-900/40 rounded-2xl p-5 text-white">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <h3 className="text-lg font-bold font-serif text-purple-400 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Demonic Gem Slider Altar
          </h3>
          <p className="text-xs text-zinc-400">
            Slide the demonic rune tiles into numerical order from 1 to 8.
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono text-zinc-400">Moves: <strong className="text-white">{moveCount}</strong></span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex justify-center my-4">
        <div className="grid grid-cols-3 gap-3 p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800 shadow-2xl">
          {grid.map((num, idx) => {
            if (num === null) {
              return (
                <div
                  key={idx}
                  className="w-20 h-20 rounded-xl bg-black/60 border border-dashed border-zinc-800"
                />
              );
            }

            return (
              <button
                key={idx}
                onClick={() => handleTileClick(idx)}
                className="w-20 h-20 rounded-xl bg-gradient-to-br from-purple-900/80 to-indigo-950 border border-purple-500/50 shadow-lg shadow-purple-900/30 flex flex-col items-center justify-center hover:border-purple-400 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <span className="text-2xl">{RUNES[num - 1]}</span>
                <span className="text-xs font-mono font-bold text-purple-200 mt-1">Rune {num}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
        <button
          onClick={handleReset}
          className="flex items-center gap-1 text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset Slider
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
          <p>💡 <strong>Hint:</strong> Click Rune 8 to slide it into the empty slot on the bottom right!</p>
          <button
            onClick={handleAutoSolve}
            className="mt-1 text-[11px] underline text-amber-400 hover:text-white cursor-pointer"
          >
            Empower Void Altar (Auto Solve)
          </button>
        </div>
      )}

      {isSolved && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500 rounded-xl text-center space-y-1 animate-bounce">
          <p className="text-emerald-300 font-extrabold font-serif text-lg flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            Demonic Runes Aligned! Altar Unlocked!
          </p>
          <p className="text-xs text-emerald-400 font-mono">Teleporting room progress...</p>
        </div>
      )}
    </div>
  );
};
