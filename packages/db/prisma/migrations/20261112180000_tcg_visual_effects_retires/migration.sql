-- Retire du catalogue cinq effets visuels : croquis, onde de choc, pop art, torches et vitrail.
-- Modifie des données en place : les cartes qui portaient ces effets les perdent
-- ("tcg"."card_visual_effects", ON DELETE CASCADE). Les autres effets de ces cartes restent, dans
-- le même ordre.
DELETE FROM "tcg"."visual_effects" WHERE "key" IN ('croquis', 'onde', 'popart', 'torches', 'vitrail');
