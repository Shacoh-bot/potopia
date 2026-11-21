import { getUser, getUsersByIds } from "@app/core";
import { getIdea, getIdeaLabels, listDuplicateCandidates } from "@app/ideas";
import { IdeaDetail } from "@app/ideas/ui";
import { ideaStateOf, isDuplicateNote, listCards } from "@app/tcg";
import { Badge, buttonClasses, Card } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/session";
import { type IdeaChoice, IdeaDuplicateControl } from "./duplicate";

export const metadata: Metadata = { title: "Idée" };

export default async function AdminIdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  const { id } = await params;
  const idea = await getIdea(admin, id);
  if (!idea) notFound();
  const [author, active, trashed, candidates, origin] = await Promise.all([
    getUser(idea.authorId),
    listCards(admin, { ideaId: idea.id }),
    listCards(admin, { ideaId: idea.id, trashed: true }),
    listDuplicateCandidates(admin),
    idea.duplicateOfId ? getIdeaLabels(admin, [idea.duplicateOfId]) : null,
  ]);
  const { cards: kept, duplicate: cardDuplicate } = ideaStateOf([...active, ...trashed]);
  // Doublon : marquée « Doublon de… » sur cette fiche, ou sa carte marquée « Doublon ».
  const duplicate = cardDuplicate || Boolean(idea.duplicateOfId);
  const originLabel = idea.duplicateOfId ? origin?.get(idea.duplicateOfId) : undefined;
  const names = new Map(
    (
      await getUsersByIds([
        ...new Set([...candidates.map((c) => c.authorId), originLabel?.authorId ?? ""]),
      ])
    ).map((u) => [u.id, u.name]),
  );
  const label = (l: { title: string; authorId: string }) =>
    `${l.title} — ${names.get(l.authorId) ?? "Membre inconnu"}`;
  const current: IdeaChoice | null =
    idea.duplicateOfId && originLabel
      ? { id: idea.duplicateOfId, label: label(originLabel) }
      : null;
  const choices = candidates
    .filter((c) => c.id !== idea.id)
    .map((c) => ({ id: c.id, label: label(c) }));
  // Cartes montrées : celles du jeu, plus celles à la corbeille marquées « Doublon ».
  const cards = [...active, ...trashed.filter((c) => isDuplicateNote(c.adminNote))];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <IdeaDetail
          idea={idea}
          authorName={author?.name ?? "Membre inconnu"}
          imageSrc={idea.imageKey ? `/api/admin/ideas/${idea.id}/image` : null}
        />
      </Card>
      <Card title="Doublon">
        <IdeaDuplicateControl ideaId={idea.id} current={current} candidates={choices} />
        {current && kept > 0 && (
          <p className="text-muted mt-2 text-sm">
            Ses cartes restent où elles sont : marque-les « Doublon » depuis leur fiche si besoin.
          </p>
        )}
      </Card>
      <Card
        title="Cartes tirées de cette idée"
        action={
          // Idée en doublon : sa carte est marquée « Doublon », rien à créer.
          duplicate ? (
            <Badge tone="danger">Doublon</Badge>
          ) : (
            <Link
              href={`/admin/cartes/nouvelle?idee=${idea.id}`}
              className={buttonClasses({ size: "sm" })}
            >
              {kept > 0 ? "Créer une autre carte" : "Créer une carte"}
            </Link>
          )
        }
      >
        {cardDuplicate && (
          <p className="text-muted mb-2 text-sm">
            Idée en doublon : sa carte est marquée « Doublon ». Retirer la marque de la carte rend
            l&apos;idée normale.
          </p>
        )}
        {cards.length === 0 ? (
          <p className="text-muted text-sm">
            Aucune carte pour l&apos;instant. La création reprend le titre, la description, la
            rareté et l&apos;image proposés.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {cards.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/cartes/${c.id}`} className="text-accent hover:underline">
                  {c.name}
                </Link>{" "}
                <span className="text-muted">
                  ·{" "}
                  {c.deletedAt ? "corbeille" : c.setCode ? `${c.setCode} n°${c.number}` : "réserve"}
                  {isDuplicateNote(c.adminNote) && ` · ${c.adminNote}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
