import { getUsersByIds } from "@app/core";
import { listIdeaAuthorIds, listIdeas, RARITIES, type Rarity } from "@app/ideas";
import { IdeasAdminList } from "@app/ideas/ui";
import { buttonClasses, Card, cx } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/session";
import { loadMoreIdeas } from "./actions";
import { asIdeaTab, cardStatesByIdea, ideaCounters, NEW_CARD_HREF } from "./card-counts";

export const metadata: Metadata = { title: "Boîte à idées" };

function asRarity(value: string | undefined): Rarity | undefined {
  return RARITIES.find((r) => r === value);
}

export default async function AdminIdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ author?: string; rarity?: string; onglet?: string }>;
}) {
  const admin = await getCurrentAdmin();
  const params = await searchParams;
  const tab = asIdeaTab(params.onglet);
  const filters = { authorId: params.author || undefined, rarity: asRarity(params.rarity) };

  // Onglets : les idées suivent leurs cartes au « Doublon » et à la « Corbeille ».
  const [{ stateOf, filter }, authorIds] = await Promise.all([
    cardStatesByIdea(admin, tab),
    listIdeaAuthorIds(admin),
  ]);
  const [{ items, nextCursor }, counters] = await Promise.all([
    listIdeas(admin, { ...filters, ...filter }),
    ideaCounters(admin, stateOf),
  ]);
  const { toCreate, active, duplicates, trashed } = counters;
  const tabHref = (t?: string) => {
    const q = new URLSearchParams();
    if (t) q.set("onglet", t);
    if (filters.authorId) q.set("author", filters.authorId);
    if (filters.rarity) q.set("rarity", filters.rarity);
    return `/admin/ideas${q.size ? `?${q}` : ""}`;
  };
  const tabs = [
    { key: undefined, label: `Idées (${active})` },
    { key: "doublon", label: `Doublon (${duplicates})` },
    { key: "corbeille", label: `Corbeille (${trashed})` },
  ];
  const authors = await getUsersByIds([...authorIds, ...items.map((i) => i.authorId)]);
  const names = new Map(authors.map((u) => [u.id, u.name]));

  return (
    <Card
      title="Boîte à idées"
      action={
        // Téléchargement de fichier : un vrai <a>, pas <Link> (pas de navigation côté client).
        <a
          href="/api/admin/ideas/export"
          download
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          Exporter (JSON)
        </a>
      }
    >
      <nav className="mb-3 flex flex-wrap gap-2 text-sm" aria-label="Onglets des idées">
        {tabs.map((t) => (
          <Link
            key={t.label}
            href={tabHref(t.key)}
            aria-current={t.key === tab ? "page" : undefined}
            className={cx(
              "rounded-full border px-3 py-1",
              t.key === tab ? "border-accent bg-accent/15 text-text" : "border-border text-muted",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <p className="text-muted mb-3 text-sm">
        {toCreate} idée{toCreate > 1 ? "s" : ""} à transformer en carte (toutes les idées, sans
        filtre). Une idée suit ses cartes au doublon ou à la corbeille, et en revient avec elles.
      </p>
      <IdeasAdminList
        basePath="/admin/ideas"
        filters={filters}
        keep={tab ? { onglet: tab } : {}}
        loadMore={loadMoreIdeas.bind(null, { ...filters, tab })}
        newCardHref={NEW_CARD_HREF}
        authors={authors
          .filter((u) => authorIds.includes(u.id))
          .map((u) => ({ id: u.id, name: u.name }))
          .sort((a, b) => a.name.localeCompare(b.name))}
        initial={{
          nextCursor,
          items: items.map((idea) => ({
            id: idea.id,
            title: idea.title,
            authorName: names.get(idea.authorId) ?? "Membre inconnu",
            rarity: idea.suggestedRarity,
            hasImage: Boolean(idea.imageKey),
            createdAt: idea.createdAt,
            ...stateOf(idea.id),
          })),
        }}
      />
    </Card>
  );
}
