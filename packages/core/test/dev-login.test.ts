import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDevSession,
  DEV_USER,
  getSession,
  isDevLoginEnabled,
  type DevSessionCookie,
} from "../src/index";

const ADMIN_ID = "100000000000000001";

/** En-têtes d'une requête qui porte le cookie, comme le navigateur l'enverrait. */
const withCookie = (cookie: DevSessionCookie) =>
  new Headers({ cookie: `${cookie.name}=${encodeURIComponent(cookie.value)}` });

beforeEach(async () => {
  await truncateTestDb();
  process.env.ADMIN_DISCORD_IDS = ADMIN_ID;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("connexion de développement", () => {
  it("ouverte en local seulement : jamais en production ni sur Vercel", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isDevLoginEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(isDevLoginEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isDevLoginEnabled({ NODE_ENV: "development", VERCEL: "1" })).toBe(false);
  });

  it("refuse d'ouvrir une session en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(createDevSession()).rejects.toThrow();
    expect(await db.session.count()).toBe(0);
  });

  it("refuse d'ouvrir une session sur Vercel", async () => {
    vi.stubEnv("VERCEL", "1");
    await expect(createDevSession()).rejects.toThrow();
    expect(await db.session.count()).toBe(0);
  });

  it("sans compte admin en base : ouvre le compte fictif « Dev local », simple membre", async () => {
    const cookie = await createDevSession();
    const session = await getSession(withCookie(cookie));
    expect(session).toMatchObject({ id: DEV_USER.id, name: DEV_USER.name, role: "member" });
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("ouvre le compte du premier admin s'il existe déjà en base", async () => {
    await db.user.create({
      data: { id: "admin-local", name: "Admin", email: "admin@example.test", discordId: ADMIN_ID },
    });
    const session = await getSession(withCookie(await createDevSession()));
    expect(session).toMatchObject({ id: "admin-local", role: "admin" });
  });

  it("pas de contrôle Discord avant la fin de la session (le compte fictif n'en a pas)", async () => {
    await createDevSession();
    const row = await db.session.findFirstOrThrow();
    expect(row.guildCheckedAt.getTime()).toBe(row.expiresAt.getTime());
  });

  it("un cookie mal signé n'ouvre rien", async () => {
    const cookie = await createDevSession();
    const forged = { ...cookie, value: cookie.value.replace(/\.[^.]+$/, ".AAAA") };
    expect(await getSession(withCookie(forged))).toBeNull();
  });
});
