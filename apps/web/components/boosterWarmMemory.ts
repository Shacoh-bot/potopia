/**
 * Sets déjà préchauffés dans cet onglet (page des boosters) : les programmes GPU compilés restent
 * jusqu'à la fermeture du navigateur. En mémoire pour un retour sur la page, et dans l'onglet
 * (`sessionStorage`) pour un rechargement : pas de barre la fois suivante.
 */
const warmSets = new Set<string>();

export const boosterWarmKey = (setCode: string) => `potopia:booster-prechauffe:${setCode}`;

export function isBoosterWarm(setCode: string): boolean {
  if (warmSets.has(setCode)) return true;
  try {
    return window.sessionStorage.getItem(boosterWarmKey(setCode)) === "1";
  } catch {
    return false;
  }
}

export function rememberBoosterWarm(setCode: string) {
  warmSets.add(setCode);
  try {
    window.sessionStorage.setItem(boosterWarmKey(setCode), "1");
  } catch {
    // stockage refusé : la mémoire de la page suffit
  }
}

/** Attribut posé sur le bloc du bouton quand le set est déjà chaud, avant la 1re image. */
export const PREWARMED_ATTR = "data-prewarmed";

/**
 * Script en ligne du rendu serveur (rechargement complet) : lit `sessionStorage` avant que le
 * bouton soit peint et pose `data-prewarmed` sur son bloc parent ; le CSS (`globals.css`) montre
 * alors le bouton normal jusqu'à l'hydratation, sans « Préparation… » ni barre. Même principe
 * qu'un anti-flash de thème. `<` échappé : le code du set ne peut pas fermer la balise.
 */
export function prewarmScript(setCode: string): string {
  const key = JSON.stringify(boosterWarmKey(setCode)).replace(/</g, "\\u003c");
  return `try{if(sessionStorage.getItem(${key})==="1")document.currentScript.parentElement.setAttribute("${PREWARMED_ATTR}","")}catch(e){}`;
}
