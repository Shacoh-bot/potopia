import type { Role } from "../users";
import { isGotyEnabled } from "@app/config/features";

/** Icônes lucide disponibles pour les tuiles (la correspondance est dans ui/AppGrid). */
export type AppIconName =
  "clock" | "grid" | "lightbulb" | "mask" | "palette" | "person" | "shield" | "trophy";

export type AppEntry = {
  id: string;
  name: string;
  icon: AppIconName;
  route: string;
  requiredRole: Role;
  /** Illustration qui remplit toute la tuile (chemin public de apps/web), à la place de l'icône. */
  art?: string;
  /** Lettres en cases façon Wordle qui jaillissent de la tuile illustrée au survol (TROIS). */
  artLetters?: string;
};

/** Apps de la plateforme, dans l'ordre d'affichage des tuiles. */
export const apps: readonly AppEntry[] = [
  {
    id: "goty",
    name: "GOTY Party",
    icon: "trophy",
    route: "/goty",
    requiredRole: "member",
    art: "/apps/goty.webp",
  },
  {
    id: "trois",
    name: "TROIS",
    icon: "grid",
    route: "/trois",
    requiredRole: "member",
    art: "/apps/trois-2.webp",
    artLetters: "OUI",
  },
  {
    id: "agents",
    name: "Agents Doubles",
    icon: "mask",
    route: "/agents",
    requiredRole: "member",
    art: "/apps/agents.webp",
  },
  {
    id: "pose",
    name: "Pose JoJo",
    icon: "person",
    route: "/pose",
    requiredRole: "member",
    art: "/apps/pose.webp",
  },
  {
    id: "douze",
    name: "DOUZE",
    icon: "clock",
    route: "/douze",
    requiredRole: "member",
    art: "/apps/douze.webp",
  },
  {
    id: "morpion",
    name: "Morpion",
    icon: "grid",
    route: "/morpion",
    requiredRole: "member",
    art: "/apps/morpion.webp",
  },
  {
    id: "ideas",
    name: "Boîte à idées",
    icon: "lightbulb",
    route: "/ideas",
    requiredRole: "member",
    art: "/apps/ideas.webp",
  },
  {
    id: "cards",
    name: "Vote design des cartes",
    icon: "palette",
    route: "/cartes",
    requiredRole: "member",
    art: "/apps/cards.webp",
  },
  {
    id: "admin",
    name: "Administration",
    icon: "shield",
    route: "/admin",
    requiredRole: "admin",
    art: "/apps/admin.webp",
  },
];

export function getVisibleApps(user: { role: Role }): AppEntry[] {
  return apps.filter(
    (app) =>
      (app.id !== "goty" || isGotyEnabled()) &&
      (app.requiredRole === "member" || user.role === "admin"),
  );
}
