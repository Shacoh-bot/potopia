"use server";

import {
  CARD_LAYOUTS,
  CARD_PREP_STAGE_LABELS,
  CARD_PREP_STAGES,
  CardInputError,
  type CardLayout,
  createCard,
  createSet,
  deleteCards,
  listCards,
  trashCards,
  moveCards,
  moveCardsToStage,
  setCardStage,
  createCardImageUpload,
  createCardSoundUpload,
  importCards,
  setCardImage,
  setCardSound,
  CARD_SOUND_TYPE,
  updateCard,
  updateCards,
  type CardImport,
  type CardInput,
  type CardUpdates,
} from "@app/tcg";
import type { CardEditorState } from "@app/tcg/ui";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { actionAdmin } from "@/lib/session";

/** Message lisible d'une erreur de saisie, ou null pour une erreur inattendue (relancée). */
function inputError(error: unknown): string | null {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Formulaire invalide.";
  if (error instanceof CardInputError) return error.message;
  if (error instanceof SyntaxError) return "JSON illisible.";
  return null;
}

function readCard(formData: FormData): CardInput {
  return JSON.parse(String(formData.get("card") ?? "{}")) as CardInput;
}

/**
 * Crée une carte (dans un set ou la réserve, éventuellement tirée d'une idée), puis ouvre sa page
 * pour y envoyer l'illustration. Garde-fou : si l'idée a déjà des cartes, il faut le confirmer.
 */
export async function createCardAction(
  _prev: CardEditorState,
  formData: FormData,
): Promise<CardEditorState> {
  const admin = await actionAdmin();
  let id: string;
  try {
    const setId = String(formData.get("setId") ?? "");
    const ideaId = String(formData.get("ideaId") ?? "") || null;
    if (ideaId && formData.get("confirmDuplicate") !== "on") {
      const existing = await listCards(admin, { ideaId });
      if (existing.length > 0) {
        return {
          status: "error",
          message: `Cette idée a déjà ${existing.length} carte${existing.length > 1 ? "s" : ""} : coche « Créer quand même » pour en ajouter une.`,
        };
      }
    }
    id = (await createCard(admin, { ...readCard(formData), setId, ideaId })).id;
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { status: "error", message };
  }
  revalidatePath("/admin/cartes", "layout");
  redirect(`/admin/cartes/${id}`);
}

/** Enregistre une carte (liée à son id par la page : `updateCardAction.bind(null, id)`). */
export async function updateCardAction(
  id: string,
  _prev: CardEditorState,
  formData: FormData,
): Promise<CardEditorState> {
  const admin = await actionAdmin();
  try {
    await updateCard(admin, z.string().min(1).parse(id), readCard(formData));
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { status: "error", message };
  }
  revalidatePath("/admin/cartes", "layout");
  return { status: "ok", message: "Carte enregistrée." };
}

/** URL d'envoi présignée pour l'illustration d'une carte. */
export async function requestCardImageAction(
  contentType: string,
  size: number,
): Promise<{ key: string; url: string } | { error: string }> {
  const admin = await actionAdmin();
  try {
    return await createCardImageUpload(admin, { contentType, size });
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { error: message };
  }
}

/**
 * Pose l'illustration envoyée sur une version de la carte (liée à son id par la page) : la normale
 * par défaut, ou la full art (Alt Art), avec sa version réduite (`smallKey`) pour les petites cartes.
 */
export async function confirmCardImageAction(
  id: string,
  key: string,
  version?: CardLayout,
  smallKey?: string | null,
): Promise<{ error: string } | null> {
  const admin = await actionAdmin();
  try {
    await setCardImage(admin, z.string().min(1).parse(id), key, {
      version: z.enum(CARD_LAYOUTS).optional().parse(version),
      smallKey: z.string().min(1).nullish().parse(smallKey),
    });
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { error: message };
  }
  revalidatePath("/admin/cartes", "layout");
  return null;
}

/** URL d'envoi présignée pour le son propre d'une carte (MP3). */
export async function requestCardSoundAction(
  size: number,
): Promise<{ key: string; url: string } | { error: string }> {
  const admin = await actionAdmin();
  try {
    return await createCardSoundUpload(admin, { contentType: CARD_SOUND_TYPE, size });
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { error: message };
  }
}

/** Pose (ou retire, avec `null`) le son propre d'une version de la carte (liée à son id par la page). */
export async function confirmCardSoundAction(
  id: string,
  key: string | null,
  version: CardLayout,
): Promise<{ error: string } | null> {
  const admin = await actionAdmin();
  try {
    await setCardSound(
      admin,
      z.string().min(1).parse(id),
      z.string().min(1).nullable().parse(key),
      { version: z.enum(CARD_LAYOUTS).parse(version) },
    );
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { error: message };
  }
  revalidatePath("/admin/cartes", "layout");
  return null;
}

export type ImportState =
  { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

/** Importe un fichier de cartes (JSON) ; les idées déjà importées sont ignorées. */
export async function importCardsAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const admin = await actionAdmin();
  const file = formData.get("file");
  const text =
    file instanceof File && file.size > 0 ? await file.text() : String(formData.get("json") ?? "");
  try {
    const json = JSON.parse(text) as CardImport | CardUpdates;
    // Fichier de mise à jour : `updates` au lieu de `cards`.
    if ("updates" in json) {
      const { updated } = await updateCards(admin, json);
      revalidatePath("/admin/cartes", "layout");
      return {
        status: "ok",
        message: `${updated} carte${updated > 1 ? "s" : ""} mise${updated > 1 ? "s" : ""} à jour.`,
      };
    }
    const { created, skipped } = await importCards(admin, json);
    revalidatePath("/admin/cartes", "layout");
    return {
      status: "ok",
      message: `${created} carte${created > 1 ? "s" : ""} créée${created > 1 ? "s" : ""}, ${skipped} déjà importée${skipped > 1 ? "s" : ""}.`,
    };
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { status: "error", message };
  }
}

export type FormState =
  { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

/** Crée un set (code et nom), puis l'ouvre. */
export async function createSetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionAdmin();
  let code: string;
  try {
    code = (
      await createSet(admin, {
        code: String(formData.get("code") ?? "").toUpperCase(),
        name: String(formData.get("name") ?? ""),
      })
    ).code;
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { status: "error", message };
  }
  revalidatePath("/admin/cartes", "layout");
  redirect(`/admin/cartes?set=${code}`);
}

/**
 * Range une carte depuis la liste (menu de sa ligne) : un set (id), la réserve (« reserve »), la
 * corbeille (« trash ») ou le doublon (« duplicate », avec `duplicateOf`, la carte dont elle est le
 * doublon). Renvoie l'erreur lisible, ou null.
 */
export async function placeCardAction(
  id: string,
  target: string,
  duplicateOf?: string,
): Promise<{ error: string } | null> {
  const admin = await actionAdmin();
  try {
    const cardId = z.string().min(1).parse(id);
    const to = z.string().min(1).parse(target);
    if (to === "trash" || to === "duplicate") {
      await trashCards(admin, [cardId], { duplicate: to === "duplicate", duplicateOf });
    } else await moveCards(admin, [cardId], to === "reserve" ? null : to);
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { error: message };
  }
  revalidatePath("/admin/cartes", "layout");
  return null;
}

/**
 * Classe une carte à une étape de préparation (pastilles sous la carte), sans la déplacer.
 * Renvoie l'erreur lisible, ou null.
 */
export async function stageCardAction(
  id: string,
  stage: string,
): Promise<{ error: string } | null> {
  const admin = await actionAdmin();
  try {
    await setCardStage(admin, [z.string().min(1).parse(id)], stage);
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { error: message };
  }
  revalidatePath("/admin/cartes", "layout");
  return null;
}

/** Préfixe d'une destination « réserve à une étape » du menu « Déplacer vers… » (`stage:described`). */
const STAGE_TARGET = "stage:";

const plural = (n: number, word: string) =>
  `${n} carte${n > 1 ? "s" : ""} ${word}${n > 1 ? "s" : ""}`;

/**
 * Range les cartes cochées (`ids`) dans un set ou dans la réserve (`target` = « reserve »), ce qui
 * les sort de la corbeille ; `target` = « trash » les met à la corbeille, « duplicate » au doublon
 * (corbeille, marquées « Doublon », doublons de la carte `duplicateOf`), « delete » supprime pour de bon celles de la corbeille.
 * « stage:<étape> » les range dans la réserve à cette étape de préparation (`CARD_PREP_STAGES`).
 */
export async function moveCardsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionAdmin();
  const target = String(formData.get("target") ?? "");
  const ids = formData.getAll("ids").map(String);
  if (ids.length === 0) return { status: "error", message: "Coche au moins une carte." };
  try {
    if (target === "trash" || target === "duplicate") {
      const duplicate = target === "duplicate";
      const duplicateOf = String(formData.get("duplicateOf") ?? "") || undefined;
      await trashCards(admin, ids, { duplicate, duplicateOf });
      revalidatePath("/admin/cartes", "layout");
      const n = new Set(ids).size;
      return {
        status: "ok",
        message: `${plural(n, "mise")} ${duplicate ? "en doublon" : "à la corbeille"}.`,
      };
    }
    if (target === "delete") {
      const { deleted } = await deleteCards(admin, ids);
      revalidatePath("/admin/cartes", "layout");
      if (formData.get("back") === "on") redirect("/admin/cartes?set=corbeille");
      return { status: "ok", message: `${plural(deleted, "supprimée")} définitivement.` };
    }
    if (target.startsWith(STAGE_TARGET)) {
      const stage = z.enum(CARD_PREP_STAGES).parse(target.slice(STAGE_TARGET.length));
      const { moved, staged } = await moveCardsToStage(admin, ids, stage);
      revalidatePath("/admin/cartes", "layout");
      const label = CARD_PREP_STAGE_LABELS[stage];
      return moved + staged === 0
        ? { status: "ok", message: `Déjà dans la réserve, étape « ${label} ».` }
        : { status: "ok", message: `Dans la réserve, étape « ${label} ».` };
    }
    const { moved } = await moveCards(admin, ids, target === "reserve" ? null : target);
    revalidatePath("/admin/cartes", "layout");
    return {
      status: "ok",
      message: `${moved} carte${moved > 1 ? "s" : ""} déplacée${moved > 1 ? "s" : ""}.`,
    };
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { status: "error", message };
  }
}
