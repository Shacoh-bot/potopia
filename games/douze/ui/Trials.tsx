"use client";

import { cx } from "@app/ui";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { ClockTime } from "../src/content";
import {
  COUNT_WATCH_MS,
  TIME_LIMITS,
  type Answer,
  type Shape,
  type Thing,
  type TrialKind,
  type TrialView,
} from "../src/trials";
import { sounds } from "./sound";

type Of<K extends TrialKind> = Extract<TrialView, { kind: K }>;
type Props<K extends TrialKind> = { trial: Of<K>; done: (answer: Answer) => void };

/** Titre crié en grand et consigne de chaque épreuve (écran d'annonce et en-tête). */
export function trialTitle(trial: TrialView): { title: string; hint: string } {
  switch (trial.kind) {
    case "chrono":
      return {
        title: "Arrête à 12,00 s !",
        hint: "Le chrono va disparaître. Compte dans ta tête.",
      };
    case "clicks":
      return { title: "Clique 12 fois !", hint: "Pas 11. Pas 13. Douze." };
    case "count":
      return {
        title: `Combien de ${trial.label} ?`,
        hint: `Seulement les ${trial.item}, pas les ${trial.decoy}. Tu as 4 secondes.`,
      };
    case "quiz":
      return { title: "Douze ou pas douze ?", hint: "Quatre questions. Vite." };
    case "sum":
      return {
        title: "Fais 12 !",
        hint: "Touche des nombres qui font 12 ensemble. Quatre paquets.",
      };
    case "polygon":
      return { title: "Trouve le dodécagone !", hint: "12 côtés. Pas 11, pas 13." };
    case "clock":
      return {
        title: `Quelle horloge indique ${trial.label} ?`,
        hint: "Regarde bien les aiguilles.",
      };
    case "letters":
      return { title: "Lequel a 12 lettres ?", hint: "Seules les lettres comptent." };
    case "counter":
      return { title: "Clique sur le 12 !", hint: "Une seule chance." };
    case "calc":
      return { title: "Coche tout ce qui fait 12", hint: "Puis valide. Les intrus coûtent cher." };
    case "real":
      return { title: "Trouve le vrai 12", hint: "Les autres sont des imposteurs." };
    case "oracle":
      return { title: "L'Oracle demande…", hint: "Réfléchis bien." };
  }
}

/** Nom court de chaque épreuve (récapitulatif de fin de journée). */
export const KIND_LABELS: Record<TrialKind, string> = {
  chrono: "Chrono à l'aveugle",
  clicks: "Douze clics",
  count: "Compter",
  quiz: "Douze ou pas douze",
  sum: "Fais 12",
  polygon: "Le dodécagone",
  clock: "L'horloge",
  letters: "Douze lettres",
  counter: "Le compteur fou",
  calc: "Calculs",
  real: "Le vrai 12",
  oracle: "L'Oracle",
};

/**
 * Une épreuve en cours : la barre de temps et le jeu lui-même. `done` n'est appelé qu'une fois,
 * avec la réponse du joueur, ou celle qu'il a en cours quand le temps est écoulé.
 */
export function TrialPlayer({ trial, done }: { trial: TrialView; done: (answer: Answer) => void }) {
  const finished = useRef(false);
  const latest = useRef<Answer | null>(null);
  const once = useRef(done);
  once.current = done;
  const finish = (answer: Answer) => {
    if (finished.current) return;
    finished.current = true;
    once.current(answer);
  };
  // réponse en cours, envoyée telle quelle quand le temps est écoulé
  const progress = (answer: Answer) => {
    latest.current = answer;
  };
  const limit = TIME_LIMITS[trial.kind];

  useEffect(() => {
    const t = window.setTimeout(() => finish(latest.current ?? timeoutAnswer(trial)), limit);
    return () => window.clearTimeout(t);
    // une seule minuterie par épreuve : le composant est recréé à chaque épreuve (key)
  }, []);

  const body = (() => {
    const p = { done: finish, progress };
    switch (trial.kind) {
      case "chrono":
        return <Chrono trial={trial} {...p} />;
      case "clicks":
        return <Clicks trial={trial} {...p} />;
      case "count":
        return <Count trial={trial} {...p} />;
      case "quiz":
        return <Quiz trial={trial} {...p} />;
      case "sum":
        return <Sum trial={trial} {...p} />;
      case "polygon":
        return <Polygons trial={trial} {...p} />;
      case "clock":
        return <Clocks trial={trial} {...p} />;
      case "letters":
        return <Letters trial={trial} {...p} />;
      case "counter":
        return <Counter trial={trial} {...p} />;
      case "calc":
        return <Calcs trial={trial} {...p} />;
      case "real":
        return <Real trial={trial} {...p} />;
      case "oracle":
        return <Oracle trial={trial} {...p} />;
    }
  })();

  return (
    <div className="douze-trial">
      <div className="douze-timer" style={{ "--douze-limit": `${limit}ms` } as CSSProperties}>
        <span />
      </div>
      {body}
    </div>
  );
}

/** Réponse quand le temps est écoulé sans rien faire. */
function timeoutAnswer(trial: TrialView): Answer {
  switch (trial.kind) {
    case "chrono":
    case "counter":
      return { ms: null };
    case "clicks":
      return { count: 0 };
    case "count":
      return { count: null };
    case "quiz":
      return { picks: [] };
    case "sum":
      return { groups: [] };
    case "calc":
      return { checked: [] };
    default:
      return { pick: null };
  }
}

type TrialProps<K extends TrialKind> = Props<K> & { progress: (answer: Answer) => void };

/** Temps écoulé depuis le début de l'épreuve, rafraîchi à chaque image. */
function useElapsed(): [number, RefObject<number>] {
  const start = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    start.current = performance.now();
    let frame = 0;
    const loop = () => {
      setElapsed(performance.now() - start.current);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);
  return [elapsed, start];
}

/**
 * Valeur tenue dans une ref (toujours à jour, même pour deux clics dans la même image) et
 * recopiée dans l'affichage.
 */
function useLive<T>(initial: T): [RefObject<T>, (value: T) => void] {
  const ref = useRef(initial);
  const [, render] = useState(0);
  return [
    ref,
    (value: T) => {
      ref.current = value;
      render((n) => n + 1);
    },
  ];
}

function Chrono({ trial, done }: TrialProps<"chrono">) {
  const [elapsed, start] = useElapsed();
  const visible = elapsed < trial.visibleMs;
  return (
    <div className="douze-center">
      <p className={cx("douze-chrono", !visible && "douze-chrono-hidden")}>
        {visible ? (elapsed / 1000).toFixed(2).replace(".", ",") : "??,??"}
      </p>
      <button
        type="button"
        className="douze-big-button"
        onClick={() => done({ ms: Math.round(performance.now() - start.current) })}
      >
        STOP
      </button>
    </div>
  );
}

function Clicks({ trial, progress }: TrialProps<"clicks">) {
  const [count, setCount] = useLive(0);
  const [spot, setSpot] = useState({ x: 50, y: 50 });
  return (
    <div className="douze-arena">
      <button
        type="button"
        className="douze-big-button douze-floating"
        style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
        onClick={() => {
          const next = count.current + 1;
          setCount(next);
          progress({ count: next });
          sounds.tick();
          if (trial.moving) setSpot({ x: 15 + Math.random() * 70, y: 20 + Math.random() * 60 });
        }}
      >
        12
      </button>
      <p className="douze-arena-note">Clics : ?</p>
    </div>
  );
}

/** Position d'un objet qui rebondit sur les bords, `t` secondes après le départ. */
function bounce(start: number, speed: number, t: number): number {
  const lo = 0.04;
  const span = 0.92;
  const raw = (((start - lo + speed * t) % (2 * span)) + 2 * span) % (2 * span);
  return lo + (raw > span ? 2 * span - raw : raw);
}

function Count({ trial, done }: TrialProps<"count">) {
  const [elapsed] = useElapsed();
  if (elapsed < COUNT_WATCH_MS) {
    const t = elapsed / 1000;
    return (
      <div className="douze-arena">
        {trial.things.map((thing: Thing, i) => (
          <span
            key={i}
            className="douze-thing"
            style={{
              left: `${bounce(thing.x, thing.vx, t) * 100}%`,
              top: `${bounce(thing.y, thing.vy, t) * 100}%`,
            }}
          >
            {thing.decoy ? trial.decoy : trial.item}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="douze-center">
      <p className="douze-question">Alors, combien de {trial.item} ?</p>
      <div className="douze-choices">
        {[10, 11, 12, 13, 14].map((n) => (
          <button key={n} type="button" className="douze-choice" onClick={() => done({ count: n })}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function Quiz({ trial, done, progress }: TrialProps<"quiz">) {
  const [live, setPicks] = useLive<boolean[]>([]);
  const picks = live.current;
  const question = trial.questions[picks.length];
  const answer = (twelve: boolean) => {
    if (live.current.length >= trial.questions.length) return;
    const next = [...live.current, twelve];
    setPicks(next);
    progress({ picks: next });
    sounds.tick();
    if (next.length >= trial.questions.length) done({ picks: next });
  };
  if (!question) return null;
  return (
    <div className="douze-center">
      <p className="douze-step">
        {picks.length + 1} / {trial.questions.length}
      </p>
      <p key={question.id} className="douze-question animate-rise">
        {question.text}
      </p>
      <div className="douze-choices">
        <button
          type="button"
          className="douze-choice douze-choice-yes"
          onClick={() => answer(true)}
        >
          12
        </button>
        <button type="button" className="douze-choice" onClick={() => answer(false)}>
          Pas 12
        </button>
      </div>
    </div>
  );
}

function Sum({ trial, done, progress }: TrialProps<"sum">) {
  const [liveGroups, setGroups] = useLive<number[][]>([]);
  const [liveSelected, setSelected] = useLive<number[]>([]);
  const [shake, setShake] = useState(0);
  const groups = liveGroups.current;
  const selected = liveSelected.current;
  const used = new Set(groups.flat());
  const total = selected.reduce((n, i) => n + (trial.tiles[i] ?? 0), 0);
  const toggle = (i: number) => {
    const current = liveSelected.current;
    if (liveGroups.current.some((g) => g.includes(i))) return;
    const next = current.includes(i) ? current.filter((j) => j !== i) : [...current, i];
    const sum = next.reduce((n, j) => n + (trial.tiles[j] ?? 0), 0);
    if (sum === 12) {
      const all = [...liveGroups.current, next];
      setGroups(all);
      setSelected([]);
      progress({ groups: all });
      sounds.result(12);
      if (all.length >= 4) done({ groups: all });
    } else if (sum > 12) {
      setSelected([]);
      setShake((n) => n + 1);
    } else {
      setSelected(next);
      sounds.tick();
    }
  };
  return (
    <div className="douze-center">
      <p className="douze-step">
        {groups.length} / 4 paquets · sélection : {total}
      </p>
      <div key={shake} className={cx("douze-tiles", shake > 0 && "douze-shake")}>
        {trial.tiles.map((n, i) => (
          <button
            key={i}
            type="button"
            disabled={used.has(i)}
            onClick={() => toggle(i)}
            className={cx(
              "douze-tile",
              selected.includes(i) && "douze-tile-on",
              used.has(i) && "douze-tile-gone",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Polygone régulier à `sides` côtés, dans un carré de 100. */
function polygonPoints({ sides, rotation, scale }: Shape): string {
  return Array.from({ length: sides }, (_, i) => {
    const a = ((rotation + (360 * i) / sides) * Math.PI) / 180;
    return `${50 + 44 * scale * Math.cos(a)},${50 + 44 * scale * Math.sin(a)}`;
  }).join(" ");
}

function Polygons({ trial, done }: TrialProps<"polygon">) {
  return (
    <div className="douze-grid douze-grid-4">
      {trial.shapes.map((shape, i) => (
        <button key={i} type="button" className="douze-cell" onClick={() => done({ pick: i })}>
          <svg viewBox="0 0 100 100" aria-label={`Forme ${i + 1}`}>
            <polygon points={polygonPoints(shape)} className="douze-polygon" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function ClockFace({ time }: { time: ClockTime }) {
  const hour = ((time.h % 12) + time.m / 60) * 30;
  const minute = time.m * 6;
  return (
    <svg viewBox="0 0 100 100" className="douze-clock">
      <circle cx="50" cy="50" r="46" className="douze-clock-face" />
      {Array.from({ length: 12 }, (_, i) => (
        <line
          key={i}
          x1="50"
          y1="8"
          x2="50"
          y2={i % 3 === 0 ? 16 : 13}
          className="douze-clock-mark"
          transform={`rotate(${i * 30} 50 50)`}
        />
      ))}
      <line
        x1="50"
        y1="50"
        x2="50"
        y2="27"
        className="douze-clock-hour"
        transform={`rotate(${hour} 50 50)`}
      />
      <line
        x1="50"
        y1="50"
        x2="50"
        y2="14"
        className="douze-clock-minute"
        transform={`rotate(${minute} 50 50)`}
      />
      <circle cx="50" cy="50" r="3" className="douze-clock-pin" />
    </svg>
  );
}

function Clocks({ trial, done }: TrialProps<"clock">) {
  return (
    <div className="douze-grid douze-grid-3">
      {trial.clocks.map((time, i) => (
        <button key={i} type="button" className="douze-cell" onClick={() => done({ pick: i })}>
          <ClockFace time={time} />
        </button>
      ))}
    </div>
  );
}

function Letters({ trial, done }: TrialProps<"letters">) {
  return (
    <div className="douze-words">
      {trial.words.map((word, i) => (
        <button key={i} type="button" className="douze-word" onClick={() => done({ pick: i })}>
          {word}
        </button>
      ))}
    </div>
  );
}

function Counter({ trial, done }: TrialProps<"counter">) {
  const [elapsed, start] = useElapsed();
  const shown = trial.sequence[Math.floor(elapsed / trial.stepMs)] ?? "…";
  return (
    <div className="douze-center">
      <button
        type="button"
        className="douze-counter"
        onClick={() => done({ ms: Math.round(performance.now() - start.current) })}
      >
        {shown}
      </button>
      <p className="douze-arena-note">Clique sur le nombre quand c'est 12</p>
    </div>
  );
}

function Calcs({ trial, done, progress }: TrialProps<"calc">) {
  const [live, setChecked] = useLive<number[]>([]);
  const checked = live.current;
  const toggle = (i: number) => {
    const current = live.current;
    const next = current.includes(i) ? current.filter((j) => j !== i) : [...current, i];
    setChecked(next);
    progress({ checked: next });
    sounds.tick();
  };
  return (
    <div className="douze-center">
      <div className="douze-grid douze-grid-3">
        {trial.items.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            aria-pressed={checked.includes(i)}
            className={cx("douze-calc", checked.includes(i) && "douze-calc-on")}
          >
            {item.text}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="douze-big-button"
        onClick={() => done({ checked: live.current })}
      >
        Valider
      </button>
    </div>
  );
}

function Real({ trial, done }: TrialProps<"real">) {
  return (
    <div className="douze-grid douze-grid-6">
      {trial.cells.map((cell, i) => (
        <button key={i} type="button" className="douze-real" onClick={() => done({ pick: i })}>
          {cell}
        </button>
      ))}
    </div>
  );
}

function Oracle({ trial, done }: TrialProps<"oracle">) {
  return (
    <div className="douze-center">
      <p className="douze-question">🔮 {trial.question}</p>
      <div className="douze-choices">
        {trial.options.map((n, i) => (
          <button key={i} type="button" className="douze-choice" onClick={() => done({ pick: i })}>
            {String(n).replace(".", ",")}
          </button>
        ))}
      </div>
    </div>
  );
}
