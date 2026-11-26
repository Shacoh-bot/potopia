import { getUsersByIds } from "@app/core";
import { getIdeaAuthorIds, listIdeaImageUrls } from "@app/ideas";
import { presignGetStable } from "@app/storage";
import {
  type Card,
  countSetCards,
  imageKeyFor,
  revealSoundKeyFor,
  smallImageKeyFor,
} from "@app/tcg";

import type { DuplicateCandidate } from "./forms";

type Admin = { discordId: string | null };

/** Clé des URL d'illustration : la carte et sa version (`layout`), qui a son illustration. */
export const imageId = (card: Pick<Card, "id" | "layout">) => `${card.id}:${card.layout}`;

/**
 * URL d'illustration de chaque carte dans sa version (`layout`), par `imageId` : celle de la
 * version (la full art reprend celle de la normale sans la sienne), ou celle de son idée quand
 * l'idée a une image. URLs présignées directement (pas de redirection par carte) et stables 5 min, pour que le
 * navigateur garde les images en cache ; une nouvelle illustration a une nouvelle clé, donc une
 * nouvelle URL.
 */
async function cardImageUrls(
  admin: Admin,
  cards: Card[],
): Promise<Map<string, { url: string | null; large: string | null }>> {
  const borrowed = await listIdeaImageUrls(
    admin,
    cards.flatMap((c) => (!imageKeyFor(c, c.layout) && c.ideaId ? [c.ideaId] : [])),
  );
  return new Map(
    await Promise.all(
      cards.map(async (c) => {
        const key = imageKeyFor(c, c.layout);
        const small = key ? smallImageKeyFor(c, c.layout) : null;
        // Avec une version réduite, la petite carte la charge ; la grande attend l'agrandissement.
        const image = !key
          ? { url: (c.ideaId && borrowed.get(c.ideaId)) ?? null, large: null }
          : small
            ? { url: await presignGetStable(small), large: await presignGetStable(key) }
            : { url: await presignGetStable(key), large: null };
        return [imageId(c), image] as const;
      }),
    ),
  );
}

/** Nom de l'auteur de l'idée de chaque carte (par id de carte), pour « idée de … ». */
async function cardAuthors(admin: Admin, cards: Card[]): Promise<Map<string, string>> {
  const ideaAuthors = await getIdeaAuthorIds(
    admin,
    cards.flatMap((c) => (c.ideaId ? [c.ideaId] : [])),
  );
  const users = await getUsersByIds([...new Set(ideaAuthors.values())]);
  const names = new Map(users.map((u) => [u.id, u.name]));
  return new Map(
    cards.flatMap((c) => {
      const name = c.ideaId && names.get(ideaAuthors.get(c.ideaId) ?? "");
      return name ? [[c.id, name] as const] : [];
    }),
  );
}

/** Une carte prête à afficher : ses données avec l'auteur de son idée, son image, la taille du set. */
export type CardFace = {
  /** `imageUrlLarge` : la grande illustration, quand `imageUrl` est sa version réduite. */
  card: Card & { author: string | null; imageUrlLarge: string | null };
  imageUrl: string | null;
  /** Son propre de la carte dans sa version, joué à son retournement ; null : bruitages de rareté. */
  revealSoundUrl: string | null;
  /** Nombre de cartes de son set (« 07/44 ») ; absent : carte hors set. */
  setSize?: number;
};

/**
 * Source unique de l'affichage d'une carte : tous les écrans (menu « Cartes », fiche, booster,
 * Potodex) préparent leurs cartes ici, avec les règles du menu « Cartes ». Chaque carte dans sa
 * version (`layout`) reçoit son image (`cardImageUrls` : version réduite pour la petite carte, grande
 * quand elle s'affiche en grand), l'auteur de son idée pour le pied
 * « idée de … » (`cardAuthors`) et la taille de son set. Ce qui entoure la carte (aura, ×N,
 * légendes, case à cocher) reste à chaque écran ; `GameCard` dessine la carte, la même partout.
 */
export async function cardFaces(admin: Admin, cards: Card[]): Promise<CardFace[]> {
  const [images, authors, sizes, sounds] = await Promise.all([
    cardImageUrls(admin, cards),
    cardAuthors(admin, cards),
    countSetCards(
      admin,
      cards.flatMap((c) => (c.setId ? [c.setId] : [])),
    ),
    Promise.all(
      cards.map((c) => {
        const key = revealSoundKeyFor(c, c.layout);
        return key ? presignGetStable(key) : null;
      }),
    ),
  ]);
  return cards.map((card, i) => ({
    card: {
      ...card,
      author: authors.get(card.id) ?? null,
      imageUrlLarge: images.get(imageId(card))?.large ?? null,
    },
    imageUrl: images.get(imageId(card))?.url ?? null,
    revealSoundUrl: sounds[i] ?? null,
    setSize: card.setId ? sizes.get(card.setId) : undefined,
  }));
}

/** Familles déjà utilisées, proposées dans l'éditeur. */
export function familiesOf(cards: Card[]): string[] {
  return [...new Set(cards.flatMap((c) => (c.family ? [c.family] : [])))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/**
 * Cartes qu'on peut choisir comme original d'un doublon (`DuplicateOfPicker`), par nom : leur
 * place (code du set, sinon « Réserve ») et leur miniature.
 */
export async function duplicateCandidates(
  admin: Admin,
  cards: Card[],
): Promise<DuplicateCandidate[]> {
  const urls = await cardImageUrls(admin, cards);
  return [...cards]
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    .map((c) => ({
      id: c.id,
      name: c.name,
      place: c.setCode ?? "Réserve",
      thumb: urls.get(imageId(c))?.url ?? null,
    }));
}
