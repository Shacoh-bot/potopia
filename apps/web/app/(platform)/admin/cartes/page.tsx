import {
  CARD_LAYOUTS,
  CARD_PREP_STAGE_LABELS,
  CARD_PREP_STAGES,
  CARD_RARITIES,
  CARD_RARITY_LABELS,
  type Card as TcgCard,
  cardVersions,
  isDuplicateNote,
  listCards,
  listSets,
} from "@app/tcg";
import { CardFlip, GameCard, GameCardDefs, typeLine } from "@app/tcg/ui";
import { buttonClasses, Card, cx, EmptyState } from "@app/ui";
import { LayoutGrid, List } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getUsersByIds } from "@app/core";
import { getIdeaLabels } from "@app/ideas";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../cartes/fonts";
import {
  CardSearch,
  CardVersionSwitch,
  type MoveTarget,
  MoveCardsForm,
  NewSetForm,
  PlaceSelect,
  StageButtons,
} from "./forms";
import { type CardFace, cardFaces, duplicateCandidates, imageId } from "./images";
import { Pagination } from "./Pagination";
import { inPreparation, placeCards } from "./stages";

export const metadata: Metadata = { title: "Cartes" };

/** Boutons de version sous chaque carte (les mots de l'admin, pas la mention « AA » du jeu). */
const VERSION_BUTTONS = { normal: "Normale", fullart: "Full art" } as const;

/** Valeur de `?set=` pour la réserve (cartes hors set). */
const RESERVE = "reserve";
/** Valeur de `?set=` pour la corbeille. */
const TRASH = "corbeille";
/** Valeur de `?set=` pour le doublon : les cartes de la corbeille marquées « Doublon ». */
const DUPLICATE = "doublon";

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
  searchParams: Promise<{ set?: string; page?: string; q?: string; vue?: string; etape?: string }>;
}) {
  const admin = await getCurrentAdmin();
  const [sets, all, binned] = await Promise.all([
    listSets(admin),
    listCards(admin),
    listCards(admin, { trashed: true }),
  ]);
  const { set: code, page: pageParam, q: rawQuery, vue, etape } = await searchParams;
  const query = (rawQuery ?? "").trim().slice(0, 60);
  const list = vue === "liste";
  const pageSize = PAGE_SIZE[list ? "list" : "grid"];
  // Cartes écartées : le « Doublon » (marquées « Doublon ») et la « Corbeille » (les autres).
  const duplicates = binned.filter((c) => isDuplicateNote(c.adminNote));
  const trash = binned.filter((c) => !isDuplicateNote(c.adminNote));
  const duplicateView = code === DUPLICATE;
  const trashView = code === TRASH || duplicateView;
  const bin = duplicateView ? duplicates : trash;
  const binName = duplicateView ? "Doublon" : "Corbeille";
  // La réserve par défaut : les cartes y attendent avant d'être rangées dans un set.
  const current = trashView ? null : (sets.find((s) => s.code === code) ?? null);
  const reserveView = !trashView && current === null;
  // Dans la réserve seulement (les cartes en préparation), l'onglet d'une étape ne montre que ses
  // cartes ; « Toutes » (pas d'étape) les montre toutes. Un set montre toutes ses cartes.
  const stage = (reserveView && !query && CARD_PREP_STAGES.find((s) => s === etape)) || null;
  // Une recherche porte sur toutes les cartes (sets et réserve, ou la corbeille quand on y est) :
  // nom, type, famille, textes.
  const words = fold(query).split(/\s+/).filter(Boolean);
  const pool = trashView ? bin : all;
  const cards = words.length
    ? pool.filter((c) => {
        const text = fold(
          [c.name, c.type, c.family, c.effectText, c.flavor, c.setCode, c.number].join(" "),
        );
        return words.every((w) => text.includes(w));
      })
    : trashView
      ? bin
      : placeCards(all, current?.id ?? null, stage);
  const pageCount = Math.max(1, Math.ceil(cards.length / pageSize));
  const page = Math.min(Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1), pageCount);
  const shown = cards.slice((page - 1) * pageSize, page * pageSize);
  // Cartes prêtes à afficher (image, « idée de … », taille du set), dans chacune de leurs versions
  // (normale, full art) : la vue liste n'en montre pas.
  const faces = new Map(
    (list
      ? []
      : await cardFaces(
          admin,
          shown.flatMap((c) => cardVersions(c).map((layout) => ({ ...c, layout }))),
        )
    ).map((face) => [imageId(face.card), face]),
  );
  // Cartes d'origine possibles d'un doublon (menus « Doublon ») ; noms des cartes d'origine.
  const candidates = await duplicateCandidates(admin, all);
  const names = new Map([...all, ...binned].map((c) => [c.id, c.name]));
  const duplicateLink = (c: (typeof cards)[number]) => {
    if (!c.deletedAt || !isDuplicateNote(c.adminNote)) return null;
    const name = c.duplicateOfId ? names.get(c.duplicateOfId) : undefined;
    return name ? (
      <Link
        href={`/admin/cartes/${c.duplicateOfId}`}
        className="text-text hover:text-accent block text-xs hover:underline"
      >
        Doublon de : {name}
      </Link>
    ) : (
      <span className="text-danger block text-xs">Doublon de : à relier</span>
    );
  };
  // « Lié à l'idée : titre — auteur » de chaque carte affichée tirée d'une idée.
  const ideaLabels = await getIdeaLabels(
    admin,
    shown.flatMap((c) => (c.ideaId ? [c.ideaId] : [])),
  );
  const ideaAuthors = new Map(
    (await getUsersByIds([...new Set([...ideaLabels.values()].map((i) => i.authorId))])).map(
      (u) => [u.id, u.name],
    ),
  );
  const ideaLink = (c: (typeof cards)[number]) => {
    const idea = c.ideaId ? ideaLabels.get(c.ideaId) : undefined;
    return idea ? (
      <Link
        href={`/admin/ideas/${c.ideaId}`}
        className="text-muted hover:text-accent block text-xs hover:underline"
      >
        Lié à l&apos;idée : {idea.title} — {ideaAuthors.get(idea.authorId) ?? "membre inconnu"}
      </Link>
    ) : null;
  };
  const counts = CARD_RARITIES.map((r) => [r, cards.filter((c) => c.rarity === r).length] as const);
  const reserve = all.filter((c) => c.setId === null);
  const reserveCount = reserve.length;
  // Cartes de la réserve, toutes étapes : compteurs des onglets d'étape.
  const stageCards = reserveView ? reserve : [];
  const setSizes = new Map(sets.map((s) => [s.id, all.filter((c) => c.setId === s.id).length]));

  const setParam = trashView
    ? duplicateView
      ? DUPLICATE
      : TRASH
    : current
      ? current.code
      : RESERVE;
  /**
   * Adresse de la planche ; la vue (miniatures ou liste) et l'étape (réserve ou set ; « Toutes »
   * quand on change de place) sont gardées sauf si on les change.
   */
  const href = (o: {
    set?: string;
    q?: string;
    page?: number;
    list?: boolean;
    stage?: string | null;
  }) => {
    const params = new URLSearchParams({ set: o.set ?? setParam });
    const st = o.stage === undefined ? stage : o.stage;
    if (st && !o.q && ![TRASH, DUPLICATE].includes(params.get("set") ?? ""))
      params.set("etape", st);
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
      href: href({ set: s.code, stage: null }),
      label: `${s.code} · ${s.name} (${setSizes.get(s.id) ?? 0})`,
      active: !query && s.id === current?.id,
    })),
    {
      href: href({ set: RESERVE, stage: null }),
      label: `Réserve (${reserveCount})`,
      active: !query && reserveView,
    },
    {
      href: href({ set: DUPLICATE, stage: null }),
      label: `Doublon (${duplicates.length})`,
      active: duplicateView,
    },
    {
      href: href({ set: TRASH, stage: null }),
      label: `Corbeille (${trash.length})`,
      active: trashView && !duplicateView,
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
        // Au « Doublon » : changer (ou choisir) la carte d'origine des cartes cochées.
        duplicateView
          ? { id: "duplicate", label: "Doublon de… (changer l'original)" }
          : { id: "duplicate", label: "Doublon" },
        ...(duplicateView ? [{ id: "trash", label: "Corbeille" }] : []),
        { id: "delete", label: "Supprimer définitivement" },
      ]
    : [
        ...(reserveView && !query ? [] : [{ id: "", label: "Réserve (hors set)" }]),
        ...setTargets,
        { id: "duplicate", label: "Doublon" },
        { id: "trash", label: "Corbeille" },
      ];
  const hint = trashView
    ? "Ranger une carte la restaure. La suppression définitive retire aussi son illustration."
    : "Une carte qui quitte un set perd son numéro ; les suivantes sont renumérotées. La corbeille se vide à la main.";
  // Menu « Édition » de chaque ligne de la liste : tous les sets, la réserve et la corbeille.
  const placeTargets: MoveTarget[] = [
    ...sets.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` })),
    { id: "reserve", label: "Réserve" },
    { id: "duplicate", label: "Doublon" },
    { id: "trash", label: "Corbeille" },
  ];
  const placeOf = (c: (typeof cards)[number]) =>
    c.deletedAt ? (isDuplicateNote(c.adminNote) ? "duplicate" : "trash") : (c.setId ?? "reserve");
  // Étapes de préparation : onglets (filtres) de la réserve et pastilles sous chaque carte.
  const stageOptions: MoveTarget[] = CARD_PREP_STAGES.map((s) => ({
    id: s,
    label: CARD_PREP_STAGE_LABELS[s],
  }));
  const stageTabs = [
    { href: href({ stage: null }), label: `Toutes (${stageCards.length})`, active: stage === null },
    ...CARD_PREP_STAGES.map((s, i) => ({
      href: href({ stage: s }),
      label: `${i + 1}. ${CARD_PREP_STAGE_LABELS[s]} (${stageCards.filter((c) => c.prepStage === s).length})`,
      active: stage === s,
    })),
  ];
  const setButtons: MoveTarget[] = sets.map((s) => ({ id: s.id, label: s.code }));
  /**
   * Coches d'étape et boutons « Ranger dans <set> » de la dernière étape, pour une carte en
   * préparation seulement (réserve, hors corbeille) : une carte de set n'en a plus.
   */
  const stageButtons = (c: (typeof cards)[number]) =>
    inPreparation(c) ? (
      <StageButtons
        cardId={c.id}
        cardName={c.name}
        stage={c.prepStage}
        stages={stageOptions}
        sets={setButtons}
      />
    ) : null;

  /** Une carte de la planche, dans une version ; glisser la retourne, un clic ouvre sa fiche. */
  const cardView = (card: TcgCard, face: CardFace) => (
    <CardFlip still>
      <Link
        href={`/admin/cartes/${card.id}`}
        aria-label={`Modifier ${card.name}`}
        className="flex flex-col items-center"
        draggable={false}
      >
        {/* Aperçu agrandi d'un tiers (400 × 560) : la carte fait 300 × 420. */}
        <div style={{ zoom: 4 / 3 }} className="pointer-events-none">
          <GameCard card={face.card} imageUrl={face.imageUrl} setSize={face.setSize} still />
        </div>
      </Link>
    </CardFlip>
  );
  /** Ses deux versions ; null pour celle que la carte n'a pas (bouton grisé). */
  const versionFaces = (card: TcgCard) =>
    CARD_LAYOUTS.map((v) => {
      const face = faces.get(imageId({ id: card.id, layout: v }));
      return { id: v, label: VERSION_BUTTONS[v], face: face ? cardView(card, face) : null };
    });

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
            garde les cartes en attente, le doublon et la corbeille celles qu&apos;on écarte (avec
            leur idée). Coche des cartes pour les déplacer d&apos;un coup.
          </p>
          <p className="text-muted">
            Une carte se prépare en quatre étapes : à traiter, illustration ok, description et effet
            ok, puis à intégrer à un set (un bouton par set l&apos;y range, depuis la réserve). Les
            onglets d&apos;étape filtrent la réserve (l&apos;espace de travail) ; les coches sous
            chaque carte la classent en un clic. Un set ne montre que ses cartes finalisées, sans
            étape. Les boutons « Normale » et « Full art » sous une carte la montrent dans cette
            version (grisé : la carte ne l&apos;a pas).
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
          {reserveView && !query && (
            <nav className="flex flex-wrap gap-2 text-xs" aria-label="Étapes de préparation">
              {stageTabs.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={t.active ? "page" : undefined}
                  className={cx(
                    "rounded-full border px-3 py-1",
                    t.active ? "border-accent bg-accent/15 text-text" : "border-border text-muted",
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          )}
          {cards.length > 0 && (
            <p className="text-muted">
              {query
                ? `Recherche « ${query} », ${trashView ? `dans « ${binName} »` : "tous sets et réserve"}`
                : trashView
                  ? binName
                  : current
                    ? `${current.code} · ${current.name}`
                    : stage
                      ? `Réserve · ${CARD_PREP_STAGE_LABELS[stage]}`
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
      <MoveCardsForm targets={targets} hint={hint} candidates={candidates}>
        {searchBar}
        {cards.length === 0 ? (
          <Card>
            <EmptyState
              title={
                query
                  ? `Aucune carte pour « ${query} »`
                  : trashView
                    ? `${binName} : vide`
                    : current
                      ? "Aucune carte dans ce set"
                      : stage
                        ? "Aucune carte à cette étape"
                        : "La réserve est vide"
              }
              description={
                query
                  ? "La recherche porte sur le nom, le type, la famille, l'effet et la description."
                  : trashView
                    ? duplicateView
                      ? "Les cartes mises en doublon attendent ici, avec leur idée."
                      : "Les cartes mises à la corbeille (essais…) attendent ici, avec leur idée."
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
                    <th className="px-3 py-2 font-medium">Édition</th>
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
                      <td className="px-3 py-1.5">
                        <span className="flex items-center gap-2">
                          <PlaceSelect
                            cardId={card.id}
                            cardName={card.name}
                            value={placeOf(card)}
                            targets={placeTargets}
                            candidates={candidates}
                          />
                          {card.number !== null && (
                            <span className="text-muted text-xs whitespace-nowrap tabular-nums">
                              n°{card.number}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 flex">{stageButtons(card)}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <Link
                          href={`/admin/cartes/${card.id}`}
                          className="text-text hover:text-accent font-medium hover:underline"
                        >
                          {card.name}
                        </Link>
                        {card.baseCardId && <span className="text-muted text-xs"> · variante</span>}
                        {card.adminNote && (
                          <span className="text-accent block text-xs" title="Note admin">
                            {card.adminNote}
                          </span>
                        )}
                        {duplicateLink(card)}
                        {ideaLink(card)}
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
                  {/* La carte et ses boutons « Normale » / « Full art », qui la montrent sur place. */}
                  <CardVersionSwitch
                    cardName={card.name}
                    versions={versionFaces(card)}
                    initial={card.layout}
                  />
                  <label className="text-muted flex items-center gap-1.5 text-xs">
                    <input type="checkbox" name="ids" value={card.id} />
                    {card.number ?? "—"} · {CARD_RARITY_LABELS[card.rarity]}
                    {card.baseCardId ? " · variante" : ""}
                    {card.adminNote && (
                      <span className="text-accent" title="Note admin">
                        {" "}
                        · {card.adminNote}
                      </span>
                    )}
                  </label>
                  {duplicateLink(card)}
                  {ideaLink(card)}
                  {stageButtons(card)}
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
