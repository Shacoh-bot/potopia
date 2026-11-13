-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "douze";

-- CreateTable
CREATE TABLE "douze"."rounds" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rounds_date_idx" ON "douze"."rounds"("date");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_user_id_date_slot_key" ON "douze"."rounds"("user_id", "date", "slot");
