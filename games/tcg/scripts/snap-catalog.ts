/*
 * Régénère games/tcg/src/snap-cards.ts (lancé depuis la racine : `pnpm snap:catalog`) : coût, puissance et page snap.fan de toutes les cartes de
 * collection de Marvel Snap (Séries 1 à 5, cartes de départ, niveaux de collection, saison des
 * recrues ; ni jetons, ni cartes de modes de jeu, ni cartes pas encore sorties).
 *
 *   pnpm snap:catalog                 télécharge les données (marvelsnapzone.com) et réécrit le fichier
 *   pnpm snap:catalog --from f.json   part d'un fichier déjà téléchargé (--index f.html : l'index snap.fan)
 *   pnpm snap:catalog --check-urls    vérifie aussi que chaque page snap.fan existe
 *
 * Le site ne dépend jamais du réseau : seul ce script télécharge, le fichier généré est commité.
 * Les textes français des effets ne sont pas générés : ils s'écrivent à la main dans
 * games/tcg/src/snap-effects.ts. Le script liste les cartes qui n'en ont pas encore.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { EFFECTS } from "../src/effects";
import { SNAP_TEXTS } from "../src/snap-effects";

const SOURCE = "https://marvelsnapzone.com/getinfo/?searchtype=cards&searchcardstype=true";
/** Index des cartes de snap.fan : l'adresse exacte de chaque page (leur casse ne suit pas le nom). */
const INDEX = "https://snap.fan/cards/";
const OUT = fileURLToPath(new URL("../src/snap-cards.ts", import.meta.url));
const COLLECTION = new Set([
  "Starter Card",
  "Recruit Season",
  "Collection Level 1-14",
  "Series 1",
  "Series 2",
  "Series 3",
  "Series 4",
  "Series 5",
]);
/** Pages snap.fan dont l'adresse ne suit pas le nom, même sans casse ni ponctuation. */
const URL_OVERRIDES: Record<string, string> = {
  Araña: "Arana",
  "Doctor Doom": "DrDoom",
  "Doctor Doom 2099": "Doom2099",
  "Emperor Hulkling": "Hulkling",
  "Hawkeye Kate Bishop": "KateBishop",
  "Isca the Unbeaten": "Isca",
  "Mister Fantastic": "MrFantastic",
  "Mister Fantastic First Steps": "MrFantasticFirstSteps",
  "Mister Negative": "MrNegative",
  "Mister Sinister": "MrSinister",
  Monstro: "MonstroOctopus",
  "Nova Frankie Raye": "FrankieRaye",
  "Omega Sentinel": "KarimaShapandar",
  "Phoenix Force": "ThePhoenixForce",
  "The First Ghost Rider": "GhostTheFirstRider",
  "The Living Tribunal": "LivingTribunal",
  "Viv Vision": "Viv",
};

const cardSchema = z.object({
  name: z.string(),
  type: z.string(),
  cost: z.number().int(),
  power: z.number().int(),
  status: z.string(),
  source: z.string(),
});
const payload = z.object({
  success: z.object({ cards: z.array(z.looseObject(cardSchema.shape)) }),
});

const args = process.argv.slice(2);
const from = args.includes("--from") ? args[args.indexOf("--from") + 1] : null;

const raw = from
  ? readFileSync(from, "utf8")
  : await (await fetch(SOURCE, { headers: { "user-agent": "potopia-snap-catalog" } })).text();
const cards = payload
  .parse(JSON.parse(raw))
  .success.cards.filter(
    (c) => c.type === "Character" && c.status === "released" && COLLECTION.has(c.source),
  )
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

const get = async (address: string) =>
  (await fetch(address, { headers: { "user-agent": "potopia-snap-catalog" } })).text();
const index = args.includes("--index")
  ? readFileSync(args[args.indexOf("--index") + 1] ?? "", "utf8")
  : await get(INDEX);
const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
const slugs = new Map(
  [...index.matchAll(/href="\/cards\/([A-Za-z0-9_-]+)\/"/g)].map((m) => [squash(m[1] ?? ""), m[1]]),
);
/**
 * Adresse snap.fan d'une carte : son nom sans casse ni ponctuation, sinon la page dont le nom est
 * le début du sien (« Uatu the Watcher » : Uatu ; « The Hood » : Hood ; « Archangel Horseman of
 * Death » : ArchangelHorseman), la plus longue.
 */
const names = new Set(cards.map((c) => squash(c.name)));
function slugOf(name: string): string | undefined {
  if (URL_OVERRIDES[name]) return URL_OVERRIDES[name];
  const full = squash(name);
  const bare = full.replace(/^the/, "");
  const exact = slugs.get(full) ?? slugs.get(bare);
  if (exact) return exact;
  // jamais la page d'une autre carte (« Hawkeye Kate Bishop » n'est pas « Hawkeye »)
  const prefixes = [...slugs.keys()]
    .filter((s) => s.length >= 4 && (full.startsWith(s) || bare.startsWith(s)))
    .filter((s) => !names.has(s))
    .sort((a, b) => b.length - a.length);
  return prefixes[0] ? slugs.get(prefixes[0]) : undefined;
}
const byPrefix = cards
  .filter((c) => {
    const slug = slugOf(c.name);
    return slug && !URL_OVERRIDES[c.name] && squash(slug) !== squash(c.name);
  })
  .map((c) => `${c.name} → ${slugOf(c.name)}`);
if (byPrefix.length) console.log(`Adresses trouvées par le début du nom : ${byPrefix.join(" ; ")}`);
const unknown = cards.filter((c) => !slugOf(c.name)).map((c) => c.name);
if (unknown.length)
  console.log(`Absentes de l'index snap.fan (adresse devinée) : ${unknown.join(", ")}`);
const url = (name: string) =>
  `https://snap.fan/cards/${slugOf(name) ?? name.replace(/[^A-Za-z0-9]/g, "")}/`;

if (args.includes("--check-urls")) {
  const broken: string[] = [];
  const queue = [...cards];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        const res = await fetch(url(c.name), { headers: { "user-agent": "potopia-snap-catalog" } });
        if (res.status !== 200) broken.push(`${c.name} → ${url(c.name)} (${res.status})`);
      }
    }),
  );
  console.log(
    broken.length
      ? `${broken.length} pages introuvables :\n${broken.join("\n")}`
      : "Pages snap.fan : toutes trouvées.",
  );
}

const day = new Date().toISOString().slice(0, 10);
const lines = cards.map(
  (c) =>
    `  ${JSON.stringify(c.name)}: { cost: ${c.cost}, power: ${c.power}, url: ${JSON.stringify(url(c.name))} },`,
);
writeFileSync(
  OUT,
  `/*
 * Généré par \`pnpm snap:catalog\` (games/tcg/scripts/snap-catalog.ts) le ${day} : ne pas modifier à la main.
 * Coût et puissance actuels (après équilibrages) des ${cards.length} cartes de collection de Marvel
 * Snap, et leur page snap.fan. Source : marvelsnapzone.com (valeurs identiques à snap.fan, vérifiées
 * sur 109 cartes le 13/11/2026). Une carte qui prend un effet prend ces stats, sauf « Stats
 * manuelles » (\`effectStats\`, src/effects.ts).
 */

export type SnapStats = { cost: number; power: number; url: string };

export const SNAP_CARDS: Record<string, SnapStats> = {
${lines.join("\n")}
};
`,
  { encoding: "utf8" },
);
console.log(`${cards.length} cartes écrites dans games/tcg/src/snap-cards.ts`);

const covered = new Set([...EFFECTS.map((e) => e.snap), ...Object.keys(SNAP_TEXTS)]);
const missing = cards.filter((c) => !covered.has(c.name)).map((c) => c.name);
console.log(
  missing.length
    ? `Sans effet en français (à écrire dans snap-effects.ts) : ${missing.join(", ")}`
    : "Chaque carte a son effet en français.",
);
