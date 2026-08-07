"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ShieldAlert, Sparkles, RefreshCw, CheckCircle, Key } from "lucide-react";

interface GravityShiftPuzzleProps {
  chamberId: number;
  onSolve: (answer: string) => void;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'RIGHT_DOWN' | 'LEFT_DOWN' | 'RIGHT_UP' | 'LEFT_UP';

interface Position {
  r: number;
  c: number;
}

// Cell Types: '.' Empty, 'W' Wall, 'T' Trap/Spike, 'K' Key, 'E' Exit, 'P' Player Start

const STAGE_MAPS: Record<number, string[][]> = {
  // Chamber 1 — keys scattered across mid-zones (not corners)
  // P=top-left, K1=top-center, K2=mid-right, K3=bottom-center, E=bottom-right-mid
  1: [
    ['W','W','W','W','W','W','W','W','W','W','W','W','W'],
    ['W','P','.','.','.','.','.','.','.','.','.','.','W'],
    ['W','.','W','T','.','W','.','.','.','W','.','.',  'W'],
    ['W','.','.','.','.','.','.','K','.','.','.','T','W'],  // K1: row3,col7 — top-center area
    ['W','.','T','W','.','.','W','.','T','.','.','.',  'W'],
    ['W','.','.','.','.','W','.','.','.','.','.','T','W'],
    ['W','.','W','T','.','.','.','.','.','.','K','.','W'],  // K2: row6,col10 — mid-right area
    ['W','.','.','.','.','.','.','W','.','T','.','.','W'],
    ['W','T','.','W','.','.','W','.','.','.','.','.','W'],
    ['W','.','.','.','.','.','.','.','.','W','.','T','W'],
    ['W','.','T','.','.','K','.','.','.','.','.','.','W'],  // K3: row10,col5 — bottom-center
    ['W','.','.','W','.','.','T','.','.','.','W','E','W'],  // E: row11,col11 - Exit
    ['W','W','W','W','W','W','W','W','W','W','W','W','W'],
  ],
  // Chamber 2 — keys in mid-field but in different quadrants
  // P=top-left, K1=upper-right-mid, K2=lower-left-mid, E=lower-right-mid
  2: [
    ['W','W','W','W','W','W','W','W','W','W','W','W','W'],
    ['W','P','.','.','.','.','.','.','.','.','.','.','W'],
    ['W','.','T','.','.','.','W','.','.','.','.','.','W'],
    ['W','.','W','.','.','T','.','.','K','.','T','.','W'],  // K1: row3,col8 — upper-right-mid
    ['W','.','.','.','.','.','.','.','.','W','.','.','W'],
    ['W','.','W','T','.','.','W','.','.','.','.','.','W'],
    ['W','.','.','.','.','.','.','.','.','T','.','.',  'W'],
    ['W','T','.','.','.','W','.','T','.','.','W','.','W'],
    ['W','.','K','.','.','.','.','.','.','.','.','T','W'],  // K2: row8,col2 — lower-left-mid
    ['W','.','.','T','.','.','.','.','.','W','.','.','W'],
    ['W','.','W','.','.','T','.','.','.','.','.','.','W'],
    ['W','.','.','.','.','.','.','.','.','.','.','E','W'],  // E: row11,col11 - Exit
    ['W','W','W','W','W','W','W','W','W','W','W','W','W'],
  ],
  // Chamber 3 — three keys spread across left-mid, top-mid, bottom-mid interior zones
  // P=top-left, K1=mid-top-center, K2=mid-left, K3=mid-bottom-center, E=bottom-right-mid
  3: [
    ['W','W','W','W','W','W','W','W','W','W','W','W','W'],
    ['W','P','.','.','.','.','.','.','.','.','.','.','W'],
    ['W','.','W','.','.','T','.','.','.','.','.','.','W'],
    ['W','.','.','T','.','.','.','.','.','W','.','.','W'],
    ['W','.','.','.','.','.','K','.','.','.','T','.','W'],  // K1: row4,col6 — upper-center
    ['W','.','T','W','.','.','.','.','.','.','.','.','W'],
    ['W','.','.','.','.','W','.','.','W','.','.','.','W'],
    ['W','.','K','.','.','.','.','.','.','T','.','.','W'],  // K2: row7,col2 — mid-left
    ['W','.','.','T','.','.','W','.','.','.','.','.',  'W'],
    ['W','.','W','.','.','.','.','.','.','W','.','.','W'],
    ['W','.','.','.','.','.','.','K','.','.','.','T','W'],  // K3: row10,col7 — lower-center
    ['W','.','.','.','.','W','.','.','.','.','.','E','W'],  // E: row11,col11 - Exit
    ['W','W','W','W','W','W','W','W','W','W','W','W','W'],
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

    // INVERTED GRAVITY: pressing UP moves DOWN, pressing DOWN moves UP, LEFT→RIGHT, RIGHT→LEFT
    const dr = (dir.includes('DOWN') ? -1 : 0) + (dir.includes('UP') ? 1 : 0);
    const dc = (dir.includes('RIGHT') ? -1 : 0) + (dir.includes('LEFT') ? 1 : 0);

    const nextR = player.r + dr;
    const nextC = player.c + dc;

    if (nextR < 0 || nextR >= baseMap.length || nextC < 0 || nextC >= baseMap[0].length) return;

    const baseCell = baseMap[nextR][nextC];
    const keyId = `${nextR},${nextC}`;

    if (baseCell === 'W') return;

    setMoveCount(prev => prev + 1);

    if (baseCell === 'T') {
      setTrapHit(true);
      setPlayer(startPos);
      return;
    }

    setPlayer({ r: nextR, c: nextC });

    const nextCollectedSet = new Set(collectedKeySet);
    if (baseCell === 'K' && !nextCollectedSet.has(keyId)) {
      nextCollectedSet.add(keyId);
      setCollectedKeySet(nextCollectedSet);
    }

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

  const btnBase = "p-3 rounded-xl border font-mono font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95";
  const btnActive = "bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/60 scale-105";
  const btnIdle   = "bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600";

  return (
    <div className="relative w-full text-white">

      {/* ─── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
        <div>
          <h3 className="text-lg font-bold font-serif text-red-400 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Chamber {chamberId}: Demon Gravity Vault
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Collect all 🗝️ keys then reach the 🌀 exit.
            <span className="text-red-400 font-bold ml-1">⚠️ Controls are inverted!</span>
          </p>
        </div>
        <div className="text-right space-y-1 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400">
            <Key className="w-3.5 h-3.5" />
            Keys: {collectedKeys} / {totalKeys}
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            Shifts: <strong className="text-white">{moveCount}</strong>
          </span>
        </div>
      </div>

      {/* ─── TRAP FLASH ─────────────────────────────────────────────── */}
      {trapHit && (
        <div className="mb-3 p-2.5 bg-red-950/90 border border-red-600/80 rounded-xl text-xs font-mono text-red-300 flex items-center gap-2 animate-bounce">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          <span>💀 Demonic Spikes! Reset to start.</span>
        </div>
      )}

      {/* ─── MAIN AREA: puzzle centered, control pad fixed right ─────── */}
      <div className="relative flex items-start justify-center">

        {/* ── PUZZLE GRID — takes up center ── */}
        <div className="flex flex-col items-center justify-center p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800 shadow-2xl mx-auto">
          <div className="grid gap-1 p-3 bg-black/80 rounded-xl border border-zinc-800">
            {baseMap.map((row, rIdx) => (
              <div key={rIdx} className="flex gap-1">
                {row.map((baseCell, cIdx) => {
                  const isPlayer = player.r === rIdx && player.c === cIdx;
                  const isExit   = baseCell === 'E';
                  const isWall   = baseCell === 'W';
                  const isTrap   = baseCell === 'T';
                  const keyId    = `${rIdx},${cIdx}`;
                  const isKeyUncollected = baseCell === 'K' && !collectedKeySet.has(keyId);
                  const exitUnlocked = collectedKeys >= totalKeys;

                  return (
                    <div
                      key={cIdx}
                      className={`w-11 h-11 rounded-lg flex items-center justify-center text-lg font-bold transition-all duration-150 border ${
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
                      {isPlayer ? '👹' : isExit ? '🌀' : isKeyUncollected ? '🗝️' : isTrap ? '💀' : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex gap-5 mt-3 text-[10px] font-mono text-zinc-400">
            <span>👹 You</span>
            <span>🗝️ Key</span>
            <span>🌀 Exit</span>
            <span>💀 Trap</span>
          </div>
        </div>

        {/* ── CONTROL PAD — fixed to the right corner ── */}
        <div className="fixed top-1/2 right-4 -translate-y-1/2 z-50 w-[230px] bg-zinc-950/95 border border-zinc-700 rounded-2xl shadow-2xl p-4 space-y-3 backdrop-blur-sm">
          <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-widest block text-center">
            🎮 Control Pad
          </span>

          <div className="grid grid-cols-3 gap-2">
            {/* Row 1 */}
            <button onClick={() => shiftGravity('LEFT_UP')} title="→↘" className={`${btnBase} ${gravityDir === 'LEFT_UP' ? btnActive : btnIdle}`}>
              <span>↖</span><span className="text-[8px] text-zinc-500">→↘</span>
            </button>
            <button onClick={() => shiftGravity('UP')} title="W = moves DOWN" className={`${btnBase} ${gravityDir === 'UP' ? btnActive : btnIdle}`}>
              <ArrowDown className="w-4 h-4 text-red-400" />
              <span className="text-[8px] text-zinc-400">W=↓</span>
            </button>
            <button onClick={() => shiftGravity('RIGHT_UP')} title="→↙" className={`${btnBase} ${gravityDir === 'RIGHT_UP' ? btnActive : btnIdle}`}>
              <span>↗</span><span className="text-[8px] text-zinc-500">→↙</span>
            </button>

            {/* Row 2 */}
            <button onClick={() => shiftGravity('LEFT')} title="A = moves RIGHT" className={`${btnBase} ${gravityDir === 'LEFT' ? btnActive : btnIdle}`}>
              <ArrowRight className="w-4 h-4 text-blue-400" />
              <span className="text-[8px] text-zinc-400">A=→</span>
            </button>
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl shadow-inner">
              👹
            </div>
            <button onClick={() => shiftGravity('RIGHT')} title="D = moves LEFT" className={`${btnBase} ${gravityDir === 'RIGHT' ? btnActive : btnIdle}`}>
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
              <span className="text-[8px] text-zinc-400">D=←</span>
            </button>

            {/* Row 3 */}
            <button onClick={() => shiftGravity('LEFT_DOWN')} title="→↗" className={`${btnBase} ${gravityDir === 'LEFT_DOWN' ? btnActive : btnIdle}`}>
              <span>↙</span><span className="text-[8px] text-zinc-500">→↗</span>
            </button>
            <button onClick={() => shiftGravity('DOWN')} title="S = moves UP" className={`${btnBase} ${gravityDir === 'DOWN' ? btnActive : btnIdle}`}>
              <ArrowUp className="w-4 h-4 text-purple-400" />
              <span className="text-[8px] text-zinc-400">S=↑</span>
            </button>
            <button onClick={() => shiftGravity('RIGHT_DOWN')} title="→↖" className={`${btnBase} ${gravityDir === 'RIGHT_DOWN' ? btnActive : btnIdle}`}>
              <span>↘</span><span className="text-[8px] text-zinc-500">→↖</span>
            </button>
          </div>

          <div className="pt-2 border-t border-zinc-800">
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-xl hover:bg-zinc-800"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              Reset Chamber
            </button>
          </div>

          <p className="text-[9px] text-zinc-600 text-center font-mono leading-relaxed">
            Keyboard: W A S D<br/>or Arrow Keys
          </p>
        </div>

      </div>

      {/* ─── SUCCESS OVERLAY ─────────────────────────────────────────── */}
      {isSolved && (
        <div className="mt-4 p-4 bg-emerald-950/80 border border-emerald-500 rounded-xl text-center space-y-1">
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
