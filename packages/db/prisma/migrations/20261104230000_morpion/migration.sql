CREATE SCHEMA IF NOT EXISTS "morpion";
CREATE TYPE "morpion"."MorpionStatus" AS ENUM ('WAITING', 'PLAYING', 'WON', 'DRAW', 'ABANDONED');
CREATE TABLE "morpion"."games" (
  "id" TEXT NOT NULL,
  "user_a" TEXT NOT NULL,
  "user_b" TEXT NOT NULL,
  "theme" TEXT NOT NULL,
  "board" TEXT NOT NULL DEFAULT '.........',
  "status" "morpion"."MorpionStatus" NOT NULL DEFAULT 'WAITING',
  "turn" INTEGER NOT NULL DEFAULT 0,
  "winner" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 0,
  "active_pair" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "games_active_pair_key" ON "morpion"."games"("active_pair");
CREATE INDEX "games_user_a_updated_at_idx" ON "morpion"."games"("user_a", "updated_at");
CREATE INDEX "games_user_b_updated_at_idx" ON "morpion"."games"("user_b", "updated_at");
