-- Son propre d'une carte, joué à son retournement dans un booster (normale et full art). Ajout seul :
-- deux colonnes vides, aucune donnée existante touchée.
ALTER TABLE "tcg"."cards" ADD COLUMN "reveal_sound_key" TEXT,
ADD COLUMN "reveal_sound_key_full" TEXT;
