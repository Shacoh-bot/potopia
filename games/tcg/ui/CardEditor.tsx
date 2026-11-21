"use client";

import { Button, cx, Input, Label, Select, Textarea } from "@app/ui";
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
  ALT_ART_CHANCE,
  CARD_LAYOUTS,
  CARD_LIMITS,
  CARD_RARITIES,
  CARD_RARITY_LABELS,
  CARD_VERSION_LABELS,
  type Card,
  type CardSet,
  DEFAULT_FRAME,
  FRAME_ZOOM,
  frameFor,
  type GlowPoint,
  type ImageFrame,
  type VisualEffect,
} from "../src/card-rules";
import {
  defaultParams,
  type EffectParams,
  effectStats,
  effectText,
  effectTriggers,
  getEffect,
  TRIGGER_LABELS,
} from "../src/effects";
import { SNAP_CARDS } from "../src/snap-cards";
import { CardFlip } from "./CardFlip";
import { EffectPicker } from "./EffectPicker";
import { GameCard, GameCardDefs } from "./GameCard";
import { GlowPointsEditor } from "./GlowPointsEditor";
import { ImageFramer } from "./ImageFramer";
import { pastedImage, sendCardImages, sizeWarning, toCardImages } from "./toCardWebp";
import { FINAL_ART } from "./v5";
import { VISUAL_EFFECTS } from "./visual-effects";

/** Onglets de la colonne à droite de la carte. */
const SIDE_TABS = [
  { id: "image", label: "Image" },
  { id: "glow", label: "Points lumineux" },
] as const;
type SideTab = (typeof SIDE_TABS)[number]["id"];

/** Colonnes d'effets visuels : largeur (12.5rem) et écart (gap-x-3), en px. */
const EFFECT_COLUMN = 200;
const EFFECT_GAP = 12;

/**
 * Version de la carte (normale ou Alt Art en full art) : celle qu'on voit dans l'aperçu et dont on
 * règle l'illustration et le cadrage.
 */
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
  /** Coût et puissance saisis ; avec un effet, utilisés seulement en stats manuelles. */
  cost: number;
  power: number;
  /** Stats manuelles : coût et puissance ne suivent plus la carte Snap de l'effet. */
  statsManual: boolean;
  effectKey: string;
  effectParams: EffectParams;
  effectText: string;
  flavor: string;
  /** Note de l'admin, jamais montrée aux joueurs. */
  adminNote: string;
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
  /** Illustration de la version normale. */
  imageUrl: string | null;
  /** Illustration de l'Alt Art (la sienne, sinon celle de la normale) ; absente : `imageUrl`. */
  imageUrlFull?: string | null;
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
  /** Infos posées au-dessus du formulaire (place, idée, variantes), à gauche de l'aperçu. */
  header?: ReactNode;
  /**
   * Envoi de l'illustration (carte existante seulement) : `request` donne une URL d'envoi
   * présignée par fichier, le navigateur y envoie la grande image et sa version réduite, puis
   * `confirm` les pose sur la version réglée de la carte.
   */
  upload?: {
    request: (
      contentType: string,
      size: number,
    ) => Promise<{ key: string; url: string } | { error: string }>;
    confirm: (
      key: string,
      version: Layout,
      smallKey?: string | null,
    ) => Promise<{ error: string } | null>;
  };
};

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
    statsManual: card?.statsManual ?? false,
    effectKey: card?.effectKey ?? "",
    effectParams: card?.effectParams ?? {},
    effectText: card?.effectText ?? "",
    flavor: card?.flavor ?? "",
    adminNote: card?.adminNote ?? "",
    visualEffectKeys: card?.visualEffectKeys ?? [],
  };
}

/**
 * Formulaire d'une carte, avec l'aperçu du design retenu à côté, mis à jour pendant la saisie. Le
 * texte de l'effet suit l'effet choisi tant qu'on ne l'a pas réécrit à la main ; le coût et la
 * puissance suivent la carte Snap de l'effet tant que « Stats manuelles » n'est pas cochée (le
 * serveur applique la même règle).
 */
export function CardEditor({
  card,
  sets,
  families,
  visualEffects,
  imageUrl,
  imageUrlFull,
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
  // Version montrée et réglée ; versions actives (tirées et collectionnées), au moins une.
  const [layout, setLayout] = useState<Layout>(card?.layout ?? "normal");
  const [versions, setVersions] = useState<Record<Layout, boolean>>(() => ({
    normal: card?.hasNormal ?? true,
    fullart: card?.hasFullArt ?? false,
  }));
  // Illustration de chaque version ; l'Alt Art reprend celle de la normale tant qu'elle n'a pas
  // la sienne (`ownFull`).
  const [images, setImages] = useState<Record<Layout, string | null>>(() => ({
    normal: imageUrl,
    fullart: imageUrlFull === undefined ? imageUrl : imageUrlFull,
  }));
  const [ownFull, setOwnFull] = useState(!!card?.imageKeyFull);
  const image = images[layout];
  // Un cadrage par mise en page. La full art part du cadrage de la carte normale tant qu'elle n'a
  // pas le sien (cartes cadrées avant la séparation) : rien n'est perdu.
  // Points lumineux, en % de l'image (accrochés à elle).
  const [glowPoints, setGlowPoints] = useState<GlowPoint[]>(() => card?.glowPoints ?? []);
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
  const [sideTab, setSideTab] = useState<SideTab>("image");
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
  // Stats de la carte Snap de l'effet ; tant qu'elles s'appliquent, les champs les affichent.
  const snapStats = effectStats(fields.effectKey || null);
  const following = !fields.statsManual && !!snapStats;
  const cost = following && snapStats ? snapStats.cost : fields.cost;
  const power = following && snapStats ? snapStats.power : fields.power;
  // Carte enregistrée avec d'autres stats que celles de son effet (avant la règle) : on prévient
  // qu'elles seront remplacées, sauf à cocher « Stats manuelles ».
  const savedDiffers =
    !!card &&
    !variant &&
    following &&
    card.effectKey === fields.effectKey &&
    (card.cost !== cost || card.power !== power);

  const preview = useMemo(
    () => ({
      ...fields,
      cost,
      power,
      family: fields.family.trim() || null,
      flavor: fields.flavor.trim() || null,
      effectText: shownText,
      number: card ? card.number : setId ? (setSizes?.[setId] ?? 0) + 1 : null,
      setCode: card ? card.setCode : sets.find((s) => s.id === setId)?.code,
      imageFrame: frames.normal,
      imageFrameFull: frames.fullart,
      glowPoints,
      // pour la mention AA de l'aperçu (`isAltArt`, selon `ALT_ART_NEEDS_NORMAL`)
      hasNormal: versions.normal,
    }),
    [fields, cost, power, shownText, card, sets, setId, setSizes, frames, glowPoints, versions],
  );

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  /**
   * Coche ou décoche « Stats manuelles ». Cochée, la saisie part des stats affichées (celles de
   * l'effet), ou des stats enregistrées si elles en diffèrent : la case sert alors à les garder.
   */
  function setManual(manual: boolean) {
    setFields((f) =>
      manual && !savedDiffers
        ? { ...f, statsManual: true, cost, power }
        : { ...f, statsManual: manual },
    );
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
        cost,
        power,
        effectText: shownText,
        imageFrame: images.normal ? frames.normal : null,
        imageFrameFull: images.fullart ? frames.fullart : null,
        glowPoints,
        hasNormal: versions.normal,
        hasFullArt: versions.fullart,
        // version montrée par défaut (planches) : la normale si elle existe
        layout: versions.normal ? "normal" : "fullart",
      }),
    );
    if (!card) {
      data.set("setId", setId);
      if (fromIdea) data.set("ideaId", fromIdea.id);
      if (confirmDuplicate) data.set("confirmDuplicate", "on");
    }
    startTransition(() => dispatch(data));
  }

  /** Envoie l'illustration de la version réglée (`layout`). */
  async function sendImage(original: Blob, name?: string) {
    if (!upload || !card) return;
    const version = layout;
    setUploadState("Conversion en WebP…");
    let prepared: Awaited<ReturnType<typeof toCardImages>>;
    try {
      prepared = await toCardImages(original, name);
    } catch (error) {
      return setUploadState((error as Error).message);
    }
    setUploadState("Envoi…");
    const sent = await sendCardImages(prepared, upload.request);
    if ("error" in sent) return setUploadState(sent.error);
    const failed = await upload.confirm(sent.key, version, sent.smallKey);
    if (failed) return setUploadState(failed.error);
    const url = URL.createObjectURL(prepared.large);
    // Nouvelle illustration de la normale : l'Alt Art sans la sienne la reprend (cadrage compris).
    const both = version === "normal" && !ownFull;
    setImages((i) => (both ? { normal: url, fullart: url } : { ...i, [version]: url }));
    setFrames((f) =>
      both ? { normal: DEFAULT_FRAME, fullart: DEFAULT_FRAME } : { ...f, [version]: DEFAULT_FRAME },
    );
    if (version === "fullart") setOwnFull(true);
    // Image trop petite pour la carte agrandie : enregistrée quand même, avec un avertissement.
    const warning = sizeWarning(prepared);
    setUploadState(
      `Illustration ${version === "normal" ? "de la version normale" : "de l'Alt Art"} enregistrée.` +
        (warning ? ` ${warning}` : ""),
    );
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

  /** Une case d'effet visuel. */
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
      <div className="flex flex-col gap-3">
        {header}
        <form
          className="flex flex-col gap-3"
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
          {/* Champs courts : 3 par ligne dès que la colonne est assez large, pour gagner en hauteur. */}
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
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
            <Label>
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
                value={cost}
                onChange={(e) => set("cost", Number(e.target.value))}
                disabled={variant || following}
              />
            </Label>
            <Label>
              Puissance
              <Input
                type="number"
                min={CARD_LIMITS.power.min}
                max={CARD_LIMITS.power.max}
                value={power}
                onChange={(e) => set("power", Number(e.target.value))}
                disabled={variant || following}
              />
            </Label>
          </div>
          {snapStats && effect && !variant && (
            <div className="flex flex-col gap-1 text-sm">
              <label className="text-text flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={fields.statsManual}
                  onChange={(e) => setManual(e.target.checked)}
                />
                Stats manuelles (ne pas suivre l&apos;effet)
              </label>
              <p className="text-muted text-xs">
                {fields.statsManual
                  ? `Coût et puissance libres. Décoche pour reprendre ceux de ${effect.snap} (${snapStats.cost}/${snapStats.power}).`
                  : `Coût et puissance de ${effect.snap} (Marvel Snap) : ${snapStats.cost}/${snapStats.power}. Ils suivent l'effet choisi.`}
              </p>
              {savedDiffers && card && (
                <p role="status" className="text-accent text-xs">
                  {`Enregistrée avec ${card.cost}/${card.power} : à l'enregistrement, elle prendra ${cost}/${power}. Coche « Stats manuelles » pour garder ${card.cost}/${card.power}.`}
                </p>
              )}
            </div>
          )}
          <datalist id="tcg-families">
            {families.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>

          {/* Pas de <label> autour : la recherche, les filtres et la liste sont trois champs. */}
          <div role="group" aria-label="Effet" className="text-muted flex flex-col gap-1 text-sm">
            Effet
            <EffectPicker value={fields.effectKey} onChange={pickEffect} disabled={variant} />
            {effect?.snap && (
              <span className="text-muted text-xs">
                Repris de{" "}
                <a
                  href={SNAP_CARDS[effect.snap]?.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-accent underline"
                >
                  {effect.snap}
                </a>{" "}
                (Marvel Snap) ·{" "}
                {effectTriggers(effect)
                  .map((t) => TRIGGER_LABELS[t])
                  .join(", ")}
              </span>
            )}
          </div>
          {effect && effect.params.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
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
              // Hauteur selon le texte (marges et interligne serrés) : compact, sans barre de défilement.
              className="[field-sizing:content] min-h-11 py-1.5 leading-snug"
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
              className="[field-sizing:content] min-h-11 py-1.5 leading-snug"
              value={fields.flavor}
              maxLength={CARD_LIMITS.flavor}
              onChange={(e) => set("flavor", e.target.value)}
            />
          </Label>

          <Label hint="Pour l'admin seulement : jamais montrée aux joueurs, sans effet en jeu.">
            Note admin
            <Input
              value={fields.adminNote}
              maxLength={CARD_LIMITS.adminNote}
              placeholder="Ex. effet à revoir"
              onChange={(e) => set("adminNote", e.target.value)}
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
            {/* Les deux versions de la carte : chacune active ou non, avec son illustration et
                son cadrage (réglés à droite pour la version choisie ici). */}
            <div
              role="group"
              aria-label="Versions de la carte"
              className="flex flex-col items-center gap-1.5"
            >
              <div className="flex gap-2 text-sm">
                {CARD_LAYOUTS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={layout === l}
                    onClick={() => setLayout(l)}
                    className={cx(
                      "rounded-full border px-3 py-1",
                      layout === l ? "border-accent text-text" : "border-border text-muted",
                      !versions[l] && "line-through decoration-1",
                    )}
                  >
                    {CARD_VERSION_LABELS[l]}
                  </button>
                ))}
              </div>
              {/* Les deux coches côte à côte, quelle que soit la version montrée : chacune
                  s'active ou se désactive en un clic, sans changer d'onglet. */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                {CARD_LAYOUTS.map((l) => (
                  <label key={l} className="text-text flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={versions[l]}
                      // au moins une version : la dernière active ne se décoche pas
                      disabled={versions[l] && !versions[l === "normal" ? "fullart" : "normal"]}
                      onChange={(e) => setVersions((v) => ({ ...v, [l]: e.target.checked }))}
                    />
                    {CARD_VERSION_LABELS[l]} active
                  </label>
                ))}
              </div>
              <p className="text-muted max-w-[300px] text-center text-xs">
                {versions[layout]
                  ? layout === "fullart" && versions.normal
                    ? `Tirée à la place de la normale ${Math.round(ALT_ART_CHANCE * 100)} fois sur 100, collectionnée à part.`
                    : "Tirée dans les boosters et collectionnée dans le Potodex."
                  : "Inactive : ni tirée, ni dans le Potodex."}
                {card &&
                (card.hasNormal !== versions.normal || card.hasFullArt !== versions.fullart)
                  ? " (à enregistrer)"
                  : ""}
              </p>
            </div>
          </div>
          {/* À droite de la carte, en deux onglets : l'image (cadrage puis envoi) ou la pose des
              points lumineux. L'aperçu de la carte reste visible. */}
          {(image || (upload && card)) && (
            <div className="flex w-full max-w-[300px] shrink-0 flex-col items-center gap-4 2xl:w-[300px]">
              {image && (
                <div role="tablist" aria-label="Réglages de l'image" className="flex gap-2 text-sm">
                  {SIDE_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={sideTab === t.id}
                      onClick={() => setSideTab(t.id)}
                      className={
                        sideTab === t.id
                          ? "border-accent text-text rounded-full border px-3 py-1"
                          : "border-border text-muted hover:text-text rounded-full border px-3 py-1"
                      }
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
              {image && sideTab === "glow" ? (
                <GlowPointsEditor imageUrl={image} points={glowPoints} onChange={setGlowPoints} />
              ) : (
                <>
                  {image && (
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-muted text-sm">
                        {layout === "normal"
                          ? "Cadrage de la version normale : glisse l'image, zoome ou dézoome (« Image entière » la fait tenir toute), puis enregistre la carte. L'Alt Art n'est pas touchée."
                          : "Cadrage de l'Alt Art : glisse l'image, zoome, puis enregistre la carte."}
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
                        // dézoom (image entière) : carte normale seulement
                        minZoom={layout === "normal" ? FRAME_ZOOM.min : FRAME_ZOOM.fullMin}
                      />
                      {layout === "fullart" && !ownFull && (
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
                          (layout === "fullart" && !ownFull
                            ? "Sans illustration à elle, l'Alt Art reprend celle de la normale. Choisis un fichier ou colle une image (Ctrl+V) : convertie en WebP avant l'envoi."
                            : "Choisis un fichier ou colle une image (Ctrl+V) : convertie en WebP avant l'envoi.")
                        }
                      >
                        Illustration{" "}
                        {layout === "normal" ? "de la version normale" : "de l'Alt Art"}
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
                </>
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
