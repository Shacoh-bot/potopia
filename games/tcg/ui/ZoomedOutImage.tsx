"use client";

import { useCallback, useState } from "react";
import type { ImageFrame } from "../src/card-rules";
import { useSharpSrc } from "./SharpImage";
import { zoomedOutStyle } from "./zoomed-out";

/**
 * Image dézoomée d'une carte. Ses proportions ne se connaissent qu'une fois chargée (lues aussi au
 * montage : une image chargée avant l'hydratation ne déclenche plus `onLoad`) ; d'ici là, elle reste
 * invisible et seul le fond flou (`ArtBackdrop`) se voit.
 */
export function ZoomedOutImage({
  src: small,
  large,
  alt,
  frame,
}: {
  src: string;
  /** Grande version, chargée quand la carte s'affiche en grand (`useSharpSrc`). */
  large?: string | null;
  alt: string;
  frame: ImageFrame;
}) {
  const [ratio, setRatio] = useState<number | null>(null);
  const { src, ref: sharpRef } = useSharpSrc(small, large);
  const read = useCallback(
    (img: HTMLImageElement | null) => {
      sharpRef(img);
      if (!img?.complete || !img.naturalWidth || !img.naturalHeight) return;
      const next = img.naturalWidth / img.naturalHeight;
      setRatio((r) => (r === next ? r : next));
    },
    [sharpRef],
  );
  return (
    <img
      ref={read}
      src={src}
      alt={alt}
      draggable={false}
      decoding="async"
      onLoad={(e) => read(e.currentTarget)}
      style={
        ratio
          ? zoomedOutStyle(frame, ratio)
          : { position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0 }
      }
    />
  );
}
