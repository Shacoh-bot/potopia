import { getCard, listCards, listSets, listVisualEffects } from "@app/tcg";
import { CardEditor } from "@app/tcg/ui";
import { Card } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../../cartes/fonts";
import { confirmCardImageAction, requestCardImageAction, updateCardAction } from "../actions";
import { MoveCardForm } from "../forms";
import { cardAuthors, cardImageUrls, familiesOf } from "../images";

export const metadata: Metadata = { title: "Modifier une carte" };

export default async function AdminCardPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  const { id } = await params;
  const card = await getCard(admin, id);
  if (!card) notFound();
  const [sets, allCards, visualEffects] = await Promise.all([
    listSets(admin),
    listCards(admin),
    listVisualEffects(admin),
  ]);
  const setCards = allCards.filter((c) => c.setId === card.setId);
  const [images, authors] = await Promise.all([
    cardImageUrls(admin, [card]),
    cardAuthors(admin, [card]),
  ]);
  const base = card.baseCardId ? allCards.find((c) => c.id === card.baseCardId) : null;
  const variants = allCards.filter((c) => c.baseCardId === card.id);
  const siblings = card.ideaId
    ? allCards.filter((c) => c.ideaId === card.ideaId && c.id !== card.id)
    : [];
  const trashed = card.deletedAt !== null;
  const place = trashed
    ? "Corbeille"
    : card.setCode
      ? `${card.setCode} · n°${card.number}`
      : "Réserve";
  const setTargets = sets
    .filter((s) => trashed || s.id !== card.setId)
    .map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` }));
  // À la corbeille : la ranger la restaure, ou la supprimer pour de bon.
  const targets = trashed
    ? [
        { id: "", label: "Réserve (restaurer)" },
        ...setTargets,
        { id: "delete", label: "Supprimer définitivement" },
      ]
    : [
        ...(card.setId ? [{ id: "", label: "Réserve (hors set)" }] : []),
        ...setTargets,
        { id: "trash", label: "Corbeille" },
      ];

  // Place, idée et variantes : en haut de la colonne du formulaire, pour que l'aperçu de la carte
  // commence juste sous le titre.
  const header = (
    <div className="flex flex-col gap-1.5">
      <p className={trashed ? "text-danger text-sm" : "text-muted text-sm"}>
        {trashed
          ? "À la corbeille : hors des sets et des listes. Range-la pour la restaurer."
          : card.setCode
            ? `Dans le set ${card.setCode} : ira en prod avec lui.`
            : "Dans la réserve : n'ira pas en prod tant qu'elle n'est pas dans un set."}
      </p>
      {card.ideaId && (
        <p className="text-muted text-sm">
          Tirée d&apos;une{" "}
          <Link href={`/admin/ideas/${card.ideaId}`} className="text-accent hover:underline">
            idée de la boîte à idées
          </Link>
          {siblings.length > 0 && (
            <>
              , comme{" "}
              {siblings.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ", "}
                  <Link href={`/admin/cartes/${c.id}`} className="text-accent hover:underline">
                    {c.name}
                  </Link>
                </span>
              ))}
            </>
          )}
          . Ce lien sert seulement à la gestion.
        </p>
      )}
      {(base || variants.length > 0) && (
        <p className="text-muted text-sm">
          {base ? (
            <>
              Variante de{" "}
              <Link href={`/admin/cartes/${base.id}`} className="text-accent hover:underline">
                {base.name}
              </Link>
              .
            </>
          ) : (
            <>
              Variantes :{" "}
              {variants.map((v, i) => (
                <span key={v.id}>
                  {i > 0 && ", "}
                  <Link href={`/admin/cartes/${v.id}`} className="text-accent hover:underline">
                    {v.name}
                  </Link>
                </span>
              ))}
              .
            </>
          )}
        </p>
      )}
    </div>
  );

  return (
    <Card
      title={`${place} · ${card.name}`}
      action={targets.length > 0 && <MoveCardForm cardId={card.id} targets={targets} />}
    >
      <div className={`${designFonts} flex flex-col gap-4`}>
        <CardEditor
          card={card}
          sets={sets}
          families={familiesOf(allCards)}
          visualEffects={visualEffects}
          imageUrl={images.get(card.id) ?? null}
          author={authors.get(card.id)}
          setSize={setCards.length}
          header={header}
          save={updateCardAction.bind(null, card.id)}
          upload={{
            request: requestCardImageAction,
            confirm: confirmCardImageAction.bind(null, card.id),
          }}
        />
        <Link href="/admin/cartes" className="text-muted text-sm hover:underline">
          ← Toutes les cartes
        </Link>
      </div>
    </Card>
  );
}
