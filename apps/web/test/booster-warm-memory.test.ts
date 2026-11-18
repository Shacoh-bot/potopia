import { describe, expect, it } from "vitest";
import { boosterWarmKey, PREWARMED_ATTR, prewarmScript } from "../components/boosterWarmMemory";

/** Exécute le script en ligne avec un `sessionStorage` et un bloc parent simulés. */
function run(setCode: string, stored: Record<string, string>, storageFails = false) {
  const attrs: Record<string, string> = {};
  const parent = { setAttribute: (name: string, value: string) => (attrs[name] = value) };
  const sessionStorage = {
    getItem: (key: string) => {
      if (storageFails) throw new Error("SecurityError");
      return stored[key] ?? null;
    },
  };
  const document = { currentScript: { parentElement: parent } };
  new Function("sessionStorage", "document", prewarmScript(setCode))(sessionStorage, document);
  return attrs;
}

describe("script en ligne du bouton d'ouverture (rechargement)", () => {
  it("pose data-prewarmed quand le set est déjà chaud dans l'onglet", () => {
    expect(run("FF", { [boosterWarmKey("FF")]: "1" })).toEqual({ [PREWARMED_ATTR]: "" });
  });

  it("ne pose rien pour un set froid, un autre set ou un stockage refusé", () => {
    expect(run("FF", {})).toEqual({});
    expect(run("FF", { [boosterWarmKey("AB")]: "1" })).toEqual({});
    expect(run("FF", { [boosterWarmKey("FF")]: "1" }, true)).toEqual({});
  });

  it("échappe le code du set : impossible de fermer la balise script", () => {
    const script = prewarmScript('</script><script>alert("x")');
    expect(script).not.toContain("</script");
    expect(run('</script>"', { [boosterWarmKey('</script>"')]: "1" })).toEqual({
      [PREWARMED_ATTR]: "",
    });
  });
});
