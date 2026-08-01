import { db, isFirebaseInitialized } from "./firebase";
import { collection, doc, setDoc, getDocs } from "firebase/firestore";

export interface LeaderboardEntry {
  id: string;
  teamCode: string;
  teamName: string;
  player1: string;
  player2: string;
  levelsCompleted: number; // 0, 1, 2, or 3 (3 = Escaped all 3 levels!)
  totalTimeSeconds: number;
  gameStatus: 'victory' | 'playing' | 'disqualified' | 'gameover';
  date: string;
  timestamp: number;
}

/**
 * Comparator to rank teams:
 * 1. Teams completing MORE levels rank HIGHER (3 levels > 2 levels > 1 level).
 * 2. For teams with the same levels completed, FASTER time (lower seconds) ranks HIGHER!
 */
export function sortLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.levelsCompleted !== a.levelsCompleted) {
      return b.levelsCompleted - a.levelsCompleted;
    }
    return a.totalTimeSeconds - b.totalTimeSeconds;
  });
}

/**
 * Saves or updates a team run in Firebase Firestore leaderboard
 */
export async function saveTeamScore(score: Omit<LeaderboardEntry, 'id' | 'timestamp'>): Promise<void> {
  const timestamp = Date.now();
  const entry: LeaderboardEntry = {
    ...score,
    id: score.teamCode || timestamp.toString(),
    timestamp,
  };

  if (isFirebaseInitialized && db && score.teamCode) {
    try {
      const docRef = doc(db, 'leaderboard', score.teamCode);
      await setDoc(docRef, entry, { merge: true });
    } catch (e) {
      console.warn("Firestore leaderboard save warning:", e);
    }
  }

  // Update local storage cache
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem('demons_lair_leaderboard');
      let list: LeaderboardEntry[] = local ? JSON.parse(local) : [];
      list = list.filter((item) => item.teamCode !== score.teamCode);
      list.push(entry);
      const sorted = sortLeaderboardEntries(list);
      localStorage.setItem('demons_lair_leaderboard', JSON.stringify(sorted.slice(0, 50)));
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Fetches all teams from Firebase Firestore and ranks them:
 * Top ranks = Teams that completed all 3 levels in fastest time!
 */
export async function getAllTeamsLeaderboard(maxLimit: number = 25): Promise<LeaderboardEntry[]> {
  let entries: LeaderboardEntry[] = [];

  if (isFirebaseInitialized && db) {
    try {
      const leaderCollection = collection(db, 'leaderboard');
      const snapshot = await getDocs(leaderCollection);
      if (!snapshot.empty) {
        entries = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as LeaderboardEntry[];
      }
    } catch (e) {
      console.warn("Firestore leaderboard fetch warning:", e);
    }
  }

  // Fallback to local storage if empty or offline
  if (entries.length === 0 && typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem('demons_lair_leaderboard');
      if (local) {
        entries = JSON.parse(local);
      }
    } catch (e) {
      // ignore
    }
  }

  // Rank entries: 3/3 levels first (by fastest time), then 2/3, 1/3, 0/3
  const ranked = sortLeaderboardEntries(entries);
  return ranked.slice(0, maxLimit);
}
