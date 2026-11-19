/** Bestiaire original du Bois de Fierfeuille : données partagées entre simulation et interface. */
export const ENEMY_FAMILIES = [
  "bandit",
  "wolf",
  "boar",
  "murloc",
  "spider",
  "gnoll",
  "kobold",
  "bear",
] as const;
export type EnemyFamily = (typeof ENEMY_FAMILIES)[number];
export const BOSS_NAME = "Baron de Croquebotte";
export const ELITE_NAMES = ["Sire Grincecroc", "Dame Griffepoil"] as const;
export const BESTIARY: Record<
  EnemyFamily,
  {
    name: string;
    family: string;
    description: string;
    hp: number;
    speed: number;
    radius: number;
    damage: number;
    xp: number;
    unlocksAt: number;
    weight: number;
    color: string;
  }
> = {
  bandit: {
    name: "Malandrin de Videgousset",
    family: "Bandit",
    description: "Un poignard, un foulard et une conception souple de la propriété.",
    hp: 15,
    speed: 34,
    radius: 11,
    damage: 9,
    xp: 2,
    unlocksAt: 0,
    weight: 3,
    color: "#bc7866",
  },
  wolf: {
    name: "Loup de Croquejarret",
    family: "Loup",
    description: "Rapide, il contourne avant de venir vous mordiller les mollets.",
    hp: 12,
    speed: 66,
    radius: 10,
    damage: 8,
    xp: 2,
    unlocksAt: 18,
    weight: 3,
    color: "#b8c8cc",
  },
  boar: {
    name: "Sanglier de Foncegroin",
    family: "Sanglier",
    description: "Il marque un arrêt, annonce sa trajectoire puis charge tout droit.",
    hp: 32,
    speed: 36,
    radius: 14,
    damage: 15,
    xp: 3,
    unlocksAt: 45,
    weight: 2,
    color: "#c69772",
  },
  murloc: {
    name: "Glouglou de Flaquefière",
    family: "Murloc",
    description: "Un amphibien à nageoire qui approche par petits bonds impatients.",
    hp: 18,
    speed: 48,
    radius: 10,
    damage: 8,
    xp: 2,
    unlocksAt: 75,
    weight: 3,
    color: "#70b9b1",
  },
  spider: {
    name: "Tisseuse de Mauvaisfil",
    family: "Araignée",
    description: "Elle alterne de brefs arrêts et des ruées rapides dans le sous-bois.",
    hp: 15,
    speed: 76,
    radius: 12,
    damage: 7,
    xp: 2,
    unlocksAt: 105,
    weight: 2,
    color: "#b299c3",
  },
  gnoll: {
    name: "Gnoll de Grincecroc",
    family: "Gnoll",
    description: "Un maraudeur robuste à museau de hyène et à massue fort peu protocolaire.",
    hp: 58,
    speed: 42,
    radius: 16,
    damage: 17,
    xp: 5,
    unlocksAt: 140,
    weight: 2,
    color: "#c7aa71",
  },
  kobold: {
    name: "Kobold de Chandellecourt",
    family: "Kobold",
    description: "Sa chandelle éclaire une approche hésitante : il recule si vous venez trop près.",
    hp: 22,
    speed: 39,
    radius: 10,
    damage: 9,
    xp: 3,
    unlocksAt: 175,
    weight: 3,
    color: "#dfb570",
  },
  bear: {
    name: "Ours de Grosdodo",
    family: "Ours",
    description: "Lent, très résistant et particulièrement contrarié d’être réveillé.",
    hp: 100,
    speed: 25,
    radius: 20,
    damage: 22,
    xp: 7,
    unlocksAt: 210,
    weight: 1,
    color: "#bd956a",
  },
};
