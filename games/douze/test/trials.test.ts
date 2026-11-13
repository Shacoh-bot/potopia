import { describe, expect, it } from "vitest";
import {
  CALCS,
  clockDecoys,
  CLOCKS,
  isTwelve,
  letterCount,
  ORACLE,
  QUIZ,
  WORDS,
} from "../src/content";
import { shiftDate } from "../src/daily";
import { dayTitle } from "../src/titles";
import {
  dailyTrials,
  EMPTY_ANSWERS,
  MAX_DAY_POINTS,
  scoreTrial,
  TIME_LIMITS,
  TRIAL_COUNT,
  TRIAL_KINDS,
  trialView,
  type Answer,
  type Trial,
} from "../src/trials";

/** Quatre paquets disjoints qui font 12 (recherche exhaustive : il y a peu de tuiles). */
function findGroups(tiles: number[]): number[][] {
  const best: number[][] = [];
  const search = (used: Set<number>, groups: number[][]) => {
    if (groups.length > best.length) best.splice(0, best.length, ...groups);
    if (best.length >= 4) return;
    const free = tiles.map((_, i) => i).filter((i) => !used.has(i));
    const subsets = (start: number, picked: number[], sum: number) => {
      if (best.length >= 4) return;
      if (sum === 12 && picked.length) {
        search(new Set([...used, ...picked]), [...groups, picked]);
        return;
      }
      for (let k = start; k < free.length; k++) {
        const i = free[k] as number;
        const n = tiles[i] ?? 0;
        if (sum + n <= 12) subsets(k + 1, [...picked, i], sum + n);
      }
    };
    subsets(0, [], 0);
  };
  search(new Set(), []);
  return best;
}

/** La réponse parfaite de chaque épreuve. */
function perfect(trial: Trial): Answer {
  switch (trial.kind) {
    case "chrono":
      return { ms: 12_000 };
    case "clicks":
      return { count: 12 };
    case "count":
      return { count: trial.count };
    case "quiz":
      return { picks: trial.questions.map((q) => q.answer === 12) };
    case "sum":
      return { groups: findGroups(trial.tiles) };
    case "polygon":
      return { pick: trial.shapes.findIndex((s) => s.sides === 12) };
    case "clock":
    case "letters":
    case "real":
      return { pick: trial.answer };
    case "counter":
      return { ms: trial.sequence.indexOf("12") * trial.stepMs + trial.stepMs / 2 };
    case "calc":
      return {
        checked: trial.items.flatMap((c, i) => (isTwelve(c.value) ? [i] : [])),
      };
    case "oracle":
      return { pick: trial.options.indexOf(12) };
  }
}

const DAYS = Array.from({ length: 90 }, (_, i) => shiftDate("2026-12-12", i));

describe("épreuves du jour", () => {
  it("12 épreuves, chacune une fois, l'Oracle toujours en dernier", () => {
    for (const date of DAYS) {
      const trials = dailyTrials(date);
      expect(trials).toHaveLength(TRIAL_COUNT);
      expect(new Set(trials.map((t) => t.kind))).toEqual(new Set(TRIAL_KINDS));
      expect(trials.at(-1)?.kind).toBe("oracle");
    }
  });

  it("les mêmes pour tout le monde, différentes d'un jour à l'autre", () => {
    expect(dailyTrials("2026-12-12")).toEqual(dailyTrials("2026-12-12"));
    expect(dailyTrials("2026-12-12")).not.toEqual(dailyTrials("2026-12-13"));
  });

  it("chaque épreuve peut rapporter 12, et rien sans réponse", () => {
    for (const date of DAYS) {
      for (const trial of dailyTrials(date)) {
        expect(scoreTrial(trial, perfect(trial)).points, `${date} ${trial.kind}`).toBe(12);
        expect(scoreTrial(trial, EMPTY_ANSWERS[trial.kind]).points).toBe(0);
      }
    }
  });

  it("le vrai 12 du compteur passe avant la fin du temps", () => {
    for (const date of DAYS) {
      const trial = dailyTrials(date).find((t) => t.kind === "counter");
      if (trial?.kind !== "counter") throw new Error("pas de compteur");
      expect(trial.sequence.indexOf("12") * trial.stepMs).toBeLessThan(TIME_LIMITS.counter);
    }
  });

  it("le joueur ne reçoit pas les réponses", () => {
    const views = dailyTrials("2026-12-12").map(trialView);
    const text = JSON.stringify(views);
    expect(text).not.toContain('"answer"');
    expect(text).not.toContain('"value"');
    const count = views.find((v) => v.kind === "count");
    expect(count && "count" in count).toBe(false);
    // les 5 réponses proposées se suivent : la bonne n'y est pas repérable
    expect(count && "choices" in count && count.choices).toHaveLength(5);
  });
});

describe("aléatoire du jour", () => {
  const MONTH = Array.from({ length: 30 }, (_, i) => shiftDate("2026-11-13", i));
  const of = <K extends Trial["kind"]>(date: string, kind: K) =>
    dailyTrials(date).find((t) => t.kind === kind) as Extract<Trial, { kind: K }>;

  it("même date : exactement le même contenu, pour tout le monde", () => {
    for (const date of MONTH) expect(dailyTrials(date)).toEqual(dailyTrials(date));
  });

  it("d'un jour à l'autre, chaque épreuve change (sauf, rarement, le temps du chrono)", () => {
    for (const [i, date] of MONTH.entries()) {
      if (i === 0) continue;
      const before = dailyTrials(MONTH[i - 1] as string);
      for (const trial of dailyTrials(date)) {
        if (trial.kind === "chrono") continue;
        const yesterday = before.find((t) => t.kind === trial.kind);
        expect(trial, `${date} ${trial.kind}`).not.toEqual(yesterday);
      }
    }
  });

  it("le vrai 12 : jamais à la même case que la veille, et partout sur le mois", () => {
    const year = Array.from({ length: 366 }, (_, i) => of(shiftDate("2026-11-13", i), "real"));
    for (const [i, t] of year.entries()) {
      expect(t.cells[t.answer]).toBe("12");
      expect(t.cells.filter((c) => c === "12")).toHaveLength(1);
      if (i > 0) expect(t.answer, `jour ${i}`).not.toBe(year[i - 1]?.answer);
    }
    expect(new Set(year.slice(0, 30).map((t) => t.answer)).size).toBeGreaterThanOrEqual(15);
    expect(new Set(year.map((t) => t.cells.length))).toEqual(new Set([18, 24, 30]));
  });

  it("grilles, leurres et réponses proposées varient", () => {
    const shapes = new Set(MONTH.map((d) => of(d, "polygon").shapes.length));
    expect(shapes).toEqual(new Set([9, 12, 16]));
    expect(new Set(MONTH.map((d) => of(d, "clock").clocks.length)).size).toBeGreaterThan(1);
    expect(new Set(MONTH.map((d) => of(d, "letters").words.length)).size).toBeGreaterThan(1);
    expect(new Set(MONTH.map((d) => of(d, "count").count)).size).toBeGreaterThan(3);
    for (const d of MONTH) {
      const count = of(d, "count");
      expect(count.choices).toContain(count.count);
      expect(count.choices).toHaveLength(5);
    }
    // la bonne réponse n'est pas toujours au même rang parmi les 5 proposées
    expect(
      new Set(MONTH.map((d) => of(d, "count").choices.indexOf(of(d, "count").count))).size,
    ).toBe(5);
  });
});

describe("points", () => {
  const trials = dailyTrials("2026-12-20");
  const of = <K extends Trial["kind"]>(kind: K) =>
    trials.find((t) => t.kind === kind) as Extract<Trial, { kind: K }>;

  it("chrono : un point de moins par dixième de seconde d'écart", () => {
    const t = of("chrono");
    expect(scoreTrial(t, { ms: 12_099 }).points).toBe(12);
    expect(scoreTrial(t, { ms: 11_850 }).points).toBe(11);
    expect(scoreTrial(t, { ms: 13_300 }).points).toBe(0);
  });

  it("clics : 4 points de moins par clic d'écart", () => {
    const t = of("clicks");
    expect(scoreTrial(t, { count: 13 }).points).toBe(8);
    expect(scoreTrial(t, { count: 10 }).points).toBe(4);
    expect(scoreTrial(t, { count: 40 }).points).toBe(0);
  });

  it("compter : 4 points à un près", () => {
    const t = of("count");
    expect(scoreTrial(t, { count: t.count + 1 }).points).toBe(4);
    expect(scoreTrial(t, { count: t.count + 2 }).points).toBe(0);
  });

  it("fais 12 : les paquets faux ou qui réutilisent une tuile ne comptent pas", () => {
    const t = of("sum");
    const [first] = findGroups(t.tiles);
    if (!first) throw new Error("pas de paquet");
    expect(scoreTrial(t, { groups: [first, first] }).points).toBe(3);
    expect(scoreTrial(t, { groups: [[0, 1, 2, 3, 4, 5]] }).points).toBe(0);
    expect(scoreTrial(t, { groups: [[99]] }).points).toBe(0);
  });

  it("calculs : un intrus annule une bonne réponse", () => {
    const t = of("calc");
    const right = t.items.flatMap((c, i) => (isTwelve(c.value) ? [i] : []));
    const wrong = t.items.findIndex((c) => !isTwelve(c.value));
    expect(scoreTrial(t, { checked: [...right, wrong] }).points).toBe(
      Math.round((12 * (right.length - 1)) / right.length),
    );
  });

  it("compteur : le 12 compte à 80 ms près", () => {
    const t = of("counter");
    const i = t.sequence.indexOf("12");
    expect(scoreTrial(t, { ms: (i + 1) * t.stepMs + 50 }).points).toBe(12);
    const far = t.sequence.findIndex((v, j) => v !== "12" && Math.abs(j - i) > 2);
    expect(scoreTrial(t, { ms: far * t.stepMs + t.stepMs / 2 }).points).toBe(0);
  });

  it("l'Oracle : seul 12 est juste", () => {
    const t = of("oracle");
    const real = t.options.indexOf(t.real);
    expect(scoreTrial(t, { pick: real }).note).toContain("toujours 12");
    expect(scoreTrial(t, { pick: real }).points).toBe(0);
  });

  it("refuse une réponse mal formée", () => {
    expect(() => scoreTrial(of("clicks"), { count: "douze" })).toThrow();
    expect(() => scoreTrial(of("chrono"), {})).toThrow();
  });
});

describe("un mois sans revoir la même réponse", () => {
  /** Ce qu'il ne faut pas revoir d'un jour à l'autre, épreuve par épreuve. */
  function answersOf(date: string): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const t of dailyTrials(date)) {
      if (t.kind === "quiz") out.quiz = t.questions.map((q) => q.id);
      if (t.kind === "oracle") out.oracle = [t.question];
      if (t.kind === "clock") {
        const target = t.clocks[t.answer];
        out.clock = [`${target?.h}:${target?.m}`];
      }
      if (t.kind === "letters") out.letters = [t.words[t.answer] ?? ""];
      if (t.kind === "calc") out.calc = t.items.filter((c) => isTwelve(c.value)).map((c) => c.text);
    }
    return out;
  }

  it("31 jours de suite sans répétition, quel que soit le jour de départ", () => {
    // fenêtres de 31 jours qui se chevauchent : le motif et la fin des réserves sont couverts
    const days = Array.from({ length: 31 + 160 }, (_, i) => shiftDate("2026-12-12", i));
    const all = days.map(answersOf);
    for (let start = 0; start < days.length - 31; start += 4) {
      const seen: Record<string, Set<string>> = {};
      for (const day of all.slice(start, start + 31)) {
        for (const [kind, values] of Object.entries(day)) {
          const set = (seen[kind] ??= new Set());
          for (const v of values) {
            expect(set.has(v), `${kind} « ${v} » revu dès le jour ${days[start]}`).toBe(false);
            set.add(v);
          }
        }
      }
    }
  });

  it("des réserves assez grandes pour un mois", () => {
    expect(QUIZ.filter((q) => q.answer === 12).length).toBeGreaterThanOrEqual(62);
    expect(QUIZ.filter((q) => q.answer !== 12).length).toBeGreaterThanOrEqual(62);
    expect(ORACLE.length).toBeGreaterThanOrEqual(31);
    expect(CLOCKS.length).toBeGreaterThanOrEqual(31);
    expect(WORDS.filter((w) => letterCount(w) === 12).length).toBeGreaterThanOrEqual(31);
    expect(CALCS.filter((c) => isTwelve(c.value)).length).toBeGreaterThanOrEqual(80);
  });
});

describe("contenu", () => {
  it("des questions qui font 12 et d'autres pas", () => {
    expect(QUIZ.filter((q) => q.answer === 12).length).toBeGreaterThanOrEqual(3);
    expect(QUIZ.filter((q) => q.answer !== 12).length).toBeGreaterThanOrEqual(3);
    expect(new Set(QUIZ.map((q) => q.id)).size).toBe(QUIZ.length);
  });

  it("l'Oracle : 12 n'est jamais la vraie réponse ni un leurre", () => {
    for (const q of ORACLE) {
      expect([q.real, ...q.others]).not.toContain(12);
      expect(new Set([q.real, ...q.others, 12]).size).toBe(4);
    }
  });

  it("des mots de 12 lettres et d'autres, les tirets ne comptent pas", () => {
    expect(letterCount("CHAUVE-SOURIS")).toBe(12);
    expect(letterCount("DÉMÉNAGEMENT")).toBe(12);
    expect(WORDS.filter((w) => letterCount(w) === 12).length).toBeGreaterThanOrEqual(4);
    expect(WORDS.filter((w) => letterCount(w) !== 12).length).toBeGreaterThanOrEqual(3);
  });

  it("au moins 3 calculs qui font 12 et 4 qui n'en font pas", () => {
    expect(CALCS.filter((c) => isTwelve(c.value)).length).toBeGreaterThanOrEqual(3);
    expect(CALCS.filter((c) => !isTwelve(c.value)).length).toBeGreaterThanOrEqual(4);
  });

  it("horloges : 60 heures différentes, au moins 5 leurres qui n'indiquent jamais l'heure", () => {
    expect(new Set(CLOCKS.map((c) => c.label)).size).toBe(CLOCKS.length);
    expect(new Set(CLOCKS.map((c) => `${c.target.h}:${c.target.m}`)).size).toBe(CLOCKS.length);
    for (const c of CLOCKS) {
      const decoys = clockDecoys(c.target);
      expect(decoys.length).toBeGreaterThanOrEqual(5);
      for (const d of decoys) expect(d).not.toEqual(c.target);
    }
  });

  it("libellés des horloges", () => {
    const label = (h: number, m: number) =>
      CLOCKS.find((c) => c.target.h === h && c.target.m === m)?.label;
    expect(label(12, 0)).toBe("midi pile");
    expect(label(12, 12)).toBe("12 h 12");
    expect(label(11, 48)).toBe("minuit moins douze");
    expect(label(4, 48)).toBe("5 h moins 12");
    expect(label(12, 48)).toBe("1 h moins 12");
    expect(label(3, 24)).toBe("3 h 24");
  });

  it("calculs et questions : pas de doublon", () => {
    expect(new Set(CALCS.map((c) => c.text)).size).toBe(CALCS.length);
    expect(new Set(QUIZ.map((q) => q.text)).size).toBe(QUIZ.length);
    expect(new Set(ORACLE.map((q) => q.id)).size).toBe(ORACLE.length);
  });

  it("titres de la journée", () => {
    expect(dayTitle(12)).toContain("pile");
    expect(dayTitle(MAX_DAY_POINTS)).toContain("144");
    expect(dayTitle(0)).toBeTruthy();
    expect(dayTitle(143)).toBe("Presque une grosse");
  });
});
