import { getUser } from "@app/core";
import { getIdea } from "@app/ideas";
import { IdeaDetail } from "@app/ideas/ui";
import { ideaStateOf, isDuplicateNote, listCards } from "@app/tcg";
import { Badge, buttonClasses, Card } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Idée" };

export default async function AdminIdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  const { id } = await params;
  const idea = await getIdea(admin, id);
  if (!idea) notFound();
  const [author, active, trashed] = await Promise.all([
    getUser(idea.authorId),
    listCards(admin, { ideaId: idea.id }),
    listCards(admin, { ideaId: idea.id, trashed: true }),
  ]);
  const { cards: kept, duplicate } = ideaStateOf([...active, ...trashed]);
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
        {duplicate && (
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
