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
  isPlayer1Ready: boolean;
  isPlayer2Ready: boolean;
  currentLevel: 1 | 2 | 3 | 4; // 1: Haunted Rooms, 2: Demon Doors, 3: Throne Room, 4: Victory
  l1CompletedRooms: number[];
  l1FailedRooms: number[];
  l1IsCompleted: boolean;
  l2UnlockedDoors: number[];
  l3DestroyedCrystals: number[];
  collectedSealFragments: number;
  selectedSeal: string | null;
  isDemonSealed: boolean;
  timeRemaining: number;
  totalTimeElapsed: number;
  timePenalties: number;
  l3TimeElapsed: number; // Level 3 only timer for leaderboard ranking
  gameStatus: 'lobby' | 'playing' | 'gameover' | 'victory' | 'disqualified';
  lastUpdated: number;
}

export const INITIAL_GAME_STATE: GameGameState = {
  teamCode: '',
  teamName: '',
  player1Name: '',
  player2Name: '',
  isPlayer1Ready: false,
  isPlayer2Ready: false,
  currentLevel: 1,
  l1CompletedRooms: [],
  l1FailedRooms: [],
  l1IsCompleted: false,
  l2UnlockedDoors: [],
  l3DestroyedCrystals: [],
  collectedSealFragments: 0,
  selectedSeal: null,
  isDemonSealed: false,
  timeRemaining: 120, // Level 1 timer: 2 minutes (120s)
  totalTimeElapsed: 0,
  timePenalties: 0,
  l3TimeElapsed: 0,
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
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.teamCode) {
            this.currentState = parsed;
          }
        }
      } catch (e) {
        console.warn('Failed to rehydrate session state:', e);
      }

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
          this.currentState = data;
          this.saveToSession(data);
          this.notifyListeners();
        }
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

  public updateState(updater: Partial<GameGameState> | ((prev: GameGameState) => Partial<GameGameState>)) {
    const partialUpdate = typeof updater === 'function' ? updater(this.currentState) : updater;
    const newState = { ...this.currentState, ...partialUpdate, lastUpdated: Date.now() };
    
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

  private notifyListeners() {
    this.listeners.forEach((cb) => cb(this.currentState));
  }
}

export const gameSync = new GameSyncManager();
