import { db, isFirebaseInitialized } from './firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

export interface LeaderboardEntry {
  id: string;
  teamCode: string;
  player1: string;
  player2: string;
  totalTimeSeconds: number;
  date: string;
}

export interface GameGameState {
  teamCode: string;
  teamName: string;
  player1Name: string;
  player2Name: string;
  phoneNumber?: string;
  department?: string;
  isPlayer1Ready: boolean;
  isPlayer2Ready: boolean;
  currentLevel: 1 | 2 | 3 | 4; // 1: Haunted Rooms, 2: Demon Doors, 3: Throne Room, 4: Victory
  l1CompletedRooms: number[];
  l1FailedRooms: number[];
  l1IsCompleted: boolean;
  l2UnlockedDoors: number[];
  l2Score?: number;
  l3DestroyedCrystals: number[];
  collectedSealFragments: number;
  selectedSeal: string | null;
  isDemonSealed: boolean;
  timeRemaining: number;
  totalTimeElapsed: number;
  timePenalties: number;
  l3DemonsDefeated: number; // Demons defeated in Level 3 out of 75
  l3TotalDemons: number; // Target demons (75)
  l3TimeElapsed: number; // Level 3 only timer for leaderboard ranking
  l3DemonHp: number; // Demon Lord current HP
  l3MaxDemonHp: number; // Demon Lord max HP (500)
  l3DemonStance: 'idle' | 'charging' | 'shielded' | 'vulnerable' | 'enraged';
  l3Player1Gesture: 'FIST' | 'PALM' | 'PEACE' | null;
  l3Player2Gesture: 'FIST' | 'PALM' | 'PEACE' | null;
  p1Pos?: { x: number; z: number; rot: number; state: string; alive?: boolean; hp?: number };
  p2Pos?: { x: number; z: number; rot: number; state: string; alive?: boolean; hp?: number };
  l3ComboCount: number;
  level1Duration: number;
  level2Duration: number;
  level3Duration: number;
  levelStartTime?: number | null;
  missionStartTime?: number | null;
  gameStatus: 'lobby' | 'playing' | 'gameover' | 'victory' | 'disqualified';
  lastUpdated: number;
}

export const INITIAL_GAME_STATE: GameGameState = {
  teamCode: '',
  teamName: '',
  player1Name: '',
  player2Name: '',
  phoneNumber: '',
  department: '',
  isPlayer1Ready: false,
  isPlayer2Ready: false,
  currentLevel: 1,
  l1CompletedRooms: [],
  l1FailedRooms: [],
  l1IsCompleted: false,
  l2UnlockedDoors: [],
  l2Score: 0,
  l3DestroyedCrystals: [],
  collectedSealFragments: 0,
  selectedSeal: null,
  isDemonSealed: false,
  timeRemaining: 60, // Level 1 default: 60s (1 min)
  totalTimeElapsed: 0,
  timePenalties: 0,
  l3DemonsDefeated: 0,
  l3TotalDemons: 75,
  l3TimeElapsed: 0,
  l3DemonHp: 500,
  l3MaxDemonHp: 500,
  l3DemonStance: 'idle',
  l3Player1Gesture: null,
  l3Player2Gesture: null,
  p1Pos: { x: -1.8, z: 0, rot: 0, state: 'idle', alive: true, hp: 100 },
  p2Pos: { x: 1.8, z: 0, rot: 0, state: 'idle', alive: true, hp: 100 },
  l3ComboCount: 0,
  level1Duration: 60,
  level2Duration: 120,
  level3Duration: 240, // Level 3 default: 4 minutes (240s)
  levelStartTime: null,
  missionStartTime: null,
  gameStatus: 'lobby',
  lastUpdated: Date.now(),
};

// Available Ancient Seals
export const ANCIENT_SEALS = [
  { id: 'SOLAR', name: 'Seal of Solar Radiance', description: 'Binds the Demon Lord in blinding holy light.', isCorrect: false },
  { id: 'LUNAR', name: 'Seal of Lunar Eclipse', description: 'Traps the Demon Lord in eternal twilight shadows.', isCorrect: false },
  { id: 'CELESTIAL', name: 'Seal of the Seven Stars', description: 'The true ancient seal forged by Arch-Mages.', isCorrect: true },
  { id: 'ABYSSAL', name: 'Seal of Abyssal Chains', description: 'Attempts to shackle the Demon in dark chains.', isCorrect: false },
];



class GameSyncManager {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(state: GameGameState) => void> = new Set();
  private currentState: GameGameState = { ...INITIAL_GAME_STATE };
  private activeFirebaseTeamCode: string | null = null;
  private firebaseUnsubscribe: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Rehydrate from sessionStorage if available
      try {
        const saved = sessionStorage.getItem('demons_lair_state');
        if (saved && saved.trim() && saved !== "undefined") {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.teamCode) {
            this.currentState = parsed;
          }
        }
      } catch (e) {
        console.warn('Failed to rehydrate session state:', e);
      }

      // Auto-sync level timer configurations from Firestore/defaults
      this.fetchDefaultLevelTimers().then((timers) => {
        if (this.currentState.gameStatus === 'lobby') {
          this.currentState = {
            ...this.currentState,
            timeRemaining: timers.level1Seconds,
            level1Duration: timers.level1Seconds,
            level2Duration: timers.level2Seconds,
            level3Duration: timers.level3Seconds,
          };
          this.saveToSession(this.currentState);
          this.notifyListeners();
        }
      });

      try {
        this.channel = new BroadcastChannel('escape_demons_lair_sync');
        this.channel.onmessage = (event) => {
          if (event.data && event.data.type === 'STATE_UPDATE') {
            this.currentState = event.data.state;
            this.saveToSession(this.currentState);
            this.syncFirebaseSubscription(this.currentState.teamCode);
            this.notifyListeners();
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }
  }

  private saveToSession(state: GameGameState) {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('demons_lair_state', JSON.stringify(state));
      } catch (e) {
        // ignore
      }
    }
  }

  private syncFirebaseSubscription(teamCode: string) {
    if (!isFirebaseInitialized || !db || !teamCode) return;
    if (this.activeFirebaseTeamCode === teamCode) return;

    if (this.firebaseUnsubscribe) {
      this.firebaseUnsubscribe();
      this.firebaseUnsubscribe = null;
    }

    try {
      const roomRef = doc(db, 'rooms', teamCode);
      this.activeFirebaseTeamCode = teamCode;
      this.firebaseUnsubscribe = onSnapshot(roomRef, (snapshot: any) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as GameGameState;
          // Guard: If incoming remote data is older than our local state update timestamp, do NOT overwrite!
          if (data.lastUpdated && this.currentState.lastUpdated && data.lastUpdated < this.currentState.lastUpdated) {
            return;
          }
          // Merge safely so array fields are never reset or set to undefined
          this.currentState = {
            ...INITIAL_GAME_STATE,
            ...this.currentState,
            ...data,
            l3DemonsDefeated: Math.max(
              this.currentState.l3DemonsDefeated || 0,
              data.l3DemonsDefeated || 0
            ),
            l1CompletedRooms: Array.from(new Set([
              ...(this.currentState.l1CompletedRooms || []),
              ...(data.l1CompletedRooms || []),
            ])),
            l1FailedRooms: Array.from(new Set([
              ...(this.currentState.l1FailedRooms || []),
              ...(data.l1FailedRooms || []),
            ])),
            l2UnlockedDoors: Array.from(new Set([
              ...(this.currentState.l2UnlockedDoors || []),
              ...(data.l2UnlockedDoors || []),
            ])),
            l3DestroyedCrystals: Array.from(new Set([
              ...(this.currentState.l3DestroyedCrystals || []),
              ...(data.l3DestroyedCrystals || []),
            ])),
          };
          this.saveToSession(this.currentState);
          this.notifyListeners();
        }
      }, (error) => {
        // Handle connection drop or offline status gracefully
        console.warn("Firestore offline/fallback active:", error?.message || error);
      });
    } catch (e) {
      console.warn("Firebase onSnapshot subscription error:", e);
    }
  }

  public subscribe(callback: (state: GameGameState) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentState);
    if (this.currentState.teamCode) {
      this.syncFirebaseSubscription(this.currentState.teamCode);
    }

    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this.firebaseUnsubscribe) {
        this.firebaseUnsubscribe();
        this.firebaseUnsubscribe = null;
        this.activeFirebaseTeamCode = null;
      }
    };
  }

  public getState(): GameGameState {
    return this.currentState;
  }

  public resetGame(freshOverrides?: Partial<GameGameState>) {
    if (this.firebaseUnsubscribe) {
      this.firebaseUnsubscribe();
      this.firebaseUnsubscribe = null;
    }
    this.activeFirebaseTeamCode = null;

    const newState: GameGameState = {
      ...INITIAL_GAME_STATE,
      ...freshOverrides,
      l1CompletedRooms: freshOverrides?.l1CompletedRooms || [],
      l1FailedRooms: freshOverrides?.l1FailedRooms || [],
      l1IsCompleted: freshOverrides?.l1IsCompleted || false,
      l2UnlockedDoors: freshOverrides?.l2UnlockedDoors || [],
      l3DestroyedCrystals: freshOverrides?.l3DestroyedCrystals || [],
      l3DemonsDefeated: freshOverrides?.l3DemonsDefeated || 0,
      l3TotalDemons: 75,
      l3TimeElapsed: 0,
      totalTimeElapsed: 0,
      timePenalties: 0,
      currentLevel: freshOverrides?.currentLevel || 1,
      gameStatus: freshOverrides?.gameStatus || 'lobby',
      lastUpdated: Date.now(),
    };

    this.currentState = newState;
    this.saveToSession(newState);

    if (newState.teamCode) {
      this.syncFirebaseSubscription(newState.teamCode);
    }

    if (this.channel) {
      this.channel.postMessage({ type: 'STATE_UPDATE', state: newState });
    }

    if (isFirebaseInitialized && db && newState.teamCode) {
      try {
        setDoc(doc(db, 'rooms', newState.teamCode), newState, { merge: false });
      } catch (e) {
        console.warn("Firebase reset team state error:", e);
      }
    }

    this.notifyListeners();
  }

  /**
   * Broadcast-only update: syncs via BroadcastChannel without writing to Firestore.
   * Use this for high-frequency updates (position, rotation) to avoid Firestore write limits.
   * Cross-device players get these via the throttled Firestore write in the game loop instead.
   */
  public broadcastLocal(partialUpdate: Partial<GameGameState>) {
    const newState: GameGameState = {
      ...this.currentState,
      ...partialUpdate,
      lastUpdated: Date.now(),
    };

    this.currentState = newState;
    this.saveToSession(newState);

    // BroadcastChannel only — no Firestore write
    if (this.channel) {
      this.channel.postMessage({ type: 'STATE_UPDATE', state: newState });
    }

    this.notifyListeners();
  }

  public updateState(updater: Partial<GameGameState> | ((prev: GameGameState) => Partial<GameGameState>)) {
    const partialUpdate = typeof updater === 'function' ? updater(this.currentState) : updater;

    const isNewTeam = (partialUpdate.teamCode && partialUpdate.teamCode !== this.currentState.teamCode) || (partialUpdate.gameStatus === 'lobby' && this.currentState.gameStatus !== 'lobby');

    let newState: GameGameState;
    if (isNewTeam) {
      newState = {
        ...INITIAL_GAME_STATE,
        ...partialUpdate,
        l1CompletedRooms: partialUpdate.l1CompletedRooms !== undefined ? partialUpdate.l1CompletedRooms : [],
        l1FailedRooms: partialUpdate.l1FailedRooms !== undefined ? partialUpdate.l1FailedRooms : [],
        l1IsCompleted: partialUpdate.l1IsCompleted !== undefined ? partialUpdate.l1IsCompleted : false,
        l2UnlockedDoors: partialUpdate.l2UnlockedDoors !== undefined ? partialUpdate.l2UnlockedDoors : [],
        l3DestroyedCrystals: partialUpdate.l3DestroyedCrystals !== undefined ? partialUpdate.l3DestroyedCrystals : [],
        l3DemonsDefeated: partialUpdate.l3DemonsDefeated !== undefined ? partialUpdate.l3DemonsDefeated : 0,
        l3TotalDemons: 75,
        l3TimeElapsed: 0,
        totalTimeElapsed: 0,
        timePenalties: 0,
        currentLevel: partialUpdate.currentLevel || 1,
        lastUpdated: Date.now(),
      };
    } else {
      newState = {
        ...this.currentState,
        ...partialUpdate,
        l3DemonsDefeated: partialUpdate.l3DemonsDefeated !== undefined
          ? Math.max(this.currentState.l3DemonsDefeated || 0, partialUpdate.l3DemonsDefeated)
          : (this.currentState.l3DemonsDefeated || 0),
        l1CompletedRooms: partialUpdate.l1CompletedRooms !== undefined
          ? partialUpdate.l1CompletedRooms
          : (this.currentState.l1CompletedRooms || []),
        l1FailedRooms: partialUpdate.l1FailedRooms !== undefined
          ? partialUpdate.l1FailedRooms
          : (this.currentState.l1FailedRooms || []),
        l2UnlockedDoors: partialUpdate.l2UnlockedDoors !== undefined
          ? partialUpdate.l2UnlockedDoors
          : (this.currentState.l2UnlockedDoors || []),
        l3DestroyedCrystals: partialUpdate.l3DestroyedCrystals !== undefined
          ? partialUpdate.l3DestroyedCrystals
          : (this.currentState.l3DestroyedCrystals || []),
        lastUpdated: Date.now(),
      };
    }

    this.currentState = newState;
    this.saveToSession(newState);

    if (newState.teamCode) {
      this.syncFirebaseSubscription(newState.teamCode);
    }

    // Broadcast locally across browser tabs
    if (this.channel) {
      this.channel.postMessage({ type: 'STATE_UPDATE', state: newState });
    }

    // Broadcast to Firebase if available
    if (isFirebaseInitialized && db && newState.teamCode) {
      try {
        // Only send the fields that actually changed (plus lastUpdated) to prevent race conditions!
        const firestorePayload = { ...partialUpdate, lastUpdated: newState.lastUpdated };
        setDoc(doc(db, 'rooms', newState.teamCode), firestorePayload, { merge: true });
      } catch (e) {
        console.warn("Firebase sync update error:", e);
      }
    }

    this.notifyListeners();
  }

  public async fetchRoomState(teamCode: string): Promise<GameGameState | null> {
    const cleanCode = teamCode.trim().toUpperCase();
    if (!cleanCode) return null;

    if (isFirebaseInitialized && db) {
      try {
        const roomRef = doc(db, 'rooms', cleanCode);
        const snapshot = await getDoc(roomRef);
        if (snapshot.exists()) {
          return snapshot.data() as GameGameState;
        }
      } catch (e) {
        console.warn("Firebase fetch room error:", e);
      }
    }

    if (this.currentState.teamCode === cleanCode) {
      return this.currentState;
    }

    return null;
  }

  public async fetchDefaultLevelTimers(): Promise<{ level1Seconds: number; level2Seconds: number; level3Seconds: number }> {
    const defaults = { level1Seconds: 120, level2Seconds: 120, level3Seconds: 240 };
    if (isFirebaseInitialized && db) {
      try {
        const configRef = doc(db, 'config', 'levels');
        const snapshot = await getDoc(configRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          return {
            level1Seconds: Number(data.level1Seconds) || defaults.level1Seconds,
            level2Seconds: Number(data.level2Seconds) || defaults.level2Seconds,
            level3Seconds: Number(data.level3Seconds) || defaults.level3Seconds,
          };
        }
      } catch (e) {
        console.warn("Firestore config/levels fetch warning:", e);
      }
    }
    return defaults;
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => cb(this.currentState));
  }
}

export const gameSync = new GameSyncManager();
