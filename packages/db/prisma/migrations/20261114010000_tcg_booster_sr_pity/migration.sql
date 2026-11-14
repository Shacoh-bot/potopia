-- Garantie « SR ou mieux » des boosters : chaque paquet note s'il avait une SR ou une SSR.
-- Ajout d'une colonne (défaut false), puis valeur calculée pour les paquets déjà ouverts (une SSR,
-- ou une carte du paquet de rareté SR ou SSR). Rien d'autre n'est modifié.
ALTER TABLE "tcg"."booster_openings" ADD COLUMN "has_sr_plus" BOOLEAN NOT NULL DEFAULT false;

UPDATE "tcg"."booster_openings" AS o
SET "has_sr_plus" = true
WHERE o."has_ssr"
   OR EXISTS (
     SELECT 1 FROM "tcg"."cards" AS c
     WHERE c."id" = ANY (o."card_ids") AND c."rarity" IN ('sr', 'ssr')
   );
