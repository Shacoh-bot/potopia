import { CARD_RARITIES, CARD_RARITY_LABELS, listCards, listSets } from "@app/tcg";
import { CardFlip, GameCard, GameCardDefs, typeLine } from "@app/tcg/ui";
import { buttonClasses, Card, cx, EmptyState } from "@app/ui";
import { LayoutGrid, List } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../cartes/fonts";
import { CardSearch, type MoveTarget, MoveCardsForm, NewSetForm } from "./forms";
import { cardAuthors, cardImageUrls } from "./images";
import { Pagination } from "./Pagination";

export const metadata: Metadata = { title: "Cartes" };

/** Valeur de `?set=` pour la réserve (cartes hors set). */
const RESERVE = "reserve";
/** Valeur de `?set=` pour la corbeille. */
const TRASH = "corbeille";

/**
 * Cartes par page : au-delà, la planche devient lourde à afficher et à faire défiler. La liste
 * (une ligne par carte, sans dessin) en montre davantage.
 */
const PAGE_SIZE = { grid: 24, list: 100 } as const;

/** Texte comparable : minuscules, sans accents. */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export default async function AdminCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; page?: string; q?: string; vue?: string }>;
}) {
  const admin = await getCurrentAdmin();
  const [sets, all, trash] = await Promise.all([
    listSets(admin),
    listCards(admin),
    listCards(admin, { trashed: true }),
  ]);
  const { set: code, page: pageParam, q: rawQuery, vue } = await searchParams;
  const query = (rawQuery ?? "").trim().slice(0, 60);
  const list = vue === "liste";
  const pageSize = PAGE_SIZE[list ? "list" : "grid"];
  const trashView = code === TRASH;
  // La réserve par défaut : les cartes y attendent avant d'être rangées dans un set.
  const current = trashView ? null : (sets.find((s) => s.code === code) ?? null);
  const reserveView = !trashView && current === null;
  // Une recherche porte sur toutes les cartes (sets et réserve, ou la corbeille quand on y est) :
  // nom, type, famille, textes.
  const words = fold(query).split(/\s+/).filter(Boolean);
  const pool = trashView ? trash : all;
  const cards = words.length
    ? pool.filter((c) => {
        const text = fold(
          [c.name, c.type, c.family, c.effectText, c.flavor, c.setCode, c.number].join(" "),
        );
        return words.every((w) => text.includes(w));
      })
    : trashView
      ? trash
      : all.filter((c) => c.setId === (current?.id ?? null));
  const pageCount = Math.max(1, Math.ceil(cards.length / pageSize));
  const page = Math.min(Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1), pageCount);
  const shown = cards.slice((page - 1) * pageSize, page * pageSize);
  const [images, authors] = await Promise.all([
    list ? new Map<string, string | null>() : cardImageUrls(admin, shown),
    list ? new Map<string, string>() : cardAuthors(admin, shown),
  ]);
  const counts = CARD_RARITIES.map((r) => [r, cards.filter((c) => c.rarity === r).length] as const);
  const reserveCount = all.filter((c) => c.setId === null).length;
  const setSizes = new Map(sets.map((s) => [s.id, all.filter((c) => c.setId === s.id).length]));

  const setParam = trashView ? TRASH : current ? current.code : RESERVE;
  /** Adresse de la planche ; la vue (miniatures ou liste) est gardée sauf si on la change. */
  const href = (o: { set?: string; q?: string; page?: number; list?: boolean }) => {
    const params = new URLSearchParams({ set: o.set ?? setParam });
    if (o.q) params.set("q", o.q);
    if (o.list ?? list) params.set("vue", "liste");
    if (o.page && o.page > 1) params.set("page", String(o.page));
    return `/admin/cartes?${params}`;
  };
  const pager = (
    <Pagination page={page} count={pageCount} href={(p) => href({ q: query, page: p })} />
  );
  // Recherche juste au-dessus des cartes, avec le choix de la vue, le compte et la pagination.
  const views = [
    { list: false, label: "Miniatures", Icon: LayoutGrid },
    { list: true, label: "Liste", Icon: List },
  ];
  const searchBar = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex-1">
        <CardSearch query={query} set={setParam} list={list} />
      </div>
      <nav aria-label="Vue" className="border-border flex rounded-full border p-0.5">
        {views.map((v) => (
          <Link
            key={v.label}
            href={href({ q: query, list: v.list })}
            aria-current={v.list === list ? "page" : undefined}
            aria-label={v.label}
            title={v.label}
            className={cx(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs",
              v.list === list ? "bg-surface-hover text-text" : "text-muted hover:text-text",
            )}
          >
            <v.Icon size={14} aria-hidden />
            <span className="hidden sm:inline">{v.label}</span>
          </Link>
        ))}
      </nav>
      {shown.length > 0 && (
        <span className="text-muted text-xs tabular-nums">
          {(page - 1) * pageSize + 1}–{(page - 1) * pageSize + shown.length} sur {cards.length}
        </span>
      )}
      {pager}
    </div>
  );

  const tabs = [
    ...sets.map((s) => ({
      href: href({ set: s.code }),
      label: `${s.code} · ${s.name} (${setSizes.get(s.id) ?? 0})`,
      active: !query && s.id === current?.id,
    })),
    {
      href: href({ set: RESERVE }),
      label: `Réserve (${reserveCount})`,
      active: !query && reserveView,
    },
    {
      href: href({ set: TRASH }),
      label: `Corbeille (${trash.length})`,
      active: trashView,
    },
  ];
  const setTargets: MoveTarget[] = sets
    .filter((s) => trashView || query || s.id !== current?.id)
    .map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` }));
  // Dans la corbeille : en sortir (réserve ou set) ou supprimer ; ailleurs : ranger ou jeter.
  const targets: MoveTarget[] = trashView
    ? [
        { id: "", label: "Réserve (restaurer)" },
        ...setTargets,
        { id: "delete", label: "Supprimer définitivement" },
      ]
    : [
        ...(reserveView && !query ? [] : [{ id: "", label: "Réserve (hors set)" }]),
        ...setTargets,
        { id: "trash", label: "Corbeille" },
      ];
  const hint = trashView
    ? "Ranger une carte la restaure. La suppression définitive retire aussi son illustration."
    : "Une carte qui quitte un set perd son numéro ; les suivantes sont renumérotées. La corbeille se vide à la main.";
  const place = (c: (typeof cards)[number]) =>
    c.setCode ? `${c.setCode} n°${c.number}` : trashView ? "Corbeille" : "Réserve";

  return (
    <div className={`${designFonts} flex flex-col gap-4`}>
      <Card
        title="Cartes"
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/cartes/import"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Importer (JSON)
            </Link>
            {current && (
              <Link
                href={`/admin/cartes/illustrations?set=${current.code}`}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                Illustrations
              </Link>
            )}
            <Link
              href={`/admin/cartes/nouvelle${current ? `?set=${current.code}` : ""}`}
              className={buttonClasses({ size: "sm" })}
            >
              Nouvelle carte
            </Link>
          </div>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-muted">
            Une carte rangée dans un set y prend un numéro et ira en prod avec lui ; la réserve
            garde les cartes en attente, la corbeille celles qu&apos;on écarte (doublons, essais).
            Coche des cartes pour les déplacer d&apos;un coup.
          </p>
          <nav className="flex flex-wrap gap-2" aria-label="Sets, réserve et corbeille">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={t.active ? "page" : undefined}
                className={cx(
                  "rounded-full border px-3 py-1",
                  t.active ? "border-accent text-text" : "border-border text-muted",
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {cards.length > 0 && (
            <p className="text-muted">
              {query
                ? `Recherche « ${query} », ${trashView ? "dans la corbeille" : "tous sets et réserve"}`
                : trashView
                  ? "Corbeille"
                  : current
                    ? `${current.code} · ${current.name}`
                    : "Réserve"}{" "}
              : {cards.length} carte
              {cards.length > 1 ? "s" : ""}
              {counts
                .filter(([, n]) => n > 0)
                .map(([r, n]) => ` · ${n} ${CARD_RARITY_LABELS[r].toLowerCase()}`)
                .join("")}
              .
            </p>
          )}
          <details>
            <summary className="text-muted cursor-pointer">Nouveau set</summary>
            <div className="mt-2">
              <NewSetForm />
            </div>
          </details>
        </div>
      </Card>

      <GameCardDefs />
      {/* Toujours le même formulaire autour de la recherche : elle garde sa saisie d'un résultat à
          l'autre, même vide. */}
      <MoveCardsForm targets={targets} hint={hint}>
        {searchBar}
        {cards.length === 0 ? (
          <Card>
            <EmptyState
              title={
                query
                  ? `Aucune carte pour « ${query} »`
                  : trashView
                    ? "La corbeille est vide"
                    : current
                      ? "Aucune carte dans ce set"
                      : "La réserve est vide"
              }
              description={
                query
                  ? "La recherche porte sur le nom, le type, la famille, l'effet et la description."
                  : trashView
                    ? "Les cartes mises à la corbeille (doublons, essais) attendent ici."
                    : "Crée une carte, importe un fichier (JSON) ou déplace des cartes ici."
              }
            />
          </Card>
        ) : list ? (
          <>
            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="text-muted bg-surface text-xs">
                  <tr>
                    <th className="w-8 px-3 py-2">
                      <span className="sr-only">Cocher</span>
                    </th>
                    <th className="px-3 py-2 font-medium">Place</th>
                    <th className="px-3 py-2 font-medium">Nom</th>
                    <th className="px-3 py-2 font-medium">Rareté</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 text-right font-medium">Mana</th>
                    <th className="px-3 py-2 text-right font-medium">Puissance</th>
                    <th className="px-3 py-2 font-medium">Effet</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((card) => (
                    <tr key={card.id} className="border-border hover:bg-surface-hover border-t">
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          name="ids"
                          value={card.id}
                          aria-label={`Cocher ${card.name}`}
                        />
                      </td>
                      <td className="text-muted px-3 py-1.5 whitespace-nowrap tabular-nums">
                        {place(card)}
                      </td>
                      <td className="px-3 py-1.5">
                        <Link
                          href={`/admin/cartes/${card.id}`}
                          className="text-text hover:text-accent font-medium hover:underline"
                        >
                          {card.name}
                        </Link>
                        {card.baseCardId && <span className="text-muted text-xs"> · variante</span>}
                      </td>
                      <td className="text-muted px-3 py-1.5 whitespace-nowrap">
                        {CARD_RARITY_LABELS[card.rarity]}
                      </td>
                      <td className="text-muted px-3 py-1.5">{typeLine(card)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{card.cost}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{card.power}</td>
                      <td
                        className="text-muted max-w-80 truncate px-3 py-1.5"
                        title={card.effectText}
                      >
                        {card.effectText || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-center">{pager}</div>
          </>
        ) : (
          <>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(400px,100%),1fr))] gap-4">
              {shown.map((card) => (
                <li
                  key={card.id}
                  className="flex flex-col items-center gap-1"
                  // Le navigateur ne dessine pas les cartes hors de l'écran (défilement fluide).
                  style={{ contentVisibility: "auto", containIntrinsicSize: "auto 585px" }}
                >
                  {/* Glisser la carte à l'horizontale la retourne ; un clic ouvre sa fiche. */}
                  <CardFlip still>
                    <Link
                      href={`/admin/cartes/${card.id}`}
                      aria-label={`Modifier ${card.name}`}
                      className="flex flex-col items-center"
                      draggable={false}
                    >
                      {/* Aperçu agrandi d'un tiers (400 × 560) : la carte fait 300 × 420. */}
                      <div style={{ zoom: 4 / 3 }} className="pointer-events-none">
                        <GameCard
                          card={card}
                          imageUrl={images.get(card.id) ?? null}
                          setSize={card.setId ? setSizes.get(card.setId) : undefined}
                          author={authors.get(card.id)}
                          still
                        />
                      </div>
                    </Link>
                  </CardFlip>
                  <label className="text-muted flex items-center gap-1.5 text-xs">
                    <input type="checkbox" name="ids" value={card.id} />
                    {card.number ?? "—"} · {CARD_RARITY_LABELS[card.rarity]}
                    {card.baseCardId ? " · variante" : ""}
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex justify-center">{pager}</div>
          </>
        )}
      </MoveCardsForm>
    </div>
  );
}
