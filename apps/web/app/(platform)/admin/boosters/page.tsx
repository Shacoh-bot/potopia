import {
  BOOSTER_SLOTS,
  boosterPity,
  CARD_RARITY_LABELS,
  type CardRarityId,
  CHANCE_RATES,
  getPotodex,
  listSets,
  SR_PITY,
  SSR_PITY,
} from "@app/tcg";
import { buttonClasses, Card, cx, EmptyState } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../cartes/fonts";
import { BoosterOpener } from "./BoosterOpener";

export const metadata: Metadata = { title: "Boosters" };

const percent = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} %`;
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** « commune (75 %) ou peu commune (25 %) » : les raretés possibles d'un emplacement. */
function slotOdds(weights: Partial<Record<CardRarityId, number>>): string {
  const entries = Object.entries(weights) as [CardRarityId, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  const parts = entries.map(
    ([rarity, w]) => `${CARD_RARITY_LABELS[rarity].toLowerCase()} (${percent((100 * w) / total)})`,
  );
  return parts.length > 1
    ? `${parts.slice(0, -1).join(", ")} ou ${parts.at(-1)}`
    : (parts[0] ?? "");
}

/**
 * Ouverture de boosters, en test (admins seulement, paquets gratuits et illimités) : 5 cartes du
 * set choisi, ajoutées à la collection de l'admin (son Potodex). Sous l'ouverture : ce qu'il y a
 * dans un paquet, les chances de la carte chance (taux moyens réels, garanties comprises), les
 * garanties et où en est le joueur.
 */
export default async function AdminBoostersPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string }>;
}) {
  const admin = await getCurrentAdmin();
  const sets = await listSets(admin);
  const { set: code } = await searchParams;
  const current = sets.find((s) => s.code === code) ?? sets[0];
  if (!current) {
    return (
      <Card title="Boosters">
        <EmptyState title="Aucun set" description="Crée un set et range-y des cartes d'abord." />
      </Card>
    );
  }
  const [dex, pity] = await Promise.all([
    getPotodex(admin, { setCode: current.code }),
    boosterPity(admin, { setCode: current.code }),
  ]);
  const [base, , , fourth] = BOOSTER_SLOTS;
  const chance = Object.entries(CHANCE_RATES) as [CardRarityId, number][];

  return (
    <Card
      title="Boosters (test)"
      action={
        <Link
          href={`/admin/potodex?set=${current.code}`}
          className={buttonClasses({ variant: "ghost", size: "sm" })}
        >
          Mon Potodex
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        {sets.length > 1 && (
          <nav className="flex flex-wrap gap-2" aria-label="Sets">
            {sets.map((s) => (
              <Link
                key={s.id}
                href={`/admin/boosters?set=${s.code}`}
                className={cx(
                  "rounded-full border px-3 py-1 text-sm",
                  s.id === current.id ? "border-accent text-accent" : "border-border text-muted",
                )}
              >
                {s.code} · {s.name}
              </Link>
            ))}
          </nav>
        )}
        <p className="text-text max-w-prose">
          Cinq cartes sous plastique, aucune garantie de bon goût. Tourne le paquet, découpe-le, et
          découvre qui des potes a fini en carte cette fois-ci. Tout ce qui sort rejoint ton
          Potodex, doublons compris : de quoi frimer, ou pleurer, devant le set {current.code}.
        </p>
        {dex.total === 0 ? (
          <EmptyState title="Set vide" description="Ce set n'a encore aucune carte numérotée." />
        ) : (
          <BoosterOpener setCode={current.code} fonts={designFonts} />
        )}
        <p className="text-accent text-sm">
          Mode test (admin) : chaque paquet contient une carte de chaque rareté, de rare à SSR, pour
          essayer ouvertures, sons et effets. Ces paquets ne comptent ni pour les garanties ni pour
          les chances ci-dessous, qui sont celles des joueurs.
        </p>

        <section
          aria-labelledby="booster-odds"
          className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-4 text-sm"
        >
          <h2 id="booster-odds" className="font-display text-accent text-base">
            Ce qu&apos;il y a dans un paquet
          </h2>
          <ul className="text-muted flex flex-col gap-1">
            <li>
              <span className="text-text">Cartes 1 à 3 :</span> {base ? slotOdds(base) : ""}.
            </li>
            <li>
              <span className="text-text">Carte 4 :</span> {fourth ? slotOdds(fourth) : ""}.
            </li>
            <li>
              <span className="text-text">Carte 5, la carte chance :</span> rare ou mieux, avec ces
              chances :
            </li>
          </ul>
          <table className="w-full max-w-lg">
            <caption className="sr-only">Chances de la carte chance</caption>
            <tbody>
              {chance.map(([rarity, rate]) => (
                <tr key={rarity}>
                  <th
                    scope="row"
                    className="text-text py-1 pr-3 text-left font-normal whitespace-nowrap"
                  >
                    {CARD_RARITY_LABELS[rarity]}
                  </th>
                  <td className="w-full min-w-24 py-1">
                    <div className="bg-border h-2 overflow-hidden rounded-full" aria-hidden>
                      <div
                        className="bg-accent h-full rounded-full"
                        style={{ width: `${Math.max(2, rate)}%` }}
                      />
                    </div>
                  </td>
                  <td className="text-text py-1 pl-3 text-right whitespace-nowrap tabular-nums">
                    {percent(rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted text-xs">
            Moyennes sur la durée, garanties comprises : les garanties ne donnent rien de plus,
            elles évitent seulement les très longues séries sans rien.
          </p>
          <ul className="flex flex-col gap-1">
            <li>Une SR ou mieux au plus tard au {SR_PITY}e paquet.</li>
            {SSR_PITY !== null && <li>Une SSR au plus tard au {SSR_PITY}e paquet.</li>}
          </ul>
          <p className="text-text">
            Pour toi, dans ce set : encore {plural(pity.untilSr, "paquet")} au plus avant ta SR
            garantie
            {pity.untilSsr !== null && <>, {plural(pity.untilSsr, "paquet")} avant ta SSR</>}. Ton
            Potodex : {dex.found}/{dex.total} trouvées, {plural(dex.boosters, "paquet")} ouvert
            {dex.boosters > 1 ? "s" : ""}.
          </p>
        </section>
      </div>
    </Card>
  );
}
