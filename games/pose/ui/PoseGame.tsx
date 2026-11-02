"use client";

import { Button, Card, cx, effectiveVolume, onVolumeChange, Select, Textarea } from "@app/ui";
import { useEffect, useRef, useState } from "react";
import { DAILY_COUNT, dailyPoses, dayKey } from "../src/daily";
import { POSES, targetPose, type TargetPose } from "../src/poses";
import { grade, scorePose } from "../src/score";
import { REST_POSE, SEGMENTS, type Pose } from "../src/skeleton";
import { verdict } from "../src/verdicts";
import { endOfDay, PoseFx } from "./PoseFx";
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
type Result = { id: string; percent: number; mirrored: boolean; line: string };

// Parties du jour déjà jouées, gardées sur l'appareil (pas encore de base : elle viendra avec le
// classement).
const dayStorageKey = (key: string) => `potopia:pose-day:${key}`;

function readDay(key: string): Result[] | null {
  try {
    const raw = localStorage.getItem(dayStorageKey(key));
    return raw ? (JSON.parse(raw) as Result[]) : null;
  } catch {
    return null;
  }
}

function saveDay(key: string, results: Result[]) {
  try {
    localStorage.setItem(dayStorageKey(key), JSON.stringify(results));
  } catch {
    // stockage indisponible : la partie n'est pas gardée
  }
}

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

function Recap({ results }: { results: Result[] }) {
  const byId = new Map(POSES.map((p) => [p.id, p]));
  return (
    <ul className="pose-recap">
      {results.map((r) => {
        const p = byId.get(r.id);
        return (
          <li key={r.id}>
            {p && <img src={p.image} alt="" />}
            <span className="min-w-0 flex-1 truncate">
              {p ? `${p.character} : ${p.name}` : r.id}
            </span>
            <span className="tabular-nums">{r.percent} %</span>
            <GradeBadge percent={r.percent} />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Pose JoJo : chaque jour, trois poses célèbres (les mêmes pour tout le monde) à reproduire avec
 * un pantin. On attrape ses membres ou ses articulations pour les faire pivoter, ou une main ou
 * un pied pour plier tout le membre ; « Valider » compare articulation par articulation (en
 * miroir aussi) et montre la pose attendue en fantôme. Bonus JoJo pendant la partie (PoseFx),
 * musique « Jojo Pose ». La partie du jour est gardée sur l'appareil ; `allowReplay` (en local)
 * permet de la rejouer.
 */
export function PoseGame({
  editor = false,
  allowReplay = false,
}: {
  editor?: boolean;
  allowReplay?: boolean;
}) {
  const [key, setKey] = useState<string | null>(null);
  const [played, setPlayed] = useState<Result[] | null>(null);
  const [queue, setQueue] = useState<TargetPose[] | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [pose, setPose] = useState<Pose>(REST_POSE);
  const [current, setCurrent] = useState<Result | null>(null);
  const [fx, setFx] = useState<{ id: number; grade: ReturnType<typeof grade> } | null>(null);
  const [, tick] = useState(0);
  const music = useMusic();
  const musicButton = <MusicToggle off={music.off} toggle={music.toggle} />;

  // le jour et la partie déjà jouée se lisent sur l'appareil, après le rendu serveur ; le compte à
  // rebours des poses suivantes se met à jour chaque minute
  useEffect(() => {
    const today = dayKey();
    setKey(today);
    setPlayed(readDay(today));
    const timer = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (editor) return <PoseEditor />;

  const start = () => {
    if (!key) return;
    music.play();
    setQueue(dailyPoses(key));
    setResults([]);
    setPose(REST_POSE);
    setCurrent(null);
    setPlayed(null);
  };

  const finished = played ?? (queue && results.length >= queue.length ? results : null);
  if (finished && key) {
    const total = Math.round(finished.reduce((n, r) => n + r.percent, 0) / finished.length);
    return (
      <Card title="Les poses du jour" action={musicButton} className="pose-final">
        <div className="flex items-center gap-4">
          <GradeBadge percent={total} big />
          <div>
            <p className="font-display text-text text-2xl">{total} %</p>
            {/* réplique fixe pour un même total : elle ne change pas à chaque visite */}
            <p className="text-muted text-sm">{verdict(grade(total), (total % 7) / 7)}</p>
          </div>
        </div>
        <Recap results={finished} />
        <p className="text-muted text-sm">Nouvelles poses dans {untilTomorrow(key)}.</p>
        {allowReplay && (
          <Button variant="secondary" onClick={start}>
            Rejouer (en local seulement)
          </Button>
        )}
      </Card>
    );
  }

  if (!queue) {
    return (
      <Card className="pose-intro">
        <h1 className="font-display text-gradient text-3xl">Pose JoJo</h1>
        <p className="text-muted max-w-prose text-sm">
          Chaque jour, {DAILY_COUNT} poses célèbres, les mêmes pour tout le monde : mets le pantin
          dans la même position. Attrape un bras, un avant-bras, une cuisse, une jambe, le tronc ou
          la tête et fais-le pivoter, ou tire une main ou un pied : le bras ou la jambe se plie tout
          seul. La pose en miroir compte aussi. Quand tu approches de la bonne pose… ゴゴゴゴ.
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={start} disabled={!key || POSES.length === 0}>
            Commencer
          </Button>
          {musicButton}
        </div>
      </Card>
    );
  }

  const target = queue[results.length] as TargetPose;
  const expected = targetPose(target);
  const live = current ? null : scorePose(pose, expected).percent;
  const validate = () => {
    const s = scorePose(pose, expected);
    const g = grade(s.percent);
    setCurrent({ id: target.id, percent: s.percent, mirrored: s.mirrored, line: verdict(g) });
    setFx({ id: Date.now(), grade: g });
  };
  const next = () => {
    if (!current || !key) return;
    const all = [...results, current];
    setResults(all);
    if (all.length >= queue.length) {
      saveDay(key, all);
      endOfDay(grade(Math.round(all.reduce((n, r) => n + r.percent, 0) / all.length)));
    }
    setCurrent(null);
    setFx(null);
    setPose(REST_POSE);
  };

  return (
    <div className="pose-board">
      <Card
        title={`Pose ${results.length + 1} / ${queue.length} du jour`}
        action={<span className="text-muted truncate text-xs">{target.character}</span>}
        className="pose-target"
      >
        <img src={target.image} alt={`${target.character} : ${target.name}`} />
        <p className="font-display text-accent text-center text-sm">{target.name}</p>
      </Card>

      <Card title="Ton pantin" action={musicButton} className="pose-stage">
        <Puppet
          pose={pose}
          onChange={current ? undefined : setPose}
          // la pose attendue, toujours dans le sens de l'image (même si le joueur l'a faite en
          // miroir), pour la comparer à l'image
          ghost={current ? expected : null}
        />
        <PoseFx live={live} result={fx} />
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
              {results.length + 1 < queue.length ? "Pose suivante" : "Résultat"}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPose(REST_POSE)}>
              Remettre droit
            </Button>
            <Button className="flex-1" onClick={validate}>
              Valider la pose
            </Button>
          </div>
        )}
      </Card>
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
        className="flex-1"
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
