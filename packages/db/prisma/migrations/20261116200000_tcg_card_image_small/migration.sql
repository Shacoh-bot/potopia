-- Version réduite des illustrations de carte (normale et full art), pour les petites cartes.
-- Ajout seul : colonnes facultatives, aucune donnée existante modifiée ; les cartes déjà illustrées
-- n'ont pas de version réduite et s'affichent comme avant.
ALTER TABLE "tcg"."cards" ADD COLUMN "image_key_small" TEXT;
ALTER TABLE "tcg"."cards" ADD COLUMN "image_key_full_small" TEXT;
