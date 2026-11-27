// Auras du booster pré-calculées (27/11) : une vidéo en boucle par rareté (épique, légendaire, SR,
// SSR), tirée du VRAI rendu de `ui/CardAura.tsx` (`paintAuraFrame` : mêmes vrilles WebGL, mêmes
// étincelles), dans un Chromium invisible. Boucle de BOUCLE s sans couture : sur les FONDU
// dernières secondes, l'image t se mêle à l'image t + BOUCLE (fondu enchaîné), si bien que la fin
// retombe exactement sur le début. Fond transparent : WebM VP9 avec couche alpha (yuva420p).
// Usage (depuis games/tcg, ffmpeg dans le PATH) : node scripts/aura-video.mjs [rareté…]
// Écrit apps/web/public/tcg/aura/<rareté>.webm. Aucun contenu réel : lumière calculée seulement.
/* global window, document -- code passé à page.evaluate, exécuté dans le navigateur */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

const ici = dirname(fileURLToPath(import.meta.url));
const sortie = join(ici, "../../../apps/web/public/tcg/aura");
const RARETES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["epic", "legendary", "sr", "ssr"];
const IPS = 30;
const BOUCLE = 6;
const FONDU = 1;
// Départ du rendu direct (il commence à 3 s) ; taille = boîte de l'aura (828 × 972 unités).
const DEPART = 3;
const [LARGEUR, HAUTEUR] = [414, 486];

const paquet = await build({
  entryPoints: [join(ici, "../ui/CardAura.tsx")],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "Aura",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "error",
});

const navigateur = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await navigateur.newPage();
await page.setContent("<!doctype html><body></body>");
await page.addScriptTag({ content: paquet.outputFiles[0].text });
mkdirSync(sortie, { recursive: true });

for (const rarete of RARETES) {
  const dossier = mkdtempSync(join(tmpdir(), `aura-${rarete}-`));
  const n = BOUCLE * IPS;
  const f = FONDU * IPS;
  for (let i = 0; i < n; i++) {
    const png = await page.evaluate(
      async ({ rarete, i, n, f, ips, depart, w, h }) => {
        const toile = (nom) => {
          window[nom] ??= Object.assign(document.createElement("canvas"), { width: w, height: h });
          return window[nom];
        };
        const peindre = async (cible, t) => {
          // Le contexte WebGL partagé compile au premier appel : on attend qu'il soit prêt.
          for (let k = 0; k < 200 && !window.Aura.paintAuraFrame(rarete, t, cible); k++) {
            await new Promise((r) => setTimeout(r, 50));
          }
        };
        const a = toile("_a");
        await peindre(a, depart + i / ips);
        // Image de sortie i : fin de boucle (i ≥ n − f) mêlée au début de la boucle suivante.
        if (i >= n - f) {
          const b = toile("_b");
          await peindre(b, depart + (i - n) / ips);
          const poids = (i - (n - f)) / f; // 0 → 1 : de l'image i vers l'image i − n (le début)
          const o = toile("_o");
          const x = o.getContext("2d");
          x.globalCompositeOperation = "source-over";
          x.globalAlpha = 1;
          x.clearRect(0, 0, w, h);
          x.globalAlpha = 1 - poids;
          x.drawImage(a, 0, 0);
          x.globalCompositeOperation = "lighter";
          x.globalAlpha = poids;
          x.drawImage(b, 0, 0);
          return o.toDataURL("image/png");
        }
        return a.toDataURL("image/png");
      },
      { rarete, i, n, f, ips: IPS, depart: DEPART, w: LARGEUR, h: HAUTEUR },
    );
    const nom = join(dossier, `i${String(i).padStart(4, "0")}.png`);
    writeFileSync(nom, Buffer.from(png.split(",")[1], "base64"));
  }
  const video = join(sortie, `${rarete}.webm`);
  const r = spawnSync(
    "ffmpeg",
    [
      ...["-loglevel", "error", "-y", "-framerate", String(IPS)],
      ...["-i", join(dossier, "i%04d.png")],
      ...["-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "42"],
      ...["-row-mt", "1", "-auto-alt-ref", "0", "-an", video],
    ],
    { stdio: "inherit" },
  );
  if (r.status !== 0) throw new Error(`ffmpeg a échoué (${rarete})`);
  rmSync(dossier, { recursive: true, force: true });
  console.log(`${video} : ${Math.round(statSync(video).size / 1024)} Ko`);
}
await navigateur.close();
