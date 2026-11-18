"use client";

import {
  BoosterOpening,
  BoosterWarmUp,
  decodeCardImages,
  fetchCardImages,
  type OpenedCard,
  preloadBoosterOpening,
  preloadBoosterSounds,
  WARM_UP_GUARD_MS,
  type WarmUpLook,
  warmUpProgress,
} from "@app/tcg/ui";
import { buttonClasses } from "@app/ui";
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  isBoosterWarm as isWarm,
  prewarmScript,
  rememberBoosterWarm as rememberWarm,
} from "@/components/boosterWarmMemory";
import { OrbWarmUp } from "@/components/SpinOrb";
import { openBoosterAction } from "./actions";
import type { Pack } from "./pack";

type Opened = { n: number; cards: OpenedCard[] | null; setSize?: number };

const noSubscribe = () => () => {};

/** Illustrations (petites cartes) d'un paquet. */
const imagesOf = (pack: Pack | null) => pack?.cards.map((c) => c.imageUrl) ?? [];
/** Une carte dans sa version : même carte et même version, même illustration. */
const versionKey = (c: OpenedCard) => `${c.id}:${c.card.layout ?? "normal"}`;

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
 *
 * Le prochain paquet est déjà tiré (`next`) : ses illustrations sont téléchargées dès l'arrivée et
 * décodées pendant la préparation (un cran de la barre). Au clic, le serveur ouvre ce paquet-là,
 * et les cartes reprennent les illustrations préchargées : aucune requête d'image après le clic.
 * Le paquet suivant arrive avec le tirage : téléchargé aussitôt (basse priorité), décodé une fois
 * toutes les cartes retournées ou l'écran fermé, pour ne rien gêner pendant les retournements.
 */
export function BoosterOpener({
  setCode,
  fonts,
  looks,
  next,
}: {
  setCode: string;
  fonts: string;
  /** Allures des cartes du set, dessinées d'avance par le préchauffage (`BoosterWarmUp`). */
  looks: WarmUpLook[];
  /** Prochain paquet, déjà tiré par le serveur (null : set vide). */
  next: Pack | null;
}) {
  const [opened, setOpened] = useState<Opened | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warm, setWarm] = useState<Warm>("waiting");
  // Déjà chaud dans l'onglet : lu dès le 1er rendu client (retour par navigation interne) ; au
  // rendu serveur et à l'hydratation, `false`, et c'est le script en ligne qui s'en charge.
  const knownWarm = useSyncExternalStore(
    noSubscribe,
    () => isWarm(setCode),
    () => false,
  );
  // Script en ligne seulement dans le HTML du serveur (et son hydratation) : un rendu client ne
  // l'exécuterait pas.
  const fromServer = useSyncExternalStore(
    noSubscribe,
    () => false,
    () => true,
  );
  const [steps, setSteps] = useState({ done: 0, total: 1 });
  const [cardsDone, setCardsDone] = useState(false);
  const [orbDone, setOrbDone] = useState(false);
  const [imagesDone, setImagesDone] = useState(false);
  const column = useRef<HTMLDivElement>(null);
  // Prochain paquet connu : celui de la page, puis celui arrivé avec chaque tirage (la page
  // rafraîchie après une ouverture renvoie le même).
  const nextPack = useRef(next);

  // Code 3D, modèle, vidéo et sons téléchargés dès l'arrivée sur la page : l'ouverture est
  // immédiate. Puis, page affichée, le préchauffage : la première ouverture ne s'arrête plus.
  useEffect(() => {
    preloadBoosterOpening();
    void preloadBoosterSounds();
    // Illustrations du prochain paquet : téléchargées et décodées (un cran de la barre).
    let live = true;
    void decodeCardImages(imagesOf(nextPack.current)).then(() => {
      if (live) setImagesDone(true);
    });
    // Dès la page affichée (2 images), pour que la barre soit vue tout de suite.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() =>
        setWarm((w) => (w !== "waiting" ? w : isWarm(setCode) ? "warm" : "running")),
      );
    });
    return () => {
      live = false;
      cancelAnimationFrame(frame);
    };
  }, [setCode]);

  // Fin : cartes et rebond préchauffés (retenu pour la suite) ; sinon, passé le délai de garde, le
  // bouton redevient cliquable quand même.
  const finished = cardsDone && orbDone && imagesDone;
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
  const preparing = !knownWarm && (warm === "waiting" || warm === "running") && !finished;
  // Temps mort (cartes toutes retournées, ou écran fermé) : le paquet suivant est décodé.
  const decodeNext = useCallback(() => void decodeCardImages(imagesOf(nextPack.current)), []);

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
      // Les cartes reprennent les illustrations préchargées (même carte, même version) : un lien
      // signé régénéré entre-temps serait une nouvelle requête.
      const preloaded = new Map(nextPack.current?.cards.map((c) => [versionKey(c), c.imageUrl]));
      const cards = result.cards.map((c) => ({
        ...c,
        imageUrl: preloaded.get(versionKey(c)) ?? c.imageUrl,
      }));
      // Paquet suivant : téléchargé tout de suite, en basse priorité (décodé plus tard).
      nextPack.current = result.next;
      fetchCardImages(imagesOf(result.next), "low");
      // Ignore un tirage arrivé après qu'on a fermé ou rouvert un autre paquet.
      setOpened((o) => (o?.n === n ? { n, cards, setSize: result.setSize } : o));
    });
  }

  return (
    // `data-prewarmed` (posé par le script en ligne) n'est pas rendu par React : pas d'alerte.
    <div ref={column} className="booster-opener flex flex-col gap-3" suppressHydrationWarning>
      {fromServer && (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: script fixe, code du set échappé (prewarmScript)
        <script dangerouslySetInnerHTML={{ __html: prewarmScript(setCode) }} />
      )}
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
          onClose={() => {
            setOpened(null);
            decodeNext();
          }}
          onAgain={open}
          onDone={decodeNext}
        />
      ) : (
        <button
          type="button"
          className={`${buttonClasses()} relative self-start overflow-hidden`}
          onClick={open}
          disabled={preparing}
          aria-busy={preparing || undefined}
          data-preparing={preparing ? "" : undefined}
        >
          {/* les deux textes dans la même case : le bouton garde sa largeur */}
          <span className="grid">
            <span data-label="ready" className={`[grid-area:1/1] ${preparing ? "invisible" : ""}`}>
              Ouvrir un paquet
            </span>
            <span
              data-label="busy"
              className={`[grid-area:1/1] ${preparing ? "" : "invisible"}`}
              aria-hidden={!preparing}
            >
              Préparation…
            </span>
          </span>
          {preparing && (
            <span aria-hidden data-bar="" className="absolute inset-x-0 bottom-0 h-1 bg-current/25">
              <span
                className="block h-full bg-current"
                style={{ width: `${warmUpProgress(steps, [orbDone, imagesDone]) * 100}%` }}
              />
            </span>
          )}
        </button>
      )}
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}
