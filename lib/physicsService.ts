import { db, isFirebaseInitialized } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface Level2PhysicsConfig {
  pipeSpeed: number;
  pipeSpeedBoost: number;
  gravity: number;
  jumpStrength: number;
  maxFallSpeed: number;
  pipeGap: number;
  pipeSpawnInterval: number;
}

export const DEFAULT_LEVEL2_PHYSICS: Level2PhysicsConfig = {
  pipeSpeed: 4.5,
  pipeSpeedBoost: 6.5,
  gravity: 0.24,
  jumpStrength: -5.2,
  maxFallSpeed: 7.0,
  pipeGap: 200,
  pipeSpawnInterval: 85,
};

function parseNum(val: any, fallback: number): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Fetches Level 2 Physics & Speed configuration from Firebase Firestore document (config/level2).
 * Falls back to default physics constants if unconfigured or offline.
 */
export async function getLevel2PhysicsConfig(): Promise<Level2PhysicsConfig> {
  if (!isFirebaseInitialized || !db) {
    return DEFAULT_LEVEL2_PHYSICS;
  }

  try {
    const physicsDocRef = doc(db, "config", "level2");
    const docSnap = await getDoc(physicsDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        pipeSpeed: parseNum(data.pipeSpeed, DEFAULT_LEVEL2_PHYSICS.pipeSpeed),
        pipeSpeedBoost: parseNum(data.pipeSpeedBoost, DEFAULT_LEVEL2_PHYSICS.pipeSpeedBoost),
        gravity: parseNum(data.gravity, DEFAULT_LEVEL2_PHYSICS.gravity),
        jumpStrength: parseNum(data.jumpStrength, DEFAULT_LEVEL2_PHYSICS.jumpStrength),
        maxFallSpeed: parseNum(data.maxFallSpeed, DEFAULT_LEVEL2_PHYSICS.maxFallSpeed),
        pipeGap: parseNum(data.pipeGap, DEFAULT_LEVEL2_PHYSICS.pipeGap),
        pipeSpawnInterval: parseNum(data.pipeSpawnInterval, DEFAULT_LEVEL2_PHYSICS.pipeSpawnInterval),
      };
    }
  } catch (error) {
    console.warn("Failed to fetch Level 2 physics from Firebase Firestore, using default physics.", error);
  }

  return DEFAULT_LEVEL2_PHYSICS;
}

/**
 * Updates Level 2 physics configuration in Firebase Firestore (admin / console script use).
 */
export async function updateLevel2PhysicsConfig(config: Partial<Level2PhysicsConfig>): Promise<boolean> {
  if (!isFirebaseInitialized || !db) {
    console.warn("Firebase is not initialized. Cannot update physics config.");
    return false;
  }

  try {
    const physicsDocRef = doc(db, "config", "level2");
    await setDoc(physicsDocRef, config, { merge: true });
    return true;
  } catch (error) {
    console.error("Error updating Level 2 physics in Firebase:", error);
    return false;
  }
}
