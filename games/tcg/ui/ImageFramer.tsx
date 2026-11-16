"use client";

import { useRef, useState } from "react";
import { DEFAULT_FRAME, FRAME_ZOOM, fitZoom, type ImageFrame } from "../src/card-rules";
import { ArtBackdrop, frameStyle, isZoomedOut } from "./cards";
import { framePointShift } from "./frame-drag";

type Props = {
  imageUrl: string;
  frame: ImageFrame;
  onChange: (frame: ImageFrame) => void;
  /** Taille de la fenêtre d'illustration montrée (proportions de la carte normale ou full art). */
  width: number;
  height: number;
  /**
   * Zoom le plus petit permis : sous 1, on peut dézoomer jusqu'à voir l'image entière (carte
   * normale, `FRAME_ZOOM.min`) ; la full art reste à 1 au moins (par défaut).
   */
  minZoom?: number;
};

type Size = { width: number; height: number };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const tenth = (v: number) => Math.round(v * 10) / 10;

/**
 * Cadrage d'une illustration : on fait glisser l'image dans la fenêtre pour choisir ce qui se voit,
 * et on zoome avec le curseur. Sous 1, l'image rétrécit et la même image floutée remplit le vide ;
 * « Image entière » la fait tenir toute dans la fenêtre. L'image elle-même n'est pas rognée.
 */
export function ImageFramer({
  imageUrl,
  frame,
  onChange,
  width,
  height,
  minZoom = FRAME_ZOOM.fullMin,
}: Props) {
  const drag = useRef<{ x: number; y: number; frame: ImageFrame } | null>(null);
  // Taille réelle de l'image, connue une fois chargée (pour suivre la souris au pixel près).
  const [natural, setNatural] = useState<Size | null>(null);

  function move(clientX: number, clientY: number) {
    const start = drag.current;
    if (!start) return;
    const { zoom } = start.frame;
    let dx: number;
    let dy: number;
    if (natural) {
      // object-fit: cover : taille de l'image dans la fenêtre avant le zoom.
      const cover = Math.max(width / natural.width, height / natural.height);
      dx = framePointShift(clientX - start.x, width, natural.width * cover, zoom);
      dy = framePointShift(clientY - start.y, height, natural.height * cover, zoom);
    } else {
      dx = -((clientX - start.x) / width) * (100 / zoom);
      dy = -((clientY - start.y) / height) * (100 / zoom);
    }
    onChange({
      ...start.frame,
      x: tenth(clamp(start.frame.x + dx, 0, 100)),
      y: tenth(clamp(start.frame.y + dy, 0, 100)),
    });
  }

  function zoom(value: number) {
    onChange({
      ...frame,
      zoom: Math.round(clamp(value, minZoom, FRAME_ZOOM.max) * 100) / 100,
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="application"
        aria-label="Cadrage de l'illustration : glisser pour déplacer"
        className="border-border relative cursor-grab touch-none overflow-hidden rounded-lg border active:cursor-grabbing"
        style={{ width, height }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, frame };
        }}
        onPointerMove={(e) => move(e.clientX, e.clientY)}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <ArtBackdrop src={imageUrl} frame={frame} />
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          className="pointer-events-none block size-full select-none"
          style={{ objectFit: "cover", ...frameStyle(frame) }}
          onLoad={(e) =>
            setNatural({
              width: e.currentTarget.naturalWidth,
              height: e.currentTarget.naturalHeight,
            })
          }
        />
      </div>
      <div className="flex w-full items-center gap-2 text-sm" style={{ maxWidth: width }}>
        <label className="text-muted flex min-w-0 flex-1 items-center gap-2">
          Zoom
          <input
            type="range"
            min={minZoom}
            max={FRAME_ZOOM.max}
            step={0.05}
            value={frame.zoom}
            onChange={(e) => zoom(Number(e.target.value))}
            className="min-w-0 flex-1"
          />
        </label>
        <button
          type="button"
          className="text-accent shrink-0 whitespace-nowrap underline-offset-4 hover:underline"
          onClick={() => onChange(DEFAULT_FRAME)}
        >
          Recentrer
        </button>
      </div>
      {minZoom < 1 && (
        <div className="flex w-full items-center gap-2 text-sm" style={{ maxWidth: width }}>
          <button
            type="button"
            disabled={!natural}
            className="text-accent shrink-0 whitespace-nowrap underline-offset-4 hover:underline disabled:opacity-50"
            onClick={() =>
              natural && onChange({ x: 50, y: 50, zoom: fitZoom({ width, height }, natural) })
            }
          >
            Image entière
          </button>
          {isZoomedOut(frame) && (
            <span className="text-muted text-xs">
              Le vide autour est rempli par l&apos;image floutée.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
