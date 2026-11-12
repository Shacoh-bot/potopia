-- Effets visuels de fumée, verte et blanche (rendu dans games/tcg/ui/visual-effects.tsx, styles
-- `tcg-vfx-smoke` et `tcg-vfx-puff` de tcg.css). Ajout seul.
INSERT INTO "tcg"."visual_effects" ("key", "name") VALUES
  ('fumeeverte', 'Fumée verte'),
  ('fumeeblanche', 'Fumée blanche');
