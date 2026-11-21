-- Carte dont une carte du « Doublon » est le doublon, choisie dans une liste (plus de texte libre).
-- Ajout d'une colonne (null par défaut) ; aucune colonne existante n'est modifiée.
ALTER TABLE "tcg"."cards" ADD COLUMN "duplicate_of_id" TEXT;

ALTER TABLE "tcg"."cards" ADD CONSTRAINT "cards_duplicate_of_id_fkey"
  FOREIGN KEY ("duplicate_of_id") REFERENCES "tcg"."cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Doublons déjà marqués en texte libre (« Doublon — gardée : X », « Doublon de X »…) : la
-- nouvelle colonne est remplie quand le reste de la note est exactement le nom (majuscules,
-- guillemets et espaces autour mis à part) d'une seule autre carte hors corbeille. Les autres
-- restent sans lien, « à relier » dans l'onglet Doublon de l'admin.
WITH marked AS (
  SELECT "id",
         lower(btrim(
           regexp_replace(
             regexp_replace("admin_note", '^\s*doublon\s*([—–:-]\s*)?', '', 'i'),
             '^(gardée|gardee|garde|de|d''|avec)\s*:?\s*', '', 'i'),
           ' «»"''“”')) AS "wanted"
  FROM "tcg"."cards"
  WHERE "deleted_at" IS NOT NULL
    AND "admin_note" ~* '^\s*doublon([^[:alnum:]]|$)'
),
matches AS (
  SELECT m."id", min(c."id") AS "of_id", count(*) AS "n"
  FROM marked m
  JOIN "tcg"."cards" c
    ON lower(btrim(c."name")) = m."wanted" AND c."id" <> m."id" AND c."deleted_at" IS NULL
  WHERE m."wanted" <> ''
  GROUP BY m."id"
)
UPDATE "tcg"."cards" t
SET "duplicate_of_id" = matches."of_id"
FROM matches
WHERE t."id" = matches."id" AND matches."n" = 1;
