"use client";

import React, { useState } from "react";
import { GameGameState, gameSync } from "@/lib/gameStore";
import { LeaderboardModal } from "@/components/ui/LeaderboardModal";
import { Users, Key, Play, ShieldAlert, CheckCircle2, Copy, Check, ArrowRight, ShieldCheck, Trophy } from "lucide-react";

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
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [player1Input, setPlayer1Input] = useState(state.player1Name || '');
  const [teamNameInput, setTeamNameInput] = useState(state.teamName || '');
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
    setErrorMsg('');
    const code = generateTeamCode();
    setMyRole('player1');
    gameSync.updateState({
      teamCode: code,
      teamName: teamNameInput.trim(),
      player1Name: player1Input.trim(),
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

  const handleStartMission = () => {
    if (!state.isPlayer1Ready || !state.isPlayer2Ready) {
      setErrorMsg('Both players must mark READY before starting!');
      return;
    }
    gameSync.updateState({
      currentLevel: 1,
      timeRemaining: 120, // 2 minutes (120s) for Level 1
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
    <div className="w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center">
      {/* Title Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-red-950/60 border border-red-800/60 px-4 py-1.5 rounded-full text-red-400 font-mono text-xs uppercase tracking-widest mb-3">
          <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
          Cooperative 2-Player Mission
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-2 font-serif drop-shadow-md">
          Escape the Demon's Lair
        </h1>
        <p className="text-sm text-zinc-400 max-w-xl mx-auto mb-4">
          Form a 2-player team, solve haunted rooms, decode demon door ciphers, and unite in the Throne Room to seal the Demon Lord.
        </p>
        <button
          onClick={() => setIsLeaderboardOpen(true)}
          className="inline-flex items-center gap-2 bg-amber-950/60 border border-amber-500/50 hover:bg-amber-900/60 text-amber-300 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all shadow-lg shadow-amber-950/40"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          🏆 View Hall of Fame Leaderboard
        </button>
      </div>

      {!state.teamCode ? (
        /* Team Creation / Join Selection Cards */
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Create Team (Player 1) */}
          <div className="bg-zinc-950/90 border border-red-900/50 rounded-2xl p-6 shadow-2xl flex flex-col justify-between hover:border-red-600/60 transition-all">
            <div>
              <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-700/50 flex items-center justify-center text-red-400 mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Create New Team</h3>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                Enter your details and Team Name to generate a unique Team Code for Player 2.
              </p>

              {errorMsg && (
                <div className="mb-4 p-2.5 bg-red-950/80 border border-red-600/50 rounded-lg text-xs font-mono text-red-300 text-center">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-300 uppercase mb-1">
                    Player 1 Name
                  </label>
                  <input
                    type="text"
                    value={player1Input}
                    onChange={(e) => setPlayer1Input(e.target.value)}
                    placeholder="e.g. Shadow Navigator"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-500 text-zinc-100 font-mono text-sm px-3 py-2.5 rounded-lg outline-none"
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
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-500 text-zinc-100 font-mono text-sm px-3 py-2.5 rounded-lg outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateTeam}
              className="w-full bg-red-700 hover:bg-red-600 text-white font-mono text-sm py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 mt-4"
            >
              <Key className="w-4 h-4" /> Create Team & Generate Code
            </button>
          </div>

          {/* Card 2: Join Team (Player 2) */}
          <div className="bg-zinc-950/90 border border-purple-900/50 rounded-2xl p-6 shadow-2xl flex flex-col justify-between hover:border-purple-600/60 transition-all">
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-950/80 border border-purple-700/50 flex items-center justify-center text-purple-400 mb-4">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Join Existing Team</h3>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                Enter your partner's Team Code to locate their room and join as Player 2.
              </p>

              {errorMsg && (
                <div className="mb-4 p-2.5 bg-red-950/80 border border-red-600/50 rounded-lg text-xs font-mono text-red-300 text-center">
                  {errorMsg}
                </div>
              )}

              {joinStep === 1 ? (
                /* Step 1: Input Code */
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
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 text-zinc-100 font-mono text-sm px-3 py-2.5 rounded-lg uppercase tracking-wider outline-none"
                    />
                  </div>
                  <button
                    onClick={handleVerifyCodeStep1}
                    disabled={isSearching}
                    className="w-full bg-purple-700 hover:bg-purple-600 text-white font-mono text-sm py-3 rounded-xl font-bold transition-all shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 mt-4"
                  >
                    {isSearching ? "Locating Team..." : <>Find Team <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              ) : (
                /* Step 2: Found Team Info & Enter Player 2 Name */
                <div className="space-y-4 mb-4">
                  <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-xl">
                    <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest block">Team Located</span>
                    <div className="text-lg font-bold text-white flex items-center gap-2">
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
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 text-zinc-100 font-mono text-sm px-3 py-2.5 rounded-lg outline-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setJoinStep(1)}
                      className="w-1/3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs py-3 rounded-xl font-bold transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleJoinTeamStep2}
                      className="w-2/3 bg-purple-700 hover:bg-purple-600 text-white font-mono text-sm py-3 rounded-xl font-bold transition-all shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2"
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
        /* Team Lobby Ready Room */
        <div className="w-full bg-zinc-950/90 border border-red-900/60 rounded-2xl p-6 shadow-2xl space-y-6">
          {/* Team Header & Code Display */}
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

          {/* Player Roster */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Player 1 Box */}
            <div className={`p-4 rounded-xl border ${
              state.isPlayer1Ready ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-zinc-900 border-zinc-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-red-400 font-bold uppercase">Player 1 (Level 1 Lead)</span>
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

            {/* Player 2 Box */}
            <div className={`p-4 rounded-xl border ${
              state.isPlayer2Ready ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-zinc-900 border-zinc-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-purple-400 font-bold uppercase">Player 2 (Level 2 Lead)</span>
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

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <button
              onClick={handleToggleReady}
              className={`w-full sm:flex-1 py-3 rounded-xl font-mono text-sm font-bold border transition-all ${
                (myRole === 'player1' && state.isPlayer1Ready) || (myRole === 'player2' && state.isPlayer2Ready)
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
                className={`w-full sm:flex-1 py-3 rounded-xl font-mono text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  state.isPlayer1Ready && state.isPlayer2Ready
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

      {/* Leaderboard Modal */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        currentTeamCode={state.teamCode}
      />
    </div>
  );
};
