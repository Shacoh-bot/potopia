"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { needsLarger } from "./sharp";

/**
 * Source d'une illustration qui commence par sa version réduite (`small`) et passe à la grande
 * (`large`) dès que la carte s'affiche assez grand pour qu'elle paraisse floue : carte agrandie,
 * écran haute densité, cadrage zoomé. La taille se mesure à l'écran (zooms et transformations
 * compris) au chargement, peu après (cartes qui grandissent à l'ouverture d'un booster) et quand la
 * fenêtre change. Sans `large`, rien ne change.
 */
export function useSharpSrc(small: string, large: string | null | undefined) {
  const [src, setSrc] = useState(small);
  const img = useRef<HTMLImageElement | null>(null);
  const check = useCallback(() => {
    const el = img.current;
    if (!large || !el?.complete || !el.naturalWidth) return;
    const { width, height } = el.getBoundingClientRect();
    const natural = { width: el.naturalWidth, height: el.naturalHeight };
    if (needsLarger({ width, height }, natural, window.devicePixelRatio || 1)) setSrc(large);
  }, [large]);
  useEffect(() => {
    if (!large) return;
    const timers = [300, 1000, 2500].map((ms) => setTimeout(check, ms));
    window.addEventListener("resize", check);
    return () => {
      for (const t of timers) clearTimeout(t);
      window.removeEventListener("resize", check);
    };
  }, [check, large]);
  const ref = useCallback(
    (el: HTMLImageElement | null) => {
      img.current = el;
      check();
    },
    [check],
  );
  return { src, ref, onLoad: check };
}

/** Illustration (version réduite, puis grande au besoin : `useSharpSrc`), cadrée par `style`. */
export function SharpImage({
  small,
  large,
  alt,
  style,
}: {
  small: string;
  large: string | null | undefined;
  alt: string;
  style: CSSProperties;
}) {
  const { src, ref, onLoad } = useSharpSrc(small, large);
  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      // Les planches montrent des dizaines de cartes : on ne charge que celles qu'on voit.
      loading="lazy"
      decoding="async"
      onLoad={onLoad}
      style={style}
    />
  );
}
