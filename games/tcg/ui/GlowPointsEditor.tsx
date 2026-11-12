"use client";

import { Trash2 } from "lucide-react";
import { type PointerEvent, useRef, useState } from "react";
import { GLOW_LIMITS, type GlowPoint } from "../src/card-rules";

/** Couleur d'un nouveau point : un vert lumineux. */
const DEFAULT_COLOR = "#7cff6b";

/** Arrondi au dixième de % : assez fin pour viser un œil. */
const round = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;

/**
 * Pose des points lumineux sur l'image entière (non rognée) : un clic sur l'image ajoute un point
 * (jusqu'à `GLOW_LIMITS.points`), un glisser le déplace, un clic sur un point le choisit. Le point
 * choisi se règle : couleur, taille du halo (en % de la largeur de l'image), vitesse de
 * clignotement (0 : fixe). Les positions sont en % de l'image : accrochées à elle, elles suivent
 * le cadrage, le zoom et la mise en page sur la carte.
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
  const dragging = useRef<number | null>(null);
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
        Points lumineux : clique sur l&apos;image pour en poser un, glisse-le pour le déplacer.
      </p>
      <div
        ref={box}
        className="relative w-full cursor-crosshair touch-none overflow-hidden rounded-md select-none"
        onPointerDown={(e) => {
          // Clic sur l'image (pas sur un point) : nouveau point.
          if (e.target !== e.currentTarget && !(e.target instanceof HTMLImageElement)) return;
          if (points.length >= GLOW_LIMITS.points) return;
          const pos = at(e);
          const next = [
            ...points,
            {
              ...pos,
              size: GLOW_LIMITS.size.default,
              color: current?.color ?? DEFAULT_COLOR,
              speed: 0,
            },
          ];
          onChange(next);
          setSelected(next.length - 1);
        }}
        onPointerMove={(e) => {
          if (dragging.current !== null) update(dragging.current, at(e));
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
        onPointerCancel={() => {
          dragging.current = null;
        }}
      >
        <img src={imageUrl} alt="" draggable={false} className="block h-auto w-full" />
        {points.map((p, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Point lumineux ${i + 1}`}
            aria-pressed={selected === i}
            onPointerDown={(e) => {
              e.stopPropagation();
              setSelected(i);
              dragging.current = i;
              box.current?.setPointerCapture(e.pointerId);
            }}
            className="absolute size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              borderColor: selected === i ? "#fff" : p.color,
              background: `${p.color}88`,
              boxShadow: `0 0 8px ${p.color}`,
            }}
          />
        ))}
      </div>
      {points.length >= GLOW_LIMITS.points && (
        <p className="text-muted text-xs">{GLOW_LIMITS.points} points au plus.</p>
      )}
      {current && selected !== null && (
        <div className="flex flex-col gap-2 text-sm">
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
            <span className="w-24 shrink-0">Taille</span>
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
              Clignotement {current.speed === 0 ? "(fixe)" : `(${current.speed})`}
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
