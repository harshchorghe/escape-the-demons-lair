import { db, isFirebaseInitialized } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface VideoConfig {
  lobby?: string;
  level_1?: string;
  level_2?: string;
  level_3?: string;
}

const DEFAULT_VIDEOS: Required<VideoConfig> = {
  lobby: process.env.NEXT_PUBLIC_VIDEO_LOBBY || "/videos/level.mp4",
  level_1: process.env.NEXT_PUBLIC_VIDEO_LEVEL_1 || "/videos/level_1.mp4",
  level_2: process.env.NEXT_PUBLIC_VIDEO_LEVEL_2 || "/videos/level_2.mp4",
  level_3: process.env.NEXT_PUBLIC_VIDEO_LEVEL_3 || "/videos/level_3.mp4",
};

/**
 * Fetches video configuration from Firebase Firestore document (config/videos).
 * Falls back to environment variables or local paths if Firebase is unconfigured or document is missing.
 */
export async function getVideoConfig(): Promise<Required<VideoConfig>> {
  if (!isFirebaseInitialized || !db) {
    return DEFAULT_VIDEOS;
  }

  try {
    const videoDocRef = doc(db, "config", "videos");
    const videoSnap = await getDoc(videoDocRef);

    if (videoSnap.exists()) {
      const data = videoSnap.data() as VideoConfig;
      return {
        lobby: data.lobby?.trim() || DEFAULT_VIDEOS.lobby,
        level_1: data.level_1?.trim() || DEFAULT_VIDEOS.level_1,
        level_2: data.level_2?.trim() || DEFAULT_VIDEOS.level_2,
        level_3: data.level_3?.trim() || DEFAULT_VIDEOS.level_3,
      };
    }
  } catch (error) {
    console.warn("Failed to fetch video config from Firebase Firestore, using default videos.", error);
  }

  return DEFAULT_VIDEOS;
}

/**
 * Helper to update video configuration in Firebase Firestore (admin/setup script use).
 */
export async function updateFirebaseVideoConfig(config: Partial<VideoConfig>): Promise<boolean> {
  if (!isFirebaseInitialized || !db) {
    console.warn("Firebase is not initialized. Cannot save video config.");
    return false;
  }

  try {
    const videoDocRef = doc(db, "config", "videos");
    await setDoc(videoDocRef, config, { merge: true });
    return true;
  } catch (error) {
    console.error("Error updating video config in Firebase:", error);
    return false;
  }
}
