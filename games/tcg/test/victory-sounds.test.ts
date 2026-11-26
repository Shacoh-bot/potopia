import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createVictorySoundUpload,
  drawVictorySounds,
  getVictorySoundsDex,
  pickVictorySound,
  resetCollection,
  showVictorySoundsTab,
  syncVictorySounds,
} from "../src";
import { planVictorySync } from "../ui/victory-plan";

// Données d'exemple : titres inventés, aucun vrai son (règle 6 de CLAUDE.md).
const ADMIN = { discordId: "100000000000000001", id: "joueur-admin" };
const OTHER = { discordId: "100000000000000001", id: "autre-joueur" };
const MEMBER = { discordId: "100000000000000002", id: "membre" };

// en-tête d'une trame MP3 (MPEG-1 couche III)
const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0, 0, 0, 0]);
async function send(): Promise<string> {
  const { key, url } = await createVictorySoundUpload(ADMIN, {
    contentType: "audio/mpeg",
    size: mp3.length,
  });
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "audio/mpeg" },
    body: mp3,
  });
  expect(res.status).toBe(200);
  return key;
}

async function seed(ids: string[]) {
  const list = [];
  for (const id of ids) list.push({ id, title: `Son ${id}`, key: await send() });
  return syncVictorySounds(ADMIN, list);
}

beforeEach(async () => {
  await truncateTestDb();
});

describe("tirage d'un son de victoire", () => {
  it("ne répète aucun son avant de les avoir tous découverts, puis vrai hasard", () => {
    const ids = ["a", "b", "c", "d", "e"];
    for (let seed = 1; seed <= 20; seed++) {
      let x = seed;
      const rnd = () => (x = (x * 9301 + 49297) % 233280) / 233280;
      const heard = new Set<string>();
      for (let i = 0; i < ids.length; i++) {
        const id = pickVictorySound(ids, heard, rnd);
        expect(id).not.toBeNull();
        expect(heard.has(id ?? "")).toBe(false);
        heard.add(id ?? "");
      }
      expect(heard.size).toBe(ids.length);
      // tout découvert : un son parmi tous
      expect(ids).toContain(pickVictorySound(ids, heard, rnd));
    }
    expect(pickVictorySound([], new Set())).toBeNull();
  });

  it("par joueur, mémorisé en base : tous différents jusqu'à épuisement", async () => {
    await seed(["vic-a", "vic-b", "vic-c"]);
    const first = await drawVictorySounds(ADMIN, 2);
    expect(new Set(first.map((s) => s.id)).size).toBe(2);
    expect(first.every((s) => s.url.length > 0)).toBe(true);
    const third = await drawVictorySounds(ADMIN, 1);
    expect(first.map((s) => s.id)).not.toContain(third[0]?.id);
    // un autre joueur repart de zéro
    expect(await getVictorySoundsDex(OTHER)).toMatchObject({ total: 3, sounds: [] });
    // tout découvert : le tirage continue (vrai hasard), les compteurs montent
    const more = await drawVictorySounds(ADMIN, 4);
    expect(more).toHaveLength(4);
    const counts = await db.tcgHeardVictorySound.findMany({ where: { userId: ADMIN.id } });
    expect(counts).toHaveLength(3);
    expect(counts.reduce((n, c) => n + c.count, 0)).toBe(7);
  });

  it("aucun son actif : rien à jouer (les bruitages de rareté restent)", async () => {
    expect(await drawVictorySounds(ADMIN, 2)).toEqual([]);
    expect(await drawVictorySounds(ADMIN, 0)).toEqual([]);
  });
});

describe("onglet Sons du Potodex", () => {
  it("caché tant qu'aucun son n'est découvert, puis seulement les sons découverts", async () => {
    await seed(["vic-a", "vic-b", "vic-c"]);
    const empty = await getVictorySoundsDex(ADMIN);
    expect(empty).toEqual({ total: 3, sounds: [] });
    expect(showVictorySoundsTab(empty)).toBe(false);
    const [drawn] = await drawVictorySounds(ADMIN, 1);
    const dex = await getVictorySoundsDex(ADMIN);
    expect(showVictorySoundsTab(dex)).toBe(true);
    expect(dex.total).toBe(3);
    expect(dex.sounds.map((s) => s.id)).toEqual([drawn?.id]);
    expect(dex.sounds[0]?.title).toBe(`Son ${drawn?.id}`);
  });

  it("aperçu admin complet : tous les sons, sans toucher aux découvertes", async () => {
    await seed(["vic-a", "vic-b"]);
    const all = await getVictorySoundsDex(ADMIN, { all: true });
    expect(all.sounds.map((s) => s.id)).toEqual(["vic-a", "vic-b"]);
    expect(await db.tcgHeardVictorySound.count()).toBe(0);
  });

  it("la remise à zéro de la collection fait tout redécouvrir", async () => {
    await seed(["vic-a"]);
    await drawVictorySounds(ADMIN, 1);
    await resetCollection(ADMIN);
    expect(showVictorySoundsTab(await getVictorySoundsDex(ADMIN))).toBe(false);
  });

  it("réservé aux admins", async () => {
    await expect(getVictorySoundsDex(MEMBER)).rejects.toThrow();
  });
});

describe("synchronisation de la liste", () => {
  it("ajoute, désactive les sons retirés (plus tirés ni montrés), réactive au retour", async () => {
    expect(await seed(["vic-a", "vic-b"])).toMatchObject({ added: 2, active: 2 });
    await drawVictorySounds(ADMIN, 2);
    const res = await syncVictorySounds(ADMIN, [{ id: "vic-a", title: "Nouveau titre" }]);
    expect(res).toMatchObject({ added: 0, disabled: 1, active: 1 });
    const dex = await getVictorySoundsDex(ADMIN);
    expect(dex).toMatchObject({ total: 1, sounds: [{ id: "vic-a", title: "Nouveau titre" }] });
    const draws = await drawVictorySounds(ADMIN, 3);
    expect(draws.map((d) => d.id)).toEqual(["vic-a", "vic-a", "vic-a"]);
    // retour dans la liste : la découverte d'avant est gardée
    await syncVictorySounds(ADMIN, [
      { id: "vic-a", title: "A" },
      { id: "vic-b", title: "B" },
    ]);
    expect((await getVictorySoundsDex(ADMIN)).sounds).toHaveLength(2);
  });

  it("refuse un son nouveau sans fichier, un doublon, un fichier absent, un membre", async () => {
    await expect(syncVictorySounds(ADMIN, [{ id: "vic-z", title: "Z" }])).rejects.toThrow(
      /fichier manquant/,
    );
    const key = await send();
    await expect(
      syncVictorySounds(ADMIN, [
        { id: "vic-a", title: "A", key },
        { id: "vic-a", title: "A", key },
      ]),
    ).rejects.toThrow(/double/);
    await expect(
      syncVictorySounds(ADMIN, [
        { id: "vic-a", title: "A", key: "sounds/victory/00000000-0000-0000-0000-000000000000.mp3" },
      ]),
    ).rejects.toThrow(/introuvable/);
    await expect(syncVictorySounds(MEMBER, [])).rejects.toThrow();
    await expect(
      createVictorySoundUpload(ADMIN, { contentType: "audio/mpeg", size: 7 * 1024 * 1024 }),
    ).rejects.toThrow();
  });

  it("prépare l'envoi : seulement les sons non écartés, nouveaux ou changés", () => {
    const liste = {
      sons: [
        { id: "vic-01", titre: "Un", fichier: "rendus/vic-01.mp3", ecarte: false },
        { id: "vic-02", titre: "Deux", fichier: "rendus/vic-02.mp3", ecarte: true },
        { id: "vic-03", titre: "Trois", fichier: "rendus/vic-03.mp3", ecarte: false },
        { id: "vic-04", titre: "Quatre", fichier: "rendus/vic-04.mp3", ecarte: false },
      ],
    };
    const files = new Map([
      ["dossier/rendus/vic-01.mp3", 100],
      ["dossier/rendus/vic-02.mp3", 200],
      ["dossier/rendus/vic-03.mp3", 300],
    ]);
    // vic-03 déjà là, même taille ; vic-04 déjà là, fichier absent du dossier
    const current = new Map([
      ["vic-03", 300],
      ["vic-04", 400],
    ]);
    expect(planVictorySync(liste, files, current)).toEqual([
      { id: "vic-01", title: "Un", file: "dossier/rendus/vic-01.mp3" },
      { id: "vic-03", title: "Trois", file: null },
      { id: "vic-04", title: "Quatre", file: null },
    ]);
    expect(() => planVictorySync(liste, files, new Map())).toThrow(/vic-04\.mp3 absent/);
    expect(() => planVictorySync({ autre: 1 }, files, current)).toThrow(/illisible/);
  });
});
