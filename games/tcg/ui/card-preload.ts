/*
 * Illustrations des cartes du prochain paquet, préparées avant le clic : le paquet est tiré
 * d'avance par le serveur (`peekBooster`), ses illustrations sont téléchargées (`fetchCardImages`)
 * puis décodées (`decodeCardImages`), et leurs images gardées en mémoire (`kept`) pour qu'elles
 * restent décodées. Au retournement, chaque carte affiche une image déjà prête : aucune requête,
 * aucune attente. Le décodage se fait hors du fil principal (`decode()`) ; rien n'est dessiné.
 */

type Kept = { img: HTMLImageElement; decoded: Promise<void> | null };

/** Images gardées, de la plus ancienne à la plus récente. */
const kept = new Map<string, Kept>();
/** Deux paquets (le courant et le suivant), et de la marge. */
const MAX_KEPT = 16;

const present = (urls: readonly (string | null | undefined)[]): string[] =>
  urls.filter((url): url is string => Boolean(url));

/**
 * Télécharge les illustrations (sans les décoder) : `low`, en basse priorité, pour ne pas passer
 * devant ce que la page affiche.
 */
export function fetchCardImages(
  urls: readonly (string | null | undefined)[],
  priority: "low" | "auto" = "auto",
): void {
  for (const url of present(urls)) {
    const known = kept.get(url);
    kept.delete(url);
    if (known) {
      kept.set(url, known);
      continue;
    }
    const img = new Image();
    img.decoding = "async";
    img.fetchPriority = priority;
    img.src = url;
    kept.set(url, { img, decoded: null });
  }
  // Les plus anciennes ne sont plus gardées (une carte affichée garde sa propre image).
  for (const url of kept.keys()) {
    if (kept.size <= MAX_KEPT) break;
    kept.delete(url);
  }
}

/**
 * Télécharge (si besoin) et décode les illustrations ; la promesse se résout quand toutes sont
 * prêtes. Une image en erreur ne bloque pas : la carte s'affichera comme avant.
 */
export function decodeCardImages(
  urls: readonly (string | null | undefined)[],
  priority: "low" | "auto" = "auto",
): Promise<void> {
  const list = present(urls);
  fetchCardImages(list, priority);
  return Promise.all(
    list.map((url) => {
      const entry = kept.get(url);
      if (!entry) return undefined;
      entry.decoded ??= entry.img.decode().catch(() => {});
      return entry.decoded;
    }),
  ).then(() => {});
}

/**
 * Filet de sécurité : se résout quand les illustrations sont décodées, au plus tard après
 * `timeoutMs` (alors les cartes s'affichent quand même).
 */
export function cardImagesReady(
  urls: readonly (string | null | undefined)[],
  timeoutMs: number,
): Promise<void> {
  if (present(urls).length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    void decodeCardImages(urls).then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}
