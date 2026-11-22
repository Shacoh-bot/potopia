-- Points lumineux réglés à part pour la full art. Ajout seul : rien n'est modifié ni supprimé.
-- Chaque carte part avec une copie de ses points actuels (ceux de la normale), puis les deux
-- versions sont indépendantes.
ALTER TABLE "tcg"."cards" ADD COLUMN "glow_points_full" JSONB;

UPDATE "tcg"."cards" SET "glow_points_full" = "glow_points" WHERE "glow_points" IS NOT NULL;
