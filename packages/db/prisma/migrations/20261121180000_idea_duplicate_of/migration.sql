-- Idée marquée « Doublon de… » par un admin : l'idée d'origine. Ajout seul, aucune donnée modifiée.
ALTER TABLE "ideas"."ideas" ADD COLUMN "duplicate_of_id" TEXT;

ALTER TABLE "ideas"."ideas" ADD CONSTRAINT "ideas_duplicate_of_id_fkey"
  FOREIGN KEY ("duplicate_of_id") REFERENCES "ideas"."ideas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ideas_duplicate_of_id_idx" ON "ideas"."ideas"("duplicate_of_id");
