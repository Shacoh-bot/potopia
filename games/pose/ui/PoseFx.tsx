"use client";

import { effectiveVolume, toBeContinued } from "@app/ui";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { pickLine, type JojoLine, type LineEvent } from "../src/lines";
import type { grade } from "../src/score";

type Grade = ReturnType<typeof grade>;

// Sons du thème JoJo, servis par apps/web/public (vraies voix, comme le thème).
const MENACING = "/audio/jojo-menacing.mp3";
const YARE_YARE = "/audio/jojo-yare-yare.mp3";
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

/** Durée d'un effet, après quoi il repart tout seul. */
const SHOW_MS = 2400;
/** Sans toucher au pantin pendant ce temps (tiré au hasard), une réplique vient le taquiner. */
const IDLE_MIN_MS = 22_000;
const IDLE_MAX_MS = 40_000;
/** Chances qu'un évènement mineur (pantin remis droit, début de partie) donne une réplique. */
const MINOR_CHANCE = 0.65;

const eventOf = (g: Grade): LineEvent =>
  g === "A" || g === "B" ? "good" : g === "C" ? "mid" : "bad";

export type FxCue = { id: number; event: "reset" | "start" };

type Props = {
  /** Ressemblance en direct pendant qu'on pose (null après la validation). */
  live: number | null;
  /** Note qu'on vient d'obtenir (après la validation) ; `id` change à chaque validation. */
  result: { id: number; grade: Grade } | null;
  /** Évènement de la partie : pantin remis droit, début de partie. */
  cue: FxCue | null;
};

/**
 * Fin de la partie du jour : « Yare yare daze » si la note finale est un A, To Be Continued si
 * c'est un E (l'arrêt sur image des défaites, désactivable dans Paramètres comme partout).
 */
export function endOfDay(g: Grade) {
  if (g === "A") play(YARE_YARE);
  else if (g === "E") toBeContinued();
}

/**
 * Bonus JoJo autour du pantin, qui ne bloquent jamais le jeu (aucun clic intercepté, aucun voile,
 * ils repartent seuls) :
 * - en posant, des « ゴゴ » apparaissent quand on approche de la pose ;
 * - des répliques de la série, tirées au hasard (src/lines.ts) et affichées en grand façon manga :
 *   à la validation selon la note (« NICE ! », « OH NOOOO ! », « Daga kotowaru »…), quand on remet
 *   le pantin droit (« Nigerundayo ! », « Bites the Dust »…), quand on hésite trop longtemps, et
 *   parfois au début de la partie ;
 * - à la validation aussi : Star Platinum (A), The World (B), une rafale de ゴゴゴ (C).
 */
export function PoseFx({ live, result, cue }: Props) {
  const count = live === null ? 0 : menaceCount(live);
  const maxed = useRef(false);
  const last = useRef<string | null>(null);
  // évènements déjà joués (par id) : un effet relancé (rendu en double en développement) ne
  // rejoue pas la réplique
  const handled = useRef(new Set<number>());
  const [shown, setShown] = useState<{ id: number; grade: Grade } | null>(null);
  const [shout, setShout] = useState<(JojoLine & { key: number }) | null>(null);

  const say = (event: LineEvent, chance = 1) => {
    if (Math.random() > chance) return;
    const line = pickLine(event, last.current);
    if (!line) return;
    last.current = line.id;
    play(line.sound);
    setShout({ ...line, key: Date.now() });
  };
  // `say` change à chaque rendu : les effets passent par une référence stable
  const sayRef = useRef(say);
  sayRef.current = say;

  // le son du Menacing, une seule fois par pose, au troisième ゴゴ
  useEffect(() => {
    if (live === null) {
      maxed.current = false;
      return;
    }
    if (count === 3 && !maxed.current) {
      maxed.current = true;
      play(MENACING);
    }
  }, [count, live]);

  // on n'a pas touché au pantin depuis un moment (la ressemblance ne bouge plus) : une réplique
  const posing = live !== null;
  useEffect(() => {
    if (!posing) return;
    const timer = window.setTimeout(
      () => sayRef.current("idle"),
      IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS),
    );
    return () => window.clearTimeout(timer);
  }, [posing, live]);

  useEffect(() => {
    if (!result) return;
    setShown(result);
    if (!handled.current.has(result.id)) {
      handled.current.add(result.id);
      sayRef.current(eventOf(result.grade));
    }
    const timer = window.setTimeout(() => setShown(null), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [result]);

  useEffect(() => {
    if (!cue || handled.current.has(cue.id)) return;
    handled.current.add(cue.id);
    sayRef.current(cue.event, MINOR_CHANCE);
  }, [cue]);

  useEffect(() => {
    if (!shout) return;
    const timer = window.setTimeout(() => setShout(null), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [shout]);

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
      {shout && (
        <div key={shout.key} className="pose-fx-shout">
          <span className="pose-fx-shout-who">{shout.who}</span>
          <span className="pose-fx-shout-text">{shout.text}</span>
          {shout.sub && <span className="pose-fx-shout-sub">{shout.sub}</span>}
        </div>
      )}
    </div>
  );
}
