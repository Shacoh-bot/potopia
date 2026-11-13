import { getPotodex, listSets } from "@app/tcg";
import { buttonClasses, Card, cx, EmptyState } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../cartes/fonts";
import { BoosterOpener } from "./BoosterOpener";

export const metadata: Metadata = { title: "Boosters" };

/**
 * Ouverture de boosters, en test (admins seulement, paquets gratuits et illimités) : 5 cartes du
 * set choisi, ajoutées à la collection de l'admin (son Potodex).
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
  const dex = await getPotodex(admin, { setCode: current.code });

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
        <p className="text-muted text-sm">
          Un paquet du set {current.code} : 3 cartes de base, 1 peu commune ou mieux et 1 carte
          chance (rare ou mieux, SSR garantie au plus tard au 30e paquet). Les cartes tirées vont
          dans ton Potodex : {dex.found}/{dex.total} trouvées, {dex.boosters} paquet
          {dex.boosters > 1 ? "s" : ""} ouvert{dex.boosters > 1 ? "s" : ""}.
        </p>
        {dex.total === 0 ? (
          <EmptyState title="Set vide" description="Ce set n'a encore aucune carte numérotée." />
        ) : (
          <BoosterOpener setCode={current.code} fonts={designFonts} />
        )}
      </div>
    </Card>
  );
}
