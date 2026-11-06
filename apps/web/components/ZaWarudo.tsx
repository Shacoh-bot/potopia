"use client";

import {
  cx,
  effectiveVolume,
  resumeTime,
  ROAD_ROLLER_EVENT,
  stopTime,
  trackMedia,
  ZA_WARUDO_EVENT,
  type ZaWarudoDetail,
} from "@app/ui";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// « ZA WARUDO ! Toki wo tomare ! » (~4,5 s) puis la reprise du temps (~1,8 s, pic à 0,8 s).
const STOP_SOUND = "/audio/za-warudo.mp3";
const RESUME_SOUND = "/audio/time-resume.mp3";
const WAVE_MS = 950; // l'onde s'étend puis se referme ; le temps est arrêté à la fin
const RESUME_HIT_MS = 800;
const AUTO_RESUME_MS = 4500; // en passant au thème : le temps repart à la fin de la réplique
const OUT_MS = 500;
const VOLUME = 0.8;
const ROLLER_LANDS_MS = 700; // secret JoJo : le rouleau compresseur tombe, puis le temps reprend

type Phase = "off" | "wave" | "stopped" | "resume";

/**
 * Arrêt du temps façon DIO (thème JoJo). Le cri part, une onde inverse les couleurs depuis le
 * centre, puis la page se fige dans une teinte délavée, « 時よ止まれ ! » : animations CSS et
 * transitions, animations Web (`element.animate`), animations JS qui lisent `timeNow()`, sons.
 * Le temps reprend dans une onde inverse : tout seul à la fin de la réplique quand on passe au
 * thème JoJo, au clic (ou Échap) seulement quand on clique de nouveau sur le thème déjà actif (un
 * clic l'écourte toujours). Déclenché par `zaWarudo()` de `@app/ui`. Monté une fois, layout racine.
 */
export function ZaWarudo() {
  const [phase, setPhase] = useState<Phase>("off");
  const phaseRef = useRef<Phase>("off");
  const timers = useRef<number[]>([]);
  const skipRef = useRef<() => void>(() => {});

  useEffect(() => {
    trackMedia();
    // animations Web et transitions en cours hors de l'effet (émeraudes…) : mises en pause,
    // relancées à la reprise. Les animations CSS, elles, sont figées par la classe time-stop (les
    // piloter ici leur ferait ignorer animation-play-state ensuite).
    let frozen: Animation[] = [];
    const go = (next: Phase) => {
      phaseRef.current = next;
      setPhase(next);
      // tout le reste se fige (animations du header, musiques) pendant l'effet, et repart à la fin
      if (next === "wave" || next === "stopped") stopTime();
      // relevées avant de poser la teinte délavée : sa transition (filter) ne doit pas être figée
      // avec le reste, sinon la page reste dans ses couleurs
      if (next === "stopped") {
        frozen = document.getAnimations().filter((a) => {
          const target = (a.effect as KeyframeEffect | null)?.target;
          return (
            a.playState === "running" &&
            !(a instanceof CSSAnimation) &&
            !target?.closest(".za-layer")
          );
        });
        frozen.forEach((a) => a.pause());
      }
      document.documentElement.classList.toggle("time-stop", next === "stopped");
      if (next === "resume") {
        frozen.forEach((a) => a.play());
        frozen = [];
      }
      if (next === "off") resumeTime();
    };
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    const play = (src: string) => {
      const audio = new Audio(src);
      // la voix de DIO n'est pas figée par son propre arrêt du temps
      audio.dataset.timeStopProof = "1";
      audio.volume = effectiveVolume() * VOLUME;
      audio.play().catch(() => {});
      return audio;
    };
    let voice: HTMLAudioElement | null = null;

    // le temps reprend : son de reprise, onde inverse sur son pic, puis tout redevient normal
    const resume = () => {
      clear();
      voice?.pause();
      play(RESUME_SOUND);
      later(RESUME_HIT_MS, () => go("resume"));
      later(RESUME_HIT_MS + OUT_MS, () => go("off"));
    };

    const start = (e: Event) => {
      if (phaseRef.current !== "off") return;
      const hold = (e as CustomEvent<ZaWarudoDetail | undefined>).detail?.hold ?? false;
      voice = play(STOP_SOUND);
      go("wave");
      later(WAVE_MS, () => go("stopped"));
      // en passant au thème, le temps repart seul à la fin de la réplique ; sinon il reste
      // arrêté jusqu'à ce qu'on clique
      if (!hold) later(AUTO_RESUME_MS, () => skipRef.current());
    };

    skipRef.current = () => {
      if (phaseRef.current === "stopped") resume();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skipRef.current();
    };

    window.addEventListener(ZA_WARUDO_EVENT, start);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(ZA_WARUDO_EVENT, start);
      window.removeEventListener("keydown", onKey);
      clear();
      voice?.pause();
      document.documentElement.classList.remove("time-stop");
      resumeTime();
    };
  }, []);

  if (phase === "off") return null;
  return createPortal(
    <div
      className={cx("za-layer fixed inset-0 z-100", phase === "stopped" && "cursor-pointer")}
      onClick={(e) => {
        // secret du thème JoJo : un clic sur DIO pendant l'arrêt du temps, et il lâche son
        // rouleau compresseur dans le temps arrêté (JojoFx) ; le temps reprend une fois le
        // rouleau posé
        const dio = document.querySelector(".jojo-dio")?.getBoundingClientRect();
        const onDio =
          phase === "stopped" &&
          dio &&
          e.clientX >= dio.left &&
          e.clientX <= dio.right &&
          e.clientY >= dio.top &&
          e.clientY <= dio.bottom;
        if (!onDio) return skipRef.current();
        window.dispatchEvent(new Event(ROAD_ROLLER_EVENT));
        window.setTimeout(() => skipRef.current(), ROLLER_LANDS_MS);
      }}
    >
      {(phase === "wave" || phase === "resume") && (
        <span className={cx("za-wave", phase === "resume" && "za-wave-out")} />
      )}
      {phase === "wave" && <span className="za-shout">ZA WARUDO !</span>}
      {phase === "stopped" && (
        <>
          <span className="za-stopped">時よ止まれ！</span>
          <span className="za-hint">Clic : le temps reprend</span>
        </>
      )}
    </div>,
    document.body,
  );
}
