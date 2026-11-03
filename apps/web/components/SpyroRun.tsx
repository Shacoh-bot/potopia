"use client";

import { effectiveVolume, onTimeStop, onVolumeChange, preloadImages, timeNow } from "@app/ui";
import { useEffect, useRef, useState } from "react";

const SHEETS = {
  idle: { src: "/spyro/spyro-idle-three-quarter.png", frames: 12, step: 120 },
  run: { src: "/spyro/spyro-run-three-quarter.png", frames: 10, step: 65 },
  takeoff: { src: "/spyro/spyro-takeoff-three-quarter.png", frames: 6, step: 120 },
  fly: { src: "/spyro/spyro-flight-three-quarter.png", frames: 6, step: 100 },
};
const IMAGES = Object.values(SHEETS).map((sheet) => sheet.src);
const RUN_MS = 3400;
const TAKEOFF_MS = SHEETS.takeoff.frames * SHEETS.takeoff.step;

/** Course sur le liseré, puis décollage et battements d'ailes. */
export function SpyroRun() {
  const [playing, setPlaying] = useState(false);
  const spriteRef = useRef<HTMLSpanElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => void preloadImages(IMAGES), []);
  useEffect(() => {
    const offVolume = onVolumeChange(() => {
      if (audioRef.current) audioRef.current.volume = effectiveVolume();
    });
    const offTime = onTimeStop((stopped) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (stopped) audio.pause();
      else if (audio.dataset.playing === "true") void audio.play().catch(() => {});
    });
    return () => {
      offVolume();
      offTime();
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const sprite = spriteRef.current;
    if (!sprite) return;
    const start = timeNow();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const animate = () => {
      const elapsed = timeNow() - start;
      const takingOff = playing && elapsed >= RUN_MS && elapsed < RUN_MS + TAKEOFF_MS;
      const flying = playing && elapsed >= RUN_MS + TAKEOFF_MS;
      const sheet = SHEETS[!playing ? "idle" : flying ? "fly" : takingOff ? "takeoff" : "run"];
      const phase = flying ? elapsed - RUN_MS - TAKEOFF_MS : takingOff ? elapsed - RUN_MS : elapsed;
      const frame = reduced ? 0 : Math.floor(phase / sheet.step) % sheet.frames;
      const takeoff = takingOff ? Math.min(1, phase / TAKEOFF_MS) : flying ? 1 : 0;
      const lift = reduced ? 0 : takeoff * 11 + (flying ? Math.sin(phase / 380) * 2 : 0);
      sprite.style.backgroundImage = `url(${sheet.src})`;
      sprite.style.backgroundPosition = `${-frame * 64}px 0`;
      sprite.style.transform = `translateY(${-lift}px)`;
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  function toggle() {
    const next = !playing;
    if (next) {
      audioRef.current ??= Object.assign(new Audio("/audio/spyro.mp3"), { loop: true });
      audioRef.current.volume = effectiveVolume();
      audioRef.current.currentTime = 0;
      audioRef.current.dataset.playing = "true";
      void audioRef.current.play().catch(() => {});
    } else if (audioRef.current) {
      audioRef.current.dataset.playing = "false";
      audioRef.current.pause();
    }
    setPlaying(next);
  }

  return (
    <div className="relative hidden h-14 w-16 shrink-0 lg:block">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Arrêter Spyro" : "Lancer Spyro"}
        aria-pressed={playing}
        title={playing ? "Arrêter Spyro" : "Spyro"}
        className="absolute inset-0 rounded-md transition-[filter] hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        <span
          ref={spriteRef}
          aria-hidden
          className="absolute inset-0 block"
          style={{
            backgroundImage: "url(/spyro/spyro-idle-three-quarter.png)",
            backgroundRepeat: "no-repeat",
            imageRendering: "pixelated",
          }}
        />
      </button>
    </div>
  );
}
