/*
 * Nom des cookies de session. Sans dépendance (pas de base) : importé aussi par le proxy de l'app.
 */

/** Préfixe par défaut de Better Auth : celui de la prod, à ne pas changer (sessions en cours). */
export const DEFAULT_COOKIE_PREFIX = "better-auth";

/**
 * Préfixe des cookies de Better Auth. En développement local seulement (`next dev`, hôte
 * localhost ou 127.0.0.1 avec un port), un préfixe propre au port : les cookies ne tiennent pas
 * compte du port, et plusieurs serveurs locaux (3000, 3001…) chacun sur sa base s'écrasaient leur
 * session. Partout ailleurs (prod, previews Vercel, `next start`, tests) : le préfixe par défaut.
 */
export function sessionCookiePrefix(
  baseURL: string | undefined,
  env: { NODE_ENV?: string; VERCEL?: string } = process.env,
): string {
  if (env.NODE_ENV !== "development" || env.VERCEL || !baseURL) return DEFAULT_COOKIE_PREFIX;
  let url: URL;
  try {
    url = new URL(baseURL);
  } catch {
    return DEFAULT_COOKIE_PREFIX;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  return local && url.port ? `${DEFAULT_COOKIE_PREFIX}-${url.port}` : DEFAULT_COOKIE_PREFIX;
}
