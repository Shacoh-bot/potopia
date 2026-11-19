-- Étape de préparation d'une carte de la réserve (illustration, puis effet, puis intégration dans
-- son set) : repère d'admin, sans effet en jeu.
-- Ajout seul : nouvelle colonne avec une valeur par défaut, aucune donnée existante modifiée.
ALTER TABLE "tcg"."cards" ADD COLUMN "prep_stage" TEXT NOT NULL DEFAULT 'illustration';
