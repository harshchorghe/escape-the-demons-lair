import { useState, useEffect } from "react";
import { getVideoConfig, VideoConfig } from "@/lib/videoService";

export function useVideoSrc(videoKey: keyof VideoConfig, fallbackSrc: string): string {
  const envKey = `NEXT_PUBLIC_VIDEO_${videoKey.toUpperCase()}`;
  const envValue = typeof process !== 'undefined' ? process.env[envKey] : undefined;

  const [videoSrc, setVideoSrc] = useState<string>(envValue || fallbackSrc);

  useEffect(() => {
    let isMounted = true;
    getVideoConfig().then((config) => {
      if (isMounted && config[videoKey]) {
        setVideoSrc(config[videoKey]);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [videoKey]);

  return videoSrc;
}
