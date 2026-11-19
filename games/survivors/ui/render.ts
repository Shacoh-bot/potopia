import {
  auraRadius,
  HEIGHT,
  shieldCount,
  shieldPosition,
  WIDTH,
  type Game,
  type Point,
} from "../src/engine";
import { createSprites } from "./sprites";
import { createForest } from "./forest";
import { ELITE_NAMES } from "../src/bestiary";

export function createRenderer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Le rendu Canvas 2D n’est pas disponible sur ce navigateur.");
  const ctx = context;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  ctx.imageSmoothingEnabled = false;
  const sprites = createSprites();
  const drawForest = createForest();
  function sprite(name: string, x: number, y: number, scale: number, flip = false) {
    const img = sprites[name];
    if (!img) return;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(
      img,
      Math.round((-img.width * scale) / 2),
      Math.round(-img.height * scale + 9),
      img.width * scale,
      img.height * scale,
    );
    ctx.restore();
  }
  function rect(color: string, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }
  function diamond(x: number, y: number, size: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.fill();
  }
  function ring(p: Point, radius: number, color: string, width = 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(Math.round(p.x), Math.round(p.y), radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  return function render(g: Game) {
    const width = canvas.width,
      height = canvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.fillStyle = "#537d3a";
    ctx.fillRect(0, 0, width, height);
    const cx = Math.round(width / 2 - g.player.x),
      cy = Math.round(height / 2 - g.player.y + 15);
    ctx.translate(cx, cy);
    drawForest(ctx, g.player, width, height);
    if (g.ranks.aura) {
      const r = auraRadius(g);
      ctx.fillStyle = "#e5ae3a12";
      ctx.beginPath();
      ctx.arc(g.player.x, g.player.y, r, 0, Math.PI * 2);
      ctx.fill();
      ring(g.player, r, "#cfa85788");
      ring(g.player, r - 7, "#cfa85733", 1);
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6 + g.time * 0.15;
        diamond(
          g.player.x + Math.cos(a) * (r - 3),
          g.player.y + Math.sin(a) * (r - 3),
          2,
          "#e6c67b",
        );
      }
    }
    for (const d of g.drops) {
      if (
        Math.abs(d.x - g.player.x) > width / 2 + 20 ||
        Math.abs(d.y - g.player.y) > height / 2 + 20
      )
        continue;
      if (d.heal) {
        rect("#46302d", d.x - 6, d.y - 6, 12, 12);
        rect("#e3a38a", d.x - 1, d.y - 4, 3, 9);
        rect("#e3a38a", d.x - 4, d.y - 1, 9, 3);
      } else {
        const size = d.value >= 20 ? 12 : d.value >= 5 ? 10 : 8;
        const gold = d.value >= 20;
        diamond(d.x, d.y - 1, size + 4, gold ? "#ffe5a030" : "#9be8ed30");
        diamond(d.x, d.y + 1, size + 2, "#15333e");
        diamond(d.x, d.y - 2, size, gold ? "#f1d27a" : "#83e4ee");
        ctx.fillStyle = gold ? "#c79644" : "#3998b6";
        ctx.beginPath();
        ctx.moveTo(d.x, d.y - 2 - size);
        ctx.lineTo(d.x + size, d.y - 2);
        ctx.lineTo(d.x, d.y - 2 + size);
        ctx.fill();
        rect("#f1ffff", d.x - 3, d.y - size + 2, 3, 5);
      }
    }
    const entities: { y: number; enemy: Game["enemies"][number] | undefined }[] = g.enemies.map(
      (e) => ({ y: e.y, enemy: e }),
    );
    entities.push({ y: g.player.y, enemy: undefined });
    for (const e of g.enemies) {
      if (e.action !== "windup") continue;
      const length = (e.kind === "boss" ? 270 : 245) * 0.7;
      ctx.strokeStyle = "#8c3c2555";
      ctx.lineWidth = e.radius * 1.5;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + e.intent.x * length, e.y + e.intent.y * length);
      ctx.stroke();
      ctx.strokeStyle = "#f3c779";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ring(e, e.radius + 5 + (1 - e.actionTime / 0.75) * 8, "#f7d48e", 2);
    }
    entities.sort((a, b) => a.y - b.y);
    for (const item of entities) {
      const e = item.enemy;
      const p = e ?? g.player;
      if (
        Math.abs(p.x - g.player.x) > width / 2 + 70 ||
        Math.abs(p.y - g.player.y) > height / 2 + 70
      )
        continue;
      const size = e?.radius ?? 16;
      ctx.fillStyle = "#101d2490";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 8, size * 1.2, size * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      if (e) {
        const scale = e.kind === "boss" ? 4 : e.kind === "elite" ? 3.5 : 2.4;
        if (e.kind === "elite" || e.kind === "boss") ring(e, e.radius + 5, "#e2c17a99", 2);
        if (e.flash) ctx.globalAlpha = 0.5;
        const bob =
          e.family === "murloc"
            ? -Math.max(0, Math.sin(g.time * 7 + e.id)) * 6
            : e.action === "windup"
              ? Math.sin(g.time * 35)
              : Math.sin(g.time * 8 + e.id) * 1.2;
        sprite(e.family, e.x, e.y + bob, scale, e.x > g.player.x);
        ctx.globalAlpha = 1;
        if (e.kind === "elite" || e.kind === "boss") {
          const crownY = e.y - (sprites[e.family]?.height ?? 20) * scale + 4;
          if (e.kind === "elite") {
            ctx.font = "bold 11px monospace";
            ctx.textAlign = "center";
            const label = e.family === "bear" ? ELITE_NAMES[1] : ELITE_NAMES[0];
            ctx.fillStyle = "#172321";
            ctx.fillText(label, e.x + 1, crownY - 14);
            ctx.fillStyle = "#fff0bc";
            ctx.fillText(label, e.x, crownY - 15);
          }
          rect("#eac373", e.x - 10, crownY, 20, 5);
          rect("#fff0af", e.x - 10, crownY - 5, 4, 5);
          rect("#fff0af", e.x - 2, crownY - 8, 4, 8);
          rect("#fff0af", e.x + 6, crownY - 5, 4, 5);
          if (e.kind === "boss") {
            rect("#a57c41", e.x + 42, e.y - 96, 4, 92);
            rect("#843f3b", e.x + 46, e.y - 94, 24, 35);
            rect("#d7b66d", e.x + 54, e.y - 87, 8, 20);
          }
        }
        if (e.kind === "elite" || (e.hp < e.maxHp && e.kind !== "boss")) {
          rect("#1b2028", e.x - 18, e.y - size * 3, 36, 4);
          rect("#c37f6b", e.x - 18, e.y - size * 3, 36 * Math.max(0, e.hp / e.maxHp), 3);
        }
      } else {
        const blink = g.invincible > 0 && Math.floor(g.invincible * 18) % 2 === 0;
        ctx.globalAlpha = blink ? 0.45 : 1;
        const bob = g.walking ? Math.sin(g.time * 16) * 2 : Math.sin(g.time * 2) * 0.7;
        const heroFrame = g.walking ? `hero-walk-${Math.floor(g.time * 8) % 2}` : "hero";
        sprite(heroFrame, p.x, p.y + bob, 1.65, g.facing < 0);
        ctx.globalAlpha = 1;
      }
    }
    for (const p of g.projectiles) {
      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y));
      ctx.rotate(p.age * 13);
      rect("#a27f42", -2, -4, 4, 22);
      rect("#f0ce80", -13, -12, 26, 12);
      rect("#fff2ba", -9, -10, 18, 4);
      ctx.restore();
    }
    for (let i = 0; i < shieldCount(g); i++) {
      const p = shieldPosition(g, i);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(g.time + i);
      rect("#26313a", -3, -5, 6, 24);
      rect("#b88b47", -1, -5, 3, 23);
      rect("#ead09a", -1, 12, 3, 3);
      rect("#26313a", -16, -15, 32, 16);
      rect("#718fa1", -12, -13, 24, 12);
      rect("#b9ced0", -11, -12, 22, 3);
      rect("#d5b574", -15, -14, 4, 14);
      rect("#d5b574", 11, -14, 4, 14);
      diamond(0, -7, 4, "#fff0ba");
      ctx.restore();
    }
    for (const p of g.particles) {
      ctx.globalAlpha = Math.min(1, p.life * 4);
      rect(p.color, p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    for (const t of g.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 3);
      ctx.fillStyle = "#171c29";
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      100,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.6,
    );
    vignette.addColorStop(0, "#fff0ba00");
    vignette.addColorStop(1, "#203e293d");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    if (g.invincible > 0.55) {
      ctx.fillStyle = "#b54d3a22";
      ctx.fillRect(0, 0, width, height);
    }
  };
}
