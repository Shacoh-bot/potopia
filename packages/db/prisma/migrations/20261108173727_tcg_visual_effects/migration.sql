-- CreateTable
CREATE TABLE "tcg"."visual_effects" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visual_effects_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "tcg"."card_visual_effects" (
    "card_id" TEXT NOT NULL,
    "effect_key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "card_visual_effects_pkey" PRIMARY KEY ("card_id","effect_key")
);

-- CreateIndex
CREATE INDEX "card_visual_effects_effect_key_idx" ON "tcg"."card_visual_effects"("effect_key");

-- AddForeignKey
ALTER TABLE "tcg"."card_visual_effects" ADD CONSTRAINT "card_visual_effects_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "tcg"."cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tcg"."card_visual_effects" ADD CONSTRAINT "card_visual_effects_effect_key_fkey" FOREIGN KEY ("effect_key") REFERENCES "tcg"."visual_effects"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- Premiers effets visuels du catalogue (rendu codé dans games/tcg/ui/visual-effects.tsx).
INSERT INTO "tcg"."visual_effects" ("key", "name") VALUES
  ('holo', 'Reflet holographique'),
  ('eclair', 'Éclair');
