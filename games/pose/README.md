# Pose JoJo — prends la pose

_Yare yare daze._

Une pose célèbre de JoJo s'affiche (rendus officiels des jeux JoJo) : il faut mettre un pantin
articulé dans la même position. **Trois poses par jour**, les mêmes pour tout le monde.

Jeu intégré au portail : page `/pose`, routes `/api/pose/*`, tuile « Pose JoJo » dans le registre
des apps. Pas encore de récompense en monnaie.

## La partie du jour

- `src/daily.ts` : le jour se compte à l'heure de Paris (`BRAND.timeZone`, changement à minuit).
  Toutes les poses sont rangées une fois pour toutes dans un ordre mélangé fixe (graine
  constante) ; chaque jour prend les trois suivantes, si bien qu'une pose ne revient qu'après que
  toutes les autres sont passées. Ajouter des poses change l'ordre à partir de ce jour-là. Journée
  n° 1 : le 2 novembre 2026 (`FIRST_DAY`), pour le fil d'activité.
- `src/play.ts` : `getDay` (les 3 poses du jour et celles déjà faites) et `playPose`. Le client
  envoie les angles de son pantin ; **la ressemblance est calculée par le serveur**, contre la
  pose du jour, jamais reçue du client. Les poses se font dans l'ordre, une seule fois chacune
  (contrainte unique : deux envois simultanés ne passent pas tous les deux) ; juste après minuit,
  une pose pensée pour la veille est refusée (409). La dernière pose publie la journée dans le fil
  d'activité (`pose/day_completed`, numéro du jour et moyenne seulement ; mise en avant en or à
  90 % et plus).
- Une fois les trois poses faites, le résultat du jour (moyenne, note, détail) reste affiché
  jusqu'au lendemain, avec le temps restant avant les poses suivantes. En local, un bouton permet
  de rejouer la journée pour de faux, sans rien enregistrer (`allowPractice`).
- Répliques du résultat (`src/verdicts.ts`) : de 9 à 12 par note, tirées au hasard, références des
  parties 1 à 6 seulement ; celle du résultat du jour ne dépend que du total (elle ne change pas
  d'une visite à l'autre).

## Le classement

`src/leaderboard.ts`, `ui/Leaderboard.tsx`, sous le jeu (à côté sur très grand écran), comme celui
de TROIS :

- **Jour** : tous ceux qui ont joué, plus moi ; points = somme des ressemblances des poses faites
  (300 au plus), la note de chaque pose en pastille ; à égalité, le plus de poses faites passe
  devant. **Semaine** (depuis lundi) et **mois** : le cumul des points, le nombre de poses et de
  jours, la meilleure pose ; à égalité, le moins de jours joués. Ex æquo au même rang.
- **Historique** : les flèches ‹ › remontent aux jours, semaines et mois passés, jusqu'au premier
  jour où quelqu'un a joué (`GET /api/pose/leaderboard?period=…&date=AAAA-MM-JJ` : le jour, ou la
  période qui contient ce jour ; une date future retombe sur aujourd'hui). La période précédente
  est préchargée ; une période passée, figée, reste en mémoire.
- Podium des 3 premiers ; la période en cours se rafraîchit chaque minute (pas quand l'onglet est
  caché) et dès qu'on valide une pose.

## Données

Schéma Postgres `pose`, une table `rounds` (modèle `PoseRound`) : une ligne par pose jouée
(`user_id`, `date` à Paris, `slot` 0 à 2, `pose_id`, `percent`, `mirrored`), unique par
(`user_id`, `date`, `slot`), index sur `date`. Migration `20261102230000_pose` (ajout seul).

## Routes

- `GET /api/pose/day` : la journée du membre.
- `POST /api/pose/play` : `{ date, slot, angles }` → la pose enregistrée et la journée.
- `GET /api/pose/leaderboard` : `?period=week|month`, `?date=AAAA-MM-JJ`.

## Les bonus JoJo

`ui/PoseFx.tsx`, par-dessus la carte du pantin : ils ne bloquent jamais le jeu (aucun clic
intercepté, aucun voile, ils repartent seuls).

- En posant, des « ゴゴ » animés apparaissent autour du pantin quand on approche de la pose (à
  50, 70 et 85 % de ressemblance), le troisième avec le son du Menacing : une indication « chaud
  ou froid », sans chiffre.
- **Répliques de la série** (`src/lines.ts`, 35 voix de l'anime et des jeux officiels, parties 1 à
  6, dans `apps/web/public/audio/pose`, égalisées en volume, 4 s au plus), tirées au hasard et
  affichées en grand façon onomatopée de manga, avec qui parle et le sens en français :
  - à la validation selon la note : réussie (A, B : « NICE ! », « YES I AM ! », « EMERALD
    SPLASH ! »…), moyenne (C : « Daga kotowaru », « Rero rero »…), ratée (D, E : « OH NOOOO ! »,
    « HINJAKU HINJAKU ! », « ARRIVEDERCI ! »…) ;
  - quand on remet le pantin droit (« NIGERUNDAYO ! », « Bites the Dust », « Made in Heaven »…) et
    au début de la partie, deux fois sur trois ;
  - quand on ne touche plus au pantin depuis 22 à 40 s (« WRYYY ! », « Toki wo tomare ! »…).
  - Jamais deux fois la même d'affilée.
- À la validation aussi : Star Platinum qui frappe vers le pantin (A), The World (B), une rafale
  de ゴゴゴ (C), avec les vrais sprites du thème JoJo (`apps/web/public/jojo`).
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
  4° ; ces articulations font les trois quarts de la note (tronc 1,5, tête 0,5, les autres 1).
- Celles qui n'ont pas à changer, déjà justes debout, font le dernier quart, tant qu'on ne les
  plie pas à tort (rien perdu jusqu'à 4° d'écart, tout au-delà de 50°, et jusqu'à 40 % de la
  part des articulations à changer en plus). Le pantin qu'on ne touche pas fait donc au plus
  25 % (note E) ; une pose qui serait simplement debout vaudrait 100 % sans rien toucher.
- La pose en **miroir** compte aussi (gauche et droite échangées) : on garde la meilleure.
- La tolérance est serrée (4°, à peine plus que la précision de la souris) et le pourcentage est
  arrondi par défaut : 100 % demande chaque articulation à quelques degrés près.
- Note façon fiche de Stand : **Z** (100 %, la pose parfaite), **S** (plus de 95 %), A (85 à
  95 %), B (75), C (60), D (40), E. Répliques propres à chaque note, Star Platinum pour Z, S et A.

Après la validation, la pose attendue s'affiche en fantôme (pointillés blancs) sur le pantin,
toujours dans le sens de l'image (même si le joueur l'a faite en miroir).

## Les poses

`src/poses.ts` : 56 poses, des parties 1 à 6 (rendus officiels détourés d'All Star Battle,
All Star Battle R, Eyes of Heaven, Last Survivor et OraDora, et visuels officiels de l'anime, pris sur jojowiki.com) : personnage, nom de
la pose, image (`apps/web/public/pose/<id>.webp`, 640 px de haut) et angles du squelette. Les
angles sont calés en pointant les articulations sur chaque image agrandie (bassin, base du cou,
centre de la tête, épaules, coudes, poignets, hanches, genoux, chevilles) et se mesurent
d'articulation à articulation, comme le pantin les juge : le bras de l'épaule au coude,
l'avant-bras du coude au poignet, la cuisse de la hanche au genou, la jambe du genou à la
cheville. La largeur des épaules et du bassin ne compte pas (le pantin ne peut pas la changer).
Chaque articulation se pointe dans l'axe du membre, là où il plie, sous les vêtements : pas au
bout d'une manche bouffante, d'une épaulette ou d'un pli de pantalon. Jambes croisées : la jambe gauche de l'image peut finir à droite (Kira, Speedwagon,
Rohan), on suit chaque jambe de la hanche à son pied. Vérification : le squelette
pointé est tracé sur l'image, puis comparé au pantin cible. Repointage complet le 8 novembre 2026
(plusieurs poses étaient fausses : bras, jambes inversées, têtes) ; trois poses à bras croisés
illisibles en 2D ont été retirées (Kars « La lame », Kakyoin « Le doigt levé », Straizo « Bras
croisés »).

Règles de choix d'une pose : rien de Steel Ball Run (en cours de diffusion) ni des parties
suivantes, sauf Gyro dans sa tenue des premiers épisodes, sans Stand ; un seul personnage, en
pied ; chaque membre lisible à plat (pas de
bras ni de jambe pointé droit vers l'écran, ni caché derrière le corps, ni bras croisés dont on ne voit pas de quelle épaule part chaque
main) ; au moins une
articulation à changer par rapport à la pose debout (sinon il n'y a rien à jouer).

Pour ajouter ou corriger une pose : l'**éditeur** `/pose?editeur` (en local seulement, jamais en
production) met l'image derrière le pantin, avec des curseurs pour la caler (position, échelle,
opacité) ; on pose le pantin dessus et on recopie les angles affichés dans `poses.ts`.

## Tests

`test/play.test.ts` (base de test) : journée, score calculé par le serveur, refus (ordre, double
envoi, angles mal formés, veille), fil d'activité, classement du jour et historique.
`test/lines.test.ts` : chaque moment a ses répliques, chaque son existe, pas deux fois la même.
`test/score.test.ts` : angles, cinématique, angle relatif retrouvé, score (identique, miroir,
pose debout à 25 % au plus, sauf pour une pose debout, tolérance, relatif, articulation pliée à tort),
notes, validité des poses (chacune atteignable à 100 %).
