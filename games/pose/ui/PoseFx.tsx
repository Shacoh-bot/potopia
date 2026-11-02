"use client";

import { effectiveVolume, toBeContinued } from "@app/ui";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { grade } from "../src/score";

type Grade = ReturnType<typeof grade>;

// Sons et planches de sprites du thème JoJo, servis par apps/web/public (vrais sprites Capcom et
// vraies voix, comme le thème).
const SOUNDS = {
  menacing: "/audio/jojo-menacing.mp3",
  ora: "/audio/jojo-ora.mp3",
  muda: "/audio/jojo-muda.mp3",
  yare: "/audio/jojo-yare-yare.mp3",
};
const FX_VOLUME = 0.6;

function play(src: string) {
  const level = effectiveVolume() * FX_VOLUME;
  if (level <= 0) return;
  const audio = new Audio(src);
  audio.volume = level;
  void audio.play().catch(() => {});
}

/**
 * Plus la pose ressemble, plus il y a de « ゴゴ » autour du pantin (à partir de 50, 70 et 85 %) :
 * une indication « chaud ou froid », sans chiffre. Le troisième arrive avec le son du Menacing.
 */
function menaceCount(percent: number): number {
  return percent >= 85 ? 3 : percent >= 70 ? 2 : percent >= 50 ? 1 : 0;
}

// places des ゴゴ dans la carte du pantin, de part et d'autre du personnage
const GOGO_SPOTS: CSSProperties[] = [
  { left: "3%", top: "16%" },
  { right: "3%", top: "28%" },
  { left: "7%", top: "52%" },
];

/** Durée d'un effet de résultat, après quoi il repart tout seul. */
const RESULT_MS = 2200;

type Props = {
  /** Ressemblance en direct pendant qu'on pose (null après la validation). */
  live: number | null;
  /** Note qu'on vient d'obtenir (après la validation) ; `id` change à chaque validation. */
  result: { id: number; grade: Grade } | null;
};

/**
 * Bonus JoJo autour du pantin, qui ne bloquent jamais le jeu (aucun clic intercepté, aucun voile,
 * ils repartent seuls) :
 * - en posant, des « ゴゴ » apparaissent quand on approche de la pose ;
 * - à la validation, selon la note : Star Platinum et son ORA ORA (A), The World et son MUDA MUDA
 *   (B), une rafale de ゴゴゴ (C), « Yare yare daze » (D), rien de plus pour un E (la réplique
 *   suffit : rien ne fige la page en pleine partie).
 */
/**
 * Fin de la partie du jour : « Yare yare daze » si la note finale est un A, To Be Continued si
 * c'est un E (l'arrêt sur image des défaites, désactivable dans Paramètres comme partout).
 */
export function endOfDay(g: Grade) {
  if (g === "A") play(SOUNDS.yare);
  else if (g === "E") toBeContinued();
}

export function PoseFx({ live, result }: Props) {
  const count = live === null ? 0 : menaceCount(live);
  const maxed = useRef(false);
  const [shown, setShown] = useState<{ id: number; grade: Grade } | null>(null);

  // le son du Menacing, une seule fois par pose, au troisième ゴゴ
  useEffect(() => {
    if (live === null) {
      maxed.current = false;
      return;
    }
    if (count === 3 && !maxed.current) {
      maxed.current = true;
      play(SOUNDS.menacing);
    }
  }, [count, live]);

  useEffect(() => {
    if (!result) return;
    setShown(result);
    if (result.grade === "A") play(SOUNDS.ora);
    else if (result.grade === "B") play(SOUNDS.muda);
    else if (result.grade === "C") play(SOUNDS.menacing);
    else if (result.grade === "D") play(SOUNDS.yare);
    const timer = window.setTimeout(() => setShown(null), RESULT_MS);
    return () => window.clearTimeout(timer);
  }, [result]);

  return (
    <div aria-hidden className="pose-fx">
      {GOGO_SPOTS.slice(0, count).map((style, i) => (
        <span key={i} className="pose-fx-gogo jojo-strip" style={style} />
      ))}
      {shown?.grade === "A" && <span key={shown.id} className="pose-fx-star jojo-strip" />}
      {shown?.grade === "B" && <span key={shown.id} className="pose-fx-world jojo-strip" />}
      {shown?.grade === "C" &&
        GOGO_SPOTS.map((style, i) => (
          <span
            key={`${shown.id}-${i}`}
            className="pose-fx-gogo pose-fx-gogo-burst jojo-strip"
            style={{ ...style, animationDelay: `${i * 120}ms` }}
          />
        ))}
    </div>
  );
}
