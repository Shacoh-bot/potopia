import { z } from "zod";
import {
  CALCS,
  CLOCKS,
  COUNTABLES,
  COUNTER_LOOKALIKES,
  FAKE_TWELVES,
  isTwelve,
  letterCount,
  ORACLE,
  QUIZ,
  WORDS,
  type Calc,
  type ClockTime,
  type QuizQuestion,
} from "./content";
import { random, seedOf } from "./daily";

/** Nombre d'épreuves par jour. Évidemment. */
export const TRIAL_COUNT = 12;
/** Points d'une épreuve parfaite. */
export const MAX_TRIAL_POINTS = 12;
/** Points d'une journée parfaite : 12 × 12 = 144, une grosse. */
export const MAX_DAY_POINTS = TRIAL_COUNT * MAX_TRIAL_POINTS;

export const TRIAL_KINDS = [
  "chrono",
  "clicks",
  "count",
  "quiz",
  "sum",
  "polygon",
  "clock",
  "letters",
  "counter",
  "calc",
  "real",
  "oracle",
] as const;
export type TrialKind = (typeof TRIAL_KINDS)[number];

/** Un objet à compter (ou son sosie), qui flotte : position et vitesse en fraction de la zone. */
export type Thing = { x: number; y: number; vx: number; vy: number; decoy: boolean };
export type Shape = { sides: number; rotation: number; scale: number };

/** Une épreuve du jour, complète (avec ses réponses) : le serveur la recalcule pour noter. */
export type Trial =
  | { kind: "chrono"; visibleMs: number }
  | { kind: "clicks"; moving: boolean }
  | { kind: "count"; item: string; decoy: string; label: string; things: Thing[]; count: number }
  | { kind: "quiz"; questions: QuizQuestion[] }
  | { kind: "sum"; tiles: number[] }
  | { kind: "polygon"; shapes: Shape[] }
  | { kind: "clock"; label: string; clocks: ClockTime[]; answer: number }
  | { kind: "letters"; words: string[]; answer: number }
  | { kind: "counter"; stepMs: number; sequence: string[] }
  | { kind: "calc"; items: Calc[] }
  | { kind: "real"; cells: string[]; answer: number }
  | { kind: "oracle"; question: string; options: number[]; real: number };

/**
 * Ce que le joueur reçoit : l'épreuve sans ses réponses quand elle n'en a pas besoin pour
 * s'afficher (les questions sans leur réponse, les calculs sans leur valeur).
 */
export type TrialView =
  | Exclude<Trial, { kind: "quiz" | "calc" | "clock" | "letters" | "real" | "count" }>
  | Omit<Extract<Trial, { kind: "count" }>, "count">
  | { kind: "quiz"; questions: { id: string; text: string }[] }
  | { kind: "calc"; items: { text: string }[] }
  | Omit<Extract<Trial, { kind: "clock" }>, "answer">
  | Omit<Extract<Trial, { kind: "letters" }>, "answer">
  | Omit<Extract<Trial, { kind: "real" }>, "answer">;

/** Temps de chaque épreuve (ms). Compter : on regarde 4 s, puis on répond. */
export const TIME_LIMITS: Record<TrialKind, number> = {
  chrono: 20_000,
  clicks: 6_000,
  count: 10_000,
  quiz: 16_000,
  sum: 20_000,
  polygon: 9_000,
  clock: 9_000,
  letters: 9_000,
  counter: 12_000,
  calc: 12_000,
  real: 9_000,
  oracle: 9_000,
};
/** Compter : temps pendant lequel les objets restent à l'écran. */
export const COUNT_WATCH_MS = 4_000;
/** Chrono : la cible, 12 s pile. */
export const CHRONO_TARGET_MS = 12_000;
/** Compteur fou : marge autour du clic pour reconnaître le 12 (un affichage a une image de retard). */
export const COUNTER_GRACE_MS = 80;

type Rand = () => number;
const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(rand: Rand, list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T;
function shuffle<T>(rand: Rand, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const GENERATORS: Record<TrialKind, (rand: Rand) => Trial> = {
  chrono: (rand) => ({ kind: "chrono", visibleMs: pick(rand, [2000, 3000, 4000, 5000]) }),
  clicks: (rand) => ({ kind: "clicks", moving: rand() < 0.5 }),
  count: (rand) => {
    const what = pick(rand, COUNTABLES);
    const count = pick(rand, [10, 11, 12, 12, 13, 14]);
    const decoys = int(rand, 3, 6);
    const thing = (decoy: boolean): Thing => ({
      x: round3(0.06 + rand() * 0.88),
      y: round3(0.08 + rand() * 0.84),
      vx: round3((rand() - 0.5) * 0.24),
      vy: round3((rand() - 0.5) * 0.24),
      decoy,
    });
    const things = shuffle(rand, [
      ...Array.from({ length: count }, () => thing(false)),
      ...Array.from({ length: decoys }, () => thing(true)),
    ]);
    return { kind: "count", item: what.item, decoy: what.decoy, label: what.label, things, count };
  },
  quiz: (rand) => {
    const twelves = shuffle(
      rand,
      QUIZ.filter((q) => q.answer === 12),
    );
    const others = shuffle(
      rand,
      QUIZ.filter((q) => q.answer !== 12),
    );
    const n = int(rand, 1, 3);
    return {
      kind: "quiz",
      questions: shuffle(rand, [...twelves.slice(0, n), ...others.slice(0, 4 - n)]),
    };
  },
  sum: (rand) => {
    const groups = Array.from({ length: 4 }, () => {
      if (rand() < 0.5) {
        const a = int(rand, 1, 11);
        return [a, 12 - a];
      }
      const a = int(rand, 1, 10);
      const b = int(rand, 1, 11 - a);
      return [a, b, 12 - a - b];
    });
    const decoys = [int(rand, 1, 11), int(rand, 1, 11)];
    return { kind: "sum", tiles: shuffle(rand, [...groups.flat(), ...decoys]) };
  },
  polygon: (rand) => {
    const target = int(rand, 0, 11);
    const shapes = Array.from({ length: 12 }, (_, i) => ({
      sides: i === target ? 12 : pick(rand, [10, 11, 11, 13, 13, 14]),
      rotation: int(rand, 0, 359),
      scale: round3(0.75 + rand() * 0.25),
    }));
    return { kind: "polygon", shapes };
  },
  clock: (rand) => {
    const riddle = pick(rand, CLOCKS);
    const clocks = shuffle(rand, [riddle.target, ...riddle.decoys]);
    return { kind: "clock", label: riddle.label, clocks, answer: clocks.indexOf(riddle.target) };
  },
  letters: (rand) => {
    const twelve = pick(
      rand,
      WORDS.filter((w) => letterCount(w) === 12),
    );
    const others = shuffle(
      rand,
      WORDS.filter((w) => letterCount(w) !== 12),
    ).slice(0, 3);
    const words = shuffle(rand, [twelve, ...others]);
    return { kind: "letters", words, answer: words.indexOf(twelve) };
  },
  counter: (rand) => {
    const stepMs = pick(rand, [300, 340, 380, 420]);
    const length = Math.ceil(TIME_LIMITS.counter / stepMs) + 2;
    const sequence: string[] = [];
    for (let i = 0; i < length; i++) {
      const prev = sequence[i - 1];
      // le vrai 12 : jamais au tout début ni après la fin du temps, jamais deux fois de suite
      if (i >= 4 && i < length - 2 && prev !== "12" && rand() < 0.11) {
        sequence.push("12");
        continue;
      }
      let next = pick(rand, COUNTER_LOOKALIKES);
      while (next === prev) next = pick(rand, COUNTER_LOOKALIKES);
      sequence.push(next);
    }
    if (!sequence.includes("12")) sequence[int(rand, 5, length - 3)] = "12";
    return { kind: "counter", stepMs, sequence };
  },
  calc: (rand) => {
    const twelves = shuffle(
      rand,
      CALCS.filter((c) => isTwelve(c.value)),
    );
    const others = shuffle(
      rand,
      CALCS.filter((c) => !isTwelve(c.value)),
    );
    const n = int(rand, 2, 3);
    return {
      kind: "calc",
      items: shuffle(rand, [...twelves.slice(0, n), ...others.slice(0, 6 - n)]),
    };
  },
  real: (rand) => {
    const answer = int(rand, 0, 23);
    const cells = Array.from({ length: 24 }, (_, i) =>
      i === answer ? "12" : pick(rand, FAKE_TWELVES),
    );
    return { kind: "real", cells, answer };
  },
  oracle: (rand) => {
    const q = pick(rand, ORACLE);
    return {
      kind: "oracle",
      question: q.text,
      options: shuffle(rand, [q.real, 12, ...q.others]),
      real: q.real,
    };
  },
};

/**
 * Les 12 épreuves du jour, les mêmes pour tout le monde : les 11 premières dans un ordre tiré au
 * sort chaque jour, l'Oracle toujours en 12e. Le contenu de chaque épreuve dépend de la date.
 */
export function dailyTrials(date: string): Trial[] {
  const order = shuffle(
    random(seedOf(`${date}:ordre`)),
    TRIAL_KINDS.filter((k) => k !== "oracle"),
  );
  return [...order, "oracle" as const].map((kind) =>
    GENERATORS[kind](random(seedOf(`${date}:${kind}`))),
  );
}

/** L'épreuve telle que le joueur la reçoit (voir `TrialView`). */
export function trialView(trial: Trial): TrialView {
  switch (trial.kind) {
    case "quiz":
      return { kind: "quiz", questions: trial.questions.map(({ id, text }) => ({ id, text })) };
    case "calc":
      return { kind: "calc", items: trial.items.map(({ text }) => ({ text })) };
    case "count": {
      const { count: _count, ...view } = trial;
      return view;
    }
    case "clock":
    case "letters":
    case "real": {
      const { answer: _answer, ...view } = trial;
      return view;
    }
    default:
      return trial;
  }
}

const ms = z.number().finite().min(0).max(120_000).nullable();
const index = z.number().int().min(0).max(99).nullable();

/** Forme de la réponse de chaque épreuve (`null` : temps écoulé sans réponse). */
export const ANSWERS = {
  chrono: z.object({ ms }),
  clicks: z.object({ count: z.number().int().min(0).max(500) }),
  count: z.object({ count: z.number().int().min(0).max(99).nullable() }),
  quiz: z.object({ picks: z.array(z.boolean().nullable()).max(10) }),
  sum: z.object({ groups: z.array(z.array(z.number().int().min(0).max(99)).max(12)).max(12) }),
  polygon: z.object({ pick: index }),
  clock: z.object({ pick: index }),
  letters: z.object({ pick: index }),
  counter: z.object({ ms }),
  calc: z.object({ checked: z.array(z.number().int().min(0).max(99)).max(12) }),
  real: z.object({ pick: index }),
  oracle: z.object({ pick: index }),
} satisfies Record<TrialKind, z.ZodType>;

export type Answers = { [K in TrialKind]: z.infer<(typeof ANSWERS)[K]> };
export type Answer = Answers[TrialKind];

/** Réponse vide : celle d'une épreuve abandonnée (page rechargée en pleine épreuve). */
export const EMPTY_ANSWERS: Answers = {
  chrono: { ms: null },
  clicks: { count: 0 },
  count: { count: null },
  quiz: { picks: [] },
  sum: { groups: [] },
  polygon: { pick: null },
  clock: { pick: null },
  letters: { pick: null },
  counter: { ms: null },
  calc: { checked: [] },
  real: { pick: null },
  oracle: { pick: null },
};

/** Résultat d'une épreuve : ses points (0 à 12) et une phrase qui dit ce qui s'est passé. */
export type TrialScore = { points: number; note: string };

const clamp = (n: number) => Math.max(0, Math.min(MAX_TRIAL_POINTS, Math.round(n)));
const seconds = (n: number) => `${(n / 1000).toFixed(2).replace(".", ",")} s`;
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** Valeur affichée par le compteur fou `ms` après son départ. */
export function counterAt(trial: Extract<Trial, { kind: "counter" }>, at: number): string | null {
  return trial.sequence[Math.floor(at / trial.stepMs)] ?? null;
}

/**
 * Note une réponse. Lève une `ZodError` si elle est mal formée. Le serveur l'appelle avec
 * l'épreuve qu'il a recalculée lui-même (jamais une épreuve envoyée par le client).
 */
export function scoreTrial(trial: Trial, raw: unknown): TrialScore {
  switch (trial.kind) {
    case "chrono": {
      const { ms } = ANSWERS.chrono.parse(raw);
      if (ms === null) return { points: 0, note: "Le chrono tourne encore…" };
      return {
        points: clamp(12 - Math.floor(Math.abs(ms - CHRONO_TARGET_MS) / 100)),
        note: `Arrêté à ${seconds(ms)}`,
      };
    }
    case "clicks": {
      const { count } = ANSWERS.clicks.parse(raw);
      return { points: clamp(12 - 4 * Math.abs(count - 12)), note: plural(count, "clic") };
    }
    case "count": {
      const { count } = ANSWERS.count.parse(raw);
      const off = count === null ? Infinity : Math.abs(count - trial.count);
      return {
        points: off === 0 ? 12 : off === 1 ? 4 : 0,
        note: `Il y en avait ${trial.count}`,
      };
    }
    case "quiz": {
      const { picks } = ANSWERS.quiz.parse(raw);
      const good = trial.questions.filter((q, i) => picks[i] === (q.answer === 12)).length;
      return {
        points: clamp(good * (MAX_TRIAL_POINTS / trial.questions.length)),
        note: `${good} sur ${trial.questions.length}`,
      };
    }
    case "sum": {
      const { groups } = ANSWERS.sum.parse(raw);
      const used = new Set<number>();
      let found = 0;
      for (const group of groups) {
        const valid =
          group.length > 0 &&
          new Set(group).size === group.length &&
          group.every((i) => i < trial.tiles.length && !used.has(i)) &&
          group.reduce((n, i) => n + (trial.tiles[i] ?? 0), 0) === 12;
        if (!valid) continue;
        group.forEach((i) => used.add(i));
        found++;
      }
      found = Math.min(found, 4);
      return { points: clamp(found * 3), note: `${plural(found, "paquet")} de 12` };
    }
    case "polygon": {
      const { pick } = ANSWERS.polygon.parse(raw);
      const shape = pick === null ? undefined : trial.shapes[pick];
      if (!shape) return { points: 0, note: "Aucun choisi" };
      return shape.sides === 12
        ? { points: 12, note: "12 côtés, bravo" }
        : { points: 0, note: `Celui-là en avait ${shape.sides}` };
    }
    case "clock":
    case "real": {
      const { pick } = ANSWERS[trial.kind].parse(raw);
      if (pick === null) return { points: 0, note: "Trop tard" };
      return pick === trial.answer
        ? { points: 12, note: "Pile ça" }
        : { points: 0, note: "Raté, c'était un autre" };
    }
    case "letters": {
      const { pick } = ANSWERS.letters.parse(raw);
      const word = pick === null ? undefined : trial.words[pick];
      if (!word) return { points: 0, note: "Trop tard" };
      const n = letterCount(word);
      return { points: n === 12 ? 12 : 0, note: `${word} : ${n} lettres` };
    }
    case "counter": {
      const { ms } = ANSWERS.counter.parse(raw);
      if (ms === null) return { points: 0, note: "Pas cliqué" };
      const hit = [ms - COUNTER_GRACE_MS, ms, ms + COUNTER_GRACE_MS].some(
        (at) => counterAt(trial, Math.max(0, at)) === "12",
      );
      return hit
        ? { points: 12, note: "Douze, dans le mille" }
        : { points: 0, note: `Cliqué sur ${counterAt(trial, ms) ?? "rien"}` };
    }
    case "calc": {
      const { checked } = ANSWERS.calc.parse(raw);
      const picked = new Set(checked.filter((i) => i < trial.items.length));
      const right = trial.items.filter((c) => isTwelve(c.value)).length;
      let hits = 0;
      let wrongs = 0;
      for (const i of picked) {
        if (isTwelve(trial.items[i]?.value ?? NaN)) hits++;
        else wrongs++;
      }
      return {
        points: clamp((MAX_TRIAL_POINTS * Math.max(0, hits - wrongs)) / right),
        note: `${hits} sur ${right}${wrongs ? `, ${wrongs} intrus` : ""}`,
      };
    }
    case "oracle": {
      const { pick } = ANSWERS.oracle.parse(raw);
      const value = pick === null ? undefined : trial.options[pick];
      if (value === 12) return { points: 12, note: "Évidemment, 12." };
      return { points: 0, note: "Non. La réponse est 12. Ce sera toujours 12." };
    }
  }
}
