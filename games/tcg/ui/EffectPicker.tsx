"use client";

import { Input, Select } from "@app/ui";
import { useMemo, useState } from "react";
import { COST_FILTER_MAX, searchEffects } from "../src/effect-search";
import { EFFECTS, type EffectTrigger, getEffect, TRIGGER_LABELS } from "../src/effects";
import { SNAP_CARDS } from "../src/snap-cards";

const TRIGGERS = Object.keys(TRIGGER_LABELS) as EffectTrigger[];

/** « Thor (3/5) — Mélange un marteau dans ta pioche » */
function optionLabel(key: string): string {
  const effect = getEffect(key);
  if (!effect) return key;
  const stats = SNAP_CARDS[effect.snap];
  return `${effect.snap}${stats ? ` (${stats.cost}/${stats.power})` : ""} — ${effect.label}`;
}

/**
 * Choix de l'effet d'une carte parmi tout le catalogue Snap (plusieurs centaines d'effets) :
 * recherche (nom de la carte Snap, libellé, texte), filtres par moment et par coût, puis liste
 * des effets trouvés, rangés par moment. L'effet choisi reste affiché même s'il ne passe plus
 * les filtres.
 */
export function EffectPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [trigger, setTrigger] = useState<EffectTrigger | "">("");
  const [cost, setCost] = useState<number | null>(null);
  const found = useMemo(
    () => searchEffects(EFFECTS, { query, trigger, cost }),
    [query, trigger, cost],
  );
  const groups = TRIGGERS.map((t) => ({
    trigger: t,
    effects: found.filter((e) => e.trigger === t),
  }));
  const current = value ? getEffect(value) : null;
  const hidden = current && !found.includes(current);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher : Thor, détruit, écureuil…"
          aria-label="Chercher un effet"
          className="min-w-48 flex-1"
          disabled={disabled}
        />
        <Select
          value={trigger}
          onChange={(e) => setTrigger(e.target.value as EffectTrigger | "")}
          aria-label="Filtrer par moment"
          style={{ width: "auto" }}
          disabled={disabled}
        >
          <option value="">Tous les moments</option>
          {TRIGGERS.map((t) => (
            <option key={t} value={t}>
              {TRIGGER_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select
          value={cost === null ? "" : String(cost)}
          onChange={(e) => setCost(e.target.value === "" ? null : Number(e.target.value))}
          aria-label="Filtrer par coût"
          style={{ width: "auto" }}
          disabled={disabled}
        >
          <option value="">Tous les coûts</option>
          {Array.from({ length: COST_FILTER_MAX + 1 }, (_, c) => (
            <option key={c} value={c}>
              {c === COST_FILTER_MAX ? `Coût ${c}+` : `Coût ${c}`}
            </option>
          ))}
        </Select>
      </div>
      <Select
        size={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Effet"
        disabled={disabled}
        className="h-auto"
      >
        <option value="">Aucun effet</option>
        {hidden && <option value={current.key}>{optionLabel(current.key)} (choisi)</option>}
        {groups
          .filter((g) => g.effects.length > 0)
          .map((g) => (
            <optgroup key={g.trigger} label={TRIGGER_LABELS[g.trigger]}>
              {g.effects.map((e) => (
                <option key={e.key} value={e.key}>
                  {optionLabel(e.key)}
                </option>
              ))}
            </optgroup>
          ))}
      </Select>
      <p className="text-muted text-xs">
        {found.length} effet{found.length > 1 ? "s" : ""} sur {EFFECTS.length}
        {found.length === 0 && " : élargis la recherche ou les filtres."}
      </p>
    </div>
  );
}
