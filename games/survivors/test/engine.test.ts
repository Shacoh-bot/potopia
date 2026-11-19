import { describe, expect, it } from "vitest";
import {
  chooseUpgrade,
  createGame,
  distance,
  MAX_ENEMIES,
  pauseGame,
  resumeGame,
  RUN_SECONDS,
  spawnEnemy,
  tick,
  xpNeeded,
  type Game,
  type Upgrade,
} from "../src/engine";

function playing() {
  const g = createGame(42);
  g.status = "playing";
  return g;
}
function advance(g: Game, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) tick(g, 1 / 60, { x: 0, y: 0 });
}

describe("simulation de Fierfeuille", () => {
  it("normalise les diagonales et ne déplace pas le héros en pause", () => {
    const straight = playing(),
      diagonal = playing();
    tick(straight, 1 / 60, { x: 1, y: 0 });
    tick(diagonal, 1 / 60, { x: 1, y: 1 });
    expect(distance(straight.player, { x: 0, y: 0 })).toBeCloseTo(
      distance(diagonal.player, { x: 0, y: 0 }),
    );
    pauseGame(straight);
    const before = structuredClone(straight);
    advance(straight, 10);
    expect(straight).toEqual(before);
    resumeGame(straight);
    tick(straight, 1 / 60, { x: 1, y: 0 });
    expect(straight.player.x).toBeGreaterThan(before.player.x);
  });
  it("met le temps en pause pendant un choix et refuse un don absent de l'offre", () => {
    const g = playing();
    g.xp = xpNeeded(1) + xpNeeded(2);
    tick(g, 1 / 60, { x: 0, y: 0 });
    expect(g.status).toBe("levelup");
    expect(g.level).toBe(2);
    expect(new Set(g.choices).size).toBe(3);
    const time = g.time;
    advance(g, 5);
    expect(g.time).toBe(time);
    const absent = (Object.keys(g.ranks) as Upgrade[]).find((k) => !g.choices.includes(k));
    expect(absent && chooseUpgrade(g, absent)).toBe(false);
    const choice = g.choices[0];
    expect(choice).toBeDefined();
    if (choice) expect(chooseUpgrade(g, choice)).toBe(true);
    expect(g.level).toBe(3);
    expect(g.status).toBe("levelup");
  });
  it("Jugement disparaît après un impact et ne traverse pas une seconde cible", () => {
    const g = playing();
    g.spawnIn = 100;
    g.cooldowns.hammer = 100;
    const e = spawnEnemy(g, "gnoll");
    e.x = 100;
    e.y = 0;
    e.speed = 0;
    e.hp = e.maxHp = 500;
    const behind = spawnEnemy(g, "gnoll");
    behind.x = 105;
    behind.y = 0;
    behind.speed = 0;
    behind.hp = behind.maxHp = 500;
    g.projectiles.push({
      x: 100,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      kind: "hammer",
      damage: 27,
    });
    advance(g, 0.4);
    expect(e.hp).toBe(473);
    expect(behind.hp).toBe(500);
    expect(g.projectiles).toHaveLength(0);
  });
  it("Jugement garde sa trajectoire sans retour et expire s'il ne touche personne", () => {
    const g = playing();
    g.spawnIn = 100;
    g.cooldowns.hammer = 100;
    g.player.x = -400;
    g.projectiles.push({ x: 0, y: 0, vx: 140, vy: 0, age: 0, kind: "hammer", damage: 27 });
    advance(g, 0.75);
    expect(g.projectiles[0]?.x).toBeCloseTo(105);
    expect(g.projectiles[0]?.vx).toBe(140);
    advance(g, 0.85);
    expect(g.projectiles).toHaveLength(0);
  });
  it("les attaques automatiques tuent et produisent de l'expérience ramassable", () => {
    const g = playing();
    const e = spawnEnemy(g, "bandit");
    e.x = 75;
    e.y = 0;
    e.speed = 0;
    advance(g, 1);
    expect(g.kills).toBeGreaterThan(0);
    expect(g.drops.length).toBeGreaterThan(0);
    g.player.x = 75;
    advance(g, 0.3);
    expect(g.xp).toBeGreaterThan(0);
  });
  it("ne compte pas une cible tuée comme un contact infligeant des dégâts", () => {
    const g = playing();
    g.ranks.aura = 1;
    const e = spawnEnemy(g, "bandit");
    e.x = 0;
    e.y = 0;
    e.hp = 1;
    tick(g, 1 / 60, { x: 0, y: 0 });
    expect(g.hp).toBe(g.maxHp);
    expect(g.kills).toBe(1);
  });
  it("n'inflige qu'un contact pendant la fenêtre d'invulnérabilité", () => {
    const g = playing();
    g.cooldowns.hammer = 100;
    for (let i = 0; i < 10; i++) {
      const e = spawnEnemy(g, "gnoll");
      e.x = 0;
      e.y = 0;
    }
    advance(g, 0.5);
    expect(g.hp).toBe(g.maxHp - 17);
  });
  it("fait apparaître le boss une seule fois à neuf minutes", () => {
    const g = playing();
    g.time = 540 - 1 / 120;
    advance(g, 1);
    expect(g.enemies.filter((e) => e.kind === "boss")).toHaveLength(1);
    expect(g.bossSpawned).toBe(true);
  });
  it("exige de vivre et d'avoir vaincu le Baron à l'échéance", () => {
    const lost = playing();
    lost.time = RUN_SECONDS - 0.005;
    tick(lost, 1 / 60, { x: 0, y: 0 });
    expect(lost.status).toBe("lost");
    expect(lost.time).toBe(600);
    const won = playing();
    won.time = RUN_SECONDS - 0.005;
    won.bossKilled = true;
    tick(won, 1 / 60, { x: 0, y: 0 });
    expect(won.status).toBe("won");
    const dead = playing();
    dead.time = RUN_SECONDS - 0.005;
    dead.bossKilled = true;
    dead.hp = 0;
    tick(dead, 1 / 60, { x: 0, y: 0 });
    expect(dead.status).toBe("lost");
  });
  it("borne la horde, les projectiles et les éclats sur dix minutes réelles de simulation", () => {
    const g = playing();
    g.hp = g.maxHp = 1_000_000;
    let maxEnemies = 0,
      maxDrops = 0,
      maxProjectiles = 0;
    // Endurance sans attaquer : pire accumulation d'ennemis et pas de dégâts pour interrompre.
    g.ranks.hammer = 0;
    for (let i = 0; i <= RUN_SECONDS * 60; i++) {
      tick(g, 1 / 60, { x: Math.cos(i / 120), y: Math.sin(i / 120) });
      maxEnemies = Math.max(maxEnemies, g.enemies.length);
      maxDrops = Math.max(maxDrops, g.drops.length);
      maxProjectiles = Math.max(maxProjectiles, g.projectiles.length);
    }
    expect(g.time).toBe(600);
    expect(g.status).toBe("lost");
    // Les deux élites et le boss ont un emplacement réservé au-delà du plafond courant.
    expect(maxEnemies).toBeLessThanOrEqual(MAX_ENEMIES + 3);
    expect(maxDrops).toBeLessThanOrEqual(360);
    expect(maxProjectiles).toBe(0);
  }, 20000);
  it("permet à l'arsenal complet de vaincre le boss au cours d'une partie entière", () => {
    const g = playing();
    // Isoler les dégâts et la progression de l'équilibrage de survie : vie de test élevée.
    g.hp = g.maxHp = 1_000_000;
    for (const key of Object.keys(g.ranks) as Upgrade[]) g.ranks[key] = 5;
    let maxProjectiles = 0;
    for (let i = 0; i <= RUN_SECONDS * 60; i++) {
      tick(g, 1 / 60, { x: 0, y: 0 });
      maxProjectiles = Math.max(maxProjectiles, g.projectiles.length);
    }
    expect(g.bossKilled).toBe(true);
    expect(g.status).toBe("won");
    expect(g.kills).toBeGreaterThan(600);
    expect(maxProjectiles).toBeLessThan(24);
    expect(g.drops.length).toBeLessThanOrEqual(360);
  }, 20000);
});
