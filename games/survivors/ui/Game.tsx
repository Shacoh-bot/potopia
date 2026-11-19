"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  createGame,
  chooseUpgrade,
  pauseGame,
  resumeGame,
  tick,
  UPGRADES,
  xpNeeded,
  RUN_SECONDS,
  type Game,
  type Point,
  type Upgrade,
  type Weapon,
} from "../src/engine";
import { createRenderer } from "./render";
import { GameSound } from "./sound";
import {
  ENEMY_SPRITES,
  HERO,
  HERO_HEIGHT,
  HERO_WIDTH,
  HERO_HAMMER,
  HERO_HAMMER_OFFSET,
  PALETTE,
} from "./sprites";
import { Icon } from "./Icon";
import {
  BESTIARY,
  BOSS_NAME,
  ENEMY_FAMILIES,
  HERO_NAME,
  LEVEL_NAME,
  type EnemyFamily,
} from "../src/index";

function snapshot(g: Game) {
  const boss = g.enemies.find((e) => e.kind === "boss");
  return {
    status: g.status,
    time: g.time,
    hp: g.hp,
    maxHp: g.maxHp,
    xp: g.xp,
    level: g.level,
    kills: g.kills,
    choices: [...g.choices],
    ranks: { ...g.ranks },
    boss: boss ? boss.hp / boss.maxHp : null,
    bossKilled: g.bossKilled,
  };
}
function clock(time: number) {
  return `${Math.floor(time / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(time % 60)
    .toString()
    .padStart(2, "0")}`;
}

function HeroPortrait() {
  return (
    <svg
      viewBox={`-4 -3 ${HERO_WIDTH + 8} ${HERO_HEIGHT + 8}`}
      role="img"
      aria-label={`${HERO_NAME}, paladin barbu aux cheveux grisonnants, lourde armure d’or et d’acier, étoffe bleu nuit et marteau compact`}
      shapeRendering="crispEdges"
    >
      <ellipse cx={HERO_WIDTH / 2} cy={HERO_HEIGHT + 1} rx="15" ry="2" fill="#090f18" />
      {HERO.flatMap((row, y) =>
        [...row].map((pixel, x) =>
          PALETTE[pixel] ? (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={PALETTE[pixel]} />
          ) : null,
        ),
      )}
      {HERO_HAMMER.flatMap((row, y) =>
        [...row].map((pixel, x) =>
          PALETTE[pixel] ? (
            <rect
              key={`hammer-${x}-${y}`}
              x={x + HERO_HAMMER_OFFSET.x}
              y={y + HERO_HAMMER_OFFSET.y}
              width="1"
              height="1"
              fill={PALETTE[pixel]}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

function EnemyPortrait({ family }: { family: EnemyFamily }) {
  const rows = ENEMY_SPRITES[family];
  const width = Math.max(...rows.map((row) => row.length));
  return (
    <svg
      viewBox={`-1 -1 ${width + 2} ${rows.length + 2}`}
      role="img"
      aria-label={BESTIARY[family].family}
      shapeRendering="crispEdges"
    >
      {rows.flatMap((row, y) =>
        [...row].map((pixel, x) =>
          PALETTE[pixel] ? (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={PALETTE[pixel]} />
          ) : null,
        ),
      )}
    </svg>
  );
}

export function SurvivorsGame() {
  const game = useRef<Game>(createGame());
  const root = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const sound = useRef<GameSound | null>(null);
  const keys = useRef(new Set<string>()),
    joystick = useRef<Point>({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);
  const [view, setView] = useState(() => snapshot(game.current));
  const [muted, setMuted] = useState(false),
    [error, setError] = useState("");
  const [stick, setStick] = useState<Point>({ x: 0, y: 0 });
  const [fullscreenError, setFullscreenError] = useState("");
  const active = view.status === "playing";

  useEffect(() => {
    if (!canvas.current) return;
    let draw: ReturnType<typeof createRenderer>;
    try {
      draw = createRenderer(canvas.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de démarrer le jeu.");
      return;
    }
    const surface = canvas.current;
    let forceRedraw = true;
    let lastDrawStatus = game.current.status;
    let lastDrawGame = game.current;
    const resize = new ResizeObserver(() => {
      const box = surface.getBoundingClientRect();
      if (box.height > 0) {
        surface.width = Math.max(320, Math.min(1600, Math.round((540 * box.width) / box.height)));
        surface.height = 540;
        forceRedraw = true;
      }
    });
    resize.observe(surface);
    let frame = 0,
      previous = 0,
      accumulator = 0,
      lastUI = 0;
    const clearInput = () => {
      keys.current.clear();
      joystick.current = { x: 0, y: 0 };
      pointer.current = null;
      setStick({ x: 0, y: 0 });
    };
    const pause = () => {
      clearInput();
      pauseGame(game.current);
      setView(snapshot(game.current));
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!root.current?.contains(document.activeElement)) return;
      const key = e.key.toLowerCase();
      if (
        [
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          " ",
          "escape",
          "p",
          "w",
          "a",
          "s",
          "d",
          "z",
          "q",
        ].includes(key)
      ) {
        // Garder Entrée et Espace natifs sur les boutons des menus.
        if (game.current.status === "playing" || e.target === canvas.current) e.preventDefault();
        keys.current.add(key);
      }
      if (!e.repeat && (key === "escape" || key === "p")) {
        e.stopPropagation();
        if (game.current.status === "paused") resumeGame(game.current);
        else pauseGame(game.current);
        clearInput();
        setView(snapshot(game.current));
      }
      if (!e.repeat && game.current.status === "levelup" && ["1", "2", "3"].includes(key)) {
        const choice = game.current.choices[Number(key) - 1];
        if (choice) {
          chooseUpgrade(game.current, choice);
          setView(snapshot(game.current));
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
    };
    const run = (now: number) => {
      const g = game.current;
      const elapsed = previous ? Math.min((now - previous) / 1000, 0.1) : 0;
      previous = now;
      if (g.status === "playing") {
        accumulator += elapsed;
        const has = (...names: string[]) => names.some((name) => keys.current.has(name));
        const input = {
          x:
            Number(has("arrowright", "d")) -
            Number(has("arrowleft", "a", "q")) +
            joystick.current.x,
          y: Number(has("arrowdown", "s")) - Number(has("arrowup", "w", "z")) + joystick.current.y,
        };
        while (accumulator >= 1 / 60 && g.status === "playing") {
          tick(g, 1 / 60, input);
          for (const event of g.events) sound.current?.play(event);
          accumulator -= 1 / 60;
        }
      } else accumulator = 0;
      if (
        g.status === "playing" ||
        g.status !== lastDrawStatus ||
        g !== lastDrawGame ||
        forceRedraw
      ) {
        draw(g);
        lastDrawStatus = g.status;
        lastDrawGame = g;
        forceRedraw = false;
      }
      if ((g.status === "playing" && now - lastUI > 100) || g.status !== viewStatus) {
        lastUI = now;
        viewStatus = g.status;
        setView(snapshot(g));
      }
      frame = requestAnimationFrame(run);
    };
    let viewStatus = game.current.status;
    frame = requestAnimationFrame(run);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      sound.current?.dispose();
      sound.current = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (view.status === "playing") canvas.current?.focus({ preventScroll: true });
    else
      root.current
        ?.querySelector<HTMLElement>("[data-survivors-focus]")
        ?.focus({ preventScroll: true });
  }, [view.status]);

  const start = () => {
    keys.current.clear();
    joystick.current = { x: 0, y: 0 };
    sound.current ??= new GameSound();
    sound.current.enabled = !muted;
    sound.current.unlock();
    game.current = createGame(crypto.getRandomValues(new Uint32Array(1))[0]);
    game.current.status = "playing";
    setView(snapshot(game.current));
  };
  const choose = (choice: Upgrade) => {
    chooseUpgrade(game.current, choice);
    keys.current.clear();
    joystick.current = { x: 0, y: 0 };
    pointer.current = null;
    setStick({ x: 0, y: 0 });
    setView(snapshot(game.current));
  };
  const togglePause = () => {
    keys.current.clear();
    joystick.current = { x: 0, y: 0 };
    pointer.current = null;
    setStick({ x: 0, y: 0 });
    if (active) pauseGame(game.current);
    else resumeGame(game.current);
    setView(snapshot(game.current));
  };
  const toggleSound = () => {
    setMuted(!muted);
    sound.current ??= new GameSound();
    sound.current.enabled = muted;
    if (muted) sound.current.unlock();
  };
  const fullscreen = async () => {
    setFullscreenError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
      else
        setFullscreenError(
          "Le plein écran n’est pas disponible ici. Vous pouvez jouer dans cette fenêtre.",
        );
    } catch {
      setFullscreenError("Le navigateur n’a pas autorisé le plein écran.");
    }
  };
  const moveStick = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    const box = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - box.left - box.width / 2,
      dy = e.clientY - box.top - box.height / 2;
    const d = Math.hypot(dx, dy),
      limit = box.width * 0.3,
      factor = Math.min(1, limit / (d || 1));
    const pos = { x: dx * factor, y: dy * factor };
    joystick.current = { x: pos.x / limit, y: pos.y / limit };
    setStick(pos);
  };
  const releaseStick = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    joystick.current = { x: 0, y: 0 };
    setStick({ x: 0, y: 0 });
  };
  const weapons: Weapon[] = ["hammer", "aura", "shield"];
  const final = view.status === "won" || view.status === "lost";

  return (
    <div className="sv-game" ref={root}>
      <header className="sv-heading">
        <div>
          <h1>Sacrebleu Survivors</h1>
        </div>
        <div className="sv-tools">
          <span className="sv-prototype">PROTOTYPE · SOLO</span>
          <button
            type="button"
            className="sv-icon-button"
            onClick={toggleSound}
            aria-label={muted ? "Activer les bruitages" : "Couper les bruitages"}
            aria-pressed={muted}
          >
            <Icon name={muted ? "mute" : "sound"} />
          </button>
          <button
            type="button"
            className="sv-icon-button"
            onClick={() => void fullscreen()}
            aria-label="Basculer le plein écran"
          >
            <Icon name="expand" />
          </button>
        </div>
      </header>
      {fullscreenError && (
        <p role="status" className="sv-notice">
          {fullscreenError}
        </p>
      )}
      <div className="sv-layout">
        <div className="sv-battle-column">
          <div className="sv-stage">
            <canvas
              ref={canvas}
              className="sv-canvas"
              tabIndex={0}
              aria-label="Champ de bataille. Déplacez-vous avec ZQSD, WASD ou les flèches. Les attaques sont automatiques. P ou Échap pour la pause."
            />
            {error ? (
              <div className="sv-overlay">
                <div className="sv-menu" role="alert">
                  <h2>Le feu attendra</h2>
                  <p>{error}</p>
                </div>
              </div>
            ) : (
              <>
                {view.status !== "ready" && (
                  <div className="sv-hud">
                    <div className="sv-health">
                      <div>
                        <Icon name="heart" />
                        <span>
                          {Math.ceil(view.hp)} <small>/ {view.maxHp}</small>
                        </span>
                      </div>
                      <div
                        className="sv-health-track"
                        role="meter"
                        aria-label="Vie"
                        aria-valuenow={Math.ceil(view.hp)}
                        aria-valuemin={0}
                        aria-valuemax={view.maxHp}
                      >
                        <i style={{ width: `${(view.hp / view.maxHp) * 100}%` }} />
                      </div>
                    </div>
                    <div className="sv-timer">
                      <span>{clock(view.time)}</span>
                      <small>/ 10:00</small>
                    </div>
                    <div className="sv-hud-right">
                      <span>
                        <Icon name="skull" />
                        {view.kills}
                      </span>
                      <button
                        type="button"
                        className="sv-icon-button"
                        onClick={togglePause}
                        disabled={view.status !== "playing" && view.status !== "paused"}
                        aria-label={active ? "Mettre en pause" : "Reprendre"}
                      >
                        <Icon name={active ? "pause" : "play"} />
                      </button>
                    </div>
                  </div>
                )}
                {view.boss !== null && (
                  <div className="sv-boss">
                    <span>{BOSS_NAME.toLocaleUpperCase("fr")}</span>
                    <div>
                      <i style={{ width: `${view.boss * 100}%` }} />
                    </div>
                  </div>
                )}
                {view.status === "ready" && (
                  <div className="sv-overlay sv-intro-overlay">
                    <section className="sv-menu sv-intro" aria-label="Commencer une partie">
                      <span className="sv-sigil">
                        <Icon name="sun" />
                      </span>
                      <p className="sv-eyebrow">{LEVEL_NAME.toLocaleUpperCase("fr")}</p>
                      <h2>Une promenade de santé.</h2>
                      <p>
                        De l’herbe tendre, de grands chênes et quelques contrariétés.
                        <br className="sv-wide-only" /> Tenez la clairière jusqu’à la relève.
                      </p>
                      <div className="sv-intro-facts">
                        <span>
                          <b>10</b> minutes
                        </span>
                        <span>
                          <b>{weapons.length}</b> armes sacrées
                        </span>
                        <span>
                          <b>1</b> dernier rempart
                        </span>
                      </div>
                      <button
                        type="button"
                        className="sv-primary"
                        onClick={start}
                        data-survivors-focus
                      >
                        <Icon name="play" />
                        Commencer
                      </button>
                      <p className="sv-menu-hint">Déplacez-vous. Vos armes font le reste.</p>
                    </section>
                  </div>
                )}
                {view.status === "paused" && (
                  <div className="sv-overlay">
                    <section className="sv-menu" role="dialog" aria-label="Partie en pause">
                      <p className="sv-eyebrow">LE TEMPS EST SUSPENDU</p>
                      <h2>Reprenez votre souffle.</h2>
                      <button
                        type="button"
                        className="sv-primary"
                        data-survivors-focus
                        onClick={togglePause}
                      >
                        <Icon name="play" />
                        Reprendre
                      </button>
                      <button
                        type="button"
                        className="sv-text-button"
                        onClick={() => {
                          game.current = createGame();
                          setView(snapshot(game.current));
                        }}
                      >
                        Abandonner et revenir au camp
                      </button>
                    </section>
                  </div>
                )}
                {view.status === "levelup" && (
                  <div className="sv-overlay">
                    <section
                      className="sv-upgrade-menu"
                      role="dialog"
                      aria-label="Choisir une amélioration"
                    >
                      <p className="sv-eyebrow">NIVEAU {view.level} · LE FEU GRANDIT</p>
                      <h2>Renforcez votre serment.</h2>
                      <p className="sv-upgrade-subtitle">
                        Choisissez un don. La horde peut attendre.
                      </p>
                      <div className="sv-choices">
                        {view.choices.map((choice, index) => (
                          <button
                            type="button"
                            className="sv-choice"
                            key={choice}
                            onClick={() => choose(choice)}
                            data-survivors-focus={index === 0 ? "" : undefined}
                          >
                            <span className="sv-choice-type">
                              {view.ranks[choice] === 0
                                ? "NOUVEAU DON"
                                : `RANG ${view.ranks[choice] + 1} / 5`}
                            </span>
                            <span className="sv-choice-icon">
                              <Icon name={UPGRADES[choice].icon} />
                            </span>
                            <strong>{UPGRADES[choice].name}</strong>
                            <span>{UPGRADES[choice].description}</span>
                            <kbd>{index + 1}</kbd>
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
                {final && (
                  <div className="sv-overlay">
                    <section
                      className="sv-menu sv-result"
                      role="dialog"
                      aria-label="Résultat de la partie"
                    >
                      <span className="sv-sigil">
                        <Icon name={view.status === "won" ? "sun" : "shield"} />
                      </span>
                      <p className="sv-eyebrow">
                        {view.status === "won" ? "LE SERMENT EST TENU" : "LE FEU VACILLE ENCORE"}
                      </p>
                      <h2>
                        {view.status === "won"
                          ? "La clairière est sauvée."
                          : "La partie est terminée."}
                      </h2>
                      <p>
                        {view.status === "won"
                          ? `Le ${BOSS_NAME} est tombé. Le ${LEVEL_NAME} retrouve sa tranquillité.`
                          : view.time >= RUN_SECONDS
                            ? "La relève est arrivée, mais le Baron tient encore le bois."
                            : "Le bois vous attendra. Revenez plus fort."}
                      </p>
                      <div className="sv-result-stats">
                        <span>
                          <b>{clock(view.time)}</b>survie
                        </span>
                        <span>
                          <b>{view.kills}</b>ennemis vaincus
                        </span>
                        <span>
                          <b>{view.level}</b>niveau atteint
                        </span>
                      </div>
                      <button
                        type="button"
                        className="sv-primary"
                        data-survivors-focus
                        onClick={start}
                      >
                        Recommencer
                      </button>
                    </section>
                  </div>
                )}
                {active && (
                  <div
                    className="sv-joystick"
                    aria-label="Joystick tactile"
                    onPointerDown={(e) => {
                      if (pointer.current !== null) return;
                      pointer.current = e.pointerId;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      moveStick(e);
                    }}
                    onPointerMove={moveStick}
                    onPointerUp={releaseStick}
                    onPointerCancel={releaseStick}
                    onLostPointerCapture={releaseStick}
                  >
                    <span style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }} />
                  </div>
                )}
                {active && (
                  <div className="sv-field-label">
                    {LEVEL_NAME.toLocaleUpperCase("fr")}{" "}
                    <span>
                      {view.bossKilled
                        ? "Tenez jusqu’à la relève"
                        : view.time >= 540
                          ? "Vainquez le Baron avant la relève"
                          : view.time >= 360
                            ? "Le sous-bois se déchaîne"
                            : view.time >= 180
                              ? "La horde se rassemble"
                              : "Premières échauffourées"}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="sv-xp">
            <div className="sv-xp-track">
              <i style={{ width: `${Math.min(100, (view.xp / xpNeeded(view.level)) * 100)}%` }} />
            </div>
            <span>
              <Icon name="gem" />
              NIVEAU {view.level}
              <small>
                {view.xp} / {xpNeeded(view.level)} éclats
              </small>
            </span>
          </div>
          <div className="sv-controls">
            <span>
              <kbd>ZQSD</kbd>
              <span className="sv-wide-only">
                {" "}
                / <kbd>WASD</kbd> / <kbd>↑↓←→</kbd>
              </span>{" "}
              Se déplacer
            </span>
            <span>
              <kbd>P</kbd> Pause
            </span>
            <span>
              <Icon name="hammer" />
              Attaques automatiques
            </span>
            <span className="sv-touch-hint">Joystick tactile disponible</span>
          </div>
        </div>
        <aside className="sv-sidebar">
          <section className="sv-hero-card">
            <div className="sv-portrait">
              <HeroPortrait />
            </div>
            <h2>{HERO_NAME}</h2>
            <p className="sv-hero-title">GARDIEN DU DERNIER FEU</p>
            <p className="sv-hero-copy">
              Un vieux serment.
              <br />
              Un marteau qui ne cède pas.
            </p>
            <div className="sv-hero-stats">
              <span>
                <Icon name="heart" />
                {view.maxHp} vie
              </span>
              <span>
                <Icon name="shield" />
                Paladin
              </span>
            </div>
          </section>
          <section className="sv-arsenal">
            <h3>
              Votre arsenal <span>{weapons.length} EMPLACEMENTS</span>
            </h3>
            {weapons.map((weapon) => (
              <div key={weapon} className={`sv-weapon ${view.ranks[weapon] ? "" : "sv-locked"}`}>
                <span className="sv-weapon-icon">
                  <Icon name={UPGRADES[weapon].icon} />
                </span>
                <div>
                  <strong>{UPGRADES[weapon].name}</strong>
                  <span className="sv-ranks">
                    {[1, 2, 3, 4, 5].map((rank) => (
                      <i key={rank} className={view.ranks[weapon] >= rank ? "sv-filled" : ""} />
                    ))}
                  </span>
                </div>
                {!view.ranks[weapon] && <span className="sv-lock-label">À découvrir</span>}
              </div>
            ))}
          </section>
        </aside>
      </div>
      <details className="sv-bestiary">
        <summary>
          Les fréquentations de Fierfeuille <span>8 familles · guide du promeneur</span>
        </summary>
        <div className="sv-bestiary-grid">
          {ENEMY_FAMILIES.map((family) => (
            <article key={family}>
              <span className="sv-enemy-portrait">
                <EnemyPortrait family={family} />
              </span>
              <div>
                <small>{BESTIARY[family].family}</small>
                <h3>{BESTIARY[family].name}</h3>
                <p>{BESTIARY[family].description}</p>
              </div>
            </article>
          ))}
        </div>
      </details>
      <span className="sv-sr-only" role="status">
        {view.status === "levelup"
          ? `Niveau ${view.level}. Choisissez une amélioration.`
          : view.status === "paused"
            ? "Partie en pause."
            : view.status === "won"
              ? "Victoire."
              : view.status === "lost"
                ? "Partie terminée."
                : ""}
      </span>
    </div>
  );
}
