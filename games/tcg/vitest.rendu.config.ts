import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

/**
 * Banc de rendu des cartes (filet de sécurité de la refonte) : les cartes de `test/rendu` dans un
 * vrai Firefox et un vrai Chrome, invisibles. Captures de référence prises sous Linux, dans l'image
 * Playwright du CI (mêmes polices, même rendu) : `pnpm test:rendu:docker` les compare en local, et
 * `pnpm test:rendu:docker --update` les renouvelle après un changement de rendu voulu.
 */
export default defineConfig({
  // Images fixes des cartes (pastilles « /tcg/badge-*.webp »…), servies comme sur le site.
  publicDir: fileURLToPath(new URL("../../apps/web/public", import.meta.url)),
  test: {
    include: ["test/rendu/**/*.rendu.test.tsx"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      viewport: { width: 900, height: 700 },
      instances: [{ browser: "chromium" }, { browser: "firefox" }],
    },
  },
});
