"use client";
import { AppLink, Button, useNavigate } from "@app/ui";
import { useEffect, useState } from "react";
import { THEMES, type ThemeId, type Player } from "../src/game";
import type { listGames } from "../src/service";
import { api } from "./api";

type Lobby = { games: Awaited<ReturnType<typeof listGames>>; partners?: Player[] };
export function MorpionLobby() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemeId>("mario");
  const [partner, setPartner] = useState("");
  const [data, setData] = useState<Lobby | null>(null);
  const [partners, setPartners] = useState<Player[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let disposed = false;
    let running = false;
    const refresh = async (first = false) => {
      if (running || (!first && document.hidden)) return;
      running = true;
      try {
        const next = await api<Lobby>(`/games${first ? "?partners=1" : ""}`);
        if (!disposed) {
          setData(next);
          if (next.partners) setPartners(next.partners);
          setError("");
        }
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : "Connexion interrompue.");
      } finally {
        running = false;
      }
    };
    void refresh(true);
    const timer = setInterval(() => void refresh(), 4000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);
  async function invite() {
    if (busy || !partner) return;
    setBusy(true);
    setError("");
    try {
      const game = await api<{ id: string }>("/games", { partnerId: partner, theme });
      navigate(`/morpion/${game.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invitation impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="morpion flex flex-col gap-6">
      <header>
        <p className="text-accent text-xs font-bold tracking-widest uppercase">
          Le duel des univers
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold">Morpion</h1>
        <p className="text-muted mt-2">
          Deux membres, neuf cases. Aligne trois de tes pions pour gagner.
        </p>
      </header>
      <div className="bg-surface rounded-xl border border-(--frame) p-5">
        <h2 className="mb-4 text-lg font-semibold">Choisis ton univers</h2>
        <div className="morpion-themes">
          {THEMES.map((t) => (
            <button
              type="button"
              key={t.id}
              aria-pressed={theme === t.id}
              onClick={() => setTheme(t.id)}
              className={`morpion-theme ${theme === t.id ? "morpion-selected" : ""}`}
              style={{ backgroundImage: `url(/morpion-assets/${t.id}/background.png)` }}
            >
              <span className="morpion-theme-pieces">
                <img src={`/morpion-assets/${t.id}/icn_j1.png`} alt="" />
                <img src={`/morpion-assets/${t.id}/icn_j2.png`} alt="" />
              </span>
              <span>{t.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="flex min-w-48 flex-1 flex-col gap-2 text-sm font-semibold">
            Ton adversaire
            <select
              className="bg-bg rounded-md border border-(--frame) px-3 py-2.5"
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
            >
              <option value="">Choisir un membre</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => void invite()} disabled={!partner || busy}>
            {busy ? "Invitation…" : "Proposer un duel"}
          </Button>
        </div>
        {data && partners.length === 0 && (
          <p className="text-muted mt-3 text-sm">
            Un deuxième membre doit se connecter au moins une fois pour apparaître ici.
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Tes duels</h2>
        {!data ? (
          <p className="text-muted">Chargement des parties…</p>
        ) : !data.games.length ? (
          <p className="text-muted">Ton premier duel commence avec une invitation.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.games.map((game) => (
              <AppLink key={game.id} href={`/morpion/${game.id}`} className="morpion-duel">
                <span>
                  <strong>{game.partner}</strong>
                  <span className="text-muted ml-3 text-sm">
                    {THEMES.find((t) => t.id === game.theme)?.name}
                  </span>
                </span>
                <span className={game.myTurn ? "text-accent" : "text-muted"}>
                  {game.status === "WAITING"
                    ? game.incoming
                      ? "Invitation reçue →"
                      : "Invitation envoyée →"
                    : game.status === "PLAYING"
                      ? game.myTurn
                        ? "À toi de jouer →"
                        : "En cours →"
                      : game.status === "ABANDONED"
                        ? "Annulé"
                        : game.status === "DRAW"
                          ? "Égalité"
                          : "Terminé →"}
                </span>
              </AppLink>
            ))}
          </div>
        )}
      </section>
      <p className="text-muted text-xs">
        Inspiré du projet « DM Morpion » : les cinq thèmes, leurs pions et leurs sons sont de
        retour.
      </p>
    </section>
  );
}
