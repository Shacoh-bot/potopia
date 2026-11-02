import { AppLink } from "@app/ui";
import {
  Grid3x3,
  Lightbulb,
  Palette,
  PersonStanding,
  Shield,
  Trophy,
  VenetianMask,
  type LucideIcon,
} from "lucide-react";
import type { AppEntry, AppIconName } from "../src/apps/registry";

// Import explicite de chaque icône : importer tout lucide alourdirait le bundle client.
const ICONS: Record<AppIconName, LucideIcon> = {
  grid: Grid3x3,
  lightbulb: Lightbulb,
  mask: VenetianMask,
  palette: Palette,
  person: PersonStanding,
  shield: Shield,
  trophy: Trophy,
};

type Props = {
  apps: Pick<AppEntry, "id" | "name" | "icon" | "route" | "art">[];
};

// Même arrondi dans tous les thèmes (le --radius des thèmes JoJo, One Piece ou Apothicaire
// donnerait des tuiles presque carrées), calé sur le cadre arrondi des illustrations.
const TILE =
  "group shine rounded-xl xl:rounded-[1.25rem] flex h-full [transform:perspective(600px)] transition-all duration-300";

export function AppGrid({ apps }: Props) {
  if (apps.length === 0) return null;
  // Tuiles de taille fixe (--tile), 175 % plus grandes sur grand écran (lisibilité des
  // illustrations) ; la hauteur de deux rangées est réservée (une seule sur grand écran, où les
  // apps tiennent sur une ligne), pour que la place en dessous ne bouge pas quand une app s'ajoute.
  return (
    <ul className="stagger grid min-h-[calc(2*var(--tile)+0.75rem)] auto-rows-(--tile) grid-cols-[repeat(auto-fill,var(--tile))] content-start gap-3 [--tile:6.5rem] sm:[--tile:7.5rem] xl:min-h-(--tile) xl:gap-4 xl:[--tile:13.125rem]">
      {apps.map((app) => {
        if (app.art) {
          // Tuile illustrée : l'image remplit la tuile ; au survol, cadre tournant, zoom et
          // petites lettres façon Wordle qui jaillissent (styles .app-art dans theme.css).
          return (
            <li key={app.id} className="app-art-cell relative">
              <AppLink
                href={app.route}
                aria-label={app.name}
                className={`${TILE} app-art hover:[transform:perspective(600px)_rotateX(8deg)_translateY(-6px)_scale(1.04)]`}
              >
                <img
                  src={app.art}
                  alt=""
                  draggable={false}
                  className="app-art-img size-full object-cover"
                />
              </AppLink>
              <span className="app-art-pops" aria-hidden>
                <span>O</span>
                <span>U</span>
                <span>I</span>
              </span>
            </li>
          );
        }
        const Icon = ICONS[app.icon];
        return (
          <li key={app.id}>
            <AppLink
              href={app.route}
              className={`${TILE} bg-surface/80 hover:border-accent/70 flex-col items-center justify-center gap-2 border border-(--frame) p-3 text-center text-sm hover:[transform:perspective(600px)_rotateX(8deg)_translateY(-4px)] hover:shadow-[0_14px_30px_-12px_var(--accent)] xl:gap-3.5`}
            >
              <span className="bg-arcane/15 ring-accent/30 group-hover:ring-accent/70 grid size-10 place-items-center rounded-full ring-1 transition-shadow group-hover:shadow-[0_0_18px_var(--accent)] xl:size-18">
                <Icon
                  size={22}
                  className="text-accent group-hover:animate-float transition-transform duration-300 group-hover:scale-110 xl:size-10"
                  aria-hidden
                />
              </span>
              <span className="font-display text-text line-clamp-2 text-xs font-semibold tracking-wide xl:text-xl">
                {app.name}
              </span>
            </AppLink>
          </li>
        );
      })}
    </ul>
  );
}
