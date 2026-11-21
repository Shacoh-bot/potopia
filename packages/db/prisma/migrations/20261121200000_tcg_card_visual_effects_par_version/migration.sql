-- Effets visuels réglés à part pour chaque version de carte (normale, full art).
-- Ajout + recopie : chaque effet posé jusqu'ici reste sur la normale et reçoit une copie sur la
-- full art (même ordre des calques). Rien n'est retiré.
ALTER TABLE "tcg"."card_visual_effects"
  ADD COLUMN "version" "tcg"."TcgCardLayout" NOT NULL DEFAULT 'normal';

ALTER TABLE "tcg"."card_visual_effects" DROP CONSTRAINT "card_visual_effects_pkey";
ALTER TABLE "tcg"."card_visual_effects"
  ADD CONSTRAINT "card_visual_effects_pkey" PRIMARY KEY ("card_id", "version", "effect_key");

INSERT INTO "tcg"."card_visual_effects" ("card_id", "version", "effect_key", "position")
SELECT "card_id", 'fullart', "effect_key", "position"
FROM "tcg"."card_visual_effects"
WHERE "version" = 'normal';
