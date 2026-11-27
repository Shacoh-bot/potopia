-- Sons de victoire (retournement d'une SR ou d'une SSR) et sons découverts par joueur. Ajout seul :
-- deux tables neuves, aucune donnée existante touchée.
CREATE TABLE "tcg"."victory_sounds" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sound_key" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "victory_sounds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tcg"."heard_victory_sounds" (
    "user_id" TEXT NOT NULL,
    "sound_id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "first_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "heard_victory_sounds_pkey" PRIMARY KEY ("user_id","sound_id")
);

CREATE INDEX "heard_victory_sounds_sound_id_idx" ON "tcg"."heard_victory_sounds"("sound_id");

ALTER TABLE "tcg"."heard_victory_sounds" ADD CONSTRAINT "heard_victory_sounds_sound_id_fkey" FOREIGN KEY ("sound_id") REFERENCES "tcg"."victory_sounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
