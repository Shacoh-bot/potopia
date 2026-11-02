# Pose JoJo — prends la pose

_Yare yare daze._

Une pose célèbre de JoJo s'affiche (rendus officiels des jeux, surtout All Star Battle) : il faut
mettre un pantin articulé dans la même position. Partie de **5 poses** tirées au hasard parmi 16.

Jeu intégré au portail : page `/pose`, tuile « Pose JoJo » dans le registre des apps. Première
version sans base de données : rien n'est enregistré (pas de classement ni de récompense).

## Le pantin

- 10 segments rigides (`src/skeleton.ts`) : tronc, tête, bras et avant-bras, cuisses et jambes. Le
  bassin est fixe ; le tronc et les cuisses en partent, la tête et les bras partent du tronc.
- Chaque segment a un angle relatif à son parent (0° = vers le haut, sens horaire). Faire pivoter
  un segment emporte ses enfants (tourner le tronc emporte la tête et les bras).
- On le manipule à la souris ou au doigt (`ui/Puppet.tsx`) :
  - **mains et pieds** (poignées claires) : ils suivent le pointeur et le bras ou la jambe se plie
    tout seul (cinématique inverse à deux os ; le coude ou le genou garde son sens de pli, vers
    l'extérieur au départ) ;
  - **coudes, genoux, haut du tronc, tête** (poignées violettes), ou **le membre lui-même** (le
    trait jaune) : le segment pivote autour de son articulation ;
  - au clic, c'est la poignée la plus proche du pointeur qui est prise (rayon de 10), sinon le
    membre sous le pointeur, selon son épaisseur réelle : jamais le voisin dessiné par-dessus.
- Le pantin reste exactement là où on le lâche (pas d'oscillation : elle dédoublait l'image).
- Musique : « Jojo Pose » d'Apollo Fresh (`apps/web/public/audio/jojo-pose.mp3`), en boucle
  pendant la partie, au volume du site ; lancée par le clic sur « Commencer ». Un bouton la coupe
  ou la remet (sur l'écran d'accueil du jeu, à côté du pantin et sur le résultat) ; le choix est
  gardé sur l'appareil (`localStorage`, clé `potopia:pose-music-off`).

## Le score

`scorePose` (`src/score.ts`) compare l'**angle de chaque articulation**, tel qu'on le voit sur
l'image, chacun par rapport à son parent : l'inclinaison du tronc, la tête, les épaules (le bras
par rapport au tronc), les coudes, les hanches et les genoux. C'est donc relatif : un tronc mal
penché ne coûte que ses points, pas ceux des bras.

- **Le pantin debout vaut 0 %** : une articulation que la pose demande de changer (plus de 25°
  d'écart avec la pose debout) est notée sur le chemin parcouru depuis la pose debout jusqu'à la
  cible, pleine à moins de 15° ; leur moyenne pondérée fait le score (tronc 1,5, tête 0,5, les
  autres 1).
- Une articulation qui n'a pas à changer ne rapporte rien, mais la plier à tort retire jusqu'à
  40 % (rien jusqu'à 15° d'écart, tout au-delà de 60°). Une pose qui serait simplement debout vaut
  donc 100 % sans rien toucher.
- La pose en **miroir** compte aussi (gauche et droite échangées) : on garde la meilleure.
- Note façon fiche de Stand : A (90 % et plus), B (75), C (60), D (40), E.

Après la validation, la pose attendue s'affiche en fantôme (pointillés blancs) sur le pantin,
toujours dans le sens de l'image (même si le joueur l'a faite en miroir).

## Les poses

`src/poses.ts` : personnage, nom de la pose, image (`apps/web/public/pose/<id>.webp`, détourée,
640 px de haut) et angles du squelette. Ils ont été calés en pointant les articulations sur
chaque image (épaules, coudes, poignets, hanches, genoux, chevilles), puis vérifiés une à une en
superposant le squelette à l'image agrandie.

Pour ajouter ou corriger une pose : l'**éditeur** `/pose?editeur` (en local seulement, jamais en
production) met l'image derrière le pantin, avec des curseurs pour la caler (position, échelle,
opacité) ; on pose le pantin dessus et on recopie les angles affichés dans `poses.ts`.

## Tests

`test/score.test.ts` : angles, cinématique, angle relatif retrouvé, score (identique, miroir,
pose debout à 0 %, sauf pour une pose debout, tolérance, relatif, articulation pliée à tort),
notes, validité des poses (chacune atteignable à 100 %).
Logique pure, sans base de données.
