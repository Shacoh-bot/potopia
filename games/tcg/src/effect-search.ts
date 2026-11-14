import { type EffectDef, type EffectTrigger, effectText, defaultParams } from "./effects";
import { SNAP_CARDS } from "./snap-cards";

/** Filtres du choix d'effet dans l'admin : texte cherché, moment, coût de la carte Snap. */
export type EffectFilters = {
  query?: string;
  trigger?: EffectTrigger | "";
  /** Coût de la carte Snap ; 6 : 6 ou plus. */
  cost?: number | null;
};

/** Plus haut coût proposé dans le filtre : « 6+ » regroupe les cartes à 6 ou plus. */
export const COST_FILTER_MAX = 6;

/** Texte sans casse ni accents, pour une recherche tolérante (« reveil » trouve « Révélation »). */
export const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Effets qui passent les filtres. La recherche porte sur le nom de la carte Snap, le libellé et le
 * texte de l'effet (réglages par défaut) ; chaque mot cherché doit s'y trouver.
 */
export function searchEffects(effects: readonly EffectDef[], filters: EffectFilters): EffectDef[] {
  const words = fold(filters.query ?? "")
    .split(/\s+/)
    .filter(Boolean);
  return effects.filter((effect) => {
    if (filters.trigger && effect.trigger !== filters.trigger) return false;
    if (filters.cost !== undefined && filters.cost !== null) {
      const cost = SNAP_CARDS[effect.snap]?.cost;
      if (cost === undefined) return false;
      if (filters.cost >= COST_FILTER_MAX ? cost < COST_FILTER_MAX : cost !== filters.cost) {
        return false;
      }
    }
    if (!words.length) return true;
    const haystack = fold(
      `${effect.snap} ${effect.label} ${effectText(effect.key, defaultParams(effect))}`,
    );
    return words.every((w) => haystack.includes(w));
  });
}
