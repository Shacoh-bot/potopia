"use client";

import { Button, cx, Input, Label, Select } from "@app/ui";
import { Check, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  createSetAction,
  type FormState,
  moveCardsAction,
  placeCardAction,
  stageCardAction,
} from "./actions";

function Status({ state }: { state: FormState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role="status"
      className={state.status === "error" ? "text-danger text-sm" : "text-muted text-sm"}
    >
      {state.message}
    </p>
  );
}

/** Délai après la dernière frappe avant de chercher. */
const SEARCH_DELAY = 300;

/**
 * Recherche de cartes qui se met à jour pendant la frappe (Entrée : tout de suite). Elle change
 * seulement `?q=` de l'adresse : le serveur renvoie les cartes trouvées, sans recharger la page.
 * Le champ n'a pas de `name` : il vit dans le formulaire des cases à cocher sans s'y envoyer.
 */
export function CardSearch({
  query,
  set,
  list,
}: {
  query: string;
  set: string;
  /** Vue en liste (`?vue=liste`), gardée d'une recherche à l'autre. */
  list: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sent = useRef(query);

  function search(q: string) {
    clearTimeout(timer.current);
    const trimmed = q.trim();
    if (trimmed === sent.current) return;
    sent.current = trimmed;
    const params = new URLSearchParams({ set });
    if (trimmed) params.set("q", trimmed);
    if (list) params.set("vue", "liste");
    startTransition(() => router.replace(`/admin/cartes?${params}`, { scroll: false }));
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div role="search" className="relative w-full max-w-sm">
      <Search
        size={16}
        aria-hidden
        className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
      />
      <Input
        type="text"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => search(next), SEARCH_DELAY);
        }}
        onKeyDown={(e) => {
          // Entrée cherche tout de suite, sans envoyer le formulaire des cases à cocher.
          if (e.key === "Enter") {
            e.preventDefault();
            search(value);
          }
          if (e.key === "Escape") {
            setValue("");
            search("");
          }
        }}
        placeholder="Chercher une carte : nom, famille, effet…"
        aria-label="Chercher une carte"
        aria-busy={pending}
        maxLength={60}
        className="pr-9 pl-9"
      />
      {pending ? (
        <span
          aria-hidden
          className="border-muted absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-t-transparent"
        />
      ) : (
        value && (
          <button
            type="button"
            aria-label="Effacer la recherche"
            onClick={() => {
              setValue("");
              search("");
            }}
            className="text-muted hover:text-text absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
          >
            <X size={14} aria-hidden />
          </button>
        )
      )}
    </div>
  );
}

/** Création d'un set (code et nom). */
export function NewSetForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createSetAction, {
    status: "idle",
  });
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Label hint="Ex. S2">
        Code
        <Input name="code" required maxLength={12} className="w-28 uppercase" />
      </Label>
      <Label>
        Nom
        <Input name="name" required maxLength={60} />
      </Label>
      <Button type="submit" variant="secondary" disabled={pending}>
        Créer le set
      </Button>
      <Status state={state} />
    </form>
  );
}

/** Destination d'un déplacement : la réserve (`id` vide), un set, « trash » ou « delete ». */
export type MoveTarget = { id: string; label: string };

function TargetSelect({
  targets,
  onChange,
  disabled,
}: {
  targets: MoveTarget[];
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      name="target"
      required
      defaultValue=""
      style={{ width: "auto" }}
      onChange={onChange}
      disabled={disabled}
    >
      <option value="" disabled>
        Déplacer vers…
      </option>
      {targets.map((t) => (
        <option key={t.id || "reserve"} value={t.id || "reserve"}>
          {t.label}
        </option>
      ))}
    </Select>
  );
}

/**
 * Édition d'une carte dans la vue liste : changer le choix range la carte tout de suite (set,
 * réserve ou corbeille). Le menu n'a pas de `name` : il ne part pas avec les cases cochées.
 */
export function PlaceSelect({
  cardId,
  cardName,
  value,
  targets,
}: {
  cardId: string;
  cardName: string;
  /** Place actuelle : id du set, « reserve » ou « trash ». */
  value: string;
  /** Choix : les sets (id), la réserve (« reserve ») et la corbeille (« trash »). */
  targets: MoveTarget[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col gap-0.5">
      <Select
        // Nouvelle place renvoyée par le serveur : le menu repart de celle-ci.
        key={value}
        defaultValue={value}
        disabled={pending}
        aria-label={`Édition de ${cardName}`}
        aria-busy={pending}
        style={{ width: "auto" }}
        className="h-8 py-0 text-xs"
        onChange={(e) => {
          const target = e.target.value;
          startTransition(async () => {
            setError((await placeCardAction(cardId, target))?.error ?? null);
          });
        }}
      >
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </Select>
      {error && <span className="text-danger text-xs">{error}</span>}
    </span>
  );
}

/**
 * Une version de carte que la planche peut montrer : son id (`normal`, `fullart`), son nom et la
 * carte dessinée dans cette version ; `face` null : la carte n'a pas cette version.
 */
export type CardVersionFace = { id: string; label: string; face: ReactNode | null };

/**
 * Carte de la planche et ses versions (normale, full art) : un bouton par version la montre sur
 * place, sans ouvrir la fiche ; le bouton d'une version que la carte n'a pas est grisé. La page
 * dessine chaque version ; seule celle choisie est affichée.
 */
export function CardVersionSwitch({
  cardName,
  versions,
  initial,
}: {
  cardName: string;
  versions: CardVersionFace[];
  /** Version montrée d'abord (celle de la carte) ; une autre si la carte ne l'a pas. */
  initial: string;
}) {
  const [shown, setShown] = useState(initial);
  const current =
    versions.find((v) => v.id === shown && v.face) ?? versions.find((v) => v.face) ?? null;
  return (
    <>
      {current?.face}
      <span role="group" aria-label={`Version de ${cardName}`} className="flex gap-1">
        {versions.map((v) => (
          <button
            key={v.id}
            type="button"
            disabled={!v.face}
            aria-pressed={v.id === current?.id}
            title={v.face ? undefined : `Pas de version ${v.label.toLowerCase()}`}
            onClick={() => setShown(v.id)}
            className={cx(
              "rounded-full border px-2.5 py-0.5 text-xs disabled:cursor-not-allowed disabled:opacity-35",
              v.id === current?.id
                ? "border-accent bg-accent/15 text-text"
                : "border-border text-muted enabled:hover:text-text",
            )}
          >
            {v.label}
          </button>
        ))}
      </span>
    </>
  );
}

/**
 * Étape de préparation d'une carte de la réserve, en un clic : une coche par étape (la sienne
 * cochée) ; à la dernière, un bouton par set pour l'y ranger, où elle prend son numéro. Tout
 * s'enregistre tout de suite ; la page se redessine avec la nouvelle étape.
 */
export function StageButtons({
  cardId,
  cardName,
  stage,
  stages,
  sets,
}: {
  cardId: string;
  cardName: string;
  /** Étape actuelle de la carte. */
  stage: string;
  /** Les étapes, dans l'ordre (id et nom). */
  stages: MoveTarget[];
  /** Les sets où ranger une carte arrivée à la dernière étape (id et code). */
  sets: MoveTarget[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => Promise<{ error: string } | null>) =>
    startTransition(async () => setError((await action())?.error ?? null));
  const last = stages.at(-1)?.id;
  return (
    <span className="flex flex-col items-center gap-1">
      <span
        role="group"
        aria-label={`Étape de ${cardName}`}
        aria-busy={pending}
        className="flex flex-wrap justify-center gap-1"
      >
        {stages.map((s, i) => (
          <button
            key={s.id}
            type="button"
            disabled={pending}
            aria-pressed={s.id === stage}
            onClick={() => s.id !== stage && run(() => stageCardAction(cardId, s.id))}
            className={cx(
              "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs disabled:opacity-60",
              s.id === stage
                ? "border-accent bg-accent/15 text-text"
                : "border-border text-muted hover:text-text",
            )}
          >
            <span
              aria-hidden
              className={cx(
                "flex size-3.5 items-center justify-center rounded-sm border",
                s.id === stage ? "border-accent bg-accent text-bg" : "border-border",
              )}
            >
              {s.id === stage && <Check size={11} strokeWidth={3} />}
            </span>
            {i + 1}. {s.label}
          </button>
        ))}
        {stage === last &&
          sets.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={pending}
              onClick={() => run(() => placeCardAction(cardId, t.id))}
              className="border-accent text-accent hover:bg-accent/15 rounded-full border px-2 py-0.5 text-xs disabled:opacity-60"
            >
              Ranger dans {t.label}
            </button>
          ))}
      </span>
      {error && <span className="text-danger text-xs">{error}</span>}
    </span>
  );
}

/** Cases de cartes à cocher d'un formulaire (`name="ids"`). */
function cardBoxes(form: HTMLFormElement | null | undefined): HTMLInputElement[] {
  return form
    ? [...form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="ids"]')]
    : [];
}

/** Cases de cartes cochées : toutes, une partie ou aucune (aucune aussi sans case). */
export function selectionState(boxes: readonly { checked: boolean }[]): "all" | "some" | "none" {
  const checked = boxes.filter((b) => b.checked).length;
  return checked === 0 ? "none" : checked === boxes.length ? "all" : "some";
}

/**
 * « Tout cocher » : coche ou décoche toutes les cartes affichées (la page en cours, après le filtre
 * d'onglet) ; elle se coche seule quand toutes le sont, à moitié (tiret) quand une partie l'est.
 */
function SelectAllBox() {
  const ref = useRef<HTMLInputElement>(null);
  const sync = () => {
    const box = ref.current;
    if (!box) return;
    const state = selectionState(cardBoxes(box.form));
    box.checked = state === "all";
    box.indeterminate = state === "some";
  };
  // À chaque rendu (nouvelle page, nouvel onglet), puis à chaque case cochée à la main.
  useEffect(sync);
  useEffect(() => {
    const form = ref.current?.form;
    form?.addEventListener("change", sync);
    return () => form?.removeEventListener("change", sync);
  });
  return (
    <label className="flex items-center gap-1.5">
      <input
        ref={ref}
        type="checkbox"
        onChange={(e) => {
          for (const box of cardBoxes(e.currentTarget.form)) box.checked = e.currentTarget.checked;
        }}
      />
      Tout cocher
    </label>
  );
}

/** La suppression définitive se confirme ; le reste part tout de suite. */
function confirmDelete(e: FormEvent<HTMLFormElement>) {
  const target = new FormData(e.currentTarget).get("target");
  if (target === "delete" && !window.confirm("Supprimer définitivement ? Impossible à annuler.")) {
    e.preventDefault();
  }
}

/**
 * Planche de cartes à cocher, avec le déplacement de la sélection vers un set, la réserve ou la
 * corbeille (ou, dans la corbeille, la suppression définitive). Les cases (`name="ids"`) sont
 * posées par la page à côté de chaque carte.
 */
export function MoveCardsForm({
  targets,
  hint,
  children,
}: {
  targets: MoveTarget[];
  /** Rappel affiché à côté du bouton. */
  hint: string;
  children: ReactNode;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(moveCardsAction, {
    status: "idle",
  });
  return (
    <form action={action} onSubmit={confirmDelete} className="flex flex-col gap-4">
      <div className="bg-surface border-border sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
        <SelectAllBox />
        <span className="text-muted">Cartes cochées :</span>
        <TargetSelect targets={targets} />
        <Button type="submit" size="sm" disabled={pending}>
          Valider
        </Button>
        <span className="text-muted text-xs">{hint}</span>
        <Status state={state} />
      </div>
      {children}
    </form>
  );
}

/**
 * Déplacement d'une seule carte (page de la carte) vers un set, la réserve ou la corbeille, dès
 * le choix dans le menu ; à la corbeille, suppression définitive (confirmée, puis retour à la
 * corbeille).
 */
export function MoveCardForm({ cardId, targets }: { cardId: string; targets: MoveTarget[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(moveCardsAction, {
    status: "idle",
  });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="ids" value={cardId} />
      <input type="hidden" name="back" value="on" />
      <TargetSelect
        targets={targets}
        disabled={pending}
        // Enregistré dès le choix ; la suppression définitive se confirme d'abord.
        onChange={(e) => {
          const select = e.currentTarget;
          if (
            select.value === "delete" &&
            !window.confirm("Supprimer définitivement ? Impossible à annuler.")
          ) {
            select.value = "";
            return;
          }
          select.form?.requestSubmit();
        }}
      />
      <Status state={state} />
    </form>
  );
}
