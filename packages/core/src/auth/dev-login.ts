import { db } from "@app/db";
import { getAuth } from "./auth";

/**
 * Connexion de développement : en local, la page /login ouvre une session sans passer par
 * Discord (pas de validation à chaque test). Jamais en production : `next build` / `next start`
 * mettent NODE_ENV à `production`, et Vercel pose VERCEL sur tous ses déploiements (previews
 * comprises) ; l'un ou l'autre suffit à la fermer.
 */
export function isDevLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" && !env.VERCEL;
}

/** Compte fictif utilisé quand le compte de l'admin n'existe pas encore en local. */
export const DEV_USER = {
  id: "dev-local",
  name: "Dev local",
  email: "dev-local@example.test",
} as const;

/**
 * Le compte à ouvrir : celui du premier admin (ADMIN_DISCORD_IDS) s'il s'est déjà connecté une
 * fois avec Discord sur cette base, pour tester avec son vrai compte et ses droits ; sinon le
 * compte fictif « Dev local », créé au besoin (simple membre).
 */
async function devUserId(): Promise<string> {
  const adminId = (process.env.ADMIN_DISCORD_IDS ?? "").split(",")[0]?.trim();
  if (adminId) {
    const admin = await db.user.findUnique({ where: { discordId: adminId }, select: { id: true } });
    if (admin) return admin.id;
  }
  const user = await db.user.upsert({
    where: { id: DEV_USER.id },
    update: {},
    create: { ...DEV_USER, emailVerified: true },
    select: { id: true },
  });
  return user.id;
}

/** Cookie de session à poser : nom, valeur signée et attributs choisis par Better Auth. */
export type DevSessionCookie = {
  name: string;
  value: string;
  options: { path: string; httpOnly: boolean; sameSite: "lax"; secure: boolean; maxAge: number };
};

/** Signature du jeton, comme Better Auth la vérifie (HMAC-SHA256 du secret, en base64). */
async function sign(token: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token)),
  );
  return btoa(String.fromCharCode(...mac));
}

/**
 * Ouvre une session de développement et renvoie le cookie à poser. Refuse hors du local. La
 * vérification d'appartenance au serveur Discord est repoussée à la fin de la session : le
 * compte fictif n'a pas de compte Discord, il serait déconnecté au premier contrôle.
 */
export async function createDevSession(): Promise<DevSessionCookie> {
  if (!isDevLoginEnabled()) throw new Error("Connexion de développement fermée hors du local.");
  const ctx = await getAuth().$context;
  const session = await ctx.internalAdapter.createSession(await devUserId());
  if (!session) throw new Error("Session de développement non créée.");
  await db.session.update({
    where: { id: session.id },
    data: { guildCheckedAt: session.expiresAt },
  });
  const { name, attributes } = ctx.authCookies.sessionToken;
  return {
    name,
    value: `${session.token}.${await sign(session.token, ctx.secret)}`,
    options: {
      path: attributes.path ?? "/",
      httpOnly: true,
      sameSite: "lax",
      secure: !!attributes.secure,
      maxAge: Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)),
    },
  };
}
