import type { Point } from "../src/engine";

const CHUNK = 384;
const CELL = 12;
const hash = (x: number, y: number) => {
  const n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  return ((n ^ (n >>> 13)) >>> 0) / 4294967296;
};
const roadDistance = (x: number, y: number) =>
  Math.min(
    Math.abs(y - 28 - Math.sin(x / 360) * 65),
    Math.abs(x + 170 - Math.sin(y / 410) * 75) * 1.5,
  );

/** Décor original : terrain et feuillus préparés en petits Canvas, sans images externes. */
export function createForest() {
  const chunks = new Map<string, HTMLCanvasElement>();
  const trees = [0, 1, 2].map((variant) => {
    const canvas = document.createElement("canvas");
    canvas.width = 144;
    canvas.height = 168;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    const rect = (color: string, x: number, y: number, w: number, h: number) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };
    // Ombre au sol, racines et branches tortueuses.
    ctx.fillStyle = "#1e3c2c45";
    ctx.beginPath();
    ctx.ellipse(83, 153, 51, 12, 0.15, 0, Math.PI * 2);
    ctx.fill();
    rect("#3d3529", 62, 78, 21, 78);
    rect("#685035", 65, 81, 15, 72);
    rect("#927044", 65, 99, 6, 48);
    rect("#b28b51", 65, 111, 3, 24);
    rect("#4a3e2c", 77, 96, 6, 57);
    rect("#3d3529", 53, 150, 42, 6);
    rect("#745536", 59, 144, 9, 9);
    rect("#745536", 80, 141, 9, 12);
    rect("#4a3e2c", 50, 72, 21, 9);
    rect("#745536", 47, 63, 9, 15);
    rect("#4a3e2c", 77, 63, 24, 9);
    rect("#745536", 92, 54, 9, 12);
    // Masses de feuilles aux contours en escaliers, lumière chaude en haut à gauche.
    const clusters = [
      [69, 32, 35],
      [40, 55, 30],
      [101, 56, 30],
      [55, 83, 30],
      [88, 84, 32],
      [72, 61, 39],
    ];
    const dark = variant === 1 ? "#284b30" : "#284c2b";
    const mid = variant === 1 ? "#3e6937" : variant === 2 ? "#4b7133" : "#427235";
    for (const [i, cluster] of clusters.entries()) {
      const [x = 0, y = 0, r = 30] = cluster;
      rect(dark, x - r + 9, y - r, r * 2 - 18, r * 2);
      rect(dark, x - r, y - r + 12, r * 2, r * 2 - 24);
      rect(mid, x - r + 6, y - r + 9, r * 2 - 12, r * 2 - 21);
      rect(mid, x - r + 12, y - r + 3, r * 2 - 27, r * 2 - 12);
      for (let j = 0; j < 30; j++) {
        const px = Math.floor((x - r + 10 + hash(j + i * 40, variant + 9) * (r * 2 - 22)) / 3) * 3;
        const py = Math.floor((y - r + 7 + hash(i * 30 + j, variant + 4) * (r * 1.6)) / 3) * 3;
        rect(
          j % 4 === 0 ? "#88a94c" : j % 3 === 0 ? "#638e40" : "#537e38",
          px,
          py,
          6 + (j % 3) * 3,
          3,
        );
      }
      rect("#729845", x - r + 12, y - r + 6, r - 6, 6);
    }
    return canvas;
  });

  function terrain(cx: number, cy: number) {
    const key = `${cx},${cy}`;
    const cached = chunks.get(key);
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = CHUNK;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    for (let y = 0; y < CHUNK; y += CELL) {
      for (let x = 0; x < CHUNK; x += CELL) {
        const wx = cx * CHUNK + x,
          wy = cy * CHUNK + y;
        const noise = hash(wx / CELL, wy / CELL);
        const d = roadDistance(wx + CELL / 2, wy + CELL / 2);
        const path = d < 33 + noise * 4;
        const edge = !path && d < 46 + noise * 5;
        const colors = path
          ? ["#b39864", "#b79b68", "#b09662"]
          : edge
            ? ["#8c8a4d", "#8a8c4d", "#91904f"]
            : ["#507a38", "#537d3a", "#567f3b"];
        ctx.fillStyle = colors[Math.floor(noise * colors.length)] ?? "#537d3a";
        ctx.fillRect(x, y, CELL, CELL);
        if (noise < 0.4) {
          ctx.fillStyle = path ? "#cfb681" : "#709448";
          ctx.fillRect(x + 3, y + 3, noise < 0.12 ? 6 : 3, 2);
        }
        if (!path && !edge && noise > 0.91) {
          ctx.fillStyle = "#3f6d33";
          ctx.fillRect(x + 6, y + 2, 2, 7);
          ctx.fillRect(x + 3, y + 4, 2, 4);
        }
        if (!path && !edge && noise > 0.985) {
          ctx.fillStyle = noise > 0.993 ? "#e8d79b" : "#b9b3d3";
          ctx.fillRect(x + 3, y + 2, 6, 2);
          ctx.fillRect(x + 5, y, 2, 6);
          ctx.fillStyle = "#cba859";
          ctx.fillRect(x + 5, y + 2, 2, 2);
        }
      }
    }
    chunks.set(key, canvas);
    // Mémoire bornée même après une longue marche ; les blocs évincés sont reproductibles.
    if (chunks.size > 36) {
      const oldest = chunks.keys().next().value;
      if (oldest !== undefined) chunks.delete(oldest);
    }
    return canvas;
  }

  return function drawForest(
    ctx: CanvasRenderingContext2D,
    player: Point,
    width: number,
    height: number,
  ) {
    const left = Math.floor((player.x - width / 2) / CHUNK);
    const top = Math.floor((player.y - height / 2 - 30) / CHUNK);
    for (let x = left; x <= Math.floor((player.x + width / 2) / CHUNK); x++) {
      for (let y = top; y <= Math.floor((player.y + height / 2 + 30) / CHUNK); y++) {
        ctx.drawImage(terrain(x, y), x * CHUNK, y * CHUNK);
      }
    }
    const rect = (color: string, x: number, y: number, w: number, h: number) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    // Panneau du carrefour, clôtures et petit sanctuaire : les repères du point de départ.
    for (const y of [-95, 120]) {
      rect("#493a27", -335, y, 126, 5);
      rect("#b19a60", -335, y - 3, 126, 3);
      for (let i = 0; i < 4; i++) {
        rect("#604b30", -335 + i * 39, y - 12, 6, 29);
        rect("#c2a46b", -335 + i * 39, y - 12, 3, 23);
      }
    }
    rect("#63492e", -105, -105, 8, 58);
    rect("#d7b77b", -131, -104, 63, 17);
    rect("#7d5b36", -128, -101, 57, 11);
    rect("#d7b77b", -135, -83, 53, 15);
    rect("#7d5b36", -132, -80, 47, 9);
    rect("#dcca8f", -122, -97, 31, 2);
    rect("#dcca8f", -123, -77, 19, 2);
    rect("#47643b", 54, -145, 65, 18);
    rect("#7c8063", 65, -168, 45, 27);
    rect("#c5bd91", 68, -171, 39, 6);
    rect("#969b77", 71, -165, 12, 21);
    rect("#92723e", 85, -185, 6, 17);
    rect("#d2b66c", 79, -181, 18, 4);
    // Feuillus, buissons, souches et champignons, placés de façon stable dans le monde.
    const gx = Math.floor((player.x - width / 2 - 150) / 176);
    const gy = Math.floor((player.y - height / 2 - 40) / 160);
    const items: { x: number; y: number; kind: number; variant: number }[] = [];
    for (let x = gx; x <= Math.ceil((player.x + width / 2 + 150) / 176); x++) {
      for (let y = gy; y <= Math.ceil((player.y + height / 2 + 180) / 160); y++) {
        const roll = hash(x, y);
        const wx = x * 176 + hash(x + 91, y) * 70,
          wy = y * 160 + hash(x, y + 81) * 70;
        if (Math.hypot(wx, wy) < 115 || roadDistance(wx, wy) < 79) continue;
        items.push({ x: wx, y: wy, kind: roll, variant: Math.floor(hash(x + 7, y + 3) * 3) });
      }
    }
    items.sort((a, b) => a.y - b.y);
    for (const item of items) {
      const { x, y, kind, variant } = item;
      if (kind < 0.72) {
        const tree = trees[variant];
        if (tree) ctx.drawImage(tree, Math.round(x - 72), Math.round(y - 155));
      } else if (kind < 0.85) {
        rect("#355d31", x - 24, y - 12, 48, 20);
        rect("#476f34", x - 18, y - 20, 36, 23);
        rect("#729243", x - 15, y - 20, 15, 5);
        rect("#5b843b", x + 6, y - 15, 12, 5);
        rect("#b47971", x - 9, y - 10, 3, 3);
        rect("#b47971", x + 12, y - 5, 3, 3);
      } else if (kind < 0.94) {
        rect("#4b3f2b", x - 15, y - 2, 30, 10);
        rect("#8c663d", x - 12, y - 17, 24, 20);
        rect("#b6945b", x - 15, y - 20, 30, 9);
        rect("#d1b478", x - 9, y - 18, 18, 4);
      } else {
        rect("#e1cd9a", x - 2, y - 7, 4, 10);
        rect("#b96a48", x - 8, y - 11, 16, 6);
        rect("#e4b78a", x - 5, y - 11, 3, 3);
        rect("#a4ab83", x + 14, y - 4, 10, 7);
      }
    }
  };
}
