"use client";
import { AppLink, Button, useNavigate } from "@app/ui";
import { useEffect, useRef, useState } from "react";
import { THEMES, winningLine, type GameView } from "../src/game";
import { api } from "./api";
import { useMorpionSound } from "./sound";

export function MorpionGame({ initial }: { initial: GameView }) {
  const [game, setGame] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const navigate = useNavigate();
  const sound = useMorpionSound(game.theme);
  const seen = useRef(initial.version);
  const theme = THEMES.find((t) => t.id === game.theme) ?? THEMES[0];
  const line = winningLine(game.board);
  const myTurn = game.status === "PLAYING" && game.turn === game.mySeat;
  const opponent = game.players[1 - game.mySeat];
  useEffect(() => {
    let disposed = false;
    let running = false;
    const refresh = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        const next = await api<GameView>(`/games/${initial.id}`);
        if (!disposed) {
          setGame((old) => (next.version >= old.version ? next : old));
          setError("");
        }
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : "Connexion interrompue.");
      } finally {
        running = false;
      }
    };
    const timer = setInterval(() => void refresh(), 2000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [initial.id]);
  useEffect(() => {
    if (game.version <= seen.current) return;
    seen.current = game.version;
    if (game.status === "WON")
      sound.play(game.winner === 0 ? "j1_win_sound" : "j2_win_sound", true);
    else if (game.status === "DRAW") sound.play("egalite_sound", true);
    else if (game.board !== ".........") sound.play("click_sound");
  }, [game, sound]);
  async function act(action: "move" | "accept" | "cancel", cell?: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/games/${game.id}`, { action, cell, version: game.version });
      const next = await api<GameView>(`/games/${game.id}`);
      setGame((old) => (next.version >= old.version ? next : old));
      setConfirmCancel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }
  async function rematch() {
    if (busy || !opponent) return;
    setBusy(true);
    setError("");
    try {
      const next = await api<{ id: string }>("/games", {
        rematchId: game.id,
      });
      navigate(`/morpion/${next.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invitation impossible.");
    } finally {
      setBusy(false);
    }
  }
  const status =
    game.status === "WAITING"
      ? game.mySeat === 1
        ? "Un duel t’attend !"
        : "Invitation envoyée"
      : game.status === "WON"
        ? `${game.players[game.winner ?? 0]?.name} remporte la manche !`
        : game.status === "DRAW"
          ? "Égalité !"
          : game.status === "ABANDONED"
            ? "Duel annulé"
            : myTurn
              ? "À toi de jouer !"
              : `À ${opponent?.name ?? "ton adversaire"} de jouer`;
  return (
    <section className="morpion flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <AppLink href="/morpion" className="text-muted text-sm">
            ← Tous mes duels
          </AppLink>
          <h1 className="font-display mt-2 text-2xl font-bold">
            Morpion <span className="text-muted text-base font-normal">/ {theme.name}</span>
          </h1>
        </div>
        <Button variant="secondary" onClick={sound.toggle} aria-pressed={sound.enabled}>
          {sound.enabled ? "Couper les sons du jeu" : "Activer les sons du thème"}
        </Button>
      </header>
      <div
        className="morpion-arena"
        style={{ backgroundImage: `url(/morpion-assets/${game.theme}/background.png)` }}
      >
        <div className="morpion-player-row">
          {game.players.map((p, i) => (
            <div
              key={p.id}
              className={`morpion-player ${game.status === "PLAYING" && game.turn === i ? "morpion-current" : ""}`}
            >
              <img src={`/morpion-assets/${game.theme}/icn_j${i + 1}.png`} alt="" />
              <div>
                <strong>
                  {p.name}
                  {game.mySeat === i ? " (toi)" : ""}
                </strong>
                <small>{theme.players[i]}</small>
              </div>
              <span className="morpion-score" title="Manches gagnées entre vous">
                {game.score[i]}
              </span>
            </div>
          ))}
        </div>
        <div className="morpion-status" role="status" aria-live="polite">
          <h2>{status}</h2>
          {game.status === "WAITING" && (
            <p>
              {game.mySeat === 1
                ? `Accepte l’invitation pour commencer. ${game.players[game.turn]?.name ?? "Ton adversaire"} jouera en premier.`
                : `${opponent?.name ?? "Ton adversaire"} doit accepter pour commencer.`}
            </p>
          )}
        </div>
        <div className="morpion-board" aria-label="Grille de Morpion">
          {game.board.split("").map((cell, i) => {
            const occupied = cell !== ".";
            const owner = cell === "X" ? 0 : 1;
            return (
              <button
                type="button"
                key={i}
                className={`morpion-cell ${line?.includes(i) ? "morpion-winning" : ""}`}
                disabled={!myTurn || occupied || busy}
                onClick={() => void act("move", i)}
                aria-label={`Ligne ${Math.floor(i / 3) + 1}, colonne ${(i % 3) + 1} : ${occupied ? game.players[owner].name : "vide"}`}
                style={{ backgroundImage: `url(/morpion-assets/${game.theme}/case.png)` }}
              >
                {occupied && (
                  <img src={`/morpion-assets/${game.theme}/icn_j${owner + 1}.png`} alt="" />
                )}
              </button>
            );
          })}
        </div>
        <div className="morpion-controls">
          {game.status === "WAITING" && game.mySeat === 1 && (
            <Button disabled={busy} onClick={() => void act("accept")}>
              Accepter le duel
            </Button>
          )}
          {game.status === "WAITING" || game.status === "PLAYING" ? (
            confirmCancel ? (
              <>
                <span>Annuler ce duel ?</span>
                <Button variant="danger" disabled={busy} onClick={() => void act("cancel")}>
                  Confirmer
                </Button>
                <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
                  Continuer
                </Button>
              </>
            ) : (
              <Button variant="secondary" disabled={busy} onClick={() => setConfirmCancel(true)}>
                {game.status === "WAITING"
                  ? game.mySeat === 1
                    ? "Décliner"
                    : "Retirer l’invitation"
                  : "Quitter le duel"}
              </Button>
            )
          ) : (
            <>
              <Button disabled={busy} onClick={() => void rematch()}>
                Proposer une revanche
              </Button>
              <p className="text-sm">
                Nouvel univers au hasard
                {game.status === "WON"
                  ? " · le perdant commence"
                  : game.status === "DRAW"
                    ? " · l’autre joueur commence"
                    : ""}
              </p>
            </>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <p className="text-muted text-xs">
        Les coups sont synchronisés automatiquement. Le score compte les manches gagnées entre vous,
        tous thèmes confondus. Le volume se règle dans le bandeau.
      </p>
    </section>
  );
}
