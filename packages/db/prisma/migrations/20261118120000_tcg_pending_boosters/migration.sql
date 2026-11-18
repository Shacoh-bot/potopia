-- Prochain paquet déjà tiré de chaque joueur (par set et type de paquet), pour précharger ses
-- illustrations avant le clic. Ajout seul : nouvelle table, aucune donnée existante modifiée.
CREATE TABLE "tcg"."pending_boosters" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "set_id" TEXT NOT NULL,
    "is_test" BOOLEAN NOT NULL,
    "cards" JSONB NOT NULL,
    "pool_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_boosters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pending_boosters_user_id_set_id_is_test_key" ON "tcg"."pending_boosters"("user_id", "set_id", "is_test");

ALTER TABLE "tcg"."pending_boosters" ADD CONSTRAINT "pending_boosters_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "tcg"."sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
