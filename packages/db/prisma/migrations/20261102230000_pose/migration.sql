-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "pose";

-- CreateTable
CREATE TABLE "pose"."rounds" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "pose_id" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,
    "mirrored" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rounds_date_idx" ON "pose"."rounds"("date");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_user_id_date_slot_key" ON "pose"."rounds"("user_id", "date", "slot");
