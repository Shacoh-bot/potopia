"use client";

import {
  BoosterOpening,
  BoosterWarmUp,
  type OpenedCard,
  preloadBoosterOpening,
  preloadBoosterSounds,
  WARM_UP_GUARD_MS,
  type WarmUpLook,
  warmUpProgress,
} from "@app/tcg/ui";
import { buttonClasses } from "@app/ui";
import { Component, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { OrbWarmUp } from "@/components/SpinOrb";
import { openBoosterAction } from "./actions";

type Opened = { n: number; cards: OpenedCard[] | null; setSize?: number };

/**
 * Sets déjà préchauffés dans cet onglet : les programmes GPU compilés restent jusqu'à la fermeture
 * du navigateur. En mémoire pour un retour sur la page, et dans l'onglet (`sessionStorage`) pour un
 * rechargement : pas de barre la fois suivante.
 */
const warmSets = new Set<string>();
const warmKey = (setCode: string) => `potopia:booster-prechauffe:${setCode}`;
function isWarm(setCode: string): boolean {
  if (warmSets.has(setCode)) return true;
  try {
    return window.sessionStorage.getItem(warmKey(setCode)) === "1";
  } catch {
    return false;
  }
}
function rememberWarm(setCode: string) {
  warmSets.add(setCode);
  try {
    window.sessionStorage.setItem(warmKey(setCode), "1");
  } catch {
    // stockage refusé : la mémoire de la page suffit
  }
}

/** Un préchauffage qui plante ne casse pas la page : il est retiré et la suite continue. */
class WarmUpGuard extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Préchauffage, vu du bouton : « waiting » avant (rendu serveur compris), « running » pendant,
 * « ready » après le délai de garde ou un préchauffage planté, « warm » déjà chaud. Fini plus tôt
 * (cartes et rebond préchauffés) : `finished`.
 */
type Warm = "waiting" | "running" | "ready" | "warm";

/**
 * Bouton « Ouvrir un paquet » : l'écran d'ouverture s'affiche aussitôt, dans la page, pendant
 * que le serveur tire les cartes (elles ne servent qu'à la fin, au retournement). À l'arrivée,
 * le temps du préchauffage, le bouton montre « Préparation… » et une barre qui avance d'un cran
 * par étape ; il est désactivé jusqu'à la fin (au plus `WARM_UP_GUARD_MS`).
 */
export function BoosterOpener({
  setCode,
  fonts,
  looks,
}: {
  setCode: string;
  fonts: string;
  /** Allures des cartes du set, dessinées d'avance par le préchauffage (`BoosterWarmUp`). */
  looks: WarmUpLook[];
}) {
  const [opened, setOpened] = useState<Opened | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Au retour sur la page (navigation dans l'application), déjà chaud : pas de barre.
  const [warm, setWarm] = useState<Warm>(() => (warmSets.has(setCode) ? "warm" : "waiting"));
  const [steps, setSteps] = useState({ done: 0, total: 1 });
  const [cardsDone, setCardsDone] = useState(false);
  const [orbDone, setOrbDone] = useState(false);
  const column = useRef<HTMLDivElement>(null);

  // Code 3D, modèle, vidéo et sons téléchargés dès l'arrivée sur la page : l'ouverture est
  // immédiate. Puis, page affichée, le préchauffage : la première ouverture ne s'arrête plus.
  useEffect(() => {
    preloadBoosterOpening();
    void preloadBoosterSounds();
    // Dès la page affichée (2 images), pour que la barre soit vue tout de suite.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() =>
        setWarm((w) => (w !== "waiting" ? w : isWarm(setCode) ? "warm" : "running")),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [setCode]);

  // Fin : cartes et rebond préchauffés (retenu pour la suite) ; sinon, passé le délai de garde, le
  // bouton redevient cliquable quand même.
  const finished = cardsDone && orbDone;
  useEffect(() => {
    if (warm === "running" && finished) rememberWarm(setCode);
  }, [warm, finished, setCode]);
  useEffect(() => {
    if (warm !== "running" || finished) return;
    const guard = window.setTimeout(() => setWarm("ready"), WARM_UP_GUARD_MS);
    return () => window.clearTimeout(guard);
  }, [warm, finished]);

  const progress = useCallback((done: number, total: number) => setSteps({ done, total }), []);
  const cardsWarmed = useCallback(() => setCardsDone(true), []);
  const cardsFailed = useCallback(() => setWarm("ready"), []);
  const orbWarmed = useCallback(() => setOrbDone(true), []);
  const preparing = (warm === "waiting" || warm === "running") && !finished;

  function open() {
    setError(null);
    const n = (opened?.n ?? 0) + 1;
    setOpened({ n, cards: null });
    void openBoosterAction(setCode).then((result) => {
      if (!result.ok) {
        setError(result.error);
        setOpened(null);
        return;
      }
      // Ignore un tirage arrivé après qu'on a fermé ou rouvert un autre paquet.
      setOpened((o) => (o?.n === n ? { n, cards: result.cards, setSize: result.setSize } : o));
    });
  }

  return (
    <div ref={column} className="flex flex-col gap-3">
      {warm === "running" && !cardsDone && (
        <WarmUpGuard onError={cardsFailed}>
          <BoosterWarmUp
            looks={looks}
            within={column}
            onDone={cardsWarmed}
            onProgress={progress}
            className={fonts}
          />
        </WarmUpGuard>
      )}
      {/* le rebond de la boule de l'en-tête aussi, sinon sa 1re compilation peut tomber pendant le
          paquet ; il se retire seul, même après le délai de garde */}
      {(warm === "running" || warm === "ready") && (
        <WarmUpGuard onError={orbWarmed}>
          <OrbWarmUp onDone={orbWarmed} />
        </WarmUpGuard>
      )}
      {opened ? (
        <BoosterOpening
          // Un nouveau paquet repart de zéro (paquet 3D, vidéo, cartes de dos).
          key={opened.n}
          cards={opened.cards}
          setSize={opened.setSize}
          className={fonts}
          onClose={() => setOpened(null)}
          onAgain={open}
        />
      ) : (
        <button
          type="button"
          className={`${buttonClasses()} relative self-start overflow-hidden`}
          onClick={open}
          disabled={preparing}
          aria-busy={preparing || undefined}
        >
          {/* les deux textes dans la même case : le bouton garde sa largeur */}
          <span className="grid">
            <span className={`[grid-area:1/1] ${preparing ? "invisible" : ""}`}>
              Ouvrir un paquet
            </span>
            <span
              className={`[grid-area:1/1] ${preparing ? "" : "invisible"}`}
              aria-hidden={!preparing}
            >
              Préparation…
            </span>
          </span>
          {preparing && (
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-current/25">
              <span
                className="block h-full bg-current"
                style={{ width: `${warmUpProgress(steps, orbDone) * 100}%` }}
              />
            </span>
          )}
        </button>
      )}
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}
