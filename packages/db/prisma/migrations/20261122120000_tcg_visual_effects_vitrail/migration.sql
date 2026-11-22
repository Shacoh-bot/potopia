-- Remet au catalogue l'effet visuel `vitrail`, sous un nouveau rendu : la lumière qui traverse une
-- illustration déjà en vitrail (l'ancien, retiré le 2026-11-12, redessinait l'image en vitrail).
-- Ajout seul.
INSERT INTO "tcg"."visual_effects" ("key", "name") VALUES
  ('vitrail', 'Lumière de vitrail');
