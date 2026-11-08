"use client";

import { type ComponentType, useRef } from "react";

/*
 * Effets visuels des cartes : le rendu (CSS de tcg.css, section « Effets visuels », et JS ici) de
 * chaque effet du catalogue `tcg.visual_effects`, sous la même clé. La base ne garde que la clé et
 * le nom affiché dans la fiche.
 *
 * Ajouter un effet :
 * 1. une migration qui insère sa ligne (`INSERT INTO "tcg"."visual_effects" ("key", "name")`) ;
 * 2. son composant ci-dessous, ajouté à `VISUAL_EFFECTS` sous la même clé ;
 * 3. ses styles dans tcg.css (classes `tcg-vfx-…`), coupés avec `prefers-reduced-motion`.
 *
 * Un effet est un calque posé sur toute la carte (au-dessus des encadrés, sous le coût et la
 * puissance), rogné à ses coins arrondis, qui ne capte jamais le pointeur. Sur les planches
 * (`still`), tcg.css coupe toutes les animations : l'effet doit rester joli à l'arrêt.
 */

type EffectProps = {
  /** Carte figée (planches) : pas d'animation, l'effet doit tenir en image fixe. */
  still: boolean;
};

/** Reflet holographique : un arc-en-ciel qui balaie la carte en diagonale (CSS seul). */
function Holo() {
  return <div className="tcg-vfx-holo" />;
}

/** Tirage pseudo-aléatoire déterministe : même rendu côté serveur et navigateur. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const SPARKS = (() => {
  const rnd = seeded(7);
  return Array.from({ length: 16 }, () => ({
    x: 6 + rnd() * 88,
    y: 6 + rnd() * 88,
    size: 5 + rnd() * 7,
    delay: rnd() * 2.4,
    duration: 1.6 + rnd() * 1.4,
  }));
})();

/**
 * Étincelles : des éclats en étoile qui scintillent. Placés au départ de façon déterministe, puis
 * déplacés au hasard en JS à la fin de chaque scintillement (`animationiteration`).
 */
function Sparkles({ still }: EffectProps) {
  const rnd = useRef(Math.random);
  return (
    <>
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="tcg-vfx-spark"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
          onAnimationIteration={
            still
              ? undefined
              : (e) => {
                  e.currentTarget.style.left = `${6 + rnd.current() * 88}%`;
                  e.currentTarget.style.top = `${6 + rnd.current() * 88}%`;
                }
          }
        />
      ))}
    </>
  );
}

/** Rendu de chaque effet, par clé du catalogue. */
export const VISUAL_EFFECTS: Record<string, ComponentType<EffectProps>> = {
  holo: Holo,
  etincelles: Sparkles,
};

/** L'effet visuel d'une carte ; rien si la clé est vide ou que son rendu n'est pas (encore) codé. */
export function VisualEffectLayer({
  effectKey,
  still = false,
}: {
  effectKey: string | null | undefined;
  still?: boolean;
}) {
  const Effect = effectKey ? VISUAL_EFFECTS[effectKey] : undefined;
  if (!Effect) return null;
  return (
    <div className="tcg-vfx" aria-hidden data-effect={effectKey}>
      <Effect still={still} />
    </div>
  );
}
