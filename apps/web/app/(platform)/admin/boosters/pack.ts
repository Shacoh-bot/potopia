import { type Card, drawVictorySounds, VICTORY_RARITIES } from "@app/tcg";
import type { OpenedCard } from "@app/tcg/ui";
import { cardFaces } from "../cartes/images";

/** Un paquet prêt à afficher : ses cartes illustrées, dans l'ordre, et la taille du set. */
export type Pack = { cards: OpenedCard[]; setSize: number };

type Admin = { discordId: string | null };
type Player = Admin & { id: string };

/**
 * Cartes d'un paquet telles que le navigateur les reçoit : mêmes données que le menu « Cartes »
 * (image, « idée de … », taille du set), chaque carte dans sa version tirée (`layout`).
 *
 * Sert aussi au paquet SUIVANT, tiré d'avance (`peekBooster`) et envoyé au navigateur AVANT le clic
 * pour précharger ses illustrations. Le joueur peut donc lire son prochain paquet avant de l'ouvrir
 * ou de l'acheter (outils du navigateur : noms, raretés, versions et liens des illustrations des 5
 * cartes). Choix de l'utilisateur le 18/11/2026 (« on sera entre potes ») : à fermer si le site
 * s'ouvre au-delà des amis (n'envoyer alors que les liens d'images, ou rien avant l'achat).
 */
export async function packOf(admin: Admin, cards: Card[]): Promise<Pack> {
  const faces = await cardFaces(admin, cards);
  return {
    setSize: faces[0]?.setSize ?? 0,
    cards: faces.map(({ card, imageUrl, revealSoundUrl }) => ({
      id: card.id,
      card,
      imageUrl,
      revealSoundUrl,
    })),
  };
}

/**
 * Paquet OUVERT : chaque SR/SSR sans son propre reçoit un son de victoire, tiré pour le joueur (pas
 * de répétition avant d'avoir tout découvert) et noté comme découvert. Jamais pour le paquet tiré
 * d'avance (`packOf` seul) : on ne découvre un son qu'en ouvrant. Une panne du tirage laisse les
 * bruitages de rareté, le paquet s'ouvre quand même.
 */
export async function withVictorySounds(player: Player, pack: Pack): Promise<Pack> {
  const slots = pack.cards.flatMap((c, i) =>
    !c.revealSoundUrl && VICTORY_RARITIES.includes(c.card.rarity) ? [i] : [],
  );
  const drawn = await drawVictorySounds(player, slots.length).catch((error: unknown) => {
    console.error("Sons de victoire :", error);
    return [];
  });
  const cards = [...pack.cards];
  slots.forEach((slot, i) => {
    const sound = drawn[i];
    const card = cards[slot];
    if (sound && card) cards[slot] = { ...card, victorySoundUrl: sound.url };
  });
  return { ...pack, cards };
}
