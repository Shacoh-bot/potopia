"use client";
import { effectiveVolume, isTimeStopped, onVolumeChange } from "@app/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ThemeId } from "../src/game";

export function useMorpionSound(theme: ThemeId) {
  const [enabled, setEnabled] = useState(true);
  const enabledRef = useRef(true);
  const music = useRef<HTMLAudioElement | null>(null);
  const effect = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const track = new Audio(`/morpion-assets/${theme}/main_theme.mp3`);
    track.loop = true;
    track.volume = effectiveVolume() * 0.45;
    music.current = track;
    const stopListening = () => {
      document.removeEventListener("pointerdown", retry);
      document.removeEventListener("keydown", retry);
    };
    // Si le navigateur bloque l'autoplay, le premier geste dans la page débloque la musique.
    const retry = () => {
      if (!enabledRef.current || isTimeStopped()) return;
      void track
        .play()
        .then(stopListening)
        .catch(() => {});
    };
    document.addEventListener("pointerdown", retry);
    document.addEventListener("keydown", retry);
    retry();
    const off = onVolumeChange(() => {
      track.volume = effectiveVolume() * 0.45;
      if (effect.current) effect.current.volume = effectiveVolume();
    });
    return () => {
      off();
      stopListening();
      track.pause();
      if (effect.current) effect.current.onended = null;
      effect.current?.pause();
      music.current = null;
    };
  }, [theme]);
  const toggle = () => {
    enabledRef.current = !enabled;
    if (enabled) {
      music.current?.pause();
      effect.current?.pause();
    } else {
      void music.current?.play().catch(() => {});
    }
    setEnabled(!enabled);
  };
  const play = useCallback(
    (file: string, result = false) => {
      if (!enabled) return;
      effect.current?.pause();
      if (result) music.current?.pause();
      const sound = new Audio(`/morpion-assets/${theme}/${file}.mp3`);
      sound.volume = effectiveVolume();
      effect.current = sound;
      if (result)
        sound.onended = () => {
          if (music.current) void music.current.play().catch(() => {});
        };
      void sound.play().catch(() => {});
    },
    [enabled, theme],
  );
  return { enabled, toggle, play };
}
