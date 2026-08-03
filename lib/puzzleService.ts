import { db, isFirebaseInitialized } from './firebase';
import { collection, doc, setDoc, getDocs, getDoc } from 'firebase/firestore';
import { geminiService } from './geminiService';
import { Level1RoomData, Level2DoorData, FinalCrystalData, FALLBACK_L1_ROOMS, FALLBACK_L2_DOORS, FALLBACK_FINAL_CRYSTALS } from './pythonApi';

export class PuzzleService {
  // ── SEED 10 QUESTION SETS TO FIRESTORE ──────────────────────────────
  public async seedLevelPuzzles(level: 1 | 2 | 3, count: number = 10): Promise<{ count: number; message: string }> {
    const collectionName = `level${level}_puzzles`;

    if (!isFirebaseInitialized || !db) {
      return { count: 0, message: "Firebase is not initialized. Please check your credentials." };
    }

    try {
      if (level === 1) {
        const sets = await geminiService.generateLevel1Sets(count);
        for (const s of sets) {
          const docRef = doc(db, collectionName, s.setId);
          await setDoc(docRef, { ...s, lastUpdated: Date.now() }, { merge: true });
        }
        return { count: sets.length, message: `Successfully seeded ${sets.length} Level 1 Question Sets into Firestore!` };
      } else if (level === 2) {
        const sets = await geminiService.generateLevel2Sets(count);
        for (const s of sets) {
          const docRef = doc(db, collectionName, s.setId);
          await setDoc(docRef, { ...s, lastUpdated: Date.now() }, { merge: true });
        }
        return { count: sets.length, message: `Successfully seeded ${sets.length} Level 2 Question Sets into Firestore!` };
      } else {
        const sets = await geminiService.generateLevel3Sets(count);
        for (const s of sets) {
          const docRef = doc(db, collectionName, s.setId);
          await setDoc(docRef, { ...s, lastUpdated: Date.now() }, { merge: true });
        }
        return { count: sets.length, message: `Successfully seeded ${sets.length} Level 3 Question Sets into Firestore!` };
      }
    } catch (e: any) {
      console.warn(`Firestore seeding error for Level ${level}:`, e);
      return { count: 0, message: `Firestore seeding warning: ${e.message || e}` };
    }
  }

  // ── FETCH ALL STORED SETS FROM FIRESTORE (For /admin Dashboard) ──────
  public async fetchAllStoredSets(level: 1 | 2 | 3): Promise<any[]> {
    const collectionName = `level${level}_puzzles`;
    if (isFirebaseInitialized && db) {
      try {
        const colRef = collection(db, collectionName);
        const snapshot = await getDocs(colRef);
        if (!snapshot.empty) {
          return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
      } catch (e) {
        console.warn(`Firestore fetchAllStoredSets error for ${collectionName}:`, e);
      }
    }
    return [];
  }

  // ── GET ASSIGNED PUZZLE SET FOR TEAM GAMEPLAY ──────────────────────
  public async getAssignedSetForTeam(level: 1 | 2 | 3, teamCode: string): Promise<any> {
    const collectionName = `level${level}_puzzles`;

    // Deterministic set index from teamCode (e.g. LAIR-7X9B -> set_1..set_10)
    let hash = 0;
    const cleanCode = (teamCode || 'LAIR-DEMO').toUpperCase();
    for (let i = 0; i < cleanCode.length; i++) hash += cleanCode.charCodeAt(i);
    const setNum = (hash % 10) + 1;
    const setId = `set_${setNum}`;

    if (isFirebaseInitialized && db) {
      try {
        const docRef = doc(db, collectionName, setId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (level === 1 && Array.isArray(data.rooms)) return data.rooms;
          if (level === 2 && Array.isArray(data.doors)) return data.doors;
          if (level === 3 && Array.isArray(data.crystals)) return data.crystals;
        }
      } catch (e) {
        console.warn(`Firestore fetch set ${setId} warning:`, e);
      }
    }

    // Fallbacks if Firestore not seeded yet
    if (level === 1) return FALLBACK_L1_ROOMS;
    if (level === 2) return FALLBACK_L2_DOORS;
    return FALLBACK_FINAL_CRYSTALS;
  }
}

export const puzzleService = new PuzzleService();
