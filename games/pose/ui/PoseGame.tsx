"use client";

import { Button, Card, cx, effectiveVolume, onVolumeChange, Select, Textarea } from "@app/ui";
import { useEffect, useRef, useState } from "react";
import { POSES, targetPose, type TargetPose } from "../src/poses";
import { grade, scorePose, type PoseScore } from "../src/score";
import { REST_POSE, SEGMENTS, type Pose } from "../src/skeleton";
import { Puppet } from "./Puppet";

/** Nombre de poses par partie. */
const ROUND = 5;

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

const VERDICTS: Record<ReturnType<typeof grade>, string> = {
  A: "Yare yare daze… Pose parfaite.",
  B: "Pas mal du tout. Bizarre, même.",
  C: "Ça ressemble à quelque chose…",
  D: "Même Speedwagon aurait fait mieux.",
  E: "WRYYY ?!",
};

function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

function GradeBadge({ percent, big }: { percent: number; big?: boolean }) {
  const g = grade(percent);
  return <span className={cx("pose-grade", `pose-grade-${g}`, big && "pose-grade-big")}>{g}</span>;
}

type Result = { pose: TargetPose; score: PoseScore };

/**
 * Pose JoJo : une image de pose célèbre, un pantin à mettre dans la même position. On attrape
 * ses membres ou ses articulations pour les faire pivoter, ou une main ou un pied pour plier tout
 * le membre ; « Valider » compare articulation par articulation (en miroir aussi) et montre la
 * pose attendue en fantôme. Partie de 5 poses, sur « Jojo Pose ».
 */
export function PoseGame({ editor = false }: { editor?: boolean }) {
  const [queue, setQueue] = useState<TargetPose[] | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [pose, setPose] = useState<Pose>(REST_POSE);
  const [score, setScore] = useState<PoseScore | null>(null);
  const music = useMusic();
  const musicButton = <MusicToggle off={music.off} toggle={music.toggle} />;

  if (editor) return <PoseEditor />;

  const start = () => {
    music.play();
    setQueue(shuffle(POSES).slice(0, ROUND));
    setResults([]);
    setPose(REST_POSE);
    setScore(null);
  };

  if (!queue) {
    return (
      <Card className="pose-intro">
        <h1 className="font-display text-gradient text-3xl">Pose JoJo</h1>
        <p className="text-muted max-w-prose text-sm">
          Une pose célèbre s&apos;affiche : mets le pantin dans la même position. Attrape un bras,
          un avant-bras, une cuisse, une jambe, le tronc ou la tête et fais-le pivoter, ou tire une
          main ou un pied : le bras ou la jambe se plie tout seul. La pose en miroir compte aussi.
          {ROUND} poses par partie.
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={start} disabled={POSES.length === 0}>
            Commencer
          </Button>
          {musicButton}
        </div>
      </Card>
    );
  }

  const done = results.length >= queue.length;
  if (done) {
    const total = Math.round(results.reduce((n, r) => n + r.score.percent, 0) / results.length);
    return (
      <Card title="Résultat" action={musicButton} className="pose-final">
        <div className="flex items-center gap-4">
          <GradeBadge percent={total} big />
          <div>
            <p className="font-display text-text text-2xl">{total} %</p>
            <p className="text-muted text-sm">{VERDICTS[grade(total)]}</p>
          </div>
        </div>
        <ul className="pose-recap">
          {results.map((r) => (
            <li key={r.pose.id}>
              <img src={r.pose.image} alt="" />
              <span className="min-w-0 flex-1 truncate">{r.pose.name}</span>
              <span className="tabular-nums">{r.score.percent} %</span>
              <GradeBadge percent={r.score.percent} />
            </li>
          ))}
        </ul>
        <Button onClick={start}>Rejouer</Button>
      </Card>
    );
  }

  const target = queue[results.length] as TargetPose;
  const expected = targetPose(target);
  const validate = () => setScore(scorePose(pose, expected));
  const next = () => {
    if (!score) return;
    setResults((all) => [...all, { pose: target, score }]);
    setScore(null);
    setPose(REST_POSE);
  };

  return (
    <div className="pose-board">
      <Card
        title={`Pose ${results.length + 1} / ${queue.length}`}
        action={<span className="text-muted truncate text-xs">{target.character}</span>}
        className="pose-target"
      >
        <img src={target.image} alt={`${target.character} : ${target.name}`} />
        <p className="font-display text-accent text-center text-sm">{target.name}</p>
      </Card>

      <Card title="Ton pantin" action={musicButton} className="pose-stage">
        <Puppet
          pose={pose}
          onChange={score ? undefined : setPose}
          // la pose attendue, toujours dans le sens de l'image (même si le joueur l'a faite en
          // miroir), pour la comparer à l'image
          ghost={score ? expected : null}
        />
        {score ? (
          <div className="pose-score animate-rise">
            <GradeBadge percent={score.percent} big />
            <div className="min-w-0 flex-1">
              <p className="font-display text-text text-2xl">{score.percent} %</p>
              <p className="text-muted text-sm">
                {VERDICTS[grade(score.percent)]}
                {score.mirrored && " (en miroir)"}
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
