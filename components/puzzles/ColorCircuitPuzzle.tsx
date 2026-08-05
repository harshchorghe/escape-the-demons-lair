"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Zap, RotateCw, RefreshCw, HelpCircle, CheckCircle2 } from "lucide-react";

interface ColorCircuitPuzzleProps {
  onSolve: (answer: string) => void;
}

// Direction vectors: 0: Top, 1: Right, 2: Bottom, 3: Left
type Dir = 0 | 1 | 2 | 3;

interface Tile {
  id: number;
  row: number;
  col: number;
  type: 'source' | 'receiver' | 'straight' | 'corner' | 'cross';
  color?: 'red' | 'blue' | 'emerald';
  rotation: number; // 0, 90, 180, 270 degrees
  // Open ports at 0-degree rotation (0: Top, 1: Right, 2: Bottom, 3: Left)
  basePorts: Dir[];
}

// Helper to get active ports given rotation
function getActivePorts(tile: Tile): Dir[] {
  const shifts = (tile.rotation / 90) % 4;
  return tile.basePorts.map((p) => ((p + shifts) % 4) as Dir);
}

const INITIAL_TILES: Tile[] = [
  // Row 0
  { id: 0, row: 0, col: 0, type: 'source', color: 'red', rotation: 90, basePorts: [1] },
  { id: 1, row: 0, col: 1, type: 'straight', rotation: 90, basePorts: [0, 2] }, // needs 90 or 270 (horizontal 1,3)
  { id: 2, row: 0, col: 2, type: 'corner', rotation: 180, basePorts: [1, 2] },
  // Row 1
  { id: 3, row: 1, col: 0, type: 'source', color: 'blue', rotation: 90, basePorts: [1] },
  { id: 4, row: 1, col: 1, type: 'cross', rotation: 0, basePorts: [0, 1, 2, 3] },
  { id: 5, row: 1, col: 2, type: 'receiver', color: 'red', rotation: 270, basePorts: [3] },
  // Row 2
  { id: 6, row: 2, col: 0, type: 'straight', rotation: 0, basePorts: [0, 2] },
  { id: 7, row: 2, col: 1, type: 'corner', rotation: 0, basePorts: [0, 1] },
  { id: 8, row: 2, col: 2, type: 'receiver', color: 'blue', rotation: 270, basePorts: [3] },
];

const SOLVED_ROTATIONS = [90, 90, 180, 90, 0, 270, 0, 0, 270];

export const ColorCircuitPuzzle: React.FC<ColorCircuitPuzzleProps> = ({ onSolve }) => {
  const [tiles, setTiles] = useState<Tile[]>(INITIAL_TILES);
  const [poweredReceivers, setPoweredReceivers] = useState<Set<number>>(new Set());
  const [isSolved, setIsSolved] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);

  // Check connectivity using BFS
  const checkConnectivity = useCallback((currentTiles: Tile[]) => {
    const grid: (Tile | null)[][] = Array.from({ length: 3 }, () => Array(3).fill(null));
    currentTiles.forEach((t) => { grid[t.row][t.col] = t; });

    const sources = currentTiles.filter((t) => t.type === 'source');
    const powered = new Set<number>();

    sources.forEach((src) => {
      const visited = new Set<number>();
      const queue: Tile[] = [src];
      visited.add(src.id);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const currPorts = getActivePorts(curr);

        // Check neighbors
        const neighborCoords: { dir: Dir; r: number; c: number; opp: Dir }[] = [
          { dir: 0, r: curr.row - 1, c: curr.col, opp: 2 },
          { dir: 1, r: curr.row, c: curr.col + 1, opp: 3 },
          { dir: 2, r: curr.row + 1, c: curr.col, opp: 0 },
          { dir: 3, r: curr.row, c: curr.col - 1, opp: 1 },
        ];

        neighborCoords.forEach(({ dir, r, c, opp }) => {
          if (currPorts.includes(dir) && r >= 0 && r < 3 && c >= 0 && c < 3) {
            const neighbor = grid[r][c];
            if (neighbor && !visited.has(neighbor.id)) {
              const nPorts = getActivePorts(neighbor);
              if (nPorts.includes(opp)) {
                visited.add(neighbor.id);
                if (neighbor.type === 'receiver' && neighbor.color === src.color) {
                  powered.add(neighbor.id);
                } else {
                  queue.push(neighbor);
                }
              }
            }
          }
        });
      }
    });

    setPoweredReceivers(powered);

    const totalReceivers = currentTiles.filter((t) => t.type === 'receiver').length;
    if (powered.size >= totalReceivers && !isSolved) {
      setIsSolved(true);
      setTimeout(() => onSolve("CIRCUIT_SOLVED"), 500);
    }
  }, [isSolved, onSolve]);

  useEffect(() => {
    checkConnectivity(tiles);
  }, [tiles, checkConnectivity]);

  const rotateTile = (id: number) => {
    const updated = tiles.map((t) => {
      if (t.id === id) {
        return { ...t, rotation: (t.rotation + 90) % 360 };
      }
      return t;
    });
    setTiles(updated);
  };

  const handleReset = () => {
    setTiles(INITIAL_TILES);
    setIsSolved(false);
  };

  const handleAutoSolve = () => {
    const solved = tiles.map((t, idx) => ({ ...t, rotation: SOLVED_ROTATIONS[idx] }));
    setTiles(solved);
  };

  return (
    <div className="space-y-5 bg-black/40 backdrop-blur-md border border-cyan-900/40 rounded-2xl p-5 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <h3 className="text-lg font-bold font-serif text-cyan-400 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Color Circuit Power Grid
          </h3>
          <p className="text-xs text-zinc-400">
            Rotate circuit tiles to connect power sources to matching energy receivers.
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono text-cyan-400 font-bold">
            Powered: {poweredReceivers.size} / 2
          </span>
        </div>
      </div>

      {/* Grid Canvas */}
      <div className="flex justify-center my-4">
        <div className="grid grid-cols-3 gap-3 p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800 shadow-2xl relative">
          {tiles.map((tile) => {
            const isPoweredRec = tile.type === 'receiver' && poweredReceivers.has(tile.id);
            const isSource = tile.type === 'source';

            return (
              <button
                key={tile.id}
                onClick={() => rotateTile(tile.id)}
                className={`w-20 h-20 rounded-xl border-2 flex flex-col items-center justify-center relative transition-all duration-300 transform active:scale-95 cursor-pointer ${
                  isSource
                    ? tile.color === 'red' ? 'bg-red-950/80 border-red-500 shadow-red-500/40' : 'bg-blue-950/80 border-blue-500 shadow-blue-500/40'
                    : isPoweredRec
                    ? 'bg-emerald-950/90 border-emerald-400 shadow-emerald-400/50 shadow-lg animate-pulse'
                    : tile.type === 'receiver'
                    ? 'bg-zinc-900 border-zinc-700 opacity-60'
                    : 'bg-zinc-900/90 border-zinc-700 hover:border-cyan-500 hover:bg-zinc-800'
                }`}
              >
                {/* Ports SVG wires */}
                <svg className="absolute inset-0 w-full h-full p-2" viewBox="0 0 100 100">
                  <g transform={`rotate(${tile.rotation} 50 50)`}>
                    {tile.type === 'straight' && (
                      <line x1="50" y1="0" x2="50" y2="100" stroke={tile.rotation % 180 === 0 ? "#06b6d4" : "#38bdf8"} strokeWidth="12" strokeLinecap="round" />
                    )}
                    {tile.type === 'corner' && (
                      <path d="M 50 0 L 50 50 L 100 50" fill="none" stroke="#38bdf8" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                    {tile.type === 'cross' && (
                      <g stroke="#38bdf8" strokeWidth="12" strokeLinecap="round">
                        <line x1="50" y1="0" x2="50" y2="100" />
                        <line x1="0" y1="50" x2="100" y2="50" />
                      </g>
                    )}
                    {tile.type === 'source' && (
                      <circle cx="50" cy="50" r="22" fill={tile.color === 'red' ? '#ef4444' : '#3b82f6'} className="animate-pulse" />
                    )}
                    {tile.type === 'receiver' && (
                      <rect x="30" y="30" width="40" height="40" rx="8" fill={isPoweredRec ? '#10b981' : '#4b5563'} />
                    )}
                  </g>
                </svg>

                <RotateCw className="w-3 h-3 text-white/40 absolute bottom-1 right-1 opacity-0 hover:opacity-100 transition-opacity" />

                {/* Node Labels */}
                {isSource && (
                  <span className="text-[10px] font-mono font-bold text-white z-10 uppercase tracking-tighter">
                    {tile.color} SRC
                  </span>
                )}
                {tile.type === 'receiver' && (
                  <span className="text-[10px] font-mono font-bold text-white z-10 uppercase tracking-tighter">
                    {tile.color} {isPoweredRec ? 'ON' : 'OFF'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-center border-t border-zinc-800 pt-3">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl"
        >
          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
          Reset Grid
        </button>
      </div>

      {isSolved && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500 rounded-xl text-center space-y-1 animate-bounce">
          <p className="text-emerald-300 font-extrabold font-serif text-lg flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            Circuit Fully Powered! Gate Unlocked!
          </p>
          <p className="text-xs text-emerald-400 font-mono">Teleporting room progress...</p>
        </div>
      )}
    </div>
  );
};
