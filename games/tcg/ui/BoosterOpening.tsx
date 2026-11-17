"use client";

import {
  Hand,
  type LucideIcon,
  Mouse,
  MouseLeft,
  MouseRight,
  Move,
  Pointer,
  Rotate3d,
  ScissorsLineDashed,
  ZoomIn,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { revealRarity } from "../src/card-rules";
import { flipSound, grabSound, landSound, openSound, tearSound } from "./booster-sounds";
import { CardAura, hasAura, warmUpAuras } from "./CardAura";
import { CardBack } from "./CardBack";
import { CardZoom } from "./CardZoom";
import { GameCard, GameCardDefs, type GameCardFields } from "./GameCard";
import { OPENING_BG, openingPlan } from "./opening";
import { type WarmUpLook, warmUpCard } from "./warm-up";

// three.js et le modèle ne se chargent que pour cet écran (préchargés par `preloadBoosterOpening`).
const loadScene = () => import("./PackScene");
const PackScene = lazy(loadScene);

/*
 * Ouverture d'un booster, dans la page (par-dessus la fenêtre des boosters) :
 * 1. le paquet en 3D, qu'on fait tourner en glissant ;
 * 2. glisser la souris le long de la ligne pointillée le découpe : la caméra s'approche du haut
 *    du paquet, jusqu'au plan exact de la vidéo, qui prend le relais (lame de lumière, sortie des
 *    5 cartes) ;
 * 3. les 5 vraies cartes, de dos, quittent la vidéo pour se ranger côte à côte ; un clic
 *    retourne chacune.
 * Les cartes tirées peuvent arriver pendant que le joueur manipule le paquet (`cards` null en
 * attendant) : l'écran s'ouvre aussitôt au clic. La vidéo est posée en entier dans l'écran (comme
 * `object-fit: contain`), sur son fond.
 */

/** Une carte tirée, prête à afficher. */
export type OpenedCard = { id: string; card: GameCardFields; imageUrl: string | null };

/** Cadre de la vidéo (pixels). */
const FRAME = { width: 1920, height: 1080 };
/** Cartes sur la vidéo une fois posées (cartes-positions.json, exporté de Blender). */
const VIDEO_CARDS = [93.9, 444.1, 794.2, 1144.3, 1494.5].map((x) => ({
  x,
  y: 307.9,
  width: 331.6,
  height: 464.2,
}));
/** Moment (s) où la vidéo prend le relais du paquet 3D : le plan serré, juste avant la lame. */
const VIDEO_START = 1.4;
/** Vitesse de lecture : la vidéo, rendue à 30 im/s, est un peu lente à l'écran. */
const VIDEO_RATE = 1.25;
/** Les cartes se posent (s) ; à VIDEO_DONE, elles sont immobiles : les vraies prennent le relais. */
const LAND_AT = [3.0, 3.15, 3.3, 3.42, 3.52];
const VIDEO_DONE = 3.62;
/** Largeur d'une carte `GameCard` à l'échelle 1, et rapport largeur/hauteur des cartes. */
const CARD_WIDTH = 300;
const CARD_RATIO = 360 / 504;
/** Durée du demi-tour d'une carte (ms), comme l'animation tcg-flip-over de tcg.css. */
const FLIP_MS = 620;

type Phase = "pack" | "zoom" | "video" | "cards";
type Size = { width: number; height: number };
type Rect = { left: number; top: number; width: number; height: number };

/** Taille de l'écran d'ouverture (suivie). */
function useSize(ref: React.RefObject<HTMLElement | null>): Size | null {
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** Cadre de la vidéo posé en entier dans l'écran, centré. */
function videoFrame(view: Size) {
  const scale = Math.min(view.width / FRAME.width, view.height / FRAME.height);
  return {
    scale,
    left: (view.width - FRAME.width * scale) / 2,
    top: (view.height - FRAME.height * scale) / 2,
    width: FRAME.width * scale,
    height: FRAME.height * scale,
  };
}

/** Les 5 cartes côte à côte, centrées, aussi grandes que l'écran le permet. */
function cardSlots(view: Size): Rect[] {
  const gap = Math.min(28, Math.max(10, view.width * 0.018));
  const width = Math.min(300, (view.width * 0.94 - 4 * gap) / 5, view.height * 0.66 * CARD_RATIO);
  const height = width / CARD_RATIO;
  const left = (view.width - (5 * width + 4 * gap)) / 2;
  const top = Math.max(12, (view.height - height) / 2 - 20);
  return Array.from({ length: 5 }, (_, i) => ({
    left: left + i * (width + gap),
    top,
    width,
    height,
  }));
}

/**
 * Safari (et iOS) n'affichent pas la transparence des WebM VP9 : ils jouent le MP4, dont le fond
 * est celui de l'écran.
 */
function videoSource(base: string): string {
  const ua = navigator.userAgent;
  const safari = /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|Firefox\/|OPR\//.test(ua);
  return `${base}/ouverture.${safari ? "mp4" : "webm"}?v=${ASSETS_VERSION}`;
}

/**
 * Version du modèle et des vidéos (même rendu Blender) : à changer à chaque nouveau rendu. Les
 * fichiers restent un jour en cache dans le navigateur ; sans elle, un joueur garderait l'ancien
 * modèle avec la nouvelle vidéo, et le relais sauterait.
 */
const ASSETS_VERSION = 6;

/** Modèle 3D du paquet. */
const packUrl = (base: string) => `${base}/paquet.glb?v=${ASSETS_VERSION}`;

/**
 * Précharge l'écran d'ouverture (code 3D, modèle, vidéo) : à appeler dès que le joueur peut
 * ouvrir un paquet, pour que tout s'affiche aussitôt au clic.
 */
export function preloadBoosterOpening(assetsBase = "/tcg/ouverture") {
  void loadScene().then((m) => m.preloadPack(packUrl(assetsBase)));
  void fetch(videoSource(assetsBase)).catch(() => {});
  // Dessin des auras compilé d'avance : aucun arrêt au retournement des cartes.
  warmUpAuras();
}

/** Gestes du paquet 3D, à la souris et au doigt : un appareil, un geste, un mot. */
const PACK_HELP: Record<
  "mouse" | "touch",
  { device: LucideIcon; does: LucideIcon; label: string }[]
> = {
  mouse: [
    { device: MouseLeft, does: Rotate3d, label: "Tourner" },
    { device: MouseRight, does: Move, label: "Déplacer" },
    { device: Mouse, does: ZoomIn, label: "Zoomer" },
    { device: MouseLeft, does: ScissorsLineDashed, label: "Découper" },
  ],
  touch: [
    { device: Pointer, does: Rotate3d, label: "Tourner" },
    { device: Hand, does: Move, label: "2 doigts" },
    { device: Hand, does: ZoomIn, label: "Pincer" },
    { device: Pointer, does: ScissorsLineDashed, label: "Découper" },
  ],
};

/** Petites icônes d'aide sous le paquet (tactile : versions au doigt). */
function PackHelp() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch(matchMedia("(pointer: coarse)").matches);
  }, []);
  return (
    <ul className="tcg-opening-help" aria-label="Gestes">
      {PACK_HELP[touch ? "touch" : "mouse"].map(({ device: Device, does: Does, label }) => (
        <li key={label}>
          <span className="tcg-opening-help-icons" aria-hidden>
            <Device size={18} strokeWidth={1.75} />
            <Does size={14} strokeWidth={2} />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}

/** Sous le paquet 3D : l'aide aux gestes (une fois le paquet prêt) et la phrase d'invite. */
function PackHints({ ready }: { ready: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-4">
      {ready && <PackHelp />}
      <p
        className="tcg-opening-hint text-center text-xs text-white/85 sm:text-sm"
        aria-live="polite"
      >
        {ready
          ? "Glisse le long de la ligne pointillée pour découper le paquet."
          : "Chargement du paquet…"}
      </p>
    </div>
  );
}

/**
 * Une carte du paquet, vraie carte recto-verso : le dos et la face (`GameCard`) sont montés
 * ensemble, dos à dos, et le clic la fait pivoter d'un seul demi-tour (une seule fois).
 */
function OpeningCard({
  opened,
  from,
  to,
  setSize,
  onReveal,
  fontClass,
  warm,
  faceDelay = 0,
}: {
  /** null tant que le tirage n'est pas arrivé : la carte reste de dos. */
  opened: OpenedCard | null;
  /** Où la carte est sur la vidéo, d'où elle part. */
  from: Rect | null;
  to: Rect;
  setSize?: number;
  onReveal: () => void;
  /** Polices des cartes, reportées sur la carte ouverte en grand (rendue hors de l'écran). */
  fontClass?: string;
  /**
   * Préchauffage (`BoosterWarmUp`) : « hover », le dos tel qu'au survol ; « reveal », la carte se
   * retourne seule, sans son, et se pose avec son aura.
   */
  warm?: "hover" | "reveal";
  /** Images à attendre avant de monter la face, une fois le tirage là (voir `faceMounted`). */
  faceDelay?: number;
}) {
  const [placed, setPlaced] = useState(from === null);
  const [side, setSide] = useState<"back" | "face">("back");
  // Fin du demi-tour : la face suit la souris (inclinaison, reflets).
  const [settled, setSettled] = useState(false);
  // Carte retournée : un clic l'ouvre en grand (avant d'être retournée, le clic la retourne).
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (placed) return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setPlaced(true)));
    return () => cancelAnimationFrame(frame);
  }, [placed]);

  // Face montée juste après l'arrivée du tirage, une carte par image (`faceDelay`) : monter les
  // cinq faces d'un coup (styles, mise en page) figeait l'image à l'arrivée des cartes. Elle reste
  // cachée jusqu'au retournement ; un clic plus tôt la monte aussitôt.
  const [faceMounted, setFaceMounted] = useState(false);
  useEffect(() => {
    if (!opened || faceMounted) return;
    let wait = faceDelay;
    let frame = 0;
    const step = () => {
      if (wait-- <= 0) setFaceMounted(true);
      else frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [opened, faceMounted, faceDelay]);

  useEffect(() => {
    if (warm !== "reveal" || !opened) return;
    setSide("face");
    const timer = window.setTimeout(() => setSettled(true), FLIP_MS);
    return () => window.clearTimeout(timer);
  }, [warm, opened]);

  // La carte est dessinée à sa taille finale ; au départ, une transformation la pose sur celle de
  // la vidéo, puis elle glisse à sa place.
  const start =
    from && !placed
      ? `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})`
      : "none";

  function reveal() {
    if (side === "face" && settled) {
      setZoomed(true);
      return;
    }
    if (side !== "back" || !opened) return;
    setFaceMounted(true);
    setSide("face");
    // une Alt Art se révèle avec le son de la SSR ; le halo reste celui de sa rareté
    flipSound(revealRarity(opened.card));
    onReveal();
    // La face ne suit la souris qu'une fois posée, sinon elle resterait de travers.
    window.setTimeout(() => setSettled(true), FLIP_MS);
  }

  const faceUp = side === "face";

  return (
    <div
      className="tcg-opening-slot absolute"
      style={{ ...to, transform: start, transitionDuration: placed ? undefined : "0s" }}
    >
      {/* Aura de la carte, derrière elle (et sous les cartes voisines), une fois retournée. */}
      {settled && opened && hasAura(opened.card.rarity) && <CardAura rarity={opened.card.rarity} />}
      <button
        type="button"
        className="tcg-opening-card"
        data-side={side}
        data-settled={settled ? "" : undefined}
        data-hover={warm === "hover" ? "" : undefined}
        data-rarity={opened?.card.rarity}
        aria-busy={!opened}
        aria-label={faceUp && opened ? `Voir ${opened.card.name} en grand` : "Retourner la carte"}
        onClick={reveal}
      >
        <span className="tcg-opening-turn">
          <span className="tcg-opening-side" aria-hidden={faceUp || undefined}>
            <CardBack />
          </span>
          {/* Face montée avant le retournement, de l'autre côté : rien ne s'échange en route. */}
          {opened && faceMounted && (
            <span
              className="tcg-opening-side tcg-opening-face"
              aria-hidden={!faceUp || undefined}
              style={{ pointerEvents: settled ? undefined : "none" }}
            >
              <span style={{ display: "block", width: CARD_WIDTH, zoom: to.width / CARD_WIDTH }}>
                <GameCard
                  card={opened.card}
                  imageUrl={opened.imageUrl}
                  setSize={setSize}
                  // Ici, c'est l'aura (CardAura) qui entoure la carte : pas de halo de survol.
                  hoverHalo={false}
                />
              </span>
            </span>
          )}
        </span>
      </button>
      {zoomed && opened && (
        <CardZoom label={opened.card.name} fontClass={fontClass} onClose={() => setZoomed(false)}>
          <GameCard card={opened.card} imageUrl={opened.imageUrl} setSize={setSize} />
        </CardZoom>
      )}
    </div>
  );
}

/** Où la carte n°`i` est sur la vidéo, une fois posée (cadre `frame`). */
function videoCard(frame: ReturnType<typeof videoFrame>, i: number): Rect | null {
  const v = VIDEO_CARDS[i];
  return v
    ? {
        left: frame.left + v.x * frame.scale,
        top: frame.top + v.y * frame.scale,
        width: v.width * frame.scale,
        height: v.height * frame.scale,
      }
    : null;
}

/** Durée du préchauffage (ms) : cartes qui quittent la vidéo, demi-tour, pose et aura en fondu. */
export const WARM_UP_MS = 2600;
/** Moment (ms) où la vidéo du préchauffage s'efface, comme au relais aux vraies cartes. */
const WARM_UP_VIDEO_OUT = 1200;
/** Illustration neutre des cartes fictives du préchauffage (jamais affichée). */
const WARM_UP_IMAGE = "prechauffage.webp";
const ignore = () => {};

/**
 * Préchauffage de l'ouverture (voir `warm-up.ts`) : à monter sur la page des boosters, avant le
 * clic, le temps de `WARM_UP_MS`, puis à retirer (`onDone`). Il dessine ce que l'ouverture va
 * dessiner, aux mêmes tailles : la vidéo, les cartes de dos qui en sortent (une survolée), et une
 * carte fictive de chaque allure (`looks`) qui se retourne et se pose avec son aura, dans le même
 * cadre (coins arrondis, aide sous le paquet, vidéo qui s'efface). Le tout est dessiné vraiment,
 * mais sans changer un seul pixel (voir `.tcg-warm-up`), sans clic ni focus possible.
 */
export function BoosterWarmUp({
  looks,
  within,
  onDone,
  assetsBase = "/tcg/ouverture",
  className,
}: {
  looks: WarmUpLook[];
  /**
   * Colonne où l'écran d'ouverture va s'afficher : le préchauffage prend sa largeur et sa place,
   * centré dans la fenêtre comme l'écran une fois amené au centre. Mêmes tailles, mêmes bords
   * arrondis autour des cartes : sinon Chrome compile encore des variantes à l'ouverture.
   */
  within: React.RefObject<HTMLElement | null>;
  onDone: () => void;
  assetsBase?: string;
  /** Polices des cartes, comme pour `BoosterOpening`. */
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const view = useSize(root);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    setSrc(videoSource(assetsBase));
  }, [assetsBase]);
  const [videoOut, setVideoOut] = useState(false);
  useEffect(() => {
    const timers = [
      window.setTimeout(() => setVideoOut(true), WARM_UP_VIDEO_OUT),
      window.setTimeout(onDone, WARM_UP_MS),
    ];
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [onDone]);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    const el = within.current;
    if (!el) return;
    const { left, width } = el.getBoundingClientRect();
    setBox({ left, width });
  }, [within]);
  const ready = box && view && view.width > 0 ? view : null;
  const frame = ready && videoFrame(ready);
  const slots = ready && cardSlots(ready);
  return (
    <div
      aria-hidden
      inert
      className="tcg-warm-up"
      style={{
        // largeur nulle tant que la colonne n'est pas mesurée : rien n'est dessiné
        left: box?.left ?? 0,
        width: box?.width ?? 0,
        top: view ? Math.max(0, (window.innerHeight - view.height) / 2) : 0,
      }}
    >
      <div
        ref={root}
        data-aura-bounds=""
        className={`tcg-opening relative w-full overflow-hidden rounded-xl ${className ?? ""}`}
        style={{ background: OPENING_BG }}
      >
        <GameCardDefs />
        {src && frame && (
          <video
            src={src}
            muted
            playsInline
            autoPlay
            preload="auto"
            className="tcg-opening-video absolute"
            data-hidden={videoOut ? "" : undefined}
            onLoadedMetadata={(e) => {
              e.currentTarget.currentTime = VIDEO_START;
              e.currentTarget.playbackRate = VIDEO_RATE;
            }}
            style={{
              left: frame.left,
              top: frame.top,
              width: frame.width,
              height: frame.height,
              objectFit: "fill",
            }}
          />
        )}
        {frame &&
          slots?.map((slot, i) => (
            <OpeningCard
              key={`dos-${i}`}
              opened={null}
              from={videoCard(frame, i)}
              to={slot}
              onReveal={ignore}
              warm={i === 0 ? "hover" : undefined}
            />
          ))}
        {slots &&
          looks.map((look, i) => {
            const slot = slots[i % slots.length];
            return (
              slot && (
                <OpeningCard
                  key={`face-${i}`}
                  opened={{
                    id: `prechauffage-${i}`,
                    card: warmUpCard(look),
                    imageUrl: `${assetsBase}/${WARM_UP_IMAGE}`,
                  }}
                  from={null}
                  to={slot}
                  onReveal={ignore}
                  warm="reveal"
                />
              )
            );
          })}
        <PackHints ready />
        <span className="tcg-opening-button absolute top-3 right-3">Fermer</span>
      </div>
    </div>
  );
}

export function BoosterOpening({
  cards,
  setSize,
  onClose,
  onAgain,
  assetsBase = "/tcg/ouverture",
  className,
}: {
  /** Les 5 cartes du paquet, dans l'ordre (la carte chance en dernier) ; null pendant le tirage. */
  cards: OpenedCard[] | null;
  /** Nombre de cartes du set, pour le numéro « 07/40 ». */
  setSize?: number;
  onClose: () => void;
  /** Ouvrir un autre paquet (bouton à la fin). */
  onAgain?: () => void;
  /** Dossier public du modèle 3D et des vidéos. */
  assetsBase?: string;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const view = useSize(root);
  const video = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("pack");
  const [packReady, setPackReady] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(0);
  const lastGrab = useRef(0);

  useEffect(() => {
    setSrc(videoSource(assetsBase));
  }, [assetsBase]);

  // L'écran s'ouvre dans la page : on l'amène au centre de la fenêtre.
  useEffect(() => {
    root.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  // Illustrations téléchargées dès l'arrivée du tirage : chaque carte se retourne sans attente.
  useEffect(() => {
    for (const c of cards ?? []) if (c.imageUrl) new Image().src = c.imageUrl;
  }, [cards]);

  // Animations réduites : l'ouverture se joue quand même (paquet, découpe, vidéo) ; seuls les
  // mouvements secondaires sont adoucis (`openingPlan`). Elle était sautée : bug en prod.
  const [plan, setPlan] = useState(() => openingPlan(false));
  useEffect(() => {
    setPlan(openingPlan(matchMedia("(prefers-reduced-motion: reduce)").matches));
  }, []);

  // Échap ferme l'écran, sauf quand une carte est ouverte en grand (`CardZoom`, dialogue) : Échap
  // ne ferme alors que la carte, comme dans le Potodex.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || root.current?.querySelector("dialog[open]")) return;
      onClose();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onClose]);

  // Sous le paquet 3D, la vidéo attend sur l'image du relais (cachée : voir `.tcg-opening-video`).
  // Elle n'est montée qu'une fois la taille de l'écran connue, parfois après `src` : on la cale
  // quand elle apparaît, sinon elle restait à 0 s et le relais repartait de la vue d'ensemble.
  const videoMounted = src !== null && view !== null;
  useEffect(() => {
    const v = video.current;
    if (!videoMounted || !v) return;
    const ready = () => {
      v.currentTime = VIDEO_START;
      v.playbackRate = VIDEO_RATE;
    };
    if (v.readyState >= 1) ready();
    else v.addEventListener("loadedmetadata", ready, { once: true });
    return () => v.removeEventListener("loadedmetadata", ready);
  }, [videoMounted]);

  // Pendant la vidéo : bruitages calés sur l'image, puis relais aux vraies cartes.
  useEffect(() => {
    const v = video.current;
    if (phase !== "video" || !v) return;
    let next = LAND_AT.findIndex((at) => at > v.currentTime);
    let frame = 0;
    const tick = () => {
      for (let at = LAND_AT[next]; at !== undefined && v.currentTime >= at; at = LAND_AT[next]) {
        landSound();
        next++;
      }
      if (v.currentTime >= VIDEO_DONE || v.ended) setPhase("cards");
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  // Fin de la vidéo ; le modèle 3D, libéré au relais, est rechargé pour « Ouvrir un autre paquet ».
  useEffect(() => {
    if (phase !== "cards") return;
    video.current?.pause();
    void loadScene().then((m) => m.preloadPack(packUrl(assetsBase)));
  }, [phase, assetsBase]);

  const onZoomed = useCallback(() => {
    const v = video.current;
    if (!v) return;
    // Le canevas 3D ne disparaît qu'une fois la vidéo réellement lancée (son image affichée
    // dessous, identique au paquet).
    const show = () => setPhase("video");
    if (typeof v.requestVideoFrameCallback === "function") v.requestVideoFrameCallback(show);
    else (v as HTMLVideoElement).addEventListener("playing", show, { once: true });
    // Filet : le relais part toujours du plan serré, jamais du début de la vidéo.
    if (Math.abs(v.currentTime - VIDEO_START) > 0.05) v.currentTime = VIDEO_START;
    v.playbackRate = VIDEO_RATE;
    v.play().catch(show);
    openSound();
  }, []);

  const onCut = useCallback(() => setPhase("zoom"), []);
  const onReady = useCallback(() => setPackReady(true), []);
  const onGrab = useCallback(() => {
    const now = performance.now();
    if (now - lastGrab.current > 700) grabSound();
    lastGrab.current = now;
  }, []);

  const frame = view && videoFrame(view);
  const slots = view && cardSlots(view);
  const done = cards !== null && revealed >= cards.length;

  return (
    <div
      ref={root}
      role="region"
      aria-label="Ouverture d'un paquet"
      // Les auras des cartes s'éteignent avant ce cadre, qui les découpe (`CardAura`).
      data-aura-bounds=""
      className={`tcg-opening relative w-full overflow-hidden rounded-xl select-none ${className ?? ""}`}
      style={{ background: OPENING_BG }}
    >
      <GameCardDefs />
      {src && frame && (
        <video
          ref={video}
          src={src}
          muted
          playsInline
          preload="auto"
          className="tcg-opening-video absolute"
          data-hidden={phase === "cards" ? "" : undefined}
          // Avant la découpe, la vidéo (calée sur le plan serré) ne se montre jamais : tant que
          // le paquet 3D n'était pas dessiné, on voyait le paquet « zoomé à mort ». Pendant
          // l'approche, le canevas opaque la couvre ; elle apparaît au relais.
          data-waiting={phase === "pack" ? "" : undefined}
          // Relais aux vraies cartes, même si l'affichage est ralenti (onglet en arrière-plan).
          onTimeUpdate={(e) => {
            if (phase === "video" && e.currentTarget.currentTime >= VIDEO_DONE) setPhase("cards");
          }}
          onEnded={() => setPhase("cards")}
          style={{
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,
            objectFit: "fill",
          }}
        />
      )}

      {frame && (phase === "pack" || phase === "zoom") && (
        <div
          className="absolute"
          style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
        >
          <Suspense fallback={null}>
            <PackScene
              url={packUrl(assetsBase)}
              zooming={phase === "zoom"}
              onReady={onReady}
              onCut={onCut}
              onZoomed={onZoomed}
              onGrab={onGrab}
              onTear={tearSound}
              float={plan.packFloat}
            />
          </Suspense>
        </div>
      )}

      {phase === "pack" && <PackHints ready={packReady} />}

      {phase === "cards" &&
        frame &&
        slots &&
        slots.map((slot, i) => {
          if (!VIDEO_CARDS[i]) return null;
          const from = plan.fromVideo ? videoCard(frame, i) : null;
          return (
            <OpeningCard
              key={i}
              opened={cards?.[i] ?? null}
              from={from}
              to={slot}
              setSize={setSize}
              onReveal={() => setRevealed((n) => n + 1)}
              faceDelay={i}
              fontClass={className}
            />
          );
        })}

      <div className="absolute top-3 right-3 flex gap-2">
        {phase === "video" && (
          <button type="button" className="tcg-opening-button" onClick={() => setPhase("cards")}>
            Passer
          </button>
        )}
        <button type="button" className="tcg-opening-button" onClick={onClose}>
          Fermer
        </button>
      </div>

      {phase === "cards" && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-3">
          {done ? (
            onAgain && (
              <button type="button" className="tcg-opening-button" data-primary onClick={onAgain}>
                Ouvrir un autre paquet
              </button>
            )
          ) : (
            <p className="text-sm text-white/85">
              {cards ? "Clique sur une carte pour la retourner." : "Tirage des cartes…"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
