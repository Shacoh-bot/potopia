import { describe, expect, it } from "vitest";
import { BESTIARY, ENEMY_FAMILIES } from "../src/bestiary";
import { createGame, selectEnemyFamily, spawnEnemy, tick, type Game } from "../src/engine";
import { ENEMY_SPRITES, PALETTE } from "../ui/sprites";

function playing(): Game {
  const g = createGame(42);
  g.status = "playing";
  g.spawnIn = 100;
  g.cooldowns.hammer = 100;
  return g;
}
function advance(g: Game, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) tick(g, 1 / 60, { x: 0, y: 0 });
}

describe("bestiaire de Fierfeuille", () => {
  it("introduit progressivement les huit familles, sans apparition prématurée", () => {
    const g = playing();
    for (const time of [0, 18, 45, 75, 105, 140, 175, 210, 540]) {
      g.time = time;
      const drawn = new Set(Array.from({ length: 400 }, () => selectEnemyFamily(g)));
      const expected = ENEMY_FAMILIES.filter((f) => BESTIARY[f].unlocksAt <= time);
      expect([...drawn].sort()).toEqual([...expected].sort());
    }
  });
  it("possède huit silhouettes différentes avec une palette entièrement définie", () => {
    expect(new Set(ENEMY_FAMILIES.map((f) => ENEMY_SPRITES[f].join("\n"))).size).toBe(8);
    for (const family of ENEMY_FAMILIES) {
      for (const row of ENEMY_SPRITES[family]) {
        for (const pixel of row)
          if (pixel !== ".") expect(PALETTE[pixel], `${family}: ${pixel}`).toBeDefined();
      }
    }
  });
  it("annonce la charge du sanglier puis conserve sa trajectoire même si le héros esquive", () => {
    const g = playing();
    const boar = spawnEnemy(g, "boar");
    boar.x = 180;
    boar.y = 0;
    boar.cooldown = 0;
    tick(g, 1 / 60, { x: 0, y: 0 });
    expect(boar.action).toBe("windup");
    expect(boar.x).toBe(180);
    expect(boar.intent).toEqual({ x: -1, y: 0 });
    g.player.y = 120;
    advance(g, 0.85);
    expect(boar.action).toBe("charge");
    expect(boar.x).toBeLessThan(180);
    expect(boar.y).toBe(0);
    advance(g, 1.2);
    expect(boar.action).toBe("pursue");
    expect(boar.cooldown).toBeGreaterThan(0);
  });
  it("fait contourner les loups et approcher les bandits de face", () => {
    const a = playing(),
      b = playing();
    const wolf = spawnEnemy(a, "wolf"),
      bandit = spawnEnemy(b, "bandit");
    wolf.x = bandit.x = 200;
    wolf.y = bandit.y = 0;
    tick(a, 1 / 60, { x: 0, y: 0 });
    tick(b, 1 / 60, { x: 0, y: 0 });
    expect(Math.abs(wolf.y)).toBeGreaterThan(0);
    expect(bandit.y).toBe(0);
    expect(wolf.speed).toBeGreaterThan(bandit.speed);
  });
  it("fait reculer un kobold approché de trop près", () => {
    const g = playing();
    const kobold = spawnEnemy(g, "kobold");
    kobold.x = 50;
    kobold.y = 0;
    tick(g, 1 / 60, { x: 0, y: 0 });
    expect(kobold.x).toBeGreaterThan(50);
  });
  it("réserve les silhouettes gnoll et ours aux élites et au Baron", () => {
    const g = playing();
    expect(spawnEnemy(g, "elite").family).toBe("gnoll");
    g.eliteStage = 1;
    expect(spawnEnemy(g, "elite").family).toBe("bear");
    const boss = spawnEnemy(g, "boss");
    expect(boss.family).toBe("gnoll");
    expect(boss.maxHp).toBe(2400);
  });
  it("ne fait pas charger sans préavis un sanglier recyclé hors écran", () => {
    const g = playing();
    const boar = spawnEnemy(g, "boar");
    boar.x = 2000;
    boar.y = 0;
    boar.action = "charge";
    boar.actionTime = 0.5;
    boar.intent = { x: -1, y: 0 };
    tick(g, 1 / 60, { x: 0, y: 0 });
    expect(boar.action).toBe("pursue");
    expect(boar.cooldown).toBeGreaterThanOrEqual(1.5);
  });
});
