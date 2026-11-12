-- Retire du catalogue l'effet visuel « Holo classique » (doublon du reflet holographique `holo`).
-- Modifie des données en place : les cartes qui le portaient le perdent
-- ("tcg"."card_visual_effects", ON DELETE CASCADE). Les autres effets de ces cartes restent, dans
-- le même ordre.
DELETE FROM "tcg"."visual_effects" WHERE "key" = 'holoclassique';
