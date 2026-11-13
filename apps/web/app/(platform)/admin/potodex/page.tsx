import { getPotodex, listSets } from "@app/tcg";
import { CARD_HEIGHT, CARD_WIDTH, GameCard, GameCardDefs } from "@app/tcg/ui";
import { buttonClasses, Card, cx, EmptyState } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../cartes/fonts";
import { cardImageUrls } from "../cartes/images";
import { PotodexCard } from "./PotodexCard";
import { ResetCollectionButton } from "./ResetCollectionButton";
import { Scaled } from "./Scaled";

export const metadata: Metadata = { title: "Potodex" };

/** Largeur d'une case (px) ; la carte (`CARD_WIDTH` à l'échelle 1) y est réduite. */
const SLOT = 180;

/**
 * Potodex de l'admin connecté (test) : toutes les cartes du set, dans l'ordre. Une carte trouvée
 * s'affiche avec son nombre d'exemplaires ; une carte pas encore tirée reste noire, avec seulement
 * son numéro (le serveur n'envoie rien d'autre). Une carte trouvée s'ouvre en grand au clic.
 */
export default async function AdminPotodexPage({
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
      <Card title="Potodex">
        <EmptyState title="Aucun set" description="Crée un set et range-y des cartes d'abord." />
      </Card>
    );
  }
  const dex = await getPotodex(admin, { setCode: current.code });
  const found = dex.entries.flatMap((e) => (e.found ? [e.card] : []));
  const images = await cardImageUrls(admin, found);
  const pad = (n: number) => String(n).padStart(2, "0");
  const percent = dex.total ? Math.round((dex.found / dex.total) * 100) : 0;

  return (
    <Card
      title={`Potodex · ${current.code} (test)`}
      action={
        <Link
          href={`/admin/boosters?set=${current.code}`}
          className={buttonClasses({ variant: "ghost", size: "sm" })}
        >
          Ouvrir des paquets
        </Link>
      }
    >
      <div className={`${designFonts} flex flex-col gap-4`}>
        {sets.length > 1 && (
          <nav className="flex flex-wrap gap-2" aria-label="Sets">
            {sets.map((s) => (
              <Link
                key={s.id}
                href={`/admin/potodex?set=${s.code}`}
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-60 flex-1 flex-col gap-1">
            <p className="text-sm">
              <span className="text-text text-lg font-semibold tabular-nums">
                {dex.found}/{dex.total}
              </span>{" "}
              <span className="text-muted">
                cartes trouvées · {dex.boosters} paquet{dex.boosters > 1 ? "s" : ""} ouvert
                {dex.boosters > 1 ? "s" : ""}
              </span>
            </p>
            <div className="bg-surface h-2 overflow-hidden rounded-full" aria-hidden>
              <div className="bg-accent h-full rounded-full" style={{ width: `${percent}%` }} />
            </div>
          </div>
          <ResetCollectionButton disabled={dex.boosters === 0 && dex.found === 0} />
        </div>

        {dex.total === 0 ? (
          <EmptyState title="Set vide" description="Ce set n'a encore aucune carte numérotée." />
        ) : (
          <>
            <GameCardDefs />
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] justify-items-center gap-4">
              {dex.entries.map((entry) => (
                <li
                  key={entry.number}
                  className="flex flex-col items-center gap-1"
                  style={{ contentVisibility: "auto", containIntrinsicSize: "auto 280px" }}
                >
                  {entry.found ? (
                    <PotodexCard
                      card={entry.card}
                      imageUrl={images.get(entry.card.id) ?? null}
                      setSize={dex.total}
                      fontClass={designFonts}
                    >
                      <Scaled scale={SLOT / CARD_WIDTH}>
                        <GameCard
                          card={entry.card}
                          imageUrl={images.get(entry.card.id) ?? null}
                          setSize={dex.total}
                          still
                        />
                      </Scaled>
                    </PotodexCard>
                  ) : (
                    <div
                      className="grid place-items-center rounded-[12px] border border-white/10 bg-black shadow-inner"
                      style={{ width: SLOT, aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}` }}
                      aria-label={`Carte ${pad(entry.number)} : pas encore trouvée`}
                    >
                      <span className="font-display text-2xl text-white/25">?</span>
                    </div>
                  )}
                  <span className="text-muted text-xs tabular-nums">
                    {pad(entry.number)}
                    {entry.found && entry.count > 1 ? ` · ×${entry.count}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
