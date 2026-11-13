import { CARD_HEIGHT, CARD_WIDTH } from "@app/tcg/ui";
import type { ReactNode } from "react";

/**
 * Une carte à l'échelle `scale`, dans une boîte à sa taille finale (mise en page, centrage).
 * Réduite ou agrandie par `transform` et non par `zoom` : sous Firefox, `zoom` décale les calques
 * 3D d'une carte vivante (survol d'une miniature, carte ouverte en grand). Sans largeur ni hauteur
 * données à la boîte, la carte déborderait et `content-visibility` la rognerait.
 */
export function Scaled({
  scale,
  className,
  children,
}: {
  scale: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className} style={{ width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale }}>
      <div
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {children}
      </div>
    </div>
  );
}
