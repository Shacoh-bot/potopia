"use client";

/* eslint-disable @next/next/no-img-element -- image détourée déjà optimisée (WebP), pas de next/image */
import {
  effectiveVolume,
  MAO_MAO_EVENT,
  MAO_MAO_SOON_EVENT,
  type MaoMaoDetail,
  type MaoMood,
  TO_BE_CONTINUED_EVENT,
} from "@app/ui";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { besideGame } from "./besideGame";

/*
 * Mao Mao (Les Carnets de l'apothicaire) juge les essais ratés à TROIS. Au 3e raté de suite sur un
 * mot, un rouleau suspendu se déroule à droite de la fenêtre du jeu (besideGame, jamais dessus) :
 * son regard qui s'assombrit, main sur la bouche, un sceau vermillon « 三連続 » (trois de suite) et
 * une réplique ; à l'avant-dernier essai, son dégoût, cachée derrière sa manche. Le mot enfin
 * trouvé après au moins 3 ratés : elle surgit, détourée, du bas de l'écran à côté du jeu, avec un
 * sourire narquois. Rien ne bloque le jeu : les clics
 * traversent (on continue de taper, au clavier ou sur les lettres à l'écran) et tout repart seul
 * après quelques secondes. Déclenché par `maoMao()` de `@app/ui`. Monté une fois, layout racine.
 */

const MEDIA = {
  judge: { video: "/apothicaire/mao-judge.mp4", poster: "/apothicaire/mao-judge.jpg" },
  disgust: { video: "/apothicaire/mao-disgust.mp4", poster: "/apothicaire/mao-disgust.jpg" },
} as const;
const SMUG = "/apothicaire/mao-smug.webp";

// Répliques, piochées au hasard ; des clins d'œil à l'anime (poisons, fard au plomb, limaces).
const LINES: Record<Exclude<MaoMood, "smug">, string[]> = {
  judge: [
    "Mao Mao te regarde comme une limace.",
    "Trois ratés. Même au poison, on finit par s'habituer.",
    "Diagnostic : aucun antidote connu.",
    "Elle préférerait encore goûter un champignon inconnu.",
    "Trop de fard au plomb, sans doute.",
  ],
  disgust: [
    "Mao Mao ne veut même plus te regarder.",
    "Dernier essai. Elle prépare déjà la décoction amère.",
    "Même Jinshi n'insiste pas autant.",
    "Là, c'est un cas pour le médecin des cadavres.",
  ],
};
const SMUG_LINES = [
  "Enfin. Tu as trouvé l'antidote ?",
  "Hm. Il était temps.",
  "Pas mal… pour une limace.",
];

const NUMERALS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
/** 3 → 三, 12 → 十二, 30 → 三十 (jusqu'à 99). */
function kanji(n: number): string {
  if (n < 10) return NUMERALS[n] ?? String(n);
  const tens = Math.floor(n / 10);
  return `${tens > 1 ? (NUMERALS[tens] ?? "") : ""}十${NUMERALS[n % 10] ?? ""}`;
}
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)] as T;

/**
 * Une vraie phrase de guzheng par humeur, tirée de la BO de l'anime (sources dans
 * `Apothicaire assets/sons/sources.csv`, hors dépôt).
 */
const GUZHENG: Record<MaoMood, string> = {
  judge: "/audio/maomao/guzheng-judge.mp3", // trois notes qui tombent, déçue
  disgust: "/audio/maomao/guzheng-disgust.mp3", // deux notes qui descendent
  smug: "/audio/maomao/guzheng-smug.mp3", // deux notes qui montent : petit « hm ! »
};
const GUZHENG_VOLUME = 0.8;
// Pendant « To Be Continued » (6,3 s, sa musique Roundabout), Mao Mao apparaît mais se tait.
const TBC_QUIET_MS = 6300;

type Scene = {
  mood: MaoMood;
  misses: number;
  line: string;
  key: number;
  /** À côté de la fenêtre de TROIS (besideGame) ; null : contre le bord droit de l'écran. */
  spot: { left: number; width: number } | null;
};
const SCROLL_MS = 4000; // = la durée de l'animation .mao-layer
const SMUG_MS = 4200;
// largeur voulue et minimale à côté du jeu : le rouleau (ses tringles dépassent de 24 px de chaque
// côté), puis la bulle et Mao Mao narquoise
const SCROLL_W = [340, 220, 24] as const;
const SMUG_W = [460, 220] as const;

export function MaoMao() {
  const [scene, setScene] = useState<Scene | null>(null);
  const timer = useRef(0);
  const preloaded = useRef(false);
  const sounds = useRef<Partial<Record<MaoMood, HTMLAudioElement>>>({});

  useEffect(() => {
    const loaded = sounds.current;
    let tbcAt = Number.NEGATIVE_INFINITY;
    const onTbc = () => {
      tbcAt = performance.now();
    };
    const sound = (mood: MaoMood) => {
      let audio = loaded[mood];
      if (!audio) {
        audio = new Audio(GUZHENG[mood]);
        audio.preload = "auto";
        loaded[mood] = audio;
      }
      return audio;
    };
    // une défaite de plus et elle juge : ses vidéos et l'image se chargent en fond
    const preload = () => {
      if (preloaded.current) return;
      preloaded.current = true;
      for (const src of [MEDIA.judge.poster, MEDIA.disgust.poster, SMUG]) new Image().src = src;
      for (const mood of Object.keys(GUZHENG) as MaoMood[]) sound(mood);
      for (const { video } of Object.values(MEDIA)) {
        const v = document.createElement("video");
        v.preload = "auto";
        v.muted = true;
        v.src = video;
      }
    };
    const onMood = (e: Event) => {
      const { mood, misses } = (e as CustomEvent<MaoMaoDetail>).detail;
      window.clearTimeout(timer.current);
      setScene({
        mood,
        misses,
        line: mood === "smug" ? pick(SMUG_LINES) : pick(LINES[mood]),
        key: Date.now(),
        spot: mood === "smug" ? besideGame(...SMUG_W) : besideGame(...SCROLL_W),
      });
      const level = effectiveVolume() * GUZHENG_VOLUME;
      const tbcPlaying = performance.now() - tbcAt < TBC_QUIET_MS;
      if (level > 0 && !tbcPlaying) {
        const audio = sound(mood);
        audio.currentTime = 0;
        audio.volume = Math.min(1, level);
        audio.play().catch(() => {});
      }
      timer.current = window.setTimeout(
        () => setScene(null),
        mood === "smug" ? SMUG_MS : SCROLL_MS,
      );
    };
    window.addEventListener(MAO_MAO_SOON_EVENT, preload);
    window.addEventListener(MAO_MAO_EVENT, onMood);
    window.addEventListener(TO_BE_CONTINUED_EVENT, onTbc);
    return () => {
      window.removeEventListener(TO_BE_CONTINUED_EVENT, onTbc);
      window.removeEventListener(MAO_MAO_SOON_EVENT, preload);
      window.removeEventListener(MAO_MAO_EVENT, onMood);
      window.clearTimeout(timer.current);
      for (const audio of Object.values(loaded)) audio.pause();
    };
  }, []);

  if (!scene) return null;
  const spot: CSSProperties | undefined = scene.spot
    ? { left: scene.spot.left, right: "auto", width: scene.spot.width }
    : undefined;

  if (scene.mood === "smug") {
    return createPortal(
      <div key={scene.key} className="mao-smug" style={spot} role="status" aria-live="polite">
        <p className="mao-smug-bubble">{scene.line}</p>
        <img
          src={SMUG}
          alt="Mao Mao, sourire narquois"
          className="mao-smug-face"
          // à côté du jeu, elle laisse à sa bulle un peu moins de la moitié de la place
          style={scene.spot ? { width: Math.min(250, scene.spot.width * 0.56) } : undefined}
        />
      </div>,
      document.body,
    );
  }

  const media = MEDIA[scene.mood];
  return createPortal(
    <div
      key={scene.key}
      className="mao-layer"
      style={spot}
      role="status"
      aria-live="polite"
      aria-label={`${scene.misses} essais ratés de suite. ${scene.line}`}
    >
      <div className="mao-petals" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </div>
      <div className="mao-scroll">
        <span className="mao-rod mao-rod-top" aria-hidden />
        {/* le papier se déroule (grille de 0fr à 1fr) et pousse la tringle du bas */}
        <div className="mao-unroll">
          <div className="mao-paper">
            <div className="mao-frame">
              <video
                src={media.video}
                poster={media.poster}
                autoPlay
                muted
                playsInline
                loop={scene.mood === "disgust"}
                className="mao-video"
              />
            </div>
            <p className="mao-line">{scene.line}</p>
            <span className="mao-seal" aria-hidden>
              {`${kanji(scene.misses)}連続`}
            </span>
          </div>
        </div>
        <span className="mao-rod mao-rod-bottom" aria-hidden />
      </div>
    </div>,
    document.body,
  );
}
