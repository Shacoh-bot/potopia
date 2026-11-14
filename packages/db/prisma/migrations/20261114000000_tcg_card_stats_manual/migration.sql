-- « Stats manuelles » d'une carte : cochée, son coût et sa puissance ne suivent plus la carte Snap
-- de son effet. Ajout seul : colonne avec valeur par défaut (false), aucune donnée existante
-- modifiée (les stats des cartes restent telles quelles jusqu'à leur prochain enregistrement).
ALTER TABLE "tcg"."cards" ADD COLUMN "stats_manual" BOOLEAN NOT NULL DEFAULT false;
