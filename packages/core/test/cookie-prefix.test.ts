import { getSessionCookie } from "better-auth/cookies";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COOKIE_PREFIX, sessionCookiePrefix } from "../src/auth/cookie-prefix";
import { createAuth } from "../src/index";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Nom du cookie de session d'une instance Better Auth créée avec cet environnement. */
async function sessionCookieName(env: { NODE_ENV: string; BETTER_AUTH_URL: string }) {
  vi.stubEnv("NODE_ENV", env.NODE_ENV);
  vi.stubEnv("BETTER_AUTH_URL", env.BETTER_AUTH_URL);
  return (await createAuth().$context).authCookies.sessionToken.name;
}

describe("nom du cookie de session", () => {
  it("propre au port en développement local seulement", () => {
    const dev = { NODE_ENV: "development" };
    expect(sessionCookiePrefix("http://localhost:3001", dev)).toBe("better-auth-3001");
    expect(sessionCookiePrefix("http://127.0.0.1:3003", dev)).toBe("better-auth-3003");
    // sans port, autre hôte, ou sur Vercel : le préfixe par défaut
    expect(sessionCookiePrefix("http://localhost", dev)).toBe(DEFAULT_COOKIE_PREFIX);
    expect(sessionCookiePrefix("http://192.168.1.20:3001", dev)).toBe(DEFAULT_COOKIE_PREFIX);
    expect(sessionCookiePrefix("http://localhost:3001", { ...dev, VERCEL: "1" })).toBe(
      DEFAULT_COOKIE_PREFIX,
    );
    expect(sessionCookiePrefix(undefined, dev)).toBe(DEFAULT_COOKIE_PREFIX);
    expect(sessionCookiePrefix("pas une url", dev)).toBe(DEFAULT_COOKIE_PREFIX);
  });

  it("inchangé hors développement : prod, next start en local, tests", () => {
    expect(DEFAULT_COOKIE_PREFIX).toBe("better-auth");
    for (const NODE_ENV of ["production", "test"]) {
      expect(sessionCookiePrefix("https://potopia.vercel.app", { NODE_ENV })).toBe("better-auth");
      expect(sessionCookiePrefix("http://localhost:3000", { NODE_ENV })).toBe("better-auth");
    }
  });

  it("prod : Better Auth garde exactement le même nom de cookie (personne n'est déconnecté)", async () => {
    // https : Better Auth ajoute « __Secure- », comme aujourd'hui
    expect(
      await sessionCookieName({
        NODE_ENV: "production",
        BETTER_AUTH_URL: "https://potopia.vercel.app",
      }),
    ).toBe("__Secure-better-auth.session_token");
    expect(
      await sessionCookieName({ NODE_ENV: "production", BETTER_AUTH_URL: "http://localhost:3000" }),
    ).toBe("better-auth.session_token");
  });

  it("développement local : un cookie par port, que le proxy retrouve", async () => {
    const name = await sessionCookieName({
      NODE_ENV: "development",
      BETTER_AUTH_URL: "http://localhost:3001",
    });
    expect(name).toBe("better-auth-3001.session_token");
    // une session ouverte sur le 3000 (autre base) ne compte pas pour le serveur du 3001
    const other = new Headers({ cookie: "better-auth.session_token=autre" });
    const mine = new Headers({ cookie: `${name}=le-mien` });
    const cookiePrefix = sessionCookiePrefix("http://localhost:3001", { NODE_ENV: "development" });
    expect(getSessionCookie(other, { cookiePrefix })).toBeNull();
    expect(getSessionCookie(mine, { cookiePrefix })).toBe("le-mien");
  });
});
