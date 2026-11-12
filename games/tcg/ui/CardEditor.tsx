"use client";

import { Button, Input, Label, Select, Textarea } from "@app/ui";
import { ClipboardPaste } from "lucide-react";
import {
  type ReactNode,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  CARD_LAYOUT_LABELS,
  CARD_LAYOUTS,
  CARD_LIMITS,
  CARD_RARITIES,
  CARD_RARITY_LABELS,
  type Card,
  type CardSet,
  DEFAULT_FRAME,
  frameFor,
  type ImageFrame,
  type VisualEffect,
} from "../src/card-rules";
import {
  defaultParams,
  EFFECTS,
  type EffectDef,
  type EffectTrigger,
  type EffectParams,
  effectText,
  getEffect,
  TRIGGER_LABELS,
} from "../src/effects";
import { CardFlip } from "./CardFlip";
import { GameCard, GameCardDefs } from "./GameCard";
import { ImageFramer } from "./ImageFramer";
import { pastedImage, toCardWebp } from "./toCardWebp";
import { FINAL_ART } from "./v5";
import { VISUAL_EFFECTS } from "./visual-effects";

/** Colonnes d'effets visuels : largeur (12.5rem) et écart (gap-x-3), en px. */
const EFFECT_COLUMN = 200;
const EFFECT_GAP = 12;

/** Mise en page de la carte (enregistrée), de l'aperçu et du cadrage qu'on règle. */
type Layout = Card["layout"];

export type CardEditorState =
  { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

/** Champs du formulaire (pré-remplissables à la création). */
export type CardFields = Fields;

type Fields = {
  name: string;
  rarity: Card["rarity"];
  type: string;
  family: string;
  cost: number;
  power: number;
  effectKey: string;
  effectParams: EffectParams;
  effectText: string;
  flavor: string;
  /** Effets visuels cochés, dans l'ordre des calques (le premier en dessous). */
  visualEffectKeys: string[];
};

type Props = {
  /** Carte à modifier, ou null pour en créer une (dans un des `sets`). */
  card: Card | null;
  sets: CardSet[];
  /** Familles déjà utilisées, proposées à la saisie. */
  families: string[];
  /** Catalogue des effets visuels (`listVisualEffects`), proposés dans la fiche. */
  visualEffects: VisualEffect[];
  imageUrl: string | null;
  /** Auteur de l'idée d'origine, affiché en pied de carte (« idée de … »). */
  author?: string | null;
  /** Nombre de cartes du set, pour le numéro affiché dans l'aperçu. */
  setSize?: number;
  /** Création : nombre de cartes de chaque set (par id), pour le numéro de l'aperçu. */
  setSizes?: Record<string, number>;
  /** Création : set proposé au départ (null : la réserve). */
  defaultSetId?: string | null;
  /** Création à partir d'une idée : son id et les champs pré-remplis depuis elle. */
  fromIdea?: {
    id: string;
    initial: Partial<Fields>;
    /** L'idée a déjà des cartes : il faut cocher « Créer quand même ». */
    hasCards: boolean;
  };
  /**
   * Server action passée par l'app : vérifie l'admin, puis crée ou modifie la carte. Champs
   * envoyés : `card`, le formulaire en JSON ; à la création, `setId` (vide : réserve), `ideaId` et
   * `confirmDuplicate`.
   */
  save: (state: CardEditorState, formData: FormData) => Promise<CardEditorState>;
  /**
   * Envoi de l'illustration (carte existante seulement) : `request` donne une URL d'envoi
   * présignée, le navigateur y envoie le fichier, puis `confirm` pose l'image sur la carte.
   */
  /** Infos posées au-dessus du formulaire (place, idée, variantes), à gauche de l'aperçu. */
  header?: ReactNode;
  upload?: {
    request: (
      contentType: string,
      size: number,
    ) => Promise<{ key: string; url: string } | { error: string }>;
    confirm: (key: string) => Promise<{ error: string } | null>;
  };
};

const EFFECT_GROUPS = (Object.keys(TRIGGER_LABELS) as EffectTrigger[]).map((trigger) => ({
  trigger,
  effects: (EFFECTS as readonly EffectDef[]).filter((e) => e.trigger === trigger),
}));

function initialFields(card: Card | null, initial?: Partial<Fields>): Fields {
  return {
    ...defaults(card),
    ...(card ? {} : initial),
  };
}

function defaults(card: Card | null): Fields {
  return {
    name: card?.name ?? "",
    rarity: card?.rarity ?? "common",
    type: card?.type ?? "Créature",
    family: card?.family ?? "",
    cost: card?.cost ?? 1,
    power: card?.power ?? 2,
    effectKey: card?.effectKey ?? "",
    effectParams: card?.effectParams ?? {},
    effectText: card?.effectText ?? "",
    flavor: card?.flavor ?? "",
    visualEffectKeys: card?.visualEffectKeys ?? [],
  };
}

/**
 * Formulaire d'une carte, avec l'aperçu du design retenu à côté, mis à jour pendant la saisie. Le
 * texte de l'effet suit l'effet choisi tant qu'on ne l'a pas réécrit à la main.
 */
export function CardEditor({
  card,
  sets,
  families,
  visualEffects,
  imageUrl,
  author,
  setSize,
  setSizes,
  defaultSetId,
  fromIdea,
  save,
  upload,
  header,
}: Props) {
  const [state, dispatch, pending] = useActionState(save, { status: "idle" });
  const [, startTransition] = useTransition();
  const [fields, setFields] = useState(() => initialFields(card, fromIdea?.initial));
  const [setId, setSetId] = useState(card?.setId ?? defaultSetId ?? "");
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  // Texte réécrit à la main : il ne suit plus l'effet.
  const [customText, setCustomText] = useState(
    () => !!card && card.effectText !== effectText(card.effectKey, card.effectParams),
  );
  const [layout, setLayout] = useState<Layout>(card?.layout ?? "normal");
  const [image, setImage] = useState(imageUrl);
  // Un cadrage par mise en page. La full art part du cadrage de la carte normale tant qu'elle n'a
  // pas le sien (cartes cadrées avant la séparation) : rien n'est perdu.
  const [frames, setFrames] = useState<Record<Layout, ImageFrame>>(() => ({
    normal: frameFor(card ?? {}, "normal") ?? DEFAULT_FRAME,
    fullart: frameFor(card ?? {}, "fullart") ?? DEFAULT_FRAME,
  }));
  const [uploadState, setUploadState] = useState<string | null>(null);
  // Effets visuels en L (dès xl) : autant qu'il en tient à gauche de la carte, sur une colonne,
  // le reste dessous sur plusieurs colonnes. Le nombre se mesure sur la hauteur de la carte.
  const cardArea = useRef<HTMLDivElement>(null);
  const effectsHead = useRef<HTMLDivElement>(null);
  const [beside, setBeside] = useState(0);
  // Colonnes qui tiendraient sur la largeur, sous la carte (pour le nombre de lignes du bas).
  const [fitColumns, setFitColumns] = useState(1);
  useEffect(() => {
    const area = cardArea.current;
    const head = effectsHead.current;
    if (!area || !head) return;
    const wide = window.matchMedia("(min-width: 1280px)");
    const measure = () => {
      const width = area.parentElement?.clientWidth ?? 0;
      setFitColumns(Math.max(1, Math.floor((width + EFFECT_GAP) / (EFFECT_COLUMN + EFFECT_GAP))));
      if (!wide.matches) return setBeside(0);
      const row = area.parentElement?.querySelector<HTMLElement>("[data-effect-row]");
      // hauteur d'une ligne, plus l'écart entre deux lignes (gap-1.5 = 6 px)
      const rowHeight = (row?.offsetHeight ?? 18) + 6;
      setBeside(Math.max(0, Math.floor((area.offsetHeight - head.offsetHeight + 6) / rowHeight)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    observer.observe(head);
    if (area.parentElement) observer.observe(area.parentElement);
    wide.addEventListener("change", measure);
    measure();
    return () => {
      observer.disconnect();
      wide.removeEventListener("change", measure);
    };
  }, []);

  const variant = !!card?.baseCardId;
  const effect = fields.effectKey ? getEffect(fields.effectKey) : null;
  const proposed = effectText(fields.effectKey || null, effect ? fields.effectParams : null);
  const shownText = customText ? fields.effectText : proposed;

  const preview = useMemo(
    () => ({
      ...fields,
      family: fields.family.trim() || null,
      flavor: fields.flavor.trim() || null,
      effectText: shownText,
      number: card ? card.number : setId ? (setSizes?.[setId] ?? 0) + 1 : null,
      setCode: card ? card.setCode : sets.find((s) => s.id === setId)?.code,
      imageFrame: frames.normal,
      imageFrameFull: frames.fullart,
    }),
    [fields, shownText, card, sets, setId, setSizes, frames],
  );

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function pickEffect(key: string) {
    const next = key ? getEffect(key) : null;
    setFields((f) => ({ ...f, effectKey: key, effectParams: next ? defaultParams(next) : {} }));
  }

  function submit() {
    const data = new FormData();
    data.set(
      "card",
      JSON.stringify({
        ...fields,
        effectText: shownText,
        imageFrame: image ? frames.normal : null,
        imageFrameFull: image ? frames.fullart : null,
        layout,
      }),
    );
    if (!card) {
      data.set("setId", setId);
      if (fromIdea) data.set("ideaId", fromIdea.id);
      if (confirmDuplicate) data.set("confirmDuplicate", "on");
    }
    startTransition(() => dispatch(data));
  }

  async function sendImage(original: Blob, name?: string) {
    if (!upload || !card) return;
    setUploadState("Conversion en WebP…");
    let file: File;
    try {
      file = await toCardWebp(original, name);
    } catch (error) {
      return setUploadState((error as Error).message);
    }
    setUploadState("Envoi…");
    const target = await upload.request(file.type, file.size);
    if ("error" in target) return setUploadState(target.error);
    const put = await fetch(target.url, {
      method: "PUT",
      body: file,
      headers: { "content-type": file.type },
    }).catch(() => null);
    if (!put?.ok) return setUploadState("L'envoi de l'image a échoué.");
    const failed = await upload.confirm(target.key);
    if (failed) return setUploadState(failed.error);
    setImage(URL.createObjectURL(file));
    setFrames({ normal: DEFAULT_FRAME, fullart: DEFAULT_FRAME });
    setUploadState("Illustration enregistrée.");
  }

  /** Bouton « Coller une image » : lit le presse-papiers (le navigateur peut demander l'accord). */
  async function pasteFromClipboard() {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) return void sendImage(await item.getType(type));
      }
      setUploadState("Pas d'image dans le presse-papiers.");
    } catch {
      setUploadState("Lecture du presse-papiers impossible : fais Ctrl+V sur l'éditeur.");
    }
  }

  // Effets sous la carte : en colonnes de 12.5rem, remplies de haut en bas.
  // Base : 4 lignes de plus que s'ils occupaient toute la largeur ; puis 2 colonnes de plus, sans
  // dépasser ce qui tient sur la largeur.
  const below = visualEffects.slice(beside);
  const baseRows = Math.min(below.length, Math.ceil(below.length / fitColumns) + 4);
  const belowColumns = Math.min(fitColumns, Math.ceil(below.length / Math.max(1, baseRows)) + 2);
  const belowRows = Math.ceil(below.length / belowColumns);

  /** Une case d'effet visuel (son rang de calque s'il y en a plusieurs). */
  const effectRow = (v: VisualEffect) => {
    const rank = fields.visualEffectKeys.indexOf(v.key);
    return (
      <label
        key={v.key}
        data-effect-row
        className="text-text flex items-start gap-2 text-sm leading-tight"
      >
        <input
          type="checkbox"
          className="mt-0.5 shrink-0"
          checked={rank >= 0}
          onChange={(e) =>
            set(
              "visualEffectKeys",
              e.target.checked
                ? [...fields.visualEffectKeys, v.key]
                : fields.visualEffectKeys.filter((k) => k !== v.key),
            )
          }
        />
        {v.name}
        {!VISUAL_EFFECTS[v.key] && (
          <span className="text-muted text-xs">(rendu pas encore codé)</span>
        )}
        {rank >= 0 && fields.visualEffectKeys.length > 1 && (
          <span className="text-muted text-xs">calque {rank + 1}</span>
        )}
      </label>
    );
  };

  return (
    <div
      // La carte, ses réglages et les effets visuels prennent juste leur largeur, à droite ; le
      // formulaire prend ce qui reste (ses champs rétrécissent au besoin).
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]"
      // Ctrl+V n'importe où dans l'éditeur : une image collée devient l'illustration (du texte se
      // colle normalement dans son champ)
      onPaste={(e) => {
        const pasted = upload && card ? pastedImage(e.clipboardData) : undefined;
        if (!pasted) return;
        e.preventDefault();
        void sendImage(pasted, pasted.name);
      }}
    >
      <div className="flex flex-col gap-4">
        {header}
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {variant && (
            <p className="text-muted text-sm">
              Variante full art : le mana, la puissance, le type et l&apos;effet viennent de sa
              carte de base et se modifient sur elle.
            </p>
          )}
          {!card && (
            <Label>
              Set
              <Select value={setId} onChange={(e) => setSetId(e.target.value)}>
                <option value="">Réserve (hors set)</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </Select>
            </Label>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Label>
              Nom
              <Input
                value={fields.name}
                maxLength={CARD_LIMITS.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </Label>
            <Label>
              Rareté
              <Select
                value={fields.rarity}
                onChange={(e) => set("rarity", e.target.value as Fields["rarity"])}
              >
                {CARD_RARITIES.map((r) => (
                  <option key={r} value={r}>
                    {CARD_RARITY_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Label>
            <Label hint="Créature, Objet, Instrument, Lieu…">
              Type
              <Input
                value={fields.type}
                maxLength={CARD_LIMITS.type}
                onChange={(e) => set("type", e.target.value)}
                disabled={variant}
                required
              />
            </Label>
            <Label hint="Après le tiret (« Grenouilles ») ; ciblée par certains effets.">
              Famille
              <Input
                value={fields.family}
                maxLength={CARD_LIMITS.family}
                list="tcg-families"
                onChange={(e) => set("family", e.target.value)}
                disabled={variant}
              />
            </Label>
            <Label>
              Mana
              <Input
                type="number"
                min={CARD_LIMITS.cost.min}
                max={CARD_LIMITS.cost.max}
                value={fields.cost}
                onChange={(e) => set("cost", Number(e.target.value))}
                disabled={variant}
              />
            </Label>
            <Label>
              Puissance
              <Input
                type="number"
                min={CARD_LIMITS.power.min}
                max={CARD_LIMITS.power.max}
                value={fields.power}
                onChange={(e) => set("power", Number(e.target.value))}
                disabled={variant}
              />
            </Label>
          </div>
          <datalist id="tcg-families">
            {families.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>

          <Label hint={effect?.snap ? `Repris de ${effect.snap} (Marvel Snap).` : undefined}>
            Effet
            <Select
              value={fields.effectKey}
              onChange={(e) => pickEffect(e.target.value)}
              disabled={variant}
            >
              <option value="">Aucun effet</option>
              {EFFECT_GROUPS.map((g) => (
                <optgroup key={g.trigger} label={TRIGGER_LABELS[g.trigger]}>
                  {g.effects.map((e) => (
                    <option key={e.key} value={e.key}>
                      {e.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Label>
          {effect && effect.params.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {effect.params.map((p) => (
                <Label key={p.name}>
                  {p.label}
                  {p.kind === "int" ? (
                    <Input
                      type="number"
                      min={p.min}
                      max={p.max}
                      value={Number(fields.effectParams[p.name] ?? p.default)}
                      onChange={(e) =>
                        set("effectParams", {
                          ...fields.effectParams,
                          [p.name]: Number(e.target.value),
                        })
                      }
                      disabled={variant}
                    />
                  ) : (
                    <Input
                      value={String(fields.effectParams[p.name] ?? "")}
                      list={p.kind === "family" ? "tcg-families" : undefined}
                      onChange={(e) =>
                        set("effectParams", { ...fields.effectParams, [p.name]: e.target.value })
                      }
                      disabled={variant}
                      required
                    />
                  )}
                </Label>
              ))}
            </div>
          )}
          <Label
            hint={
              customText
                ? "Texte réécrit à la main : il ne suit plus l'effet."
                : "Proposé à partir de l'effet ; tu peux le réécrire."
            }
          >
            Texte de l&apos;effet
            <Textarea
              value={shownText}
              maxLength={CARD_LIMITS.effectText}
              onChange={(e) => {
                setCustomText(true);
                set("effectText", e.target.value);
              }}
              disabled={variant}
            />
          </Label>
          {customText && !variant && (
            <button
              type="button"
              className="text-accent self-start text-sm underline-offset-4 hover:underline"
              onClick={() => setCustomText(false)}
            >
              Reprendre le texte proposé
            </button>
          )}
          <Label hint="En italique sous l'effet.">
            Description
            <Textarea
              value={fields.flavor}
              maxLength={CARD_LIMITS.flavor}
              onChange={(e) => set("flavor", e.target.value)}
            />
          </Label>

          {fromIdea?.hasCards && (
            <label className="text-text flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmDuplicate}
                onChange={(e) => setConfirmDuplicate(e.target.checked)}
              />
              Créer quand même une autre carte pour cette idée
            </label>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {card ? "Enregistrer" : "Créer la carte"}
            </Button>
            {state.status !== "idle" && (
              <p
                role="status"
                className={state.status === "error" ? "text-danger text-sm" : "text-muted text-sm"}
              >
                {state.message}
              </p>
            )}
          </div>
        </form>
      </div>

      {/* Effets visuels en L autour de la carte (dès xl) : une colonne à gauche de la carte et de
          ses réglages (cadrage et envoi à sa droite dès 2xl), puis plusieurs colonnes dessous,
          sur toute la largeur. La colonne de gauche fait 15rem, collée à la carte ; celles du bas,
          12.5rem. Les effets du bas prennent la largeur de la zone sans l'élargir. Avant xl : la carte, puis les effets en grille dessous. */}
      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[15rem_auto] xl:items-start xl:gap-x-3 xl:gap-y-1.5">
        <div
          ref={cardArea}
          className="flex flex-col items-center gap-6 xl:col-start-2 xl:row-start-1 2xl:flex-row 2xl:items-start"
        >
          <div className="flex shrink-0 flex-col items-center gap-3">
            <GameCardDefs />
            <CardFlip button>
              <GameCard
                card={preview}
                imageUrl={image}
                layout={layout}
                setSize={setSize}
                author={author}
              />
            </CardFlip>
            {/* La mise en page choisie est celle de la carte : enregistrée avec elle. */}
            <div
              role="group"
              aria-label="Affichage de la carte"
              className="flex flex-col items-center gap-1"
            >
              <div className="flex gap-2 text-sm">
                {CARD_LAYOUTS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={layout === l}
                    onClick={() => setLayout(l)}
                    className={
                      layout === l
                        ? "border-accent text-text rounded-full border px-3 py-1"
                        : "border-border text-muted rounded-full border px-3 py-1"
                    }
                  >
                    {CARD_LAYOUT_LABELS[l]}
                  </button>
                ))}
              </div>
              <p className="text-muted text-xs">
                Affichage de la carte
                {layout === (card?.layout ?? "normal") ? "" : " (à enregistrer)"}
              </p>
            </div>
          </div>
          {/* À droite de la carte : le cadrage de l'illustration, puis son envoi. */}
          {(image || (upload && card)) && (
            <div className="flex w-full max-w-[300px] shrink-0 flex-col items-center gap-4 2xl:w-[300px]">
              {image && (
                <div className="flex flex-col items-center gap-1">
                  <p className="text-muted text-sm">
                    Cadrage {layout === "normal" ? "de la carte normale" : "de la full art"} :
                    glisse l&apos;image, zoome, puis enregistre la carte.
                  </p>
                  <ImageFramer
                    // un cadrage par mise en page : changer de mise en page change de réglage
                    key={layout}
                    imageUrl={image}
                    frame={frames[layout]}
                    onChange={(next) => setFrames((f) => ({ ...f, [layout]: next }))}
                    // Proportions de la fenêtre d'illustration : carte normale (FINAL_ART) ou full art.
                    width={layout === "normal" ? FINAL_ART.width : 200}
                    height={layout === "normal" ? FINAL_ART.height : 280}
                  />
                  {layout === "fullart" && (
                    <button
                      type="button"
                      className="text-accent text-sm underline-offset-4 hover:underline"
                      onClick={() => setFrames((f) => ({ ...f, fullart: f.normal }))}
                    >
                      Reprendre le cadrage de la carte normale
                    </button>
                  )}
                </div>
              )}
              {upload && card && (
                <div className="flex w-full flex-col gap-2">
                  <Label
                    className="w-full"
                    hint={
                      uploadState ??
                      "Choisis un fichier ou colle une image (Ctrl+V) : convertie en WebP avant l'envoi."
                    }
                  >
                    Illustration
                    <Input
                      type="file"
                      accept="image/*"
                      className="py-1.5"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void sendImage(file, file.name);
                      }}
                    />
                  </Label>
                  <button
                    type="button"
                    onClick={() => void pasteFromClipboard()}
                    className="border-border text-muted hover:text-text hover:bg-surface-hover flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                  >
                    <ClipboardPaste size={16} aria-hidden />
                    Coller une image
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div
          role="group"
          aria-labelledby="tcg-visual-effects"
          // lg : la colonne s'ajuste à la carte, les effets en prennent la largeur sans l'élargir.
          className="flex flex-col gap-1.5 lg:w-0 lg:min-w-full xl:col-start-1 xl:row-start-1 xl:w-auto xl:min-w-0"
        >
          <div ref={effectsHead}>
            <p id="tcg-visual-effects" className="text-text mb-1 text-sm font-medium">
              Effets visuels
            </p>
            <p className="text-muted text-xs">
              Plusieurs à la fois : empilés dans l&apos;ordre où on les coche (le premier en
              dessous). Nouveaux effets : ajoutés par migration.
            </p>
            {visualEffects.length === 0 && (
              <p className="text-muted text-sm">Aucun effet dans le catalogue.</p>
            )}
          </div>
          {visualEffects.slice(0, beside).map(effectRow)}
        </div>
        {below.length > 0 && (
          <div
            className="grid auto-cols-[12.5rem] grid-flow-col gap-x-3 gap-y-1.5 overflow-x-auto lg:w-0 lg:min-w-full xl:col-span-2"
            style={{ gridTemplateRows: `repeat(${belowRows}, auto)` }}
          >
            {below.map(effectRow)}
          </div>
        )}
      </div>
    </div>
  );
}
