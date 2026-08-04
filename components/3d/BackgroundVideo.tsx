"use client";

interface BackgroundVideoProps {
  src: string;
}

export default function BackgroundVideo({ src }: BackgroundVideoProps) {
  return (
    <video
      autoPlay
      muted
      loop
      playsInline
      className="absolute inset-0 w-full h-full object-cover"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}