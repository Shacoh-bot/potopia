-- AlterTable
ALTER TABLE "tcg"."cards" ADD COLUMN     "visual_effect_key" TEXT;

-- CreateTable
CREATE TABLE "tcg"."visual_effects" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visual_effects_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "tcg"."cards" ADD CONSTRAINT "cards_visual_effect_key_fkey" FOREIGN KEY ("visual_effect_key") REFERENCES "tcg"."visual_effects"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- Premiers effets visuels du catalogue (rendu codé dans games/tcg/ui/visual-effects.tsx).
INSERT INTO "tcg"."visual_effects" ("key", "name") VALUES
  ('holo', 'Reflet holographique'),
  ('etincelles', 'Étincelles');
