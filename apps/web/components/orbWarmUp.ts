/*
 * Préchauffage du rebond de la boule de l'en-tête (`OrbWarmUp`) : quand s'arrêter.
 * Chrome compile les programmes GPU du reflet la première fois qu'il le dessine ; une compilation
 * fige l'affichage (~0,5 s). Tant que la page est occupée (préchauffage des boosters), le reflet
 * n'est presque pas dessiné et rien ne se compile. Le préchauffage rebondit donc jusqu'à ce que
 * deux rebonds de suite passent sans image longue : alors plus rien ne reste à compiler.
 */

/** Une image plus longue que ça : arrêt (compilation ou page occupée). */
export const ORB_WARM_UP_SMOOTH_MS = 50;
/** Rebonds fluides de suite pour finir. */
export const ORB_WARM_UP_CLEAN_HOPS = 2;
/** Au plus tant de rebonds (machine lente : on n'insiste pas). */
export const ORB_WARM_UP_MAX_HOPS = 10;

/**
 * Après un rebond du préchauffage (le n° `hop`, à partir de 0) dont la plus longue image a duré
 * `worstFrameMs` : la nouvelle série de rebonds fluides, et si le préchauffage est fini.
 */
export function afterWarmUpHop(
  hop: number,
  cleanStreak: number,
  worstFrameMs: number,
): { cleanStreak: number; done: boolean } {
  const streak = worstFrameMs <= ORB_WARM_UP_SMOOTH_MS ? cleanStreak + 1 : 0;
  return {
    cleanStreak: streak,
    done: streak >= ORB_WARM_UP_CLEAN_HOPS || hop + 1 >= ORB_WARM_UP_MAX_HOPS,
  };
}
