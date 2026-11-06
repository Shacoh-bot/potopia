"use client";

import { Button, Card, cx, effectiveVolume, onVolumeChange, Select, Textarea } from "@app/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { DAILY_COUNT, dayKey } from "../src/daily";
import type { DayView, Round } from "../src/play";
import { POSES, targetPose, type TargetPose } from "../src/poses";
import { grade, scorePose } from "../src/score";
import { REST_POSE, SEGMENTS, type Pose } from "../src/skeleton";
import { verdict } from "../src/verdicts";
import { api } from "./api";
import { Leaderboard } from "./Leaderboard";
import { endOfDay, PoseFx, type FxCue } from "./PoseFx";
import { Puppet } from "./Puppet";

// « Jojo Pose » d'Apollo Fresh, en boucle pendant la partie (servie par apps/web/public).
const MUSIC = "/audio/jojo-pose.mp3";
const MUSIC_VOLUME = 0.45;

// Musique coupée par le joueur : choix gardé sur l'appareil.
const MUSIC_OFF_KEY = "potopia:pose-music-off";

function readMusicOff(): boolean {
  try {
    return localStorage.getItem(MUSIC_OFF_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Musique de la partie : lancée par `play()` (un clic, que le navigateur exige pour le son), au
 * volume du site, coupée en quittant la page. Le joueur peut la couper (`toggle`), pour toutes
 * les parties suivantes. ZA WARUDO la fige comme les autres sons.
 */
function useMusic() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const playing = useRef(false);
  const [off, setOff] = useState(false);
  useEffect(() => {
    setOff(readMusicOff());
    const stop = onVolumeChange(() => {
      if (audio.current) audio.current.volume = effectiveVolume() * MUSIC_VOLUME;
    });
    return () => {
      stop();
      audio.current?.pause();
    };
  }, []);
  const start = () => {
    audio.current ??= Object.assign(new Audio(MUSIC), { loop: true });
    audio.current.volume = effectiveVolume() * MUSIC_VOLUME;
    void audio.current.play().catch(() => {});
  };
  return {
    off,
    /** Début de partie : la musique part, sauf si elle est coupée. */
    play: () => {
      playing.current = true;
      if (!readMusicOff()) start();
    },
    toggle: () => {
      const next = !off;
      setOff(next);
      try {
        localStorage.setItem(MUSIC_OFF_KEY, next ? "1" : "0");
      } catch {
        // stockage indisponible : le choix vaut pour cette page seulement
      }
      if (next) audio.current?.pause();
      else if (playing.current) start();
    },
  };
}

/** Bouton qui coupe ou remet la musique. */
function MusicToggle({ off, toggle }: { off: boolean; toggle: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={toggle} aria-pressed={!off}>
      {off ? "Musique coupée" : "Couper la musique"}
    </Button>
  );
}

function GradeBadge({ percent, big }: { percent: number; big?: boolean }) {
  const g = grade(percent);
  return <span className={cx("pose-grade", `pose-grade-${g}`, big && "pose-grade-big")}>{g}</span>;
}

/** Résultat d'une pose : ressemblance, faite en miroir ou non, et la réplique tirée. */
type Result = { poseId: string; percent: number; mirrored: boolean; line: string };

/** Temps jusqu'aux poses suivantes (minuit à Paris), en texte : « 5 h 12 min ». */
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

const byId = new Map(POSES.map((p) => [p.id, p]));

function Recap({ results }: { results: Result[] }) {
  return (
    <ul className="pose-recap">
      {results.map((r) => {
        const p = byId.get(r.poseId);
        return (
          <li key={r.poseId}>
            {p && <img src={p.image} alt="" />}
            <span className="min-w-0 flex-1 truncate">
              {p ? `${p.character} : ${p.name}` : r.poseId}
            </span>
            <span className="tabular-nums">{r.percent} %</span>
            <GradeBadge percent={r.percent} />
          </li>
        );
      })}
    </ul>
  );
}

const toResult = (r: Round): Result => ({
  poseId: r.poseId,
  percent: r.percent,
  mirrored: r.mirrored,
  line: verdict(grade(r.percent), (r.percent % 7) / 7),
});

/**
 * Pose JoJo : chaque jour, trois poses célèbres (les mêmes pour tout le monde) à reproduire avec
 * un pantin. On attrape ses membres ou ses articulations pour les faire pivoter, ou une main ou
 * un pied pour plier tout le membre ; « Valider » envoie les angles au serveur, qui calcule la
 * ressemblance (articulation par articulation, en miroir aussi), l'enregistre et la classe ; la
 * pose attendue s'affiche en fantôme. Bonus JoJo pendant la partie (PoseFx), musique « Jojo
 * Pose », classement sous le jeu. `allowPractice` (en local) : rejouer la journée pour de faux,
 * sans rien enregistrer.
 */
export function PoseGame({
  editor = false,
  allowPractice = false,
}: {
  editor?: boolean;
  allowPractice?: boolean;
}) {
  const [day, setDay] = useState<DayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [practice, setPractice] = useState<Result[] | null>(null);
  const [pose, setPose] = useState<Pose>(REST_POSE);
  const [current, setCurrent] = useState<Result | null>(null);
  const [sending, setSending] = useState(false);
  const [fx, setFx] = useState<{ id: number; grade: ReturnType<typeof grade> } | null>(null);
  const [cue, setCue] = useState<FxCue | null>(null);
  const [version, setVersion] = useState(0);
  const [, tick] = useState(0);
  const music = useMusic();
  const musicButton = <MusicToggle off={music.off} toggle={music.toggle} />;

  const load = useCallback(async () => {
    try {
      setDay(await api<DayView>("/api/pose/day"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }, []);

  // la journée vient du serveur ; le compte à rebours des poses suivantes se met à jour chaque minute
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (editor) return <PoseEditor />;

  const ranking = <Leaderboard version={version} />;
  if (!day) {
    return (
      <div className="pose-page">
        <Card className="pose-intro">
          <p className="text-muted text-sm">{error ?? "Chargement…"}</p>
        </Card>
        {ranking}
      </div>
    );
  }

  const queue = day.poses.map((p) => byId.get(p.id)).filter((p): p is TargetPose => !!p);
  const results = practice ?? day.rounds.map(toResult);
  const finished = results.length >= queue.length;

  const start = () => {
    music.play();
    setPlaying(true);
    setPose(REST_POSE);
    setCurrent(null);
    setCue({ id: Date.now(), event: "start" });
  };
  const startPractice = () => {
    setPractice([]);
    start();
  };

  if (finished && (!playing || !current)) {
    const total = Math.round(results.reduce((n, r) => n + r.percent, 0) / results.length);
    return (
      <div className="pose-page">
        <Card
          title={practice ? "Pour de faux" : `Les poses du jour · #${day.number}`}
          action={musicButton}
          className="pose-final"
        >
          <div className="flex items-center gap-4">
            <GradeBadge percent={total} big />
            <div>
              <p className="font-display text-text text-2xl">{total} %</p>
              {/* réplique fixe pour un même total : elle ne change pas à chaque visite */}
              <p className="text-muted text-sm">{verdict(grade(total), (total % 7) / 7)}</p>
            </div>
          </div>
          <Recap results={results} />
          <p className="text-muted text-sm">Nouvelles poses dans {untilTomorrow(day.date)}.</p>
          {allowPractice && (
            <Button variant="secondary" onClick={startPractice}>
              Rejouer pour de faux (en local seulement)
            </Button>
          )}
        </Card>
        {ranking}
      </div>
    );
  }

  if (!playing) {
    const started = results.length > 0;
    return (
      <div className="pose-page">
        <Card className="pose-intro">
          <h1 className="font-display text-gradient text-3xl">Pose JoJo</h1>
          <p className="text-muted max-w-prose text-sm">
            Chaque jour, {DAILY_COUNT} poses célèbres, les mêmes pour tout le monde : mets le pantin
            dans la même position. Attrape un bras, un avant-bras, une cuisse, une jambe, le tronc
            ou la tête et fais-le pivoter, ou tire une main ou un pied : le bras ou la jambe se plie
            tout seul. La pose en miroir compte aussi. Quand tu approches de la bonne pose…
            ゴゴゴゴ.
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={start} disabled={queue.length === 0}>
              {started ? `Reprendre (pose ${results.length + 1} / ${queue.length})` : "Commencer"}
            </Button>
            {musicButton}
          </div>
        </Card>
        {ranking}
      </div>
    );
  }

  const index = current ? results.length - 1 : results.length;
  const target = queue[index] as TargetPose;
  const expected = targetPose(target);
  const live = current ? null : scorePose(pose, expected).percent;

  const show = (r: Result) => {
    setCurrent(r);
    setFx({ id: Date.now(), grade: grade(r.percent) });
  };
  const validate = async () => {
    if (practice) {
      const s = scorePose(pose, expected);
      const r = {
        poseId: target.id,
        percent: s.percent,
        mirrored: s.mirrored,
        line: verdict(grade(s.percent)),
      };
      setPractice([...practice, r]);
      show(r);
      return;
    }
    setSending(true);
    try {
      const res = await api<{ round: Round; day: DayView }>("/api/pose/play", {
        body: { date: day.date, slot: index, angles: pose.angle },
      });
      setDay(res.day);
      setVersion((v) => v + 1);
      show({ ...toResult(res.round), line: verdict(grade(res.round.percent)) });
      if (res.day.rounds.length >= queue.length) {
        const all = res.day.rounds;
        endOfDay(grade(Math.round(all.reduce((n, r) => n + r.percent, 0) / all.length)));
      }
    } catch (e) {
      // minuit passé ou pose déjà validée ailleurs : on recharge la journée du serveur
      setError(e instanceof Error ? e.message : "Erreur");
      setPlaying(false);
      void load();
    } finally {
      setSending(false);
    }
  };
  const next = () => {
    setCurrent(null);
    setFx(null);
    setPose(REST_POSE);
    if (results.length >= queue.length) setPlaying(false);
  };

  return (
    <div className="pose-page">
      <div className="pose-board">
        <Card
          title={`Pose ${index + 1} / ${queue.length}${practice ? " · pour de faux" : " du jour"}`}
          action={<span className="text-muted truncate text-xs">{target.character}</span>}
          className="pose-target"
        >
          <img src={target.image} alt={`${target.character} : ${target.name}`} />
          <p className="font-display text-accent text-center text-sm">{target.name}</p>
        </Card>

        <Card title="Ton pantin" action={musicButton} className="pose-stage">
          <Puppet
            pose={pose}
            onChange={current || sending ? undefined : setPose}
            // la pose attendue, toujours dans le sens de l'image (même si le joueur l'a faite en
            // miroir), pour la comparer à l'image
            ghost={current ? expected : null}
          />
          <PoseFx live={live} result={fx} cue={cue} />
          {current ? (
            <div className="pose-score animate-rise">
              <GradeBadge percent={current.percent} big />
              <div className="min-w-0 flex-1">
                <p className="font-display text-text text-2xl">{current.percent} %</p>
                <p className="text-muted text-sm">
                  {current.line}
                  {current.mirrored && " (en miroir)"}
                </p>
              </div>
              <Button onClick={next}>
                {results.length < queue.length ? "Pose suivante" : "Résultat"}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setPose(REST_POSE);
                  setCue({ id: Date.now(), event: "reset" });
                }}
                disabled={sending}
              >
                Remettre droit
              </Button>
              <Button className="flex-1" onClick={() => void validate()} disabled={sending}>
                {sending ? "…" : "Valider la pose"}
              </Button>
            </div>
          )}
        </Card>
      </div>
      {ranking}
    </div>
  );
}

/**
 * Éditeur des poses cibles (en local seulement, `?editeur`) : l'image derrière le pantin, qu'on
 * cale avec les curseurs, puis on pose le pantin dessus et on copie les angles dans `poses.ts`.
 */
function PoseEditor() {
  const [id, setId] = useState(POSES[0]?.id ?? "");
  const target = POSES.find((p) => p.id === id);
  const [pose, setPose] = useState<Pose>(target ? targetPose(target) : REST_POSE);
  const [frame, setFrame] = useState({ x: 0, y: 0, scale: 1, opacity: 0.5 });

  const angles = Object.fromEntries(SEGMENTS.map((s) => [s, Math.round(pose.angle[s])]));
  const slider = (key: keyof typeof frame, min: number, max: number, step: number) => (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted w-14">{key}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={frame[key]}
        onChange={(e) => setFrame({ ...frame, [key]: Number(e.target.value) })}
        className="min-w-0 flex-1"
      />
      <span className="w-10 tabular-nums">{frame[key]}</span>
    </label>
  );

  return (
    <div className="pose-board">
      <Card title="Éditeur de poses" className="flex flex-col gap-3">
        <Select
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            const next = POSES.find((p) => p.id === e.target.value);
            setPose(next ? targetPose(next) : REST_POSE);
          }}
        >
          {POSES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.character} : {p.name}
            </option>
          ))}
        </Select>
        {slider("x", -300, 300, 1)}
        {slider("y", -300, 300, 1)}
        {slider("scale", 0.3, 3, 0.01)}
        {slider("opacity", 0, 1, 0.05)}
        <Textarea readOnly rows={7} value={JSON.stringify(angles)} className="font-mono text-xs" />
      </Card>
      <Card title="Pantin" className="pose-stage">
        <Puppet
          pose={pose}
          onChange={setPose}
          backdrop={target ? { src: target.image, ...frame } : null}
        />
      </Card>
    </div>
  );
}
