-- Cartes en deux versions : normale et full art, chacune active ou non, avec son illustration.
-- MODIFIE DES DONNÉES EXISTANTES PAR CALCUL :
--   * chaque carte n'a d'active que la version de sa mise en page actuelle (`layout`) ;
--   * chaque carte possédée est comptée dans cette même version.
-- Aucune illustration n'est déplacée : la full art reprend `image_key` tant qu'elle n'a pas la sienne.
ALTER TABLE "tcg"."cards"
  ADD COLUMN "image_key_full" TEXT,
  ADD COLUMN "has_normal" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "has_full_art" BOOLEAN NOT NULL DEFAULT false;

UPDATE "tcg"."cards"
SET "has_normal" = ("layout" = 'normal'),
    "has_full_art" = ("layout" = 'fullart');

ALTER TABLE "tcg"."owned_cards"
  ADD COLUMN "version" "tcg"."TcgCardLayout" NOT NULL DEFAULT 'normal';

UPDATE "tcg"."owned_cards" AS o
SET "version" = c."layout"
FROM "tcg"."cards" AS c
WHERE c."id" = o."card_id";

ALTER TABLE "tcg"."owned_cards" DROP CONSTRAINT "owned_cards_pkey";
ALTER TABLE "tcg"."owned_cards" ADD CONSTRAINT "owned_cards_pkey" PRIMARY KEY ("user_id", "card_id", "version");
