/** Événement écouté par l'effet « ZA WARUDO » de l'app (`apps/web/components/ZaWarudo`). */
export const ZA_WARUDO_EVENT = "app:za-warudo";

/** Détail de l'événement : `hold`, le temps reste arrêté jusqu'à un clic. */
export type ZaWarudoDetail = { hold: boolean };

/**
 * Événement du rouleau compresseur de DIO (secret du thème JoJo) : un clic sur DIO pendant que le
 * temps est arrêté le déclenche, écouté par les effets JoJo de l'app (`apps/web/components/JojoFx`).
 */
export const ROAD_ROLLER_EVENT = "app:road-roller";

/**
 * Arrêt du temps façon DIO : onde qui inverse les couleurs, page figée dans une teinte délavée,
 * puis le temps reprend : tout seul à la fin de la réplique, ou, avec `hold`, seulement au clic.
 * Sans effet monté, rien ne se passe.
 */
export function zaWarudo({ hold = false }: { hold?: boolean } = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ZaWarudoDetail>(ZA_WARUDO_EVENT, { detail: { hold } }));
}
