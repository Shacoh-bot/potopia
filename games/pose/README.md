# Pose JoJo — prends la pose

_Yare yare daze._

Une pose célèbre de JoJo s'affiche (rendus officiels des jeux JoJo) : il faut mettre un pantin
articulé dans la même position. **Trois poses par jour**, les mêmes pour tout le monde.

Jeu intégré au portail : page `/pose`, tuile « Pose JoJo » dans le registre des apps. Première
version sans base de données : pas encore de classement ni de récompense ; la partie du jour est
gardée sur l'appareil.

## La partie du jour

- `src/daily.ts` : le jour se compte à l'heure de Paris (`BRAND.timeZone`, changement à minuit).
  Toutes les poses sont rangées une fois pour toutes dans un ordre mélangé fixe (graine
  constante) ; chaque jour prend les trois suivantes, si bien qu'une pose ne revient qu'après que
  toutes les autres sont passées. Ajouter des poses change l'ordre à partir de ce jour-là.
- Une fois les trois poses faites, le résultat du jour (moyenne, note, détail) reste affiché
  jusqu'au lendemain, avec le temps restant avant les poses suivantes. Il est gardé dans le
  `localStorage` (clé `potopia:pose-day:<AAAA-MM-JJ>`) ; une vraie limite par membre viendra avec
  la base. En local, un bouton permet de rejouer la partie du jour (`allowReplay`).
- Répliques (`src/verdicts.ts`) : de 9 à 12 par note, tirées au hasard, références des parties 1
  à 6 seulement ; celle du résultat du jour ne dépend que du total (elle ne change pas d'une
  visite à l'autre).

## Les bonus JoJo

`ui/PoseFx.tsx`, par-dessus la carte du pantin : ils ne bloquent jamais le jeu (aucun clic
intercepté, aucun voile, ils repartent seuls), avec les vrais sprites et voix du thème JoJo
(`apps/web/public/jojo`, `apps/web/public/audio/jojo-*.mp3`).

- En posant, des « ゴゴ » animés apparaissent autour du pantin quand on approche de la pose (à
  50, 70 et 85 % de ressemblance), le troisième avec le son du Menacing : une indication « chaud
  ou froid », sans chiffre.
- À la validation, selon la note : Star Platinum qui frappe vers le pantin en ORA ORA (A), The
  World en MUDA MUDA (B), une rafale de ゴゴゴ (C), « Yare yare daze » (D).
- En fin de partie : « Yare yare daze » pour une note finale A, l'arrêt sur image To Be
  Continued pour un E (désactivable dans Paramètres, comme partout sur le site).

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

- Une articulation que la pose demande de changer (plus de 25° d'écart avec la pose debout)
  est notée sur le chemin parcouru depuis la pose debout jusqu'à la cible, pleine à moins de
  15° ; ces articulations font les trois quarts de la note (tronc 1,5, tête 0,5, les autres 1).
- Celles qui n'ont pas à changer, déjà justes debout, font le dernier quart, tant qu'on ne les
  plie pas à tort (rien perdu jusqu'à 15° d'écart, tout au-delà de 60°, et jusqu'à 40 % de la
  part des articulations à changer en plus). Le pantin qu'on ne touche pas fait donc au plus
  25 % (note E) ; une pose qui serait simplement debout vaudrait 100 % sans rien toucher.
- La pose en **miroir** compte aussi (gauche et droite échangées) : on garde la meilleure.
- Note façon fiche de Stand : A (90 % et plus), B (75), C (60), D (40), E.

Après la validation, la pose attendue s'affiche en fantôme (pointillés blancs) sur le pantin,
toujours dans le sens de l'image (même si le joueur l'a faite en miroir).

## Les poses

`src/poses.ts` : 59 poses, des parties 1 à 6 (rendus officiels détourés d'All Star Battle,
All Star Battle R, Eyes of Heaven, Last Survivor et OraDora, et visuels officiels de l'anime, pris sur jojowiki.com) : personnage, nom de
la pose, image (`apps/web/public/pose/<id>.webp`, 640 px de haut) et angles du squelette. Les
angles ont été calés en pointant les articulations sur chaque image (épaules, coudes, poignets,
hanches, genoux, chevilles), puis vérifiés un à un en superposant le squelette à l'image
agrandie.

Règles de choix d'une pose : rien de Steel Ball Run (en cours de diffusion) ni des parties
suivantes, sauf Gyro dans sa tenue des premiers épisodes, sans Stand ; un seul personnage, en
pied ; chaque membre lisible à plat (pas de
bras ni de jambe pointé droit vers l'écran, ni caché derrière le corps) ; au moins une
articulation à changer par rapport à la pose debout (sinon il n'y a rien à jouer).

Pour ajouter ou corriger une pose : l'**éditeur** `/pose?editeur` (en local seulement, jamais en
production) met l'image derrière le pantin, avec des curseurs pour la caler (position, échelle,
opacité) ; on pose le pantin dessus et on recopie les angles affichés dans `poses.ts`.

## Tests

`test/score.test.ts` : angles, cinématique, angle relatif retrouvé, score (identique, miroir,
pose debout à 25 % au plus, sauf pour une pose debout, tolérance, relatif, articulation pliée à tort),
notes, validité des poses (chacune atteignable à 100 %).
Logique pure, sans base de données.
