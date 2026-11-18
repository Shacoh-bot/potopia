import { CARD_VERSION_LABELS, getCompletePotodex, getPotodex, listSets } from "@app/tcg";
import { CARD_HEIGHT, CARD_WIDTH, GameCard, GameCardDefs } from "@app/tcg/ui";
import { buttonClasses, Card, cx, EmptyState } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../cartes/fonts";
import { Pagination } from "../cartes/Pagination";
import { cardFaces, imageId } from "../cartes/images";
import { paginate } from "./paginate";
import { PotodexCard } from "./PotodexCard";
import { ResetCollectionButton } from "./ResetCollectionButton";
import { Scaled } from "./Scaled";

export const metadata: Metadata = { title: "Potodex" };

/** Largeur d'une case (px) ; la carte (`CARD_WIDTH` à l'échelle 1) y est réduite. */
const SLOT = 220;
/**
 * Cases par page : au-delà, la planche devient lourde (cartes, effets, illustrations signées). Seules
 * les illustrations de la page affichée sont demandées au stockage.
 */
const PAGE_SIZE = 24;

/**
 * Potodex de l'admin connecté (test) : toutes les cartes du set, dans l'ordre, chaque version à part
 * (la normale, puis l'Alt Art, « AA »). Une version trouvée s'affiche avec son nombre
 * d'exemplaires ; une version pas encore tirée reste noire, avec seulement son numéro et, pour
 * l'Alt Art, la mention AA (le serveur n'envoie rien d'autre). Une carte trouvée s'ouvre en grand au clic.
 * Paginé (`?page=`), `PAGE_SIZE` cases par page.
 *
 * `?complet=1` : aperçu « tout débloqué » (lien « Potodex complet » de l'admin), le même Potodex
 * comme si chaque version était trouvée. Lecture seule (`getCompletePotodex`) : la vraie collection
 * n'est ni lue ni modifiée ; pas de remise à zéro. Admin seulement, comme toute la page.
 */
export default async function AdminPotodexPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; page?: string; complet?: string }>;
}) {
  const admin = await getCurrentAdmin();
  const sets = await listSets(admin);
  const { set: code, page: pageParam, complet } = await searchParams;
  const complete = complet === "1";
  const current = sets.find((s) => s.code === code) ?? sets[0];
  if (!current) {
    return (
      <Card title="Potodex">
        <EmptyState title="Aucun set" description="Crée un set et range-y des cartes d'abord." />
      </Card>
    );
  }
  const dex = complete
    ? await getCompletePotodex(admin, { setCode: current.code })
    : await getPotodex(admin, { setCode: current.code });
  // le mode (vrai Potodex ou aperçu complet) suit les liens des sets et des pages
  const mode = complete ? "&complet=1" : "";
  const { page, pageCount, shown } = paginate(dex.entries, pageParam, PAGE_SIZE);
  const found = shown.flatMap((e) => (e.found ? [e.card] : []));
  // mêmes données que le menu « Cartes » : image, « idée de … », taille du set
  const faces = new Map((await cardFaces(admin, found)).map((f) => [imageId(f.card), f]));
  const pageHref = (p: number) =>
    `/admin/potodex?set=${current.code}${mode}${p > 1 ? `&page=${p}` : ""}`;
  const pager = <Pagination page={page} count={pageCount} href={pageHref} />;
  const pad = (n: number) => String(n).padStart(2, "0");
  const percent = dex.total ? Math.round((dex.found / dex.total) * 100) : 0;

  return (
    <Card
      title={`Potodex · ${current.code} ${complete ? "(complet)" : "(test)"}`}
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
        {complete && (
          <p
            role="status"
            className="border-accent/40 bg-accent/10 text-accent rounded-lg border px-3 py-2 text-sm"
          >
            Aperçu admin : tout débloqué. Ta vraie collection n&apos;est pas touchée ·{" "}
            <Link href={`/admin/potodex?set=${current.code}`} className="underline">
              revenir à mon Potodex
            </Link>
          </p>
        )}
        {sets.length > 1 && (
          <nav className="flex flex-wrap gap-2" aria-label="Sets">
            {sets.map((s) => (
              <Link
                key={s.id}
                href={`/admin/potodex?set=${s.code}${mode}`}
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
                versions trouvées (Alt Art comprises) · {dex.boosters} paquet
                {dex.boosters > 1 ? "s" : ""} ouvert
                {dex.boosters > 1 ? "s" : ""}
              </span>
            </p>
            <div className="bg-surface h-2 overflow-hidden rounded-full" aria-hidden>
              <div className="bg-accent h-full rounded-full" style={{ width: `${percent}%` }} />
            </div>
          </div>
          {!complete && <ResetCollectionButton disabled={dex.boosters === 0 && dex.found === 0} />}
        </div>

        {dex.total === 0 ? (
          <EmptyState title="Set vide" description="Ce set n'a encore aucune carte numérotée." />
        ) : (
          <>
            <GameCardDefs />
            {pageCount > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-muted text-sm tabular-nums">
                  Cartes {pad(shown[0]?.number ?? 0)} à {pad(shown.at(-1)?.number ?? 0)} sur{" "}
                  {dex.total}
                </span>
                {pager}
              </div>
            )}
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] justify-items-center gap-5">
              {shown.map((entry) => (
                <li
                  key={`${entry.number}:${entry.version}`}
                  className="flex flex-col items-center gap-1"
                  style={{ contentVisibility: "auto", containIntrinsicSize: "auto 330px" }}
                >
                  {entry.found ? (
                    <PotodexCard
                      card={faces.get(imageId(entry.card))?.card ?? entry.card}
                      imageUrl={faces.get(imageId(entry.card))?.imageUrl ?? null}
                      setSize={faces.get(imageId(entry.card))?.setSize ?? dex.size}
                      fontClass={designFonts}
                    >
                      <Scaled scale={SLOT / CARD_WIDTH}>
                        <GameCard
                          card={faces.get(imageId(entry.card))?.card ?? entry.card}
                          imageUrl={faces.get(imageId(entry.card))?.imageUrl ?? null}
                          setSize={faces.get(imageId(entry.card))?.setSize ?? dex.size}
                          still
                        />
                      </Scaled>
                    </PotodexCard>
                  ) : (
                    <div
                      className="grid place-items-center rounded-[12px] border border-white/10 bg-black shadow-inner"
                      style={{ width: SLOT, aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}` }}
                      aria-label={`Carte ${pad(entry.number)}${entry.altArt ? " en Alt Art" : ""} : pas encore trouvée`}
                    >
                      <span className="flex flex-col items-center gap-1">
                        <span className="font-display text-2xl text-white/25">?</span>
                        {entry.altArt && (
                          <span className="rounded border border-amber-300/40 px-1.5 text-xs font-bold tracking-wider text-amber-200/60">
                            AA
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  <span className="text-muted text-xs tabular-nums">
                    {pad(entry.number)}
                    {entry.altArt && (
                      <span
                        title={CARD_VERSION_LABELS.fullart}
                        className="font-semibold text-amber-300"
                      >
                        {" "}
                        AA
                      </span>
                    )}
                    {entry.found && entry.count > 1 ? ` · ×${entry.count}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {pageCount > 1 && <div className="flex justify-center">{pager}</div>}
          </>
        )}
      </div>
    </Card>
  );
}
