/** Simulation indépendante du rendu et de React. Unités : pixels et secondes. */
import { BESTIARY, ENEMY_FAMILIES, type EnemyFamily } from "./bestiary";
export const RUN_SECONDS = 600;
export const WIDTH = 960;
export const HEIGHT = 540;
export const MAX_ENEMIES = 220;
const MAX_DROPS = 360;
export type Point = { x: number; y: number };
export type Weapon = "hammer" | "aura" | "shield";
export type Upgrade = Weapon | "vitality" | "haste" | "stride" | "magnet";
export type Status = "ready" | "playing" | "paused" | "levelup" | "won" | "lost";
export type EnemyKind = EnemyFamily | "elite" | "boss";
export type Enemy = Point & {
  id: number;
  kind: EnemyKind;
  family: EnemyFamily;
  action: "pursue" | "windup" | "charge" | "recover";
  actionTime: number;
  cooldown: number;
  intent: Point;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  damage: number;
  flash: number;
  shieldHit: number;
};
export type Projectile = Point & {
  kind: "hammer";
  vx: number;
  vy: number;
  age: number;
  damage: number;
};
export type Drop = Point & { value: number; heal: boolean; attracted: boolean };
export type Particle = Point & { vx: number; vy: number; life: number; color: string };
export type FloatingText = Point & { text: string; life: number; color: string };
export type GameEvent = "hit" | "kill" | "level" | "heal" | "boss" | "won" | "lost";
export type Game = {
  status: Status;
  time: number;
  player: Point;
  hp: number;
  maxHp: number;
  facing: number;
  walking: boolean;
  invincible: number;
  level: number;
  xp: number;
  kills: number;
  ranks: Record<Upgrade, number>;
  choices: Upgrade[];
  enemies: Enemy[];
  projectiles: Projectile[];
  drops: Drop[];
  particles: Particle[];
  texts: FloatingText[];
  events: GameEvent[];
  cooldowns: Record<Weapon, number>;
  spawnIn: number;
  eliteStage: number;
  bossSpawned: boolean;
  bossKilled: boolean;
  nextId: number;
  seed: number;
};
export const UPGRADES: Record<Upgrade, { name: string; description: string; icon: string }> = {
  hammer: {
    name: "Jugement",
    description: "Un marteau frappe une cible puis disparaît. Plus de dégâts et de projectiles.",
    icon: "hammer",
  },
  aura: {
    name: "Concécration",
    description: "Un sol consacré brûle les ennemis autour de vous. Rayon et puissance augmentés.",
    icon: "sun",
  },
  shield: {
    name: "Marteaux bénis",
    description: "Des marteaux bénis orbitent autour de vous et frappent la horde.",
    icon: "hammer",
  },
  vitality: {
    name: "Cœur indomptable",
    description: "+25 points de vie maximum et 35 points de vie rendus.",
    icon: "heart",
  },
  haste: {
    name: "Ferveur",
    description: "Vos armes attaquent 12 % plus vite par rang.",
    icon: "spark",
  },
  stride: {
    name: "Marche du preux",
    description: "Déplacement 10 % plus rapide par rang.",
    icon: "boot",
  },
  magnet: {
    name: "Appel des âmes",
    description: "Ramassage des éclats étendu de 35 pixels par rang.",
    icon: "gem",
  },
};
export function createGame(seed = 1701): Game {
  return {
    status: "ready",
    time: 0,
    player: { x: 0, y: 0 },
    hp: 120,
    maxHp: 120,
    facing: 1,
    walking: false,
    invincible: 0,
    level: 1,
    xp: 0,
    kills: 0,
    ranks: { hammer: 1, aura: 0, shield: 0, vitality: 0, haste: 0, stride: 0, magnet: 0 },
    choices: [],
    enemies: [],
    projectiles: [],
    drops: [],
    particles: [],
    texts: [],
    events: [],
    cooldowns: { hammer: 0.3, aura: 0, shield: 0 },
    spawnIn: 0.5,
    eliteStage: 0,
    bossSpawned: false,
    bossKilled: false,
    nextId: 1,
    seed: seed >>> 0,
  };
}
export function random(g: Game): number {
  g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0;
  return g.seed / 4294967296;
}
export function xpNeeded(level: number): number {
  return 8 + level * 5;
}
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export function auraRadius(g: Game): number {
  return 48 + g.ranks.aura * 13;
}
export function shieldCount(g: Game): number {
  return g.ranks.shield ? 1 + Math.floor(g.ranks.shield / 2) : 0;
}
export function shieldPosition(g: Game, index: number): Point {
  const angle = g.time * 2.6 + (index * Math.PI * 2) / shieldCount(g);
  return { x: g.player.x + Math.cos(angle) * 85, y: g.player.y + Math.sin(angle) * 85 };
}
function offerLevel(g: Game) {
  if (g.xp < xpNeeded(g.level) || g.status !== "playing") return;
  g.xp -= xpNeeded(g.level);
  g.level++;
  const pool = (Object.keys(UPGRADES) as Upgrade[]).filter((k) => g.ranks[k] < 5);
  g.choices = [];
  while (pool.length && g.choices.length < 3) {
    const [pick] = pool.splice(Math.floor(random(g) * pool.length), 1);
    if (pick) g.choices.push(pick);
  }
  // Très longue progression : les niveaux rendent de la vie une fois tous les rangs acquis.
  if (!g.choices.length) {
    g.hp = Math.min(g.maxHp, g.hp + 35);
    return;
  }
  g.status = "levelup";
  g.events.push("level");
}
export function chooseUpgrade(g: Game, choice: Upgrade): boolean {
  if (g.status !== "levelup" || !g.choices.includes(choice) || g.ranks[choice] >= 5) return false;
  g.ranks[choice]++;
  if (choice === "vitality") {
    g.maxHp += 25;
    g.hp = Math.min(g.maxHp, g.hp + 35);
  }
  g.choices = [];
  g.status = "playing";
  offerLevel(g);
  return true;
}
export function pauseGame(g: Game) {
  if (g.status === "playing") g.status = "paused";
}
export function resumeGame(g: Game) {
  if (g.status === "paused") g.status = "playing";
}

export function spawnEnemy(g: Game, kind: EnemyKind): Enemy {
  const angle = random(g) * Math.PI * 2;
  const scale = 1 + g.time / 300;
  const family: EnemyFamily =
    kind === "boss" ? "gnoll" : kind === "elite" ? (g.eliteStage === 0 ? "gnoll" : "bear") : kind;
  const stats = BESTIARY[family];
  const hp = kind === "boss" ? 2400 : kind === "elite" ? 260 * scale : stats.hp * scale;
  const speed = kind === "boss" ? 43 : kind === "elite" ? 37 : stats.speed + g.time / 40;
  const radius = kind === "boss" ? 32 : kind === "elite" ? 23 : stats.radius;
  const damage = kind === "boss" ? 30 : kind === "elite" ? 24 : stats.damage;
  const enemy: Enemy = {
    id: g.nextId++,
    kind,
    family,
    action: "pursue",
    actionTime: 0,
    cooldown: 1.5,
    intent: { x: 0, y: 0 },
    x: g.player.x + Math.cos(angle) * 580,
    y: g.player.y + Math.sin(angle) * 360,
    hp,
    maxHp: hp,
    speed,
    radius,
    damage,
    flash: 0,
    shieldHit: 0,
  };
  g.enemies.push(enemy);
  return enemy;
}

export function selectEnemyFamily(g: Game): EnemyFamily {
  const available = ENEMY_FAMILIES.filter((family) => BESTIARY[family].unlocksAt <= g.time);
  const total = available.reduce((sum, family) => sum + BESTIARY[family].weight, 0);
  let roll = random(g) * total;
  for (const family of available) {
    roll -= BESTIARY[family].weight;
    if (roll < 0) return family;
  }
  return "bandit";
}

function moveEnemy(g: Game, e: Enemy, dt: number) {
  const d = distance(e, g.player) || 1;
  const dx = (g.player.x - e.x) / d,
    dy = (g.player.y - e.y) / d;
  e.cooldown = Math.max(0, e.cooldown - dt);
  if ((e.family === "boar" || e.kind === "boss") && e.speed > 0) {
    if (e.action === "pursue" && e.cooldown <= 0 && d > 65 && d < 290) {
      e.action = "windup";
      e.actionTime = 0.75;
      e.intent = { x: dx, y: dy };
    }
    if (e.action === "windup") {
      e.actionTime -= dt;
      if (e.actionTime <= 0) {
        e.action = "charge";
        e.actionTime = 0.7;
      }
      return;
    }
    if (e.action === "charge") {
      const speed = e.kind === "boss" ? 270 : 245;
      e.x += e.intent.x * speed * dt;
      e.y += e.intent.y * speed * dt;
      e.actionTime -= dt;
      if (e.actionTime <= 0) {
        e.action = "recover";
        e.actionTime = 0.55;
        e.cooldown = 3.5;
      }
      return;
    }
    if (e.action === "recover") {
      e.actionTime -= dt;
      if (e.actionTime <= 0) e.action = "pursue";
      return;
    }
  }
  let vx = dx,
    vy = dy,
    factor = 1;
  if (e.family === "wolf" && d > 75) {
    const flank = (e.id % 2 ? 1 : -1) * 0.42;
    vx = dx * Math.cos(flank) - dy * Math.sin(flank);
    vy = dx * Math.sin(flank) + dy * Math.cos(flank);
  }
  if (e.family === "spider") factor = Math.sin(g.time * 5 + e.id) > 0 ? 1.45 : 0.18;
  if (e.family === "murloc") factor = 0.65 + Math.max(0, Math.sin(g.time * 7 + e.id)) * 0.9;
  if (e.family === "kobold") {
    if (d < 78) factor = -0.65;
    else factor = Math.sin(g.time * 3 + e.id) > -0.2 ? 1 : 0.35;
  }
  e.x += vx * e.speed * factor * dt;
  e.y += vy * e.speed * factor * dt;
}
function addDrop(g: Game, drop: Drop) {
  if (g.drops.length < MAX_DROPS) {
    g.drops.push(drop);
    return;
  }
  // Agréger l'expérience dans un éclat proche plutôt que perdre de l'XP ou allouer sans limite.
  let nearest: Drop | undefined;
  let d = Infinity;
  for (const item of g.drops) {
    if (item.heal !== drop.heal) continue;
    const next = distance(item, drop);
    if (next < d) {
      d = next;
      nearest = item;
    }
  }
  if (nearest) nearest.value += drop.value;
  else if (drop.heal) g.hp = Math.min(g.maxHp, g.hp + 20);
}
function hit(g: Game, e: Enemy, damage: number) {
  if (e.hp <= 0) return;
  e.hp -= damage;
  e.flash = 0.09;
  if (g.texts.length < 35)
    g.texts.push({
      x: e.x,
      y: e.y - e.radius,
      text: `${Math.round(damage)}`,
      life: 0.6,
      color: "#ffe6a3",
    });
  if (e.hp > 0) return;
  g.kills++;
  if (e.kind === "boss") {
    g.bossKilled = true;
    g.events.push("boss");
  }
  const value = e.kind === "boss" ? 100 : e.kind === "elite" ? 40 : BESTIARY[e.family].xp;
  addDrop(g, { x: e.x, y: e.y, value, heal: false, attracted: false });
  if (g.kills % 25 === 0 || e.kind === "elite")
    addDrop(g, { x: e.x + 10, y: e.y, value: 24, heal: true, attracted: false });
  for (let i = 0; i < 4 && g.particles.length < 180; i++) {
    g.particles.push({
      x: e.x,
      y: e.y,
      vx: (random(g) - 0.5) * 90,
      vy: (random(g) - 0.5) * 90,
      life: 0.35,
      color: BESTIARY[e.family].color,
    });
  }
  if (!g.events.includes("kill")) g.events.push("kill");
}

/** Grille spatiale reconstruite une fois par pas, pour les collisions des projectiles. */
class EnemyGrid {
  cells = new Map<string, Enemy[]>();
  constructor(enemies: Enemy[]) {
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const key = `${Math.floor(e.x / 96)},${Math.floor(e.y / 96)}`;
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(e);
      else this.cells.set(key, [e]);
    }
  }
  near(p: Point, radius: number): Enemy[] {
    const result: Enemy[] = [];
    for (let x = Math.floor((p.x - radius) / 96); x <= Math.floor((p.x + radius) / 96); x++) {
      for (let y = Math.floor((p.y - radius) / 96); y <= Math.floor((p.y + radius) / 96); y++) {
        const bucket = this.cells.get(`${x},${y}`);
        if (bucket) result.push(...bucket);
      }
    }
    return result;
  }
}
function fire(g: Game, target: Point) {
  const rank = g.ranks.hammer;
  const count = 1 + Math.floor(rank / 2);
  const base = Math.atan2(target.y - g.player.y, target.x - g.player.x);
  for (let i = 0; i < count; i++) {
    const angle = base + (i - (count - 1) / 2) * 0.3;
    const speed = 290;
    g.projectiles.push({
      ...g.player,
      kind: "hammer",
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      damage: 17 + rank * 10,
    });
  }
}
export function tick(g: Game, delta: number, input: Point) {
  if (g.status !== "playing" || !Number.isFinite(delta) || delta <= 0) return;
  // Le contrôleur utilise un pas fixe ; un appel lent ne doit jamais traverser une horde.
  const dt = Math.min(delta, 1 / 30);
  g.events = [];
  g.time = Math.min(RUN_SECONDS, g.time + dt);
  g.invincible = Math.max(0, g.invincible - dt);
  const len = Math.hypot(input.x, input.y);
  g.walking = len > 0.05;
  if (g.walking) {
    const speed = 132 * (1 + g.ranks.stride * 0.1);
    const divisor = Math.max(1, len);
    g.player.x += (input.x / divisor) * speed * dt;
    g.player.y += (input.y / divisor) * speed * dt;
    if (Math.abs(input.x) > 0.05) g.facing = input.x > 0 ? 1 : -1;
  }
  g.spawnIn -= dt;
  if (g.spawnIn <= 0) {
    g.spawnIn = Math.max(0.13, 1.15 - g.time / 540);
    if (g.enemies.length < MAX_ENEMIES) {
      spawnEnemy(g, selectEnemyFamily(g));
    }
  }
  const stage = g.time >= 360 ? 2 : g.time >= 180 ? 1 : 0;
  if (stage > g.eliteStage) {
    spawnEnemy(g, "elite");
    g.eliteStage = stage;
    g.events.push("boss");
  }
  if (g.time >= 540 && !g.bossSpawned) {
    spawnEnemy(g, "boss");
    g.bossSpawned = true;
    g.events.push("boss");
  }
  for (const e of g.enemies) {
    const d = distance(e, g.player) || 1;
    moveEnemy(g, e, dt);
    e.flash = Math.max(0, e.flash - dt);
    e.shieldHit = Math.max(0, e.shieldHit - dt);
    // Les ennemis éloignés rejoignent la horde au lieu de s'accumuler hors écran.
    if (d > 1050 && e.kind !== "boss" && e.kind !== "elite") {
      const angle = random(g) * Math.PI * 2;
      e.x = g.player.x + Math.cos(angle) * 570;
      e.y = g.player.y + Math.sin(angle) * 350;
      e.action = "pursue";
      e.actionTime = 0;
      e.cooldown = Math.max(1.5, e.cooldown);
    }
  }
  const grid = new EnemyGrid(g.enemies);
  let nearest: Enemy | undefined;
  let nearestDistance = 700;
  for (const e of g.enemies) {
    const d = distance(e, g.player);
    if (d < nearestDistance) {
      nearest = e;
      nearestDistance = d;
    }
  }
  const haste = 1 + g.ranks.haste * 0.12;
  g.cooldowns.hammer -= dt;
  if (g.ranks.hammer && g.cooldowns.hammer <= 0 && nearest) {
    fire(g, nearest);
    g.cooldowns.hammer = 1.1 / haste;
  }
  g.cooldowns.aura -= dt;
  if (g.ranks.aura && g.cooldowns.aura <= 0) {
    g.cooldowns.aura = 0.65 / haste;
    for (const e of grid.near(g.player, auraRadius(g) + 32)) {
      if (distance(e, g.player) < auraRadius(g) + e.radius) hit(g, e, 6 + g.ranks.aura * 5);
    }
  }
  for (let i = 0; i < shieldCount(g); i++) {
    const pos = shieldPosition(g, i);
    for (const e of grid.near(pos, 55)) {
      if (e.shieldHit <= 0 && distance(pos, e) < e.radius + 14) {
        hit(g, e, 15 + g.ranks.shield * 10);
        e.shieldHit = 0.45 / haste;
      }
    }
  }
  for (const p of g.projectiles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    let target: Enemy | undefined;
    let closest = Infinity;
    for (const e of grid.near(p, 55)) {
      const d = distance(p, e);
      if (e.hp > 0 && d < e.radius + 13 && d < closest) {
        target = e;
        closest = d;
      }
    }
    if (target) {
      hit(g, target, p.damage);
      p.age = Infinity;
    }
  }
  g.projectiles = g.projectiles.filter((p) => p.age < 1.5);
  for (const e of g.enemies) {
    if (e.hp > 0 && g.invincible <= 0 && distance(e, g.player) < e.radius + 10) {
      g.hp = Math.max(0, g.hp - e.damage);
      g.invincible = 0.75;
      g.events.push("hit");
    }
  }
  g.enemies = g.enemies.filter((e) => e.hp > 0);
  g.drops = g.drops.filter((drop) => {
    const d = distance(drop, g.player);
    if (d < 55 + g.ranks.magnet * 35) drop.attracted = true;
    if (d < 15) {
      if (drop.heal) {
        g.hp = Math.min(g.maxHp, g.hp + drop.value);
        g.events.push("heal");
      } else g.xp += drop.value;
      return false;
    }
    if (drop.attracted) {
      const step = Math.min(d, (230 + 220 / Math.max(d, 1)) * dt);
      drop.x += ((g.player.x - drop.x) / d) * step;
      drop.y += ((g.player.y - drop.y) / d) * step;
    }
    return true;
  });
  for (const p of g.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  g.particles = g.particles.filter((p) => p.life > 0);
  for (const t of g.texts) {
    t.life -= dt;
    t.y -= dt * 25;
  }
  g.texts = g.texts.filter((t) => t.life > 0);
  if (g.hp <= 0 || (g.time >= RUN_SECONDS && !g.bossKilled)) {
    g.status = "lost";
    g.events.push("lost");
    return;
  }
  if (g.time >= RUN_SECONDS) {
    g.status = "won";
    g.events.push("won");
    return;
  }
  offerLevel(g);
}
