"use client";

import { Button, Card, cx } from "@app/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { dayKey } from "../src/daily";
import type { DayView, Round } from "../src/play";
import { dayTitle } from "../src/titles";
import {
  dailyTrials,
  EMPTY_ANSWERS,
  MAX_DAY_POINTS,
  MAX_TRIAL_POINTS,
  scoreTrial,
  TRIAL_COUNT,
  type Answer,
  type TrialScore,
} from "../src/trials";
import { api } from "./api";
import { Leaderboard } from "./Leaderboard";
import { sounds } from "./sound";
import { KIND_LABELS, TrialPlayer, trialTitle } from "./Trials";

/** Durée de l'annonce d'une épreuve, puis de son résultat (ms). */
const SPLASH_MS = 1600;
const RESULT_MS = 1800;

// Épreuve commencée et pas encore envoyée : recharger la page en plein milieu la compte à 0.
const STARTED_KEY = "potopia:douze-started";

function readStarted(): string | null {
  try {
    return localStorage.getItem(STARTED_KEY);
  } catch {
    return null;
  }
}
function writeStarted(value: string | null) {
  try {
    if (value) localStorage.setItem(STARTED_KEY, value);
    else localStorage.removeItem(STARTED_KEY);
  } catch {
    // stockage indisponible : pas de garde contre le rechargement
  }
}

/** Temps jusqu'aux épreuves suivantes (minuit à Paris), en texte : « 5 h 12 min ». */
function untilTomorrow(key: string): string {
  let lo = Date.now();
  let hi = lo + 26 * 3_600_000;
  while (hi - lo > 60_000) {
    const mid = (lo + hi) / 2;
    if (dayKey(new Date(mid)) === key) lo = mid;
    else hi = mid;
  }
  const minutes = Math.max(1, Math.round((hi - Date.now()) / 60_000));
  const h = Math.floor(minutes / 60);
  return h ? `${h} h ${minutes % 60} min` : `${minutes} min`;
}

/** Compte à rebours jusqu'à l'ouverture (12/12 à 12 h 12), à la seconde. */
function Countdown({ to, onOpen }: { to: string; onOpen: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, Date.parse(to) - now);
  useEffect(() => {
    if (left === 0) onOpen();
  }, [left, onOpen]);
  const s = Math.floor(left / 1000);
  const parts: [number, string][] = [
    [Math.floor(s / 86_400), "j"],
    [Math.floor(s / 3600) % 24, "h"],
    [Math.floor(s / 60) % 60, "min"],
    [s % 60, "s"],
  ];
  return (
    <div className="douze-countdown">
      {parts.map(([n, unit]) => (
        <span key={unit}>
          <strong>{String(n).padStart(2, "0")}</strong>
          {unit}
        </span>
      ))}
    </div>
  );
}

type Phase =
  | { kind: "idle" }
  | { kind: "splash"; index: number }
  | { kind: "play"; index: number }
  | { kind: "result"; index: number; score: TrialScore };

/**
 * DOUZE : chaque jour, douze épreuves absurdes autour du 12, les mêmes pour tout le monde, notées
 * chacune sur 12 (144 points au plus). Chaque épreuve est annoncée en grand, se joue en quelques
 * secondes, puis sa réponse part au serveur, qui compte les points. L'Oracle (la 12e) a toujours
 * la même réponse : 12. Avant l'ouverture (12/12 à 12 h 12), un compte à rebours ;
 * `allowPractice` (en local et pour les admins) : jouer pour de faux, sans rien enregistrer.
 */
export function DouzeGame({ allowPractice = false }: { allowPractice?: boolean }) {
  const [day, setDay] = useState<DayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [practice, setPractice] = useState<Round[] | null>(null);
  const [version, setVersion] = useState(0);
  const [, tick] = useState(0);
  const sending = useRef(false);

  const load = useCallback(async () => {
    try {
      const fresh = await api<DayView>("/api/douze/day");
      // page rechargée en pleine épreuve : elle compte, à 0
      const slot = fresh.rounds.length;
      const trial = fresh.trials[slot];
      if (fresh.open && trial && readStarted() === `${fresh.date}:${slot}`) {
        writeStarted(null);
        const res = await api<{ day: DayView }>("/api/douze/play", {
          body: { date: fresh.date, slot, answer: EMPTY_ANSWERS[trial.kind] },
        }).catch(() => null);
        setNotice("Page rechargée en pleine épreuve : 0 point. Le 12 ne pardonne pas.");
        setDay(res?.day ?? fresh);
      } else {
        setDay(fresh);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }, []);

  // la journée vient du serveur ; le compte à rebours des épreuves suivantes se met à jour chaque minute
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  // annonce, puis épreuve ; résultat, puis épreuve suivante (ou la fin)
  useEffect(() => {
    if (phase.kind === "splash") {
      sounds.go();
      const t = window.setTimeout(() => setPhase({ kind: "play", index: phase.index }), SPLASH_MS);
      return () => window.clearTimeout(t);
    }
    if (phase.kind === "result") {
      const t = window.setTimeout(() => next(phase.index), RESULT_MS);
      return () => window.clearTimeout(t);
    }
  });

  const ranking = <Leaderboard version={version} />;
  if (!day) {
    return (
      <div className="douze-page">
        <Card>
          <p className="text-muted text-sm">{error ?? "Chargement…"}</p>
        </Card>
        {ranking}
      </div>
    );
  }

  const rounds = practice ?? day.rounds;
  const total = rounds.reduce((n, r) => n + r.points, 0);
  const finished = rounds.length >= TRIAL_COUNT;

  function next(index: number) {
    if (index + 1 >= TRIAL_COUNT) setPhase({ kind: "idle" });
    else setPhase({ kind: "splash", index: index + 1 });
  }

  const start = (fromScratch: boolean) => {
    setNotice(null);
    if (fromScratch) setPractice([]);
    setPhase({ kind: "splash", index: fromScratch ? 0 : rounds.length });
  };

  const answer = async (index: number, value: Answer) => {
    if (sending.current) return;
    sending.current = true;
    try {
      if (practice) {
        const trial = dailyTrials(day.date)[index];
        if (!trial) return;
        const score = scoreTrial(trial, value);
        setPractice([...practice, { slot: index, kind: trial.kind, points: score.points }]);
        sounds.result(score.points);
        setPhase({ kind: "result", index, score });
        return;
      }
      const res = await api<{ round: Round; score: TrialScore; day: DayView }>("/api/douze/play", {
        body: { date: day.date, slot: index, answer: value },
      });
      writeStarted(null);
      setDay(res.day);
      setVersion((v) => v + 1);
      sounds.result(res.score.points);
      setPhase({ kind: "result", index, score: res.score });
    } catch (e) {
      // minuit passé ou épreuve déjà jouée ailleurs : on recharge la journée du serveur
      writeStarted(null);
      setError(e instanceof Error ? e.message : "Erreur");
      setPhase({ kind: "idle" });
      void load();
    } finally {
      sending.current = false;
    }
  };

  if (phase.kind === "splash" || phase.kind === "play" || phase.kind === "result") {
    const trial = day.trials[phase.index];
    if (!trial) return null;
    const { title, hint } = trialTitle(trial);
    const header = (
      <p className="douze-header">
        <span>
          Épreuve {phase.index + 1} / {TRIAL_COUNT}
          {practice && " · pour de faux"}
        </span>
        <span className="tabular-nums">
          {total} / {MAX_DAY_POINTS}
        </span>
      </p>
    );
    return (
      <div className="douze-page">
        <Card className="douze-stage">
          {header}
          {phase.kind === "splash" && (
            <div key={phase.index} className="douze-splash">
              <p className="douze-splash-number">{phase.index + 1}</p>
              <p className="douze-splash-title">{title}</p>
              <p className="text-muted text-sm">{hint}</p>
            </div>
          )}
          {phase.kind === "play" && (
            <>
              <p className="douze-title">{title}</p>
              <TrialPlayer
                key={phase.index}
                trial={trial}
                done={(value) => void answer(phase.index, value)}
              />
            </>
          )}
          {phase.kind === "result" && (
            <button
              type="button"
              className="douze-result"
              onClick={() => next(phase.index)}
              aria-label="Épreuve suivante"
            >
              <span
                className={cx(
                  "douze-result-points",
                  phase.score.points === MAX_TRIAL_POINTS && "douze-result-perfect",
                  phase.score.points === 0 && "douze-result-zero",
                )}
              >
                +{phase.score.points}
              </span>
              <span className="text-muted">sur {MAX_TRIAL_POINTS}</span>
              <span className="text-text">{phase.score.note}</span>
            </button>
          )}
        </Card>
      </div>
    );
  }

  // l'épreuve qu'on va lancer : retenue, pour qu'un rechargement en plein milieu compte 0
  const launch = () => {
    writeStarted(`${day.date}:${rounds.length}`);
    start(false);
  };

  if (finished) {
    return (
      <div className="douze-page">
        <Card
          title={
            practice
              ? "Pour de faux"
              : `Les épreuves du jour${day.number >= 1 ? ` · #${day.number}` : ""}`
          }
          className="douze-final"
        >
          <p className="douze-total">
            {total}
            <span> / {MAX_DAY_POINTS}</span>
          </p>
          <p className="font-display text-accent text-center">{dayTitle(total)}</p>
          <ol className="douze-recap">
            {rounds.map((r) => (
              <li key={r.slot}>
                <span className="text-muted w-6 tabular-nums">{r.slot + 1}</span>
                <span className="min-w-0 flex-1 truncate">{KIND_LABELS[r.kind]}</span>
                <span className="douze-recap-bar">
                  <span style={{ width: `${(r.points / MAX_TRIAL_POINTS) * 100}%` }} />
                </span>
                <span className="w-10 text-right tabular-nums">{r.points}</span>
              </li>
            ))}
          </ol>
          <p className="text-muted text-sm">
            Douze nouvelles épreuves dans {untilTomorrow(day.date)}.
          </p>
          {allowPractice && (
            <Button variant="secondary" onClick={() => start(true)}>
              Rejouer pour de faux
            </Button>
          )}
        </Card>
        {ranking}
      </div>
    );
  }

  const started = rounds.length > 0;
  return (
    <div className="douze-page">
      <Card className="douze-intro">
        <h1 className="douze-logo">DOUZE</h1>
        {!day.open && (
          <>
            <p className="text-text">Ouverture le 12/12 à 12 h 12. Évidemment.</p>
            <Countdown to={day.opensAt} onOpen={() => void load()} />
          </>
        )}
        <p className="text-muted max-w-prose text-sm">
          Chaque jour, douze épreuves absurdes, les mêmes pour tout le monde, chacune notée sur 12 :
          arrêter un chrono à l'aveugle, compter des canards, trouver le dodécagone… Elles
          s'enchaînent en quelques secondes. Une journée parfaite vaut 144 points (une grosse).
          Recharger la page en pleine épreuve, c'est 0. Et la 12e épreuve a toujours la même
          réponse.
        </p>
        {notice && <p className="text-danger text-sm">{notice}</p>}
        {error && <p className="text-danger text-sm">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {day.open && (
            <Button onClick={launch}>
              {started ? `Reprendre (épreuve ${rounds.length + 1} / ${TRIAL_COUNT})` : "Commencer"}
            </Button>
          )}
          {!day.open && allowPractice && (
            <Button variant="secondary" onClick={() => start(true)}>
              S'entraîner pour de faux
            </Button>
          )}
        </div>
      </Card>
      {ranking}
    </div>
  );
}
