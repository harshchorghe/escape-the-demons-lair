"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ShieldAlert, Sparkles, RefreshCw, CheckCircle, Key } from "lucide-react";

interface GravityShiftPuzzleProps {
  chamberId: number; // 1, 2, or 3
  onSolve: (answer: string) => void;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'RIGHT_DOWN' | 'LEFT_DOWN' | 'RIGHT_UP' | 'LEFT_UP';

interface Position {
  r: number;
  c: number;
}

// Cell Types: '.' Empty, 'W' Wall, 'T' Trap/Spike, 'K' Key, 'E' Exit, 'P' Player Start

const STAGE_MAPS: Record<number, string[][]> = {
  1: [
    ['W','W','W','W','W','W','W','W','W','W'],
    ['W','P','.','.','.','.','.','.','.','W'],
    ['W','.','W','.','T','.','W','.','K','W'],
    ['W','.','.','.','.','W','.','T','.','W'],
    ['W','.','T','W','.','.','.','.','.','W'],
    ['W','K','.','.','.','T','W','.','T','W'],
    ['W','.','W','.','T','.','.','.','.','W'],
    ['W','.','T','.','W','.','.','K','.','W'],
    ['W','.','.','K','T','.','.','W','E','W'],
    ['W','W','W','W','W','W','W','W','W','W'],
  ],
  2: [
    ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
    ['W', 'P', '.', '.', '.', '.', '.', 'W'],
    ['W', '.', 'W', '.', 'T', '.', '.', 'W'],
    ['W', '.', '.', '.', '.', '.', 'K', 'W'],
    ['W', '.', '.', 'W', '.', 'W', '.', 'W'],
    ['W', 'K', '.', '.', '.', 'T', '.', 'W'],
    ['W', '.', '.', '.', '.', '.', 'E', 'W'],
    ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
  ],
  3: [
    ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
    ['W', 'P', '.', '.', '.', 'W', '.', '.', 'W'],
    ['W', '.', 'W', '.', 'T', '.', '.', '.', 'W'],
    ['W', '.', '.', '.', '.', '.', '.', 'K', 'W'],
    ['W', '.', 'T', '.', 'W', '.', '.', '.', 'W'],
    ['W', 'K', '.', '.', '.', '.', '.', '.', 'W'],
    ['W', '.', '.', '.', 'T', '.', 'K', '.', 'W'],
    ['W', '.', '.', '.', '.', '.', '.', 'E', 'W'],
    ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
  ],
};

function buildBaseMap(raw: string[][]): string[][] {
  return raw.map(row => row.map(cell => (cell === 'P' ? '.' : cell)));
}

function findStart(raw: string[][]): Position {
  for (let r = 0; r < raw.length; r++) {
    for (let c = 0; c < raw[r].length; c++) {
      if (raw[r][c] === 'P') return { r, c };
    }
  }
  return { r: 1, c: 1 };
}

function countKeys(raw: string[][]): number {
  let count = 0;
  raw.forEach(row => row.forEach(cell => { if (cell === 'K') count++; }));
  return count;
}

export const GravityShiftPuzzle: React.FC<GravityShiftPuzzleProps> = ({ chamberId, onSolve }) => {
  const rawMap = STAGE_MAPS[chamberId] || STAGE_MAPS[1];
  const baseMap = buildBaseMap(rawMap);
  const startPos = findStart(rawMap);
  const totalKeys = countKeys(rawMap);

  const [player, setPlayer] = useState<Position>(startPos);
  const [collectedKeySet, setCollectedKeySet] = useState<Set<string>>(new Set());
  const [gravityDir, setGravityDir] = useState<Direction | null>(null);
  const [moveCount, setMoveCount] = useState<number>(0);
  const [trapHit, setTrapHit] = useState<boolean>(false);
  const [isSolved, setIsSolved] = useState<boolean>(false);

  const collectedKeys = collectedKeySet.size;

  const shiftGravity = useCallback((dir: Direction) => {
    if (isSolved) return;

    setGravityDir(dir);
    setTrapHit(false);

    const dr = (dir.includes('DOWN') ? 1 : 0) + (dir.includes('UP') ? -1 : 0);
    const dc = (dir.includes('RIGHT') ? 1 : 0) + (dir.includes('LEFT') ? -1 : 0);

    const nextR = player.r + dr;
    const nextC = player.c + dc;

    // Bounds check
    if (nextR < 0 || nextR >= baseMap.length || nextC < 0 || nextC >= baseMap[0].length) return;

    const baseCell = baseMap[nextR][nextC];
    const keyId = `${nextR},${nextC}`;

    // Wall check: cannot move into wall
    if (baseCell === 'W') return;

    // Increment move count on valid step
    setMoveCount(prev => prev + 1);

    // Trap check: stepping into trap resets player to start
    if (baseCell === 'T') {
      setTrapHit(true);
      setPlayer(startPos);
      return;
    }

    // Move player exactly 1 block
    setPlayer({ r: nextR, c: nextC });

    // Collect key if present on this cell
    const nextCollectedSet = new Set(collectedKeySet);
    if (baseCell === 'K' && !nextCollectedSet.has(keyId)) {
      nextCollectedSet.add(keyId);
      setCollectedKeySet(nextCollectedSet);
    }

    // Check exit condition
    const totalAfterMove = nextCollectedSet.size;
    const atExit = baseCell === 'E';
    if (atExit && totalAfterMove >= totalKeys) {
      setIsSolved(true);
      setTimeout(() => onSolve("GRAVITY_SOLVED"), 500);
    }
  }, [baseMap, isSolved, player, collectedKeySet, totalKeys, startPos, onSolve]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        ArrowUp: 'UP', KeyW: 'UP', w: 'UP', W: 'UP',
        ArrowDown: 'DOWN', KeyS: 'DOWN', s: 'DOWN', S: 'DOWN',
        ArrowLeft: 'LEFT', KeyA: 'LEFT', a: 'LEFT', A: 'LEFT',
        ArrowRight: 'RIGHT', KeyD: 'RIGHT', d: 'RIGHT', D: 'RIGHT',
        Numpad1: 'LEFT_DOWN',
        Numpad3: 'RIGHT_DOWN',
        Numpad7: 'LEFT_UP',
        Numpad9: 'RIGHT_UP',
      };
      const dir = keyMap[e.code] || keyMap[e.key];
      if (dir) {
        e.preventDefault();
        shiftGravity(dir);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shiftGravity]);

  const handleReset = () => {
    setPlayer(startPos);
    setCollectedKeySet(new Set());
    setMoveCount(0);
    setTrapHit(false);
    setIsSolved(false);
    setGravityDir(null);
  };

  return (
    <div className="space-y-5 bg-black/50 backdrop-blur-md border border-red-900/50 rounded-2xl p-5 text-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <h3 className="text-lg font-bold font-serif text-red-400 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Chamber {chamberId}: Demon Gravity Vault
          </h3>
          <p className="text-xs text-zinc-400">
            Move the Demon 👹 1 block per step — collect all 🗝️ keys then reach the 🌀 exit.
          </p>
        </div>
        <div className="text-right space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400">
            <Key className="w-3.5 h-3.5" />
            Keys: {collectedKeys} / {totalKeys}
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            Shifts: <strong className="text-white">{moveCount}</strong>
          </span>
        </div>
      </div>

      {trapHit && (
        <div className="p-3 bg-red-950/90 border border-red-600/80 rounded-xl text-xs font-mono text-red-300 flex items-center gap-2 animate-bounce">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          <span>💀 Demonic Spikes! Reset to start — keys from this slide lost.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="flex flex-col items-center justify-center p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800 shadow-2xl">
          <div className="grid gap-1 p-3 bg-black/80 rounded-xl border border-zinc-800">
            {baseMap.map((row, rIdx) => (
              <div key={rIdx} className="flex gap-1">
                {row.map((baseCell, cIdx) => {
                  const isPlayer = player.r === rIdx && player.c === cIdx;
                  const isExit = baseCell === 'E';
                  const isWall = baseCell === 'W';
                  const isTrap = baseCell === 'T';
                  const keyId = `${rIdx},${cIdx}`;
                  const isKeyUncollected = baseCell === 'K' && !collectedKeySet.has(keyId);
                  const exitUnlocked = collectedKeys >= totalKeys;

                  return (
                    <div
                      key={cIdx}
                      className={`w-9 h-9 rounded-md flex items-center justify-center text-base font-bold transition-all duration-150 border ${
                        isPlayer
                          ? 'bg-red-700 border-red-500 shadow-lg shadow-red-600/70 scale-110 animate-pulse'
                          : isExit
                          ? exitUnlocked
                            ? 'bg-emerald-600 border-emerald-400 shadow-lg shadow-emerald-500/60 animate-bounce'
                            : 'bg-emerald-950/50 border-emerald-800/40 opacity-60'
                          : isKeyUncollected
                          ? 'bg-amber-950/80 border-amber-500/60 shadow shadow-amber-500/20'
                          : isTrap
                          ? 'bg-red-950/50 border-red-900/60'
                          : isWall
                          ? 'bg-zinc-800 border-zinc-700 shadow-inner'
                          : 'bg-zinc-950/50 border-zinc-900'
                      }`}
                    >
                      {isPlayer
                        ? '👹'
                        : isExit
                        ? '🌀'
                        : isKeyUncollected
                        ? '🗝️'
                        : isTrap
                        ? '💀'
                        : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-3 text-[10px] font-mono text-zinc-400">
            <span>👹 Demon</span>
            <span>🗝️ Key</span>
            <span>🌀 Exit</span>
            <span>💀 Trap</span>
          </div>
        </div>

        <div className="space-y-4">
          <span className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider block text-center">
            Demon Gravity Control Pad
          </span>

          <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
            <button
              onClick={() => shiftGravity('LEFT_UP')}
              title="Up-Left (↖)"
              className={`p-2.5 rounded-xl border font-mono font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                gravityDir === 'LEFT_UP'
                  ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/50'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <span>↖</span>
              <span className="text-[9px] text-zinc-400">UP-LEFT</span>
            </button>

            <button
              onClick={() => shiftGravity('UP')}
              title="Gravity Up (↑)"
              className={`p-2.5 rounded-xl border font-mono font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                gravityDir === 'UP'
                  ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/50'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <ArrowUp className="w-4 h-4 text-red-400" />
              <span className="text-[9px] text-zinc-400">UP (W)</span>
            </button>

            <button
              onClick={() => shiftGravity('RIGHT_UP')}
              title="Up-Right (↗)"
              className={`p-2.5 rounded-xl border font-mono font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                gravityDir === 'RIGHT_UP'
                  ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/50'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <span>↗</span>
              <span className="text-[9px] text-zinc-400">UP-RIGHT</span>
            </button>

            <button
              onClick={() => shiftGravity('LEFT')}
              title="Left (←)"
              className={`p-2.5 rounded-xl border font-mono font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                gravityDir === 'LEFT'
                  ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/50'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <ArrowLeft className="w-4 h-4 text-blue-400" />
              <span className="text-[9px] text-zinc-400">LEFT (A)</span>
            </button>

            <div className="w-full h-full rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-2xl shadow-inner">
              👹
            </div>

            <button
              onClick={() => shiftGravity('RIGHT')}
              title="Right (→)"
              className={`p-2.5 rounded-xl border font-mono font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                gravityDir === 'RIGHT'
                  ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/50'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <ArrowRight className="w-4 h-4 text-emerald-400" />
              <span className="text-[9px] text-zinc-400">RIGHT (D)</span>
            </button>

            <button
              onClick={() => shiftGravity('LEFT_DOWN')}
              title="Left Down (↙)"
              className={`p-2.5 rounded-xl border font-mono font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                gravityDir === 'LEFT_DOWN'
                  ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/50'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <span>↙</span>
              <span className="text-[9px] text-zinc-400">LEFT-DOWN</span>
            </button>

            <button
              onClick={() => shiftGravity('DOWN')}
              title="Gravity Down (↓)"
              className={`p-2.5 rounded-xl border font-mono font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                gravityDir === 'DOWN'
                  ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/50'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <ArrowDown className="w-4 h-4 text-purple-400" />
              <span className="text-[9px] text-zinc-400">DOWN (S)</span>
            </button>

            <button
              onClick={() => shiftGravity('RIGHT_DOWN')}
              title="Right Down (↘)"
              className={`p-2.5 rounded-xl border font-mono font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                gravityDir === 'RIGHT_DOWN'
                  ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/50'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <span>↘</span>
              <span className="text-[9px] text-zinc-400">RIGHT-DOWN</span>
            </button>
          </div>

          <div className="pt-2 flex items-center justify-center border-t border-zinc-800">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              Reset Chamber
            </button>
          </div>
        </div>
      </div>

      {/* Success Overlay */}
      {isSolved && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500 rounded-xl text-center space-y-1">
          <p className="text-emerald-300 font-extrabold font-serif text-lg flex items-center justify-center gap-2 animate-bounce">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            Gravity Portal Reached! Chamber Cleared!
          </p>
          <p className="text-xs text-emerald-400 font-mono">Teleporting room progress...</p>
        </div>
      )}
    </div>
  );
};
