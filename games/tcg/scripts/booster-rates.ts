/*
 * Calibre les poids de base de la carte chance des boosters (src/boosters.ts) : avec les
 * garanties (SR ou mieux au plus tard au SR_PITY-ième paquet, SSR au plus tard au SSR_PITY-ième),
 * les taux moyens RÉELS doivent rester ceux annoncés (CHANCE_RATES). Les garanties ajoutent des SR
 * et des SSR : les poids de base de SR et SSR sont donc plus bas, et ce qu'on leur retire va aux
 * autres raretés, au prorata.
 *
 *   pnpm booster:rates          cherche les poids (simulation, graine fixe) et les affiche
 *
 * À relancer après un changement de garantie ou de taux annoncé, puis reporter les poids dans
 * BOOSTER_ODDS (baseSr, baseSsr) de src/boosters.ts. Le test des boosters vérifie les taux par
 * simulation.
 */
import { CHANCE_RATES, chanceWeights, simulateChance, SR_PITY, SSR_PITY } from "../src/boosters";

const PACKS = 2_000_000;

/** Poids de base qui donnent les taux annoncés (dichotomies alternées sur SSR puis SR). */
function calibrate(): { sr: number; ssr: number } {
  let sr: number = CHANCE_RATES.sr;
  let ssr: number = CHANCE_RATES.ssr;
  const rates = (s: number, ss: number) => simulateChance(PACKS, chanceWeights(s, ss), 12);
  for (let round = 0; round < 6; round++) {
    let lo = 0;
    let hi: number = CHANCE_RATES.ssr;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (rates(sr, mid).ssr > CHANCE_RATES.ssr) hi = mid;
      else lo = mid;
    }
    ssr = (lo + hi) / 2;
    lo = 0;
    hi = CHANCE_RATES.sr as number;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (rates(mid, ssr).sr > CHANCE_RATES.sr) hi = mid;
      else lo = mid;
    }
    sr = (lo + hi) / 2;
  }
  return { sr, ssr };
}

const { sr, ssr } = calibrate();
const check = simulateChance(4_000_000, chanceWeights(sr, ssr), 99);
console.log(`Garanties : SR ou mieux au ${SR_PITY}e paquet, SSR au ${SSR_PITY ?? "—"}e.`);
console.log(`Poids de base : baseSr = ${sr.toFixed(3)}, baseSsr = ${ssr.toFixed(3)}`);
console.log(
  `Contrôle (4 M paquets, autre graine) : ${Object.entries(check)
    .map(([r, v]) => `${r} ${v.toFixed(3)} %`)
    .join(", ")}`,
);
