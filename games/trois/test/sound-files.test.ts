import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Mark } from "../src/game";
import { TROIS_SOUNDS } from "../ui/sound-files";

describe("sons de TROIS", () => {
  it("chaque son existe et reste léger (< 100 Ko)", () => {
    for (const name of TROIS_SOUNDS) {
      const path = fileURLToPath(
        new URL(`../../../apps/web/public/audio/trois/${name}.mp3`, import.meta.url),
      );
      const size = statSync(path).size;
      expect(size, name).toBeGreaterThan(1000);
      expect(size, name).toBeLessThan(100 * 1024);
    }
  });

  it("un son de case par couleur", () => {
    const marks: Mark[] = ["correct", "present", "absent"];
    for (const mark of marks) expect(TROIS_SOUNDS).toContain(`tile-${mark}`);
  });
});
