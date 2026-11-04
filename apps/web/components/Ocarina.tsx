"use client";

import { effectiveVolume, isTimeStopped, onVolumeChange } from "@app/ui";
import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import { OCARINA_SONGS } from "./ocarinaSongs";
import styles from "./Ocarina.module.css";

type Playback = { song: number; id: number; note: number };

export function Ocarina() {
  const gradient = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const lastRef = useRef(-1);
  const serialRef = useRef(0);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const serial = serialRef;
    const offVolume = onVolumeChange(() => {
      if (audioRef.current) audioRef.current.volume = effectiveVolume();
    });
    return () => {
      offVolume();
      serial.current++;
      stopRef.current?.();
    };
  }, []);

  async function play() {
    const id = ++serialRef.current;
    stopRef.current?.();
    setError(false);
    setPlayback(null);
    if (isTimeStopped()) return;
    const audio = (audioRef.current ??= new Audio());
    const choices = OCARINA_SONGS.map((_, i) => i).filter((i) => i !== lastRef.current);
    const songIndex = choices[Math.floor(Math.random() * choices.length)] ?? 0;
    const song = OCARINA_SONGS[songIndex] ?? OCARINA_SONGS[0];
    audio.src = song.src;
    audio.volume = effectiveVolume();
    let raf = 0;
    let lastNote = -1;
    stopRef.current = () => {
      cancelAnimationFrame(raf);
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    };
    audio.onended = () => {
      cancelAnimationFrame(raf);
      if (id === serialRef.current) setPlayback(null);
    };
    audio.onerror = () => {
      if (id !== serialRef.current) return;
      stopRef.current?.();
      setPlayback(null);
      setError(true);
    };
    try {
      await audio.play();
      if (id !== serialRef.current) return;
      lastRef.current = songIndex;
      setPlayback({ song: songIndex, id, note: -1 });
      const tick = () => {
        if (id !== serialRef.current || audio.ended) return;
        const note = Math.floor(audio.currentTime / 0.45);
        if (note !== lastNote) {
          lastNote = note;
          setPlayback({ song: songIndex, id, note });
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch {
      if (id !== serialRef.current) return;
      stopRef.current?.();
      setPlayback(null);
      setError(true);
    }
  }
  const song = playback ? OCARINA_SONGS[playback.song] : null;
  return (
    <div className="relative hidden h-14 w-12 shrink-0 lg:block">
      <button
        type="button"
        onClick={() => void play()}
        aria-label={
          song ? `${song.name} — jouer une autre mélodie` : "Jouer une mélodie à l’ocarina"
        }
        title={song?.name ?? "Ocarina du Temps — mélodie au hasard"}
        className={`${styles.button} ${playback ? styles.playing : ""} absolute inset-0 grid place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current`}
      >
        <svg
          className={styles.instrument}
          width="46"
          height="40"
          viewBox="0 0 64 54"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={gradient}
              x1="16"
              y1="15"
              x2="44"
              y2="48"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#626baf" />
              <stop offset=".3" stopColor="#bfc9ee" />
              <stop offset=".44" stopColor="#e1e8fb" />
              <stop offset=".63" stopColor="#737db7" />
              <stop offset="1" stopColor="#353a82" />
            </linearGradient>
            <linearGradient
              id={`${gradient}-silver`}
              x1="9"
              y1="16"
              x2="24"
              y2="29"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#e6ebec" />
              <stop offset=".45" stopColor="#89989d" />
              <stop offset=".7" stopColor="#e1e6e6" />
              <stop offset="1" stopColor="#414e57" />
            </linearGradient>
            <linearGradient
              id={`${gradient}-mouth`}
              x1="3"
              y1="9"
              x2="16"
              y2="25"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#e6eafb" />
              <stop offset=".3" stopColor="#8f9bc9" />
              <stop offset="1" stopColor="#353c81" />
            </linearGradient>
          </defs>
          <path
            d="M12 28C10 23 1 13 2 10c2-5 9 0 18 9l-8 9Z"
            fill={`url(#${gradient}-mouth)`}
            stroke="#4d5588"
            strokeWidth=".8"
          />
          <path
            d="m10 24 6-9 8 3-8 14-6-8Z"
            fill={`url(#${gradient}-silver)`}
            stroke="#343f52"
            strokeWidth=".8"
          />
          <path
            d="M8 49C0 39 17 21 32 12 43 6 56 1 61 2c4 1-3 18-10 29C39 48 18 57 8 49Z"
            fill={`url(#${gradient})`}
            stroke="#3a427a"
            strokeWidth="1"
          />
          <path d="M12 39c8-13 24-26 39-32-14 9-28 22-36 34Z" fill="#ecf2ff" opacity=".22" />
          <path
            d="m13 21 3-5 3 5h-6Zm-3 5 3-5 3 5h-6Zm6 0 3-5 3 5h-6Z"
            fill="#f9c641"
            stroke="#a57525"
            strokeWidth=".35"
          />
          {[
            [18, 45, 2.9],
            [28, 42, 3],
            [22, 34, 3.2],
            [34, 32, 3.3],
            [36, 18, 3.5],
            [46, 15, 3.1],
            [51, 9, 2.8],
          ].map(([x, y, r], i) => (
            <g key={i} transform={`rotate(-30 ${x} ${y})`}>
              <ellipse
                cx={x}
                cy={y}
                rx={r}
                ry={(r ?? 3) * 0.84}
                fill="#070d24"
                stroke="#b8c7ef"
                strokeWidth=".8"
              />
              <path
                d={`M${(x ?? 0) - (r ?? 3) * 0.65} ${y}q${r} -${r} ${(r ?? 3) * 1.35} -${(r ?? 3) * 0.3}`}
                stroke="#222d60"
                strokeWidth="1.2"
              />
            </g>
          ))}
        </svg>
      </button>
      {playback &&
        Array.from({ length: Math.max(0, playback.note + 1) }, (_, i) => (
          <span
            key={`${playback.id}-${i}`}
            aria-hidden
            className={styles.note}
            style={
              {
                "--drift": `${(i % 2 ? -1 : 1) * (15 + i * 3)}px`,
                animationPlayState: isTimeStopped() ? "paused" : "running",
              } as CSSProperties
            }
          >
            {i % 2 ? "♫" : "♪"}
          </span>
        ))}
      <span className="sr-only" role="status">
        {error ? "Le son n’a pas pu démarrer. Réessaie." : song ? `À l’ocarina : ${song.name}` : ""}
      </span>
    </div>
  );
}
