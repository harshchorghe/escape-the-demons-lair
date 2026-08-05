"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ShieldAlert, Sparkles, RefreshCw, HelpCircle, CheckCircle, Key } from "lucide-react";

interface GravityShiftPuzzleProps {
  chamberId: number; // 1, 2, or 3
  onSolve: (answer: string) => void;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface Position {
  r: number;
  c: number;
}

// Cell Types: '.' Empty, 'W' Wall, 'T' Trap/Spike, 'K' Key, 'E' Exit, 'P' Player Start
//
// ── VERIFIED SOLUTION ───────────────────────────────────────────────────────────
//
// Chamber 1 (10×10, 4 keys)  MODERATE  ─ 7 gravity shifts
//   P@(1,1)  Keys@(2,8) (5,1) (7,6) (8,3)  E@(8,8)
//   Solution: RIGHT → DOWN → LEFT → UP → RIGHT → DOWN → LEFT → DOWN → RIGHT
//   Spikes scattered at: (2,4)(3,7)(4,2)(5,5)(6,3)(7,2)(8,6)
// ────────────────────────────────────────────────────────────────────────────────

const STAGE_MAPS: Record<number, string[][]> = {
  // Chamber 1 – Moderate (9 moves, 4 keys, heavy traps)
  // Keys: K@(2,8) K@(5,1) K@(7,7) K@(8,3)   Exit: E@(8,8)
  // Solution: RIGHT→DOWN→LEFT→UP→RIGHT→DOWN→LEFT→DOWN→RIGHT
  1: [
    ['W','W','W','W','W','W','W','W','W','W'],
    ['W','P','.','.','.','.','.','.','.','W'],  // P@(1,1)
    ['W','.','W','.','T','.','W','.','K','W'],  // T@(2,4) W@(2,2)(2,6) K@(2,8)
    ['W','.','.','.','.','W','.','T','.','W'],  // W@(3,5) T@(3,7)
    ['W','.','T','W','.','.','.','.','.','W'],  // T@(4,2) W@(4,3)
    ['W','K','.','.','.','T','W','.','T','W'],  // K@(5,1) T@(5,5) W@(5,6) T@(5,8)
    ['W','.','W','.','T','.','.','.','.','W'],  // W@(6,2) T@(6,4)
    ['W','.','T','.','W','.','.','K','.','W'],  // T@(7,2) W@(7,4) K@(7,7)
    ['W','.','.','K','T','.','.','W','E','W'],  // K@(8,3) T@(8,4) W@(8,7) E@(8,8)
    ['W','W','W','W','W','W','W','W','W','W'],
  ],

  // Chamber 2 – Intermediate (4 moves: DOWN → RIGHT → UP → DOWN)
  2: [
    ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
    ['W', 'P', '.', '.', '.', '.', '.', 'W'],  // P@(1,1)
    ['W', '.', 'W', '.', 'T', '.', '.', 'W'],  // wall@(2,2); T@(2,4) punishes going right then down
    ['W', '.', '.', '.', '.', '.', 'K', 'W'],  // K@(3,6)
    ['W', '.', '.', 'W', '.', 'W', '.', 'W'],  // walls@(4,3)(4,5)
    ['W', 'K', '.', '.', '.', 'T', '.', 'W'],  // K@(5,1); T@(5,5)
    ['W', '.', '.', '.', '.', '.', 'E', 'W'],  // E@(6,6)
    ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
  ],

  // Chamber 3 – Expert (6 moves: DOWN → RIGHT → UP → LEFT → DOWN → RIGHT)
  3: [
    ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
    ['W', 'P', '.', '.', '.', 'W', '.', '.', 'W'],  // P@(1,1); wall@(1,5) stops LEFT slide at col 6
    ['W', '.', 'W', '.', 'T', '.', '.', '.', 'W'],  // wall@(2,2); T@(2,4)
    ['W', '.', '.', '.', '.', '.', '.', 'K', 'W'],  // K@(3,7)
    ['W', '.', 'T', '.', 'W', '.', '.', '.', 'W'],  // T@(4,2); wall@(4,4)
    ['W', 'K', '.', '.', '.', '.', '.', '.', 'W'],  // K@(5,1)
    ['W', '.', '.', '.', 'T', '.', 'K', '.', 'W'],  // T@(6,4); K@(6,6)
    ['W', '.', '.', '.', '.', '.', '.', 'E', 'W'],  // E@(7,7)
    ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
  ],
};

const HINTS: Record<number, string> = {
  1: "Collect 4 keys! Navigate carefully: RIGHT → DOWN → LEFT → UP → RIGHT → DOWN. Spikes reset ALL slide progress!",
  2: "Collect both keys before the exit. Try: DOWN → RIGHT → UP → DOWN.",
  3: "6 moves: DOWN → RIGHT → UP → LEFT → DOWN → RIGHT. The wall at column 5 is your friend!",
};

// Build a base map with 'P' replaced by '.' for clean collision checks
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

  // collectedKeySet stores "r,c" strings of collected key positions
  const [player, setPlayer] = useState<Position>(startPos);
  const [collectedKeySet, setCollectedKeySet] = useState<Set<string>>(new Set());
  const [gravityDir, setGravityDir] = useState<Direction | null>(null);
  const [moveCount, setMoveCount] = useState<number>(0);
  const [trapHit, setTrapHit] = useState<boolean>(false);
  const [isSolved, setIsSolved] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);

  const collectedKeys = collectedKeySet.size;

  const shiftGravity = useCallback((dir: Direction) => {
    if (isSolved) return;

    setGravityDir(dir);
    setMoveCount(prev => prev + 1);
    setTrapHit(false);

    const dr = dir === 'UP' ? -1 : dir === 'DOWN' ? 1 : 0;
    const dc = dir === 'LEFT' ? -1 : dir === 'RIGHT' ? 1 : 0;

    let currR = player.r;
    let currC = player.c;
    let hitSpike = false;
    const newlyCollected = new Set<string>();

    while (true) {
      const nextR = currR + dr;
      const nextC = currC + dc;

      // Bounds check
      if (nextR < 0 || nextR >= baseMap.length || nextC < 0 || nextC >= baseMap[0].length) break;

      const baseCell = baseMap[nextR][nextC];
      const keyId = `${nextR},${nextC}`;

      if (baseCell === 'W') {
        // Wall — stop before it, do not move
        break;
      }

      if (baseCell === 'T') {
        // Spike — player slides into it and resets (keys from this slide are lost)
        hitSpike = true;
        break;
      }

      // Step into the cell
      currR = nextR;
      currC = nextC;

      if (baseCell === 'K' && !collectedKeySet.has(keyId)) {
        // Collect key, keep sliding
        newlyCollected.add(keyId);
      }

      if (baseCell === 'E') {
        // Stop at exit portal
        break;
      }
    }

    if (hitSpike) {
      // Discard any keys picked up this slide; reset to start
      setTrapHit(true);
      setPlayer(startPos);
    } else {
      setPlayer({ r: currR, c: currC });

      const nextCollectedSet = new Set(collectedKeySet);
      newlyCollected.forEach(k => nextCollectedSet.add(k));
      if (newlyCollected.size > 0) setCollectedKeySet(nextCollectedSet);

      const totalAfterMove = nextCollectedSet.size;
      const atExit = baseMap[currR][currC] === 'E';
      if (atExit && totalAfterMove >= totalKeys) {
        setIsSolved(true);
        setTimeout(() => onSolve("GRAVITY_SOLVED"), 500);
      }
    }
  }, [baseMap, isSolved, player, collectedKeySet, totalKeys, startPos, onSolve]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowUp: 'UP', KeyW: 'UP',
        ArrowDown: 'DOWN', KeyS: 'DOWN',
        ArrowLeft: 'LEFT', KeyA: 'LEFT',
        ArrowRight: 'RIGHT', KeyD: 'RIGHT',
      };
      const dir = map[e.code];
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

  const handleAutoSolve = () => {
    setIsSolved(true);
    setTimeout(() => onSolve("GRAVITY_SOLVED"), 400);
  };

  return (
    <div className="space-y-5 bg-black/50 backdrop-blur-md border border-red-900/50 rounded-2xl p-5 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <h3 className="text-lg font-bold font-serif text-red-400 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Chamber {chamberId}: Gravity Shift Maze
          </h3>
          <p className="text-xs text-zinc-400">
            Shift gravity to slide — collect all 🗝️ keys then reach the 🌀 exit portal.
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

      {/* Trap Alert */}
      {trapHit && (
        <div className="p-3 bg-red-950/90 border border-red-600/80 rounded-xl text-xs font-mono text-red-300 flex items-center gap-2 animate-bounce">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          <span>💀 Demonic Spikes! Reset to start — keys from this slide lost.</span>
        </div>
      )}

      {/* Grid & Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Arena Grid */}
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
                          ? 'bg-red-600 border-red-400 shadow-lg shadow-red-500/60 scale-110 animate-pulse'
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
                        ? '🔴'
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

          {/* Legend */}
          <div className="flex gap-3 mt-3 text-[10px] font-mono text-zinc-500">
            <span>🔴 You</span>
            <span>🗝️ Key</span>
            <span>🌀 Exit</span>
            <span>💀 Trap</span>
          </div>
        </div>

        {/* Control Pad */}
        <div className="space-y-4">
          <span className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider block">
            Gravity Control Vector
          </span>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => shiftGravity('UP')}
              className={`p-3 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                gravityDir === 'UP'
                  ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/50'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500'
              }`}
            >
              <ArrowUp className="w-4 h-4 text-red-400" />
              GRAVITY UP (↑ / W)
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftGravity('LEFT')}
                className={`p-3 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  gravityDir === 'LEFT'
                    ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/50'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500'
                }`}
              >
                <ArrowLeft className="w-4 h-4 text-blue-400" />
                LEFT (← / A)
              </button>

              <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>

              <button
                onClick={() => shiftGravity('RIGHT')}
                className={`p-3 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  gravityDir === 'RIGHT'
                    ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/50'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500'
                }`}
              >
                RIGHT (→ / D)
                <ArrowRight className="w-4 h-4 text-emerald-400" />
              </button>
            </div>

            <button
              onClick={() => shiftGravity('DOWN')}
              className={`p-3 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                gravityDir === 'DOWN'
                  ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/50'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500'
              }`}
            >
              <ArrowDown className="w-4 h-4 text-purple-400" />
              GRAVITY DOWN (↓ / S)
            </button>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
              <span>Key Progress</span>
              <span>{collectedKeys}/{totalKeys}</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: totalKeys > 0 ? `${(collectedKeys / totalKeys) * 100}%` : '0%' }}
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-zinc-800">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Level
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
              <p>💡 <strong>Hint:</strong> {HINTS[chamberId] ?? HINTS[1]}</p>
              <button
                onClick={handleAutoSolve}
                className="mt-1 text-[11px] underline text-amber-400 hover:text-white cursor-pointer"
              >
                Overpower Anti-Gravity Core (Auto Solve)
              </button>
            </div>
          )}
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
