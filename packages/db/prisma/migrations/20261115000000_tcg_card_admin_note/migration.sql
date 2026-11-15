-- Note de l'admin sur une carte (« Doublon de … ») : jamais montrée aux joueurs, sans effet en jeu.
-- Ajout seul : colonne facultative, aucune donnée existante modifiée.
ALTER TABLE "tcg"."cards" ADD COLUMN "admin_note" TEXT;
