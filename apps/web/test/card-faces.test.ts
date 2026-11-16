import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { countSetCards, createCard, ensureSet, getCard, trashCards } from "@app/tcg";
import { beforeEach, describe, expect, it } from "vitest";
import { cardFaces } from "@/app/(platform)/admin/cartes/images";

const ADMIN = { discordId: "100000000000000001" };
const MEMBER = { discordId: "100000000000000002" };
const BASE = { rarity: "common", type: "Créature", cost: 2, power: 3 } as const;

let setId = "";
let ideaId = "";

beforeEach(async () => {
  await truncateTestDb();
  setId = (await ensureSet(ADMIN, { code: "S1", name: "Set de test" })).id;
  await db.user.create({
    data: { id: "auteur-1", name: "Alice", email: "alice@example.test" },
  });
  ideaId = (
    await db.idea.create({
      data: { authorId: "auteur-1", title: "Idée", description: "Texte" },
    })
  ).id;
});

describe("cardFaces : la carte prête à afficher, la même sur tous les écrans", () => {
  it("donne l'auteur de l'idée, la taille du set et l'image, pour chaque version", async () => {
    const fromIdea = await createCard(ADMIN, { ...BASE, name: "Tirée d'une idée", setId, ideaId });
    await createCard(ADMIN, { ...BASE, name: "Sans idée", setId });
    const trashed = await createCard(ADMIN, { ...BASE, name: "À la corbeille", setId });
    await trashCards(ADMIN, [trashed.id]);
    const card = (await getCard(ADMIN, fromIdea.id)) ?? fromIdea;

    // menu « Cartes » (version par défaut), Potodex et booster (version tirée) : mêmes données
    const [normal, full] = await cardFaces(ADMIN, [
      { ...card, layout: "normal" },
      { ...card, layout: "fullart" },
    ]);
    for (const face of [normal, full]) {
      expect(face?.card.author).toBe("Alice");
      // la carte à la corbeille n'est plus dans le set
      expect(face?.setSize).toBe(2);
      // ni illustration ni image d'idée : le dessin de remplacement
      expect(face?.imageUrl).toBeNull();
    }
    expect(full?.card.layout).toBe("fullart");
  });

  it("version réduite pour la petite carte, grande pour l'agrandie ; sans réduite, comme avant", async () => {
    const card = await createCard(ADMIN, { ...BASE, name: "Illustrée", setId });
    const large = `cards/${crypto.randomUUID()}.webp`;
    const small = `cards/${crypto.randomUUID()}.webp`;
    await db.tcgCard.update({ where: { id: card.id }, data: { imageKey: large } });
    const before = (await getCard(ADMIN, card.id)) ?? card;
    const [plain] = await cardFaces(ADMIN, [before]);
    // illustration envoyée avant : la même qu'aujourd'hui, pas de grande à part
    expect(plain?.imageUrl).toContain(large);
    expect(plain?.card.imageUrlLarge).toBeNull();

    await db.tcgCard.update({ where: { id: card.id }, data: { imageKeySmall: small } });
    const after = (await getCard(ADMIN, card.id)) ?? card;
    const [face] = await cardFaces(ADMIN, [after]);
    expect(face?.imageUrl).toContain(small);
    expect(face?.card.imageUrlLarge).toContain(large);
  });

  it("carte hors set et sans idée : ni taille de set ni auteur", async () => {
    const reserve = await createCard(ADMIN, { ...BASE, name: "Réserve" });
    const [face] = await cardFaces(ADMIN, [reserve]);
    expect(face).toMatchObject({ setSize: undefined, imageUrl: null });
    expect(face?.card.author).toBeNull();
  });

  it("réservé aux admins", async () => {
    const card = await createCard(ADMIN, { ...BASE, name: "A", setId, ideaId });
    await expect(cardFaces(MEMBER, [card])).rejects.toThrow("Réservé aux admins.");
    await expect(countSetCards(MEMBER, [setId])).rejects.toThrow("Réservé aux admins.");
    expect(await countSetCards(ADMIN, [setId, "set-vide"])).toEqual(
      new Map([
        [setId, 1],
        ["set-vide", 0],
      ]),
    );
  });
});
