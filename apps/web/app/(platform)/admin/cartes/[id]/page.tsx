import { getCard, isDuplicateNote, listCards, listSets, listVisualEffects } from "@app/tcg";
import { CardEditor } from "@app/tcg/ui";
import { buttonClasses, Card } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../../cartes/fonts";
import { confirmCardImageAction, requestCardImageAction, updateCardAction } from "../actions";
import { MoveCardForm } from "../forms";
import { cardFaces, duplicateCandidates, familiesOf } from "../images";
import { boardHref, boardQuery, cardHref } from "../board-url";

export const metadata: Metadata = { title: "Modifier une carte" };

export default async function AdminCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retour?: string }>;
}) {
  const admin = await getCurrentAdmin();
  const { id } = await params;
  // La planche d'où l'on vient (place, étape, vue, page) : le lien « retour » y ramène.
  const board = boardQuery((await searchParams).retour);
  const card = await getCard(admin, id);
  if (!card) notFound();
  const [sets, allCards, visualEffects] = await Promise.all([
    listSets(admin),
    listCards(admin),
    listVisualEffects(admin),
  ]);
  // la carte prête à afficher dans chaque version (image, « idée de … », taille du set)
  const [normal, full] = await cardFaces(admin, [
    { ...card, layout: "normal" },
    { ...card, layout: "fullart" },
  ]);
  const base = card.baseCardId ? allCards.find((c) => c.id === card.baseCardId) : null;
  // « Doublon de : … » : la carte d'origine choisie au passage au « Doublon ».
  const original = card.duplicateOfId ? await getCard(admin, card.duplicateOfId) : null;
  const candidates = await duplicateCandidates(admin, allCards);
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
        // Déjà au « Doublon » : en changer (ou en choisir) la carte d'origine.
        { id: "duplicate", label: isDuplicateNote(card.adminNote) ? "Doublon de…" : "Doublon" },
        { id: "delete", label: "Supprimer définitivement" },
      ]
    : [
        ...(card.setId ? [{ id: "", label: "Réserve (hors set)" }] : []),
        ...setTargets,
        { id: "duplicate", label: "Doublon" },
        { id: "trash", label: "Corbeille" },
      ];

  // Déplacement, place, idée et variantes : en haut de la colonne du formulaire, pour que l'aperçu de la carte
  // commence juste sous le titre.
  const header = (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {targets.length > 0 && (
          <MoveCardForm cardId={card.id} targets={targets} candidates={candidates} />
        )}
        <p className={trashed ? "text-danger text-sm" : "text-muted text-sm"}>
          {trashed
            ? "À la corbeille : hors des sets et des listes. Range-la pour la restaurer."
            : card.setCode
              ? `Dans le set ${card.setCode} : ira en prod avec lui.`
              : "Dans la réserve : n'ira pas en prod tant qu'elle n'est pas dans un set."}
        </p>
      </div>
      {isDuplicateNote(card.adminNote) && (
        <p className="text-sm">
          Doublon de :{" "}
          {original ? (
            <Link href={cardHref(original.id, board)} className="text-accent hover:underline">
              {original.name}
            </Link>
          ) : (
            <span className="text-danger">à relier (choisis « Doublon de… » dans le menu)</span>
          )}
        </p>
      )}
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
                  <Link href={cardHref(c.id, board)} className="text-accent hover:underline">
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
              <Link href={cardHref(base.id, board)} className="text-accent hover:underline">
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
                  <Link href={cardHref(v.id, board)} className="text-accent hover:underline">
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
      action={
        // Retour à la planche avec ses filtres (place, étape, vue, page, recherche), sur la carte.
        <Link
          href={boardHref(board, card.id)}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          ← Retour aux cartes
        </Link>
      }
    >
      <div className={`${designFonts} flex flex-col gap-4`}>
        <CardEditor
          card={card}
          sets={sets}
          families={familiesOf(allCards)}
          visualEffects={visualEffects}
          // l'éditeur cadre sur la grande illustration
          imageUrl={normal?.card.imageUrlLarge ?? normal?.imageUrl ?? null}
          imageUrlFull={full?.card.imageUrlLarge ?? full?.imageUrl ?? null}
          author={normal?.card.author}
          setSize={normal?.setSize}
          header={header}
          save={updateCardAction.bind(null, card.id)}
          upload={{
            request: requestCardImageAction,
            confirm: confirmCardImageAction.bind(null, card.id),
          }}
        />
      </div>
    </Card>
  );
}
