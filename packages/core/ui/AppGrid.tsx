import { AppLink } from "@app/ui";
import type { CSSProperties } from "react";
import {
  Clock12,
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
  clock: Clock12,
  grid: Grid3x3,
  lightbulb: Lightbulb,
  mask: VenetianMask,
  palette: Palette,
  person: PersonStanding,
  shield: Shield,
  trophy: Trophy,
};

type Props = {
  apps: Pick<AppEntry, "id" | "name" | "icon" | "route" | "art" | "artLetters">[];
};

// Même arrondi dans tous les thèmes (le --radius des thèmes JoJo, One Piece ou Apothicaire
// donnerait des tuiles presque carrées), calé sur le cadre arrondi des illustrations.
const TILE =
  "group shine rounded-xl @2xl:rounded-[1.25rem] flex h-full [transform:perspective(600px)] transition-all duration-300";

export function AppGrid({ apps }: Props) {
  if (apps.length === 0) return null;
  // Grille équilibrée (.app-grid, theme.css) : nombre de colonnes et taille des tuiles calculés
  // en CSS d'après la largeur du bloc et le nombre d'apps (--n), sans ligne presque vide.
  return (
    <div className="@container">
      <ul style={{ "--n": apps.length } as CSSProperties} className="app-grid stagger">
        {apps.map((app) => {
          if (app.art) {
            // Tuile illustrée : l'image remplit la tuile ; au survol, cadre tournant, zoom et, si
            // l'app en a, petites lettres façon Wordle qui jaillissent (styles .app-art, theme.css).
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
                {app.artLetters && (
                  <span className="app-art-pops" aria-hidden>
                    {[...app.artLetters].map((letter, i) => (
                      <span key={i}>{letter}</span>
                    ))}
                  </span>
                )}
              </li>
            );
          }
          const Icon = ICONS[app.icon];
          return (
            <li key={app.id}>
              <AppLink
                href={app.route}
                className={`${TILE} bg-surface/80 hover:border-accent/70 flex-col items-center justify-center gap-2 border border-(--frame) p-3 text-center text-sm hover:[transform:perspective(600px)_rotateX(8deg)_translateY(-4px)] hover:shadow-[0_14px_30px_-12px_var(--accent)] @2xl:gap-3.5`}
              >
                <span className="bg-arcane/15 ring-accent/30 group-hover:ring-accent/70 grid size-10 place-items-center rounded-full ring-1 transition-shadow group-hover:shadow-[0_0_18px_var(--accent)] @2xl:size-18">
                  <Icon
                    size={22}
                    className="text-accent group-hover:animate-float transition-transform duration-300 group-hover:scale-110 @2xl:size-10"
                    aria-hidden
                  />
                </span>
                <span className="font-display text-text line-clamp-2 text-xs font-semibold tracking-wide @2xl:text-xl">
                  {app.name}
                </span>
              </AppLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
