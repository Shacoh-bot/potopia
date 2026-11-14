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
import { flipSound, grabSound, landSound, openSound, tearSound } from "./booster-sounds";
import { CardBack } from "./CardBack";
import { GameCard, GameCardDefs, type GameCardFields } from "./GameCard";
import { OPENING_BG } from "./opening";

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
const ASSETS_VERSION = 4;

/** Modèle 3D du paquet. */
const packUrl = (base: string) => `${base}/paquet.glb?v=${ASSETS_VERSION}`;

/**
 * Précharge l'écran d'ouverture (code 3D, modèle, vidéo) : à appeler dès que le joueur peut
 * ouvrir un paquet, pour que tout s'affiche aussitôt au clic.
 */
export function preloadBoosterOpening(assetsBase = "/tcg/ouverture") {
  void loadScene().then((m) => m.preloadPack(packUrl(assetsBase)));
  void fetch(videoSource(assetsBase)).catch(() => {});
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
}: {
  /** null tant que le tirage n'est pas arrivé : la carte reste de dos. */
  opened: OpenedCard | null;
  /** Où la carte est sur la vidéo, d'où elle part. */
  from: Rect | null;
  to: Rect;
  setSize?: number;
  onReveal: () => void;
}) {
  const [placed, setPlaced] = useState(from === null);
  const [side, setSide] = useState<"back" | "face">("back");
  // Fin du demi-tour : la face suit la souris (inclinaison, reflets).
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (placed) return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setPlaced(true)));
    return () => cancelAnimationFrame(frame);
  }, [placed]);

  // La carte est dessinée à sa taille finale ; au départ, une transformation la pose sur celle de
  // la vidéo, puis elle glisse à sa place.
  const start =
    from && !placed
      ? `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})`
      : "none";

  function reveal() {
    if (side !== "back" || !opened) return;
    setSide("face");
    flipSound(opened.card.rarity);
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
      <button
        type="button"
        className="tcg-opening-card"
        data-side={side}
        data-settled={settled ? "" : undefined}
        data-rarity={opened?.card.rarity}
        aria-busy={!opened}
        aria-label={faceUp && opened ? opened.card.name : "Retourner la carte"}
        onClick={reveal}
      >
        <span className="tcg-opening-turn">
          <span className="tcg-opening-side" aria-hidden={faceUp || undefined}>
            <CardBack />
          </span>
          {/* Face montée dès l'arrivée du tirage, de l'autre côté : rien ne s'échange en route. */}
          {opened && (
            <span
              className="tcg-opening-side tcg-opening-face"
              aria-hidden={!faceUp || undefined}
              style={{ pointerEvents: settled ? undefined : "none" }}
            >
              <span style={{ display: "block", width: CARD_WIDTH, zoom: to.width / CARD_WIDTH }}>
                <GameCard card={opened.card} imageUrl={opened.imageUrl} setSize={setSize} />
              </span>
            </span>
          )}
        </span>
      </button>
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
  const [fromVideo, setFromVideo] = useState(true);
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

  // Animations réduites : directement les 5 cartes.
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFromVideo(false);
      setPhase("cards");
    }
  }, []);

  // Échap ferme.
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
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
            />
          </Suspense>
        </div>
      )}

      {phase === "pack" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-4">
          {packReady && <PackHelp />}
          <p
            className="tcg-opening-hint text-center text-xs text-white/85 sm:text-sm"
            aria-live="polite"
          >
            {packReady
              ? "Glisse le long de la ligne pointillée pour découper le paquet."
              : "Chargement du paquet…"}
          </p>
        </div>
      )}

      {phase === "cards" &&
        frame &&
        slots &&
        slots.map((slot, i) => {
          const v = VIDEO_CARDS[i];
          if (!v) return null;
          const from = fromVideo
            ? {
                left: frame.left + v.x * frame.scale,
                top: frame.top + v.y * frame.scale,
                width: v.width * frame.scale,
                height: v.height * frame.scale,
              }
            : null;
          return (
            <OpeningCard
              key={i}
              opened={cards?.[i] ?? null}
              from={from}
              to={slot}
              setSize={setSize}
              onReveal={() => setRevealed((n) => n + 1)}
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
