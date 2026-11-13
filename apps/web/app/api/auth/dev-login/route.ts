import { createDevSession, isDevLoginEnabled } from "@app/core";
import { NextResponse } from "next/server";

/**
 * Connexion de développement (en local seulement) : ouvre une session sans Discord et renvoie
 * à l'accueil. La page /login y envoie toute seule en local. En production (et sur Vercel) : 404,
 * comme si la route n'existait pas.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isDevLoginEnabled()) return new Response(null, { status: 404 });
  const cookie = await createDevSession();
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
