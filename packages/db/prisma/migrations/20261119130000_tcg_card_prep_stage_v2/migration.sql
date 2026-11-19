-- Étapes de préparation, version 2 : « À traiter », « Illustration ok », « Description et effet ok »,
-- « À intégrer à un set ». Une nouvelle carte arrive « À traiter ».
--
-- MODIFIE DES DONNÉES EXISTANTES, colonne "prep_stage" seulement (ni image, ni set, ni numéro), une
-- seule fois, à la demande de l'utilisateur (19/11/2026) :
--   - toutes les cartes du set S1 (corbeille comprise)      -> 'illustrated' (Illustration ok) ;
--   - ancienne étape 'illustration' (hors S1)                -> 'todo'        (À traiter) ;
--   - ancienne étape 'effect' (illustration faite, hors S1)  -> 'illustrated' (Illustration ok) ;
--   - ancienne étape 'integration' (hors S1)                 -> 'integration' (À intégrer à un set) ;
--   - toute autre valeur (aucune attendue)                   -> 'todo'.
ALTER TABLE "tcg"."cards" ALTER COLUMN "prep_stage" SET DEFAULT 'todo';

UPDATE "tcg"."cards" AS c
SET "prep_stage" = CASE
  WHEN c."set_id" IN (SELECT s."id" FROM "tcg"."sets" AS s WHERE s."code" = 'S1') THEN 'illustrated'
  WHEN c."prep_stage" = 'effect' THEN 'illustrated'
  WHEN c."prep_stage" = 'integration' THEN 'integration'
  ELSE 'todo'
END;
