-- Boosters et Potodex (test admin) : cartes trouvées par joueur et journal des paquets ouverts.
-- Ajout seul.

-- CreateTable
CREATE TABLE "tcg"."owned_cards" (
    "user_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "first_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owned_cards_pkey" PRIMARY KEY ("user_id","card_id")
);

-- CreateTable
CREATE TABLE "tcg"."booster_openings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "set_id" TEXT NOT NULL,
    "card_ids" TEXT[],
    "has_ssr" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booster_openings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owned_cards_card_id_idx" ON "tcg"."owned_cards"("card_id");

-- CreateIndex
CREATE INDEX "booster_openings_user_id_set_id_created_at_idx" ON "tcg"."booster_openings"("user_id", "set_id", "created_at");

-- AddForeignKey
ALTER TABLE "tcg"."owned_cards" ADD CONSTRAINT "owned_cards_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "tcg"."cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tcg"."booster_openings" ADD CONSTRAINT "booster_openings_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "tcg"."sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
