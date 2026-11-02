"use client";

import { Avatar, Card, cx } from "@app/ui";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { dayNumber, periodStart, shiftDate } from "../src/daily";
import type { Period, Player, Total } from "../src/leaderboard";
import { grade } from "../src/score";
import { api } from "./api";

type Who = { id: string; name: string; image: string | null; me: boolean };

/** Réponse de /api/pose/leaderboard : un jour, ou une semaine / un mois. */
type Board = { players?: Player[]; totals?: Total[]; today: string; first: string };

const MEDALS = ["🥇", "🥈", "🥉"];
const PERIODS: Record<Period, { label: string; heading: string }> = {
  day: { label: "Jour", heading: "Classement du jour" },
  week: { label: "Semaine", heading: "Classement de la semaine" },
  month: { label: "Mois", heading: "Classement du mois" },
};
const PERIOD_ORDER: Period[] = ["day", "week", "month"];
const CURRENT: Record<Period, string> = {
  day: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois-ci",
};

const fmt = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: "UTC" }).format(
    new Date(date + "T12:00:00Z"),
  );

/** Date du jour à Paris, en attendant celle du serveur. */
const parisToday = () => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format();

/** Premier jour de la période qui contient `date` (pour « jour » : le jour lui-même). */
const startOf = (period: Period, date: string) =>
  period === "day" ? date : periodStart(date, period);

/** Premier jour de la période suivante. */
function nextStart(period: Period, start: string): string {
  if (period === "day") return shiftDate(start, 1);
  if (period === "week") return shiftDate(start, 7);
  return shiftDate(start.slice(0, 8) + "28", 4).slice(0, 8) + "01";
}

/** Nom de la période commençant le jour `start`, calculé tout de suite (sans attendre le serveur). */
function periodLabel(period: Period, start: string, today: string): string {
  if (period === "day") {
    const number = ` · #${dayNumber(start)}`;
    if (start === today) return `Aujourd'hui${number}`;
    if (start === shiftDate(today, -1)) return `Hier${number}`;
    return fmt(start, { weekday: "long", day: "numeric", month: "long" }) + number;
  }
  if (start === startOf(period, today)) return CURRENT[period];
  if (period === "month") return fmt(start, { month: "long", year: "numeric" });
  return `Semaine du ${fmt(start, { day: "numeric", month: "short" })}`;
}

const keyOf = (period: Period, date: string | null) => `${period}:${date ?? "now"}`;
const medal = (rank: number) => MEDALS[rank - 1] ?? rank;

/** Note (A à E) d'une ressemblance, en petite pastille. */
function Grade({ percent }: { percent: number }) {
  const g = grade(percent);
  return (
    <span className={cx("pose-grade pose-grade-mini", `pose-grade-${g}`)} title={`${percent} %`}>
      {g}
    </span>
  );
}

/** Les 3 premiers, en 2 · 1 · 3 ; la médaille suit le rang serveur (ex æquo = même médaille). */
function Podium({ entries }: { entries: (Who & { rank: number; detail: string })[] }) {
  const places = [2, 1, 3];
  return (
    <div className="pose-podium">
      {places.map((place) => {
        const e = entries[place - 1];
        const rank = e?.rank ?? place;
        return (
          <div key={place} className="pose-podium-place">
            {e ? (
              <>
                <span className="text-2xl">{MEDALS[rank - 1] ?? MEDALS[place - 1]}</span>
                <Avatar name={e.name} src={e.image} size={32} />
                <p className={cx("w-full truncate text-center text-sm", e.me && "text-accent")}>
                  {e.name}
                </p>
                <p className="text-muted text-[11px]">{e.detail}</p>
              </>
            ) : (
              <span className="text-2xl opacity-20">{MEDALS[place - 1]}</span>
            )}
            <div className={cx("pose-podium-step", `pose-podium-step-${place}`)}>{rank}</div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Classement de Pose JoJo, comme celui de TROIS : jour, semaine ou mois, avec l'historique (‹ ›
 * pour remonter les jours, semaines et mois passés, jusqu'au premier jour où quelqu'un a joué) et
 * le podium. Jour : la somme des ressemblances des 3 poses (300 au plus) et la note de chacune ;
 * semaine et mois : le cumul. `version` change quand le joueur vient de valider une pose : la
 * période en cours est rechargée.
 */
export function Leaderboard({ version }: { version: number }) {
  const [period, setPeriod] = useState<Period>("day");
  // premier jour de la période affichée dans l'historique ; null = la période en cours
  const [date, setDate] = useState<string | null>(null);
  // classements déjà chargés : une période passée ne change plus, on la garde pour revenir dessus
  const [boards, setBoards] = useState<Record<string, Board>>({});
  const loadedKeys = useRef(new Set<string>());
  // pendant le chargement d'une période pas encore en mémoire : on garde l'ancienne à l'écran
  const [stale, setStale] = useState<Board | null>(null);
  const [bounds, setBounds] = useState<{ today: string; first: string } | null>(null);

  const fetchBoard = useCallback(async (p: Period, d: string | null) => {
    const params = new URLSearchParams();
    if (p !== "day") params.set("period", p);
    if (d) params.set("date", d);
    try {
      const board = await api<Board>(`/api/pose/leaderboard?${params}`);
      loadedKeys.current.add(keyOf(p, d));
      setBoards((b) => ({ ...b, [keyOf(p, d)]: board }));
      setBounds((old) =>
        old?.today === board.today && old.first === board.first
          ? old
          : { today: board.today, first: board.first },
      );
    } catch {
      /* réessayé au prochain tour */
    }
  }, []);

  useEffect(() => {
    // historique déjà en mémoire : figé, rien à recharger
    if (date && loadedKeys.current.has(keyOf(period, date))) return;
    fetchBoard(period, date);
    if (date) return;
    // période en cours : rafraîchie, sans requête tant que l'onglet est caché
    const t = setInterval(
      () => document.visibilityState === "visible" && fetchBoard(period, null),
      60_000,
    );
    return () => clearInterval(t);
  }, [period, date, fetchBoard, version]);

  const today = bounds?.today ?? parisToday();
  const currentStart = startOf(period, today);
  const shownStart = date ?? currentStart;
  const prevStart = startOf(period, shiftDate(shownStart, -1));
  const canPrev = !!bounds && shownStart > bounds.first;

  // précharge la période précédente, pour que la flèche ‹ réponde tout de suite
  useEffect(() => {
    if (!canPrev || loadedKeys.current.has(keyOf(period, prevStart))) return;
    fetchBoard(period, prevStart);
  }, [period, prevStart, canPrev, fetchBoard]);

  const loadedBoard = boards[keyOf(period, date)];
  const board = loadedBoard ?? stale;
  const loading = !loadedBoard;
  const past = date !== null;
  const players = period === "day" ? (board?.players ?? null) : null;
  const totals = period === "day" ? null : (board?.totals ?? null);
  const loaded = players ?? totals;
  const label = periodLabel(period, shownStart, today);

  const go = (target: string | null) => {
    setStale(board);
    setDate(target);
  };
  const choosePeriod = (id: Period) => {
    setStale(null);
    setPeriod(id);
    setDate(null);
  };

  const podium =
    period === "day"
      ? (players ?? [])
          .filter((p) => p.percents.length > 0)
          .map((p) => ({ ...p, detail: `${p.points} pts` }))
      : (totals ?? [])
          .filter((t) => t.points > 0)
          .map((t) => ({ ...t, detail: `${t.points} pts` }));

  const row = (w: Who, rankLabel: ReactNode, sub: ReactNode, right?: ReactNode) => (
    <li key={w.id} className={cx("pose-board-row", w.me && "pose-board-row-me")}>
      <span className="text-muted w-7 text-center tabular-nums">{rankLabel}</span>
      <Avatar name={w.name} src={w.image} size={28} />
      <div className="min-w-0 flex-1">
        <p className="text-text truncate text-sm font-semibold">
          {w.name}
          {w.me && <span className="text-muted ml-1 text-xs">(toi)</span>}
        </p>
        <p className="text-muted text-xs">{sub}</p>
      </div>
      {right}
    </li>
  );

  return (
    <Card title={past ? `Classement · ${label}` : PERIODS[period].heading} className="pose-ranking">
      <div className="pose-tabs">
        {PERIOD_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => choosePeriod(id)}
            aria-pressed={period === id}
            className={cx("pose-tab", period === id && "pose-tab-on")}
          >
            {PERIODS[id].label}
          </button>
        ))}
      </div>

      {/* historique : période précédente / suivante, et retour direct à la période en cours */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => go(prevStart)}
          disabled={!canPrev}
          aria-label="Période précédente"
          className="pose-arrow"
        >
          ‹
        </button>
        <span className="text-text min-w-44 text-center first-letter:uppercase">{label}</span>
        <button
          type="button"
          onClick={() => {
            const next = nextStart(period, shownStart);
            go(next >= currentStart ? null : next);
          }}
          disabled={!past}
          aria-label="Période suivante"
          className="pose-arrow"
        >
          ›
        </button>
      </div>
      {/* place réservée même quand il est caché : rien ne saute à l'écran */}
      <button
        type="button"
        onClick={() => go(null)}
        disabled={!past}
        className={cx("pose-back text-xs", !past && "invisible")}
      >
        ⏭ Revenir à {CURRENT[period].toLowerCase()}
      </button>

      {loaded && podium.length > 0 && <Podium entries={podium} />}

      {period !== "day" && (
        <p className="text-muted text-xs">
          Chaque pose rapporte sa ressemblance en points (100 pour une pose parfaite), 300 au plus
          par jour.
        </p>
      )}
      {!loaded && <p className="text-muted text-sm">Chargement…</p>}
      {loaded && loaded.length <= 1 && (
        <p className="text-muted text-sm">
          {past ? "Personne d'autre n'a joué." : "Personne d'autre n'a joué pour l'instant."}
        </p>
      )}
      <ol
        className={cx("flex flex-col gap-2 transition-opacity", loading && loaded && "opacity-50")}
      >
        {period === "day"
          ? (players ?? []).map((p) =>
              row(
                p,
                p.percents.length === 0 ? "–" : medal(p.rank),
                p.percents.length === 0
                  ? past
                    ? "Pas joué"
                    : "Pas encore joué"
                  : `${p.percents.length}/3 poses${p.percents.length < 3 ? (past ? " · pas fini" : " · en cours") : ""}`,
                <span className="flex items-center gap-2">
                  <span className="flex gap-1">
                    {p.percents.map((percent, i) => (
                      <Grade key={i} percent={percent} />
                    ))}
                  </span>
                  <span className="text-text w-14 text-right font-semibold tabular-nums">
                    {p.points}
                    <span className="text-muted ml-0.5 text-xs font-normal">pts</span>
                  </span>
                </span>,
              ),
            )
          : (totals ?? []).map((t) =>
              row(
                t,
                t.points === 0 ? "–" : medal(t.rank),
                t.days === 0
                  ? past
                    ? "Pas joué"
                    : "Pas encore joué"
                  : `${t.poses} poses · ${t.days} jour${t.days > 1 ? "s" : ""} · meilleure : ${t.best} %`,
                <span className="text-text font-semibold tabular-nums">
                  {t.points}
                  <span className="text-muted ml-0.5 text-xs font-normal">pts</span>
                </span>,
              ),
            )}
      </ol>
    </Card>
  );
}
