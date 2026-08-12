"use client";

import BackgroundVideo from "@/components/3d/BackgroundVideo";
import React, { useState } from "react";
import { useVideoSrc } from "@/hooks/useVideoSrc";
import { GameGameState, gameSync } from "@/lib/gameStore";
import { pythonApi } from "@/lib/pythonApi";
import LobbyBackground from "@/components/3d/LobbyBackground";
import { Users, Key, Play, ShieldAlert, CheckCircle2, Copy, Check, ArrowRight, ShieldCheck } from "lucide-react";

interface LobbyScreenProps {
  state: GameGameState;
  myRole: 'player1' | 'player2';
  setMyRole: (role: 'player1' | 'player2') => void;
  onStartMission?: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  state,
  myRole,
  setMyRole,
  onStartMission,
}) => {
  const lobbyVideoSrc = useVideoSrc('lobby', '/videos/level.mp4');

  const [player1Input, setPlayer1Input] = useState(state.player1Name || '');
  const [teamNameInput, setTeamNameInput] = useState(state.teamName || '');
  const [phoneInput, setPhoneInput] = useState(state.phoneNumber || '');
  const [deptInput, setDeptInput] = useState(state.department || '');
  const [player2Input, setPlayer2Input] = useState(state.player2Name || '');
  const [inputCode, setInputCode] = useState('');

  // Player 2 Join Step: 1 = Enter Code, 2 = Enter Player 2 Name
  const [joinStep, setJoinStep] = useState<1 | 2>(1);
  const [foundRoom, setFoundRoom] = useState<GameGameState | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const generateTeamCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'LAIR-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateTeam = () => {
    if (!player1Input.trim()) {
      setErrorMsg('Please enter your Player Name.');
      return;
    }
    if (!teamNameInput.trim()) {
      setErrorMsg('Please enter a Team Name.');
      return;
    }
    if (!phoneInput.trim()) {
      setErrorMsg('Please enter your Phone Number.');
      return;
    }
    if (!deptInput.trim()) {
      setErrorMsg('Please enter your Department.');
      return;
    }
    setErrorMsg('');
    const code = generateTeamCode();
    setMyRole('player1');
    gameSync.resetGame({
      teamCode: code,
      teamName: teamNameInput.trim(),
      player1Name: player1Input.trim(),
      phoneNumber: phoneInput.trim(),
      department: deptInput.trim(),
      isPlayer1Ready: true,
      gameStatus: 'lobby',
    });
  };

  const handleVerifyCodeStep1 = async () => {
    if (!inputCode.trim()) {
      setErrorMsg('Please enter a valid Team Code.');
      return;
    }
    setErrorMsg('');
    setIsSearching(true);
    const cleanCode = inputCode.trim().toUpperCase();
    const room = await gameSync.fetchRoomState(cleanCode);
    setIsSearching(false);

    if (!room || !room.teamCode) {
      setErrorMsg(`No active lobby found for code "${cleanCode}". Please check and try again.`);
      return;
    }

    setFoundRoom(room);
    setJoinStep(2);
  };

  const handleJoinTeamStep2 = () => {
    if (!player2Input.trim()) {
      setErrorMsg('Please enter your Player Name.');
      return;
    }
    setErrorMsg('');
    setMyRole('player2');
    gameSync.updateState({
      ...foundRoom,
      teamCode: foundRoom?.teamCode || inputCode.trim().toUpperCase(),
      teamName: foundRoom?.teamName || 'Demon Slayers',
      player2Name: player2Input.trim(),
      isPlayer2Ready: true,
      gameStatus: 'lobby',
    });
  };

  const handleToggleReady = () => {
    if (myRole === 'player1') {
      gameSync.updateState((prev) => ({
        ...prev,
        isPlayer1Ready: !prev.isPlayer1Ready,
      }));
    } else {
      gameSync.updateState((prev) => ({
        ...prev,
        isPlayer2Ready: !prev.isPlayer2Ready,
      }));
    }
  };

  const handleStartMission = async () => {
    if (!state.isPlayer1Ready || !state.isPlayer2Ready) {
      setErrorMsg('Both players must mark READY before starting!');
      return;
    }

    const firestoreTimers = await gameSync.fetchDefaultLevelTimers();
    const pythonTimers = await pythonApi.getTimerConfig();

    const l1Sec = pythonTimers?.level1Seconds ?? firestoreTimers.level1Seconds ?? 120;
    const l2Sec = pythonTimers?.level2Seconds ?? firestoreTimers.level2Seconds ?? 120;
    const l3Sec = pythonTimers?.level3Seconds ?? firestoreTimers.level3Seconds ?? 300;

    const now = Date.now();

    if (state.teamCode) {
      pythonApi.startRoomTimer(state.teamCode, 1);
    }

    gameSync.updateState({
      currentLevel: 1,
      timeRemaining: l1Sec,
      level1Duration: l1Sec,
      level2Duration: l2Sec,
      level3Duration: l3Sec,
      levelStartTime: now,
      missionStartTime: now,
      totalTimeElapsed: 0,
      timePenalties: 0,
      l1CompletedRooms: [],
      l1FailedRooms: [],
      l1IsCompleted: false,
      l2UnlockedDoors: [],
      l3DestroyedCrystals: [],
      collectedSealFragments: 0,
      selectedSeal: null,
      isDemonSealed: false,
      gameStatus: 'playing',
    });
    if (onStartMission) onStartMission();
  };

  const copyCode = () => {
    if (!state.teamCode) return;
    navigator.clipboard.writeText(state.teamCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-full py-2 sm:py-4">
      <BackgroundVideo src={lobbyVideoSrc} />
      <div className="absolute inset-0 bg-black/55 z-10" />
      <div className="relative z-20">
        <section className="w-full px-4 pt-1 pb-2">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-1.5 bg-red-950/60 border border-red-800/60 px-3 py-1 rounded-full text-red-400 font-mono text-xs uppercase tracking-widest mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-red-500 animate-pulse" />
              Cooperative 2-Player Mission
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-1 font-serif drop-shadow-md">
              Demon Slayers: Escape the Lair
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-3xl mx-auto mb-3">
              Form a 2-player team: Player 1 solves gravity vaults, Player 2 survives 18 demonic pillars, and both unite in the Throne Room to slay 75 demons!
            </p>
          </div>
        </section>

        <section className="flex-1 w-full max-w-[1400px] mx-auto px-4">
          <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] items-start gap-6 lg:gap-8">
            <div className="w-full flex flex-col items-center">
              {!state.teamCode ? (
                <div className="relative z-10 w-full grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6 items-stretch">
                  {/* Create New Team Card */}
                  <div className="bg-zinc-950/90 border border-red-900/60 rounded-2xl p-5 shadow-2xl flex flex-col justify-between hover:border-red-600/60 transition-all h-full">
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-700/50 flex items-center justify-center text-red-400 mb-3">
                        <Users className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">Create New Team</h3>
                      <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                        Enter your details and Team Name to generate a unique Team Code for Player 2.
                      </p>

                      {errorMsg && (
                        <div className="mb-3 p-2 bg-red-950/80 border border-red-600/50 rounded-lg text-xs font-mono text-red-300 text-center">
                          {errorMsg}
                        </div>
                      )}

                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="block text-xs font-mono text-zinc-300 uppercase mb-1">
                            Player 1 Name
                          </label>
                          <input
                            type="text"
                            value={player1Input}
                            onChange={(e) => setPlayer1Input(e.target.value)}
                            placeholder="e.g. Shadow Navigator"
                            className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-500 text-zinc-100 font-mono text-sm px-3 py-2 rounded-lg outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-zinc-300 uppercase mb-1">
                            Team Name
                          </label>
                          <input
                            type="text"
                            value={teamNameInput}
                            onChange={(e) => setTeamNameInput(e.target.value)}
                            placeholder="e.g. Demon Slayers"
                            className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-500 text-zinc-100 font-mono text-sm px-3 py-2 rounded-lg outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-zinc-300 uppercase mb-1">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value)}
                            placeholder="e.g. +91 9876543210"
                            className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-500 text-zinc-100 font-mono text-sm px-3 py-2 rounded-lg outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-zinc-300 uppercase mb-1">
                            Department
                          </label>
                          <input
                            type="text"
                            value={deptInput}
                            onChange={(e) => setDeptInput(e.target.value)}
                            placeholder="e.g. Computer Science / IT"
                            className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-500 text-zinc-100 font-mono text-sm px-3 py-2 rounded-lg outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleCreateTeam}
                      className="w-full bg-red-700 hover:bg-red-600 text-white font-mono text-sm py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                    >
                      <Key className="w-4 h-4" /> Create Team & Generate Code
                    </button>
                  </div>

                  {/* Join Existing Team Card */}
                  <div className="bg-zinc-950/90 border border-purple-900/60 rounded-2xl p-5 shadow-2xl flex flex-col justify-between hover:border-purple-600/60 transition-all h-full">
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-700/50 flex items-center justify-center text-purple-400 mb-3">
                        <Key className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">Join Existing Team</h3>
                      <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                        Enter your partner's Team Code to locate their room and join as Player 2.
                      </p>

                      {errorMsg && (
                        <div className="mb-3 p-2 bg-red-950/80 border border-red-600/50 rounded-lg text-xs font-mono text-red-300 text-center">
                          {errorMsg}
                        </div>
                      )}

                      {joinStep === 1 ? (
                        <div className="space-y-4 mb-4">
                          <div>
                            <label className="block text-xs font-mono text-zinc-300 uppercase mb-1">
                              Enter Team Secret Code
                            </label>
                            <input
                              type="text"
                              value={inputCode}
                              onChange={(e) => setInputCode(e.target.value)}
                              placeholder="e.g. LAIR-7X9B"
                              className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 text-zinc-100 font-mono text-sm px-3 py-2 rounded-lg uppercase tracking-wider outline-none"
                            />
                          </div>
                          <button
                            onClick={handleVerifyCodeStep1}
                            disabled={isSearching}
                            className="w-full bg-purple-700 hover:bg-purple-600 text-white font-mono text-sm py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                          >
                            {isSearching ? "Locating Team..." : <>Find Team <ArrowRight className="w-4 h-4" /></>}
                          </button>

                          {/* How Co-op Works Guide inside Join Card */}
                          <div className="mt-5 pt-4 border-t border-purple-900/40">
                            <span className="text-[11px] font-mono text-purple-400 uppercase tracking-widest block mb-2.5 font-bold flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" /> How Co-op Works
                            </span>
                            <div className="space-y-2">
                              <div className="flex items-start gap-2.5 bg-purple-950/30 p-2.5 rounded-xl border border-purple-900/30">
                                <span className="w-5 h-5 rounded-full bg-purple-900/80 text-purple-300 font-mono text-xs flex items-center justify-center font-bold shrink-0">1</span>
                                <p className="text-xs text-zinc-300 leading-tight">Player 1 creates team and shares the secret code.</p>
                              </div>
                              <div className="flex items-start gap-2.5 bg-purple-950/30 p-2.5 rounded-xl border border-purple-900/30">
                                <span className="w-5 h-5 rounded-full bg-purple-900/80 text-purple-300 font-mono text-xs flex items-center justify-center font-bold shrink-0">2</span>
                                <p className="text-xs text-zinc-300 leading-tight">Player 2 enters code to connect their session.</p>
                              </div>
                              <div className="flex items-start gap-2.5 bg-purple-950/30 p-2.5 rounded-xl border border-purple-900/30">
                                <span className="w-5 h-5 rounded-full bg-purple-900/80 text-purple-300 font-mono text-xs flex items-center justify-center font-bold shrink-0">3</span>
                                <p className="text-xs text-zinc-300 leading-tight">Both mark READY to launch the escape mission!</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 mb-4">
                          <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-xl">
                            <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest block">Team Located</span>
                            <div className="text-base font-bold text-white flex items-center gap-2">
                              <ShieldCheck className="w-5 h-5 text-purple-400" />
                              {foundRoom?.teamName || "Demon Slayers"}
                            </div>
                            <span className="text-xs text-zinc-400 font-mono block mt-1">
                              Created by Player 1: <strong className="text-zinc-200">{foundRoom?.player1Name || "Player 1"}</strong>
                            </span>
                          </div>

                          <div>
                            <label className="block text-xs font-mono text-zinc-300 uppercase mb-1">
                              Your Player 2 Name
                            </label>
                            <input
                              type="text"
                              value={player2Input}
                              onChange={(e) => setPlayer2Input(e.target.value)}
                              placeholder="e.g. Cipher Decrypter"
                              className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 text-zinc-100 font-mono text-sm px-3 py-2 rounded-lg outline-none"
                            />
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => setJoinStep(1)}
                              className="w-1/3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs py-2.5 rounded-xl font-bold transition-all cursor-pointer"
                            >
                              Back
                            </button>
                            <button
                              onClick={handleJoinTeamStep2}
                              className="w-2/3 bg-purple-700 hover:bg-purple-600 text-white font-mono text-sm py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Join & Mark Ready
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full bg-zinc-950/90 border border-red-900/60 rounded-2xl p-6 shadow-2xl space-y-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl gap-4">
                    <div>
                      <span className="text-xs font-mono text-red-400 uppercase tracking-widest block font-bold">
                        Team: {state.teamName || "Demon Slayers"}
                      </span>
                      <div className="text-3xl font-mono font-extrabold text-white tracking-wider flex items-center gap-2">
                        <Key className="w-6 h-6 text-red-500" />
                        <span className="text-red-500">{state.teamCode}</span>
                      </div>
                    </div>
                    <button
                      onClick={copyCode}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono px-4 py-2.5 rounded-lg flex items-center gap-2 border border-zinc-700 transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                      {copied ? "Code Copied!" : "Copy Code"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border ${state.isPlayer1Ready ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-zinc-900 border-zinc-800'
                      }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-red-400 font-bold uppercase">Player 1 (Gravity Vaults Lead)</span>
                        {state.isPlayer1Ready ? (
                          <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> READY
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-zinc-500">NOT READY</span>
                        )}
                      </div>
                      <div className="text-base font-semibold text-white">
                        {state.player1Name || "Waiting for Player 1..."}
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border ${state.isPlayer2Ready ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-zinc-900 border-zinc-800'
                      }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-purple-400 font-bold uppercase">Player 2 (Demonic Pillars Lead)</span>
                        {state.isPlayer2Ready ? (
                          <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> READY
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-zinc-500">WAITING TO JOIN...</span>
                        )}
                      </div>
                      <div className="text-base font-semibold text-white">
                        {state.player2Name || "Waiting for Player 2..."}
                      </div>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-red-950/80 border border-red-600/50 rounded-lg text-xs font-mono text-red-300 text-center">
                      {errorMsg}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                    <button
                      onClick={handleToggleReady}
                      className={`w-full sm:flex-1 py-3 rounded-xl font-mono text-sm font-bold border transition-all ${(myRole === 'player1' && state.isPlayer1Ready) || (myRole === 'player2' && state.isPlayer2Ready)
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                          : 'bg-emerald-700 border-emerald-600 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-950/50'
                        }`}
                    >
                      {(myRole === 'player1' && state.isPlayer1Ready) || (myRole === 'player2' && state.isPlayer2Ready)
                        ? 'Cancel Ready State'
                        : 'Mark I AM READY'}
                    </button>

                    {myRole === 'player1' && (
                      <button
                        onClick={handleStartMission}
                        disabled={!state.isPlayer1Ready || !state.isPlayer2Ready}
                        className={`w-full sm:flex-1 py-3 rounded-xl font-mono text-sm font-bold flex items-center justify-center gap-2 transition-all ${state.isPlayer1Ready && state.isPlayer2Ready
                            ? 'bg-red-700 hover:bg-red-600 text-white shadow-lg shadow-red-950/50 cursor-pointer'
                            : 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                          }`}
                      >
                        <Play className="w-4 h-4 fill-current" /> Begin Escape Mission
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="w-full flex items-center justify-center lg:justify-end">
              <div className="relative h-[460px] sm:h-[500px] lg:h-[520px] w-full max-w-[480px] overflow-hidden">
                <LobbyBackground />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
