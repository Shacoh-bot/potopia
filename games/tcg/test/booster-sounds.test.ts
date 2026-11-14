import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CARD_RARITIES } from "../src/card-rules";
import { BOOSTER_SOUNDS, BOOSTER_SOUNDS_BASE, revealSound } from "../ui/booster-sound-files";

const file = (name: string) =>
  fileURLToPath(
    new URL(`../../../apps/web/public${BOOSTER_SOUNDS_BASE}${name}.mp3`, import.meta.url),
  );

describe("sons de l'ouverture d'un booster", () => {
  it("chaque son existe et reste léger (< 100 Ko)", () => {
    for (const name of BOOSTER_SOUNDS) {
      const size = statSync(file(name)).size;
      expect(size, name).toBeGreaterThan(1000);
      expect(size, name).toBeLessThan(100 * 1024);
    }
  });

  it("une révélation par rareté, la commune pour une rareté inconnue", () => {
    const reveals = CARD_RARITIES.map(revealSound);
    expect(new Set(reveals).size).toBe(CARD_RARITIES.length);
    for (const r of reveals) expect(BOOSTER_SOUNDS).toContain(r);
    expect(revealSound("inconnue")).toBe("reveal-common");
  });
});
