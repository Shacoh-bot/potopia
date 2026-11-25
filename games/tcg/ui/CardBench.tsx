"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { CARD_RARITIES, CARD_RARITY_LABELS, type CardRarityId } from "../src/card-rules";
import { CardAura, hasAura } from "./CardAura";
import { CardBack } from "./CardBack";
import { GameCard, GameCardDefs, type GameCardFields } from "./GameCard";
import { RETIRED_EFFECTS } from "./effect-places";
import { H, W } from "./v2";
import type { TopLayout } from "./v4";
import { VISUAL_EFFECTS } from "./visual-effects";

/** Une carte prête à afficher (comme `cardFaces` de l'app la prépare). */
export type BenchCard = { card: GameCardFields; imageUrl: string | null; setSize?: number };

type Mode = "une" | "rangee" | "planche";

/**
 * Strates que le banc peut couper (attribut `data-sans` du banc, règles `.tcg-bench` de tcg.css).
 * Couper une strate ne change que l'affichage du banc : aucune donnée n'est écrite.
 */
export const BENCH_STRATES: { key: string; label: string; hint: string }[] = [
  { key: "incl", label: "Inclinaison", hint: "la carte ne pivote plus au survol" },
  { key: "holo", label: "Holo", hint: "reflets irisés de la rareté et de l'effet holo" },
  { key: "effets", label: "Effets visuels", hint: "tous les effets du catalogue" },
  { key: "cadre", label: "Cadre", hint: "bordure de rareté et ses lumières" },
  { key: "filets", label: "Filets dorés", hint: "contours des encadrés" },
  { key: "bandeau", label: "Bandeau du nom", hint: "titre de la carte" },
  { key: "encadres", label: "Encadrés", hint: "type et texte" },
  { key: "pied", label: "Pied", hint: "rareté, numéro, idée de…" },
  { key: "pastilles", label: "Coût et puissance", hint: "pastilles des coins" },
  { key: "halo", label: "Halo de survol", hint: "hors booster" },
  { key: "fusions", label: "Fusions (blend)", hint: "mix-blend-mode neutralisé partout" },
  { key: "filtres", label: "Filtres", hint: "filter et backdrop-filter retirés" },
  { key: "masques", label: "Masques", hint: "mask-image retiré" },
  { key: "anims", label: "Animations", hint: "toutes en pause" },
];

const EFFECT_KEYS = Object.keys(VISUAL_EFFECTS).filter((k) => !RETIRED_EFFECTS.includes(k));

/** Durée du demi-tour du booster (`tcg-flip-out` puis `tcg-flip-in`, 0,62 s), plus une marge. */
const FLIP_MS = 650;

/**
 * Banc d'essai des cartes (admin) : une carte, une rangée de 5 comme à l'ouverture d'un booster
 * (auras, face retournable, `zoom`), ou une planche de 40 comme le Potodex. Rareté, version et
 * effets peuvent être forcés ; chaque strate se coupe à part ; un compteur donne les images par
 * seconde et les images longues. Sert à trouver, dans le vrai navigateur de l'admin, la strate qui
 * fait disparaître une partie de la carte ou qui ralentit. Rien n'est écrit.
 */
export function CardBench({ cards }: { cards: BenchCard[] }) {
  const [mode, setMode] = useState<Mode>("une");
  const [index, setIndex] = useState(0);
  const [rarity, setRarity] = useState<CardRarityId | "">("");
  const [layout, setLayout] = useState<TopLayout | "">("");
  const [forceEffects, setForceEffects] = useState(false);
  const [effects, setEffects] = useState<string[]>([]);
  const [off, setOff] = useState<string[]>([]);
  const [booster, setBooster] = useState(true);
  const [zoom, setZoom] = useState(true);
  const [auras, setAuras] = useState(true);
  const [flip, setFlip] = useState(0);

  if (cards.length === 0) return <p className="text-muted text-sm">Aucune carte à afficher.</p>;

  const pick = (n: number) => {
    const face = cards[(index + n) % cards.length] ?? cards[0];
    if (!face) throw new Error("banc vide");
    const card: GameCardFields = {
      ...face.card,
      ...(rarity ? { rarity } : null),
      ...(forceEffects ? { visualEffectKeys: effects, visualEffectKeysFull: effects } : null),
    };
    return { ...face, card };
  };
  const count = mode === "une" ? 1 : mode === "rangee" ? 5 : 40;
  const shown = Array.from({ length: count }, (_, n) => pick(n));
  const forced = layout || undefined;
  const toggle = (list: string[], key: string) =>
    list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

  return (
    <div className="flex flex-col gap-4">
      <GameCardDefs />
      <div className="grid gap-3 text-sm lg:grid-cols-[1fr_1fr_1fr]">
        <fieldset className="flex flex-col gap-2">
          <legend className="font-semibold">Affichage</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["une", "Une carte"],
                ["rangee", "Rangée de 5 (booster)"],
                ["planche", "Planche de 40 (Potodex)"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-full border px-3 py-1 ${mode === m ? "border-accent text-accent" : "border-border text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1">
            Carte (et les suivantes)
            <select
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
              className="border-border bg-surface rounded border px-2 py-1"
            >
              {cards.map((c, i) => (
                <option key={i} value={i}>
                  {c.card.name} ·{" "}
                  {CARD_RARITY_LABELS[c.card.rarity as CardRarityId] ?? c.card.rarity}
                  {c.card.visualEffectKeys?.length
                    ? ` · ${c.card.visualEffectKeys.join(", ")}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              Rareté
              <select
                value={rarity}
                onChange={(e) => setRarity(e.target.value as CardRarityId | "")}
                className="border-border bg-surface rounded border px-2 py-1"
              >
                <option value="">celle de la carte</option>
                {CARD_RARITIES.map((r) => (
                  <option key={r} value={r}>
                    {CARD_RARITY_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1">
              Version
              <select
                value={layout}
                onChange={(e) => setLayout(e.target.value as TopLayout | "")}
                className="border-border bg-surface rounded border px-2 py-1"
              >
                <option value="">celle de la carte</option>
                <option value="normal">normale</option>
                <option value="fullart">full art</option>
              </select>
            </label>
          </div>
          {mode !== "planche" && (
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={booster} onChange={() => setBooster(!booster)} />
                Face de booster (retournable)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={zoom} onChange={() => setZoom(!zoom)} />
                Taille par <code>zoom</code> (sinon <code>transform: scale</code>)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={auras} onChange={() => setAuras(!auras)} />
                Auras
              </label>
              {booster && (
                <button
                  type="button"
                  onClick={() => setFlip((f) => f + 1)}
                  className="border-border self-start rounded border px-3 py-1"
                >
                  Retourner (dos, puis demi-tour)
                </button>
              )}
            </div>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-1">
          <legend className="font-semibold">Strates coupées</legend>
          {BENCH_STRATES.map((s) => (
            <label key={s.key} className="flex items-center gap-2" title={s.hint}>
              <input
                type="checkbox"
                checked={off.includes(s.key)}
                onChange={() => setOff(toggle(off, s.key))}
              />
              {s.label} <span className="text-muted text-xs">({s.hint})</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-1">
          <legend className="font-semibold">Effets</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={forceEffects}
              onChange={() => setForceEffects(!forceEffects)}
            />
            Forcer ces effets (sinon ceux de la carte)
          </label>
          <div className="grid grid-cols-2 gap-x-3">
            {EFFECT_KEYS.map((k) => (
              <label key={k} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  disabled={!forceEffects}
                  checked={effects.includes(k)}
                  onChange={() => setEffects(toggle(effects, k))}
                />
                {k}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <FrameMeter />

      <div className="tcg-bench" data-sans={off.join(" ") || undefined}>
        {mode === "planche" ? (
          <div className="flex flex-wrap gap-3">
            {shown.map((c, n) => (
              <Scaled key={n} scale={160 / W}>
                <GameCard {...c} layout={forced} still />
              </Scaled>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-start gap-6 p-4">
            {shown.map((c, n) => (
              <BenchSlot
                key={`${n}-${flip}`}
                face={c}
                layout={forced}
                width={mode === "une" ? W : 200}
                booster={booster}
                zoom={zoom}
                aura={auras}
                flip={flip > 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Une carte à l'échelle `scale` par `transform`, dans une boîte à sa taille finale. */
function Scaled({ scale, children }: { scale: number; children: ReactNode }) {
  return (
    <div style={{ width: W * scale, height: H * scale }}>
      <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Une case de carte. En face de booster : même balisage et mêmes classes que `BoosterOpening`
 * (retournement, un seul côté visible à la fois, aura derrière), taille par `zoom` ou par
 * `transform`. Avec `flip`, la carte part de dos et fait son demi-tour.
 */
function BenchSlot({
  face,
  layout,
  width,
  booster,
  zoom,
  aura,
  flip,
}: {
  face: BenchCard;
  layout: TopLayout | undefined;
  width: number;
  booster: boolean;
  zoom: boolean;
  aura: boolean;
  flip: boolean;
}) {
  const [side, setSide] = useState<"back" | "face">(flip ? "back" : "face");
  const [settled, setSettled] = useState(!flip);
  useEffect(() => {
    if (!flip) return;
    const turn = window.setTimeout(() => setSide("face"), 400);
    const rest = window.setTimeout(() => setSettled(true), 400 + FLIP_MS);
    return () => {
      window.clearTimeout(turn);
      window.clearTimeout(rest);
    };
  }, [flip]);

  const scale = width / W;
  const card = (
    <GameCard
      card={face.card}
      imageUrl={face.imageUrl}
      setSize={face.setSize}
      layout={layout}
      hoverHalo={!booster}
    />
  );
  const sized = zoom ? (
    <span style={{ display: "block", width: W, zoom: scale }}>{card}</span>
  ) : (
    <span style={{ display: "block", width, height: H * scale }}>
      <span
        style={{
          display: "block",
          width: W,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {card}
      </span>
    </span>
  );
  const showAura = aura && settled && hasAura(face.card.rarity);
  return (
    <div className="tcg-opening-slot relative" style={{ width, height: H * scale }}>
      {showAura && <CardAura rarity={face.card.rarity} />}
      {booster ? (
        <div
          className="tcg-opening-card"
          data-side={side}
          data-settled={settled ? "" : undefined}
          data-rarity={face.card.rarity}
        >
          <span className="tcg-opening-turn">
            <span className="tcg-opening-side">
              <CardBack />
            </span>
            <span
              className="tcg-opening-side tcg-opening-face"
              style={{ pointerEvents: settled ? undefined : "none" }}
            >
              {sized}
            </span>
          </span>
        </div>
      ) : (
        sized
      )}
    </div>
  );
}

/**
 * Compteur d'images : images par seconde sur la dernière seconde, images longues (plus de 50 ms,
 * soit 3 images ratées à 60 i/s) et pire image, depuis la dernière remise à zéro.
 */
function FrameMeter() {
  const out = useRef<HTMLOutputElement>(null);
  const stats = useRef({ long: 0, worst: 0 });
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const times: number[] = [];
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      times.push(now);
      while ((times[0] ?? now) < now - 1000) times.shift();
      const s = stats.current;
      if (dt > 50) s.long += 1;
      s.worst = Math.max(s.worst, dt);
      if (out.current)
        out.current.textContent = `${times.length} i/s · images longues (> 50 ms) : ${s.long} · pire : ${Math.round(s.worst)} ms`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="border-border flex items-center gap-3 rounded border px-3 py-2 text-sm">
      <output ref={out} className="font-mono" aria-live="off">
        …
      </output>
      <button
        type="button"
        onClick={() => {
          stats.current = { long: 0, worst: 0 };
        }}
        className="border-border rounded border px-2 py-0.5"
      >
        Remettre à zéro
      </button>
    </div>
  );
}
