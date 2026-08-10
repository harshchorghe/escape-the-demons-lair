import { db, isFirebaseInitialized } from "./firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

export interface Level2PhysicsConfig {
  pipeSpeed: number;
  pipeSpeedBoost: number;
  gravity: number;
  jumpStrength: number;
  maxFallSpeed: number;
  pipeGap: number;
  pipeSpawnInterval: number;
  targetScore: number;
  speedBoostThreshold: number;
  timePenalty: number;
  maxLives: number;
}

export const DEFAULT_LEVEL2_PHYSICS: Level2PhysicsConfig = {
  pipeSpeed: 4.5,
  pipeSpeedBoost: 6.5,
  gravity: 0.24,
  jumpStrength: -5.2,
  maxFallSpeed: 7.0,
  pipeGap: 200,
  pipeSpawnInterval: 85,
  targetScore: 21,
  speedBoostThreshold: 15,
  timePenalty: 15,
  maxLives: 3,
};

function parseNum(val: any, fallback: number): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}

function parseConfigData(data: any): Level2PhysicsConfig {
  return {
    pipeSpeed: parseNum(data?.pipeSpeed, DEFAULT_LEVEL2_PHYSICS.pipeSpeed),
    pipeSpeedBoost: parseNum(data?.pipeSpeedBoost, DEFAULT_LEVEL2_PHYSICS.pipeSpeedBoost),
    gravity: parseNum(data?.gravity, DEFAULT_LEVEL2_PHYSICS.gravity),
    jumpStrength: parseNum(data?.jumpStrength, DEFAULT_LEVEL2_PHYSICS.jumpStrength),
    maxFallSpeed: parseNum(data?.maxFallSpeed, DEFAULT_LEVEL2_PHYSICS.maxFallSpeed),
    pipeGap: parseNum(data?.pipeGap, DEFAULT_LEVEL2_PHYSICS.pipeGap),
    pipeSpawnInterval: parseNum(data?.pipeSpawnInterval, DEFAULT_LEVEL2_PHYSICS.pipeSpawnInterval),
    targetScore: parseNum(data?.targetScore, DEFAULT_LEVEL2_PHYSICS.targetScore),
    speedBoostThreshold: parseNum(data?.speedBoostThreshold, DEFAULT_LEVEL2_PHYSICS.speedBoostThreshold),
    timePenalty: parseNum(data?.timePenalty, DEFAULT_LEVEL2_PHYSICS.timePenalty),
    maxLives: parseNum(data?.maxLives, DEFAULT_LEVEL2_PHYSICS.maxLives),
  };
}

/**
 * Fetches Level 2 Physics & Speed configuration from Firebase Firestore document (config/level2).
 * Falls back to default physics constants if unconfigured or offline.
 */
export async function getLevel2PhysicsConfig(): Promise<Level2PhysicsConfig> {
  if (!isFirebaseInitialized || !db) {
    console.warn("⚠️ Firebase is not initialized. Level 2 using DEFAULT physics constants.");
    return DEFAULT_LEVEL2_PHYSICS;
  }

  try {
    const physicsDocRef = doc(db, "config", "level2");
    const docSnap = await getDoc(physicsDocRef);

    if (docSnap.exists()) {
      const config = parseConfigData(docSnap.data());
      console.log("🔥 Level 2 physics loaded from Firebase Firestore (config/level2):", config);
      return config;
    } else {
      console.warn("⚠️ Firestore document config/level2 does not exist. Using DEFAULT physics constants.");
    }
  } catch (error) {
    console.warn("Failed to fetch Level 2 physics from Firebase Firestore, using default physics.", error);
  }

  return DEFAULT_LEVEL2_PHYSICS;
}

/**
 * Subscribes to real-time updates for Level 2 physics configuration in Firebase Firestore.
 */
export function subscribeToLevel2PhysicsConfig(callback: (config: Level2PhysicsConfig) => void): () => void {
  if (!isFirebaseInitialized || !db) {
    console.warn("⚠️ Firebase is not initialized. Level 2 using DEFAULT physics constants.");
    callback(DEFAULT_LEVEL2_PHYSICS);
    return () => {};
  }

  try {
    const physicsDocRef = doc(db, "config", "level2");
    return onSnapshot(
      physicsDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const config = parseConfigData(snapshot.data());
          console.log("🔥 Real-time Level 2 physics updated from Firebase Firestore (config/level2):", config);
          callback(config);
        } else {
          console.warn("⚠️ Firestore document config/level2 does not exist. Using DEFAULT physics constants.");
          callback(DEFAULT_LEVEL2_PHYSICS);
        }
      },
      (error) => {
        console.warn("Real-time physics subscription error, falling back to default.", error);
        callback(DEFAULT_LEVEL2_PHYSICS);
      }
    );
  } catch (error) {
    console.warn("Failed to subscribe to Level 2 physics Firestore document.", error);
    callback(DEFAULT_LEVEL2_PHYSICS);
    return () => {};
  }
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

