"use client";

import { Trash2 } from "lucide-react";
import { type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  GLOW_KIND_LABELS,
  GLOW_KINDS,
  GLOW_LIMITS,
  type GlowKind,
  glowKind,
  type GlowPoint,
} from "../src/card-rules";

/** Couleur d'un nouveau point : un vert lumineux. */
const DEFAULT_COLOR = "#7cff6b";

/** Réglages d'une nouvelle lumière, selon son type. */
const NEW_LIGHT: Record<GlowKind, { size: number; speed: number }> = {
  glow: { size: GLOW_LIMITS.size.default, speed: 0 },
  sparks: { size: 8, speed: 5 },
  rays: { size: 10, speed: 2 },
  line: { size: 1.5, speed: 3 },
};

/** Zoom de l'image pour viser : de 1 (image entière) à 5. */
const ZOOM = { min: 1, max: 5 } as const;

/** Arrondi au dixième de % : assez fin pour viser un œil. */
const round = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;

/**
 * Pose des lumières sur l'image entière (non rognée) : on choisit le type (point lumineux,
 * étincelles, rayons, trait), un clic sur l'image en pose une (jusqu'à `GLOW_LIMITS.points`), un
 * glisser déplace sa poignée (un trait en a deux, une par extrémité), un clic la choisit. La
 * lumière choisie se règle : couleur, taille (en % de la largeur de l'image), vitesse (0 :
 * immobile). Les positions sont en % de l'image : accrochées à elle, elles suivent
 * le cadrage, le zoom et la mise en page sur la carte. Pour viser, l'image se zoome (curseur, ou
 * molette autour du pointeur) et se parcourt en la glissant (ou aux barres de défilement) ; un clic
 * sans glisser pose un point. Les repères gardent leur taille.
 */
export function GlowPointsEditor({
  imageUrl,
  points,
  onChange,
}: {
  imageUrl: string;
  points: GlowPoint[];
  onChange: (points: GlowPoint[]) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // Poignée qu'on glisse : la lumière et l'extrémité (2 : la seconde d'un trait).
  const dragging = useRef<{ i: number; end: 1 | 2 } | null>(null);
  const [kind, setKind] = useState<GlowKind>("glow");
  const view = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(ZOOM.min);
  const zoomNow = useRef(zoom);
  zoomNow.current = zoom;
  // Point de l'image à garder sous un même endroit de la vue pendant un zoom : sa place dans
  // l'image (fraction) et dans la vue (px). Par défaut, le centre de la vue.
  const anchor = useRef<{ fx: number; fy: number; vx: number; vy: number } | null>(null);
  // Glisser sur l'image : déplacement de la vue (un clic sans bouger pose un point).
  const pan = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(
    null,
  );
  const [panning, setPanning] = useState(false);

  /** Zoome en gardant fixe le point de la vue `at` (px dans la vue ; par défaut, son centre). */
  function zoomTo(next: number, at?: { vx: number; vy: number }) {
    const v = view.current;
    const clamped = Math.min(ZOOM.max, Math.max(ZOOM.min, Math.round(next * 100) / 100));
    if (v) {
      const vx = at?.vx ?? v.clientWidth / 2;
      const vy = at?.vy ?? v.clientHeight / 2;
      anchor.current = {
        fx: (v.scrollLeft + vx) / v.scrollWidth,
        fy: (v.scrollTop + vy) / v.scrollHeight,
        vx,
        vy,
      };
    }
    setZoom(clamped);
  }

  useLayoutEffect(() => {
    const v = view.current;
    const a = anchor.current;
    if (!v || !a) return;
    v.scrollLeft = a.fx * v.scrollWidth - a.vx;
    v.scrollTop = a.fy * v.scrollHeight - a.vy;
    anchor.current = null;
  }, [zoom]);

  // Molette : zoom et dézoom autour du pointeur (écouteur non passif pour bloquer le défilement
  // de la page).
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = v.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomTo(zoomNow.current * factor, { vx: e.clientX - r.left, vy: e.clientY - r.top });
    };
    v.addEventListener("wheel", onWheel, { passive: false });
    return () => v.removeEventListener("wheel", onWheel);
  }, []);
  const current = selected !== null ? points[selected] : undefined;

  /** Position du pointeur en % de l'image. */
  function at(e: PointerEvent): { x: number; y: number } {
    const r = box.current?.getBoundingClientRect();
    if (!r) return { x: 50, y: 50 };
    return {
      x: round(((e.clientX - r.left) / r.width) * 100),
      y: round(((e.clientY - r.top) / r.height) * 100),
    };
  }

  function update(i: number, patch: Partial<GlowPoint>) {
    onChange(points.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-muted text-sm">
        Choisis un type, puis clique sur l&apos;image pour poser une lumière ; glisse une poignée
        pour la déplacer. Molette : zoom ; glisser l&apos;image : se déplacer.
      </p>
      <div
        role="radiogroup"
        aria-label="Type de lumière à poser"
        className="flex flex-wrap gap-1.5"
      >
        {GLOW_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={
              kind === k
                ? "border-accent text-text rounded-full border px-2.5 py-0.5 text-xs"
                : "border-border text-muted hover:text-text rounded-full border px-2.5 py-0.5 text-xs"
            }
          >
            {GLOW_KIND_LABELS[k].name}
          </button>
        ))}
      </div>
      <label className="text-muted flex items-center gap-2 text-sm">
        <span className="w-24 shrink-0">Zoom ×{zoom.toFixed(1)}</span>
        <input
          type="range"
          min={ZOOM.min}
          max={ZOOM.max}
          step={0.1}
          value={zoom}
          onChange={(e) => zoomTo(Number(e.target.value))}
          className="min-w-0 flex-1"
        />
      </label>
      {/* Vue de l'image : défile quand elle est zoomée. */}
      <div ref={view} className="max-h-[360px] w-full overflow-auto rounded-md">
        <div
          ref={box}
          className={`relative touch-none select-none ${panning ? "cursor-grabbing" : "cursor-crosshair"}`}
          style={{ width: `${zoom * 100}%` }}
          onPointerDown={(e) => {
            // Sur l'image (pas sur un point) : glisser déplace la vue, un clic pose un point.
            if (e.target !== e.currentTarget && !(e.target instanceof HTMLImageElement)) return;
            const v = view.current;
            if (!v) return;
            pan.current = {
              x: e.clientX,
              y: e.clientY,
              left: v.scrollLeft,
              top: v.scrollTop,
              moved: false,
            };
            box.current?.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = dragging.current;
            if (d) {
              const pos = at(e);
              return update(d.i, d.end === 1 ? pos : { x2: pos.x, y2: pos.y });
            }
            const p = pan.current;
            const v = view.current;
            if (!p || !v) return;
            const dx = e.clientX - p.x;
            const dy = e.clientY - p.y;
            // Quelques px de tolérance : un clic qui tremble reste un clic.
            if (!p.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
            if (!p.moved) setPanning(true);
            p.moved = true;
            v.scrollLeft = p.left - dx;
            v.scrollTop = p.top - dy;
          }}
          onPointerUp={(e) => {
            dragging.current = null;
            const p = pan.current;
            pan.current = null;
            setPanning(false);
            // Clic sans glisser : nouvelle lumière du type choisi à cet endroit (un trait part
            // de là, vers la droite).
            if (!p || p.moved || points.length >= GLOW_LIMITS.points) return;
            const pos = at(e);
            const light: GlowPoint = {
              ...(kind === "glow" ? {} : { kind }),
              ...pos,
              ...(kind === "line" ? { x2: Math.min(100, pos.x + 15), y2: pos.y } : {}),
              ...NEW_LIGHT[kind],
              color: current?.color ?? DEFAULT_COLOR,
            };
            const next = [...points, light];
            onChange(next);
            setSelected(next.length - 1);
          }}
          onPointerCancel={() => {
            dragging.current = null;
            pan.current = null;
            setPanning(false);
          }}
        >
          <img src={imageUrl} alt="" draggable={false} className="block h-auto w-full" />
          {/* Trait entre les deux poignées d'un trait lumineux. */}
          <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
            {points.map((p, i) =>
              glowKind(p) === "line" ? (
                <line
                  key={i}
                  x1={`${p.x}%`}
                  y1={`${p.y}%`}
                  x2={`${p.x2 ?? p.x}%`}
                  y2={`${p.y2 ?? p.y}%`}
                  stroke={p.color}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              ) : null,
            )}
          </svg>
          {points.flatMap((p, i) => {
            const k = glowKind(p);
            const ends: (1 | 2)[] = k === "line" ? [1, 2] : [1];
            return ends.map((end) => (
              <button
                key={`${i}-${end}`}
                type="button"
                aria-label={`${GLOW_KIND_LABELS[k].name} ${i + 1}${k === "line" ? `, extrémité ${end}` : ""}`}
                aria-pressed={selected === i}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelected(i);
                  dragging.current = { i, end };
                  box.current?.setPointerCapture(e.pointerId);
                }}
                className={`absolute size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab border-2 ${
                  k === "sparks" ? "rotate-45" : k === "line" ? "rounded-sm" : "rounded-full"
                } ${k === "rays" ? "border-dashed" : ""}`}
                style={{
                  left: `${end === 1 ? p.x : (p.x2 ?? p.x)}%`,
                  top: `${end === 1 ? p.y : (p.y2 ?? p.y)}%`,
                  borderColor: selected === i ? "#fff" : p.color,
                  background: `${p.color}88`,
                  boxShadow: `0 0 8px ${p.color}`,
                }}
              />
            ));
          })}
        </div>
      </div>
      {points.length >= GLOW_LIMITS.points && (
        <p className="text-muted text-xs">{GLOW_LIMITS.points} lumières au plus.</p>
      )}
      {current && selected !== null && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-text text-xs font-medium">
            {GLOW_KIND_LABELS[glowKind(current)].name} {selected + 1}
          </p>
          <div className="flex items-center gap-3">
            <label className="text-muted flex items-center gap-2">
              Couleur
              <input
                type="color"
                value={current.color}
                onChange={(e) => update(selected, { color: e.target.value })}
                className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                onChange(points.filter((_, j) => j !== selected));
                setSelected(null);
              }}
              className="text-muted hover:text-danger ml-auto flex items-center gap-1 text-xs"
            >
              <Trash2 size={14} aria-hidden />
              Supprimer
            </button>
          </div>
          <label className="text-muted flex items-center gap-2">
            <span className="w-24 shrink-0">{GLOW_KIND_LABELS[glowKind(current)].size}</span>
            <input
              type="range"
              min={GLOW_LIMITS.size.min}
              max={GLOW_LIMITS.size.max}
              step={0.5}
              value={current.size}
              onChange={(e) => update(selected, { size: Number(e.target.value) })}
              className="min-w-0 flex-1"
            />
          </label>
          <label className="text-muted flex items-center gap-2">
            <span className="w-24 shrink-0">
              {GLOW_KIND_LABELS[glowKind(current)].speed}{" "}
              {current.speed === 0 ? "(arrêt)" : `(${current.speed})`}
            </span>
            <input
              type="range"
              min={GLOW_LIMITS.speed.min}
              max={GLOW_LIMITS.speed.max}
              step={1}
              value={current.speed}
              onChange={(e) => update(selected, { speed: Number(e.target.value) })}
              className="min-w-0 flex-1"
            />
          </label>
        </div>
      )}
    </div>
  );
}
