import type { Card } from "@app/tcg";
import type { OpenedCard } from "@app/tcg/ui";
import { cardFaces } from "../cartes/images";

/** Un paquet prêt à afficher : ses cartes illustrées, dans l'ordre, et la taille du set. */
export type Pack = { cards: OpenedCard[]; setSize: number };

type Admin = { discordId: string | null };

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
