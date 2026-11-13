# DOUZE — douze épreuves par jour

_Douze._

Chaque jour, **douze épreuves express** autour du nombre 12, les mêmes pour tout le monde, notées
chacune **sur 12** : une journée parfaite vaut **144 points** (12 × 12, une grosse). Les épreuves
s'enchaînent façon jeu télé : annonce en grand, quelques secondes pour jouer, points, suivante.

Jeu intégré au portail : page `/douze`, routes `/api/douze/*`, tuile « DOUZE » dans le registre
des apps (illustration `apps/web/public/apps/douze-2.webp`). Pas de récompense en monnaie.

## Ouverture

Le jeu est ouvert dès sa mise en ligne : les parties comptent tout de suite, partout. Journée
n° 1 : le jour de la mise en ligne (`FIRST_DAY`, `src/daily.ts`), pour le numéro « DOUZE #n » du
fil d'activité.

- **En local et pour les admins** : une fois la journée finie, « Rejouer pour de faux »
  (`allowPractice`) joue une autre journée, un jour passé tiré au hasard : points calculés dans
  le navigateur, rien d'enregistré. Rejouer la journée du jour n'apprendrait rien (mêmes
  épreuves, même case pour le vrai 12).

## Les douze épreuves

`src/trials.ts` (génération, temps, notation), `src/content.ts` (questions, mots, calculs,
horloges), `ui/Trials.tsx` (affichage). Chaque jour, les onze premières sont tirées dans un ordre
mélangé ; **l'Oracle est toujours la 12e**. Le contenu de chaque épreuve dépend de la date (graine
tirée de la date et du type d'épreuve, aucune graine liée au joueur) : même journée pour tout le
monde, autre journée le lendemain. Tout ce qui peut varier varie : taille des grilles (9, 12 ou
16 formes ; 18, 24 ou 30 cases), nombre de leurres et de sosies, positions, vitesses, temps
d'affichage du chrono, réponses proposées. **Le vrai 12 n'est jamais à la même case que la
veille** (`realPlacement` : en cas d'égalité, la case est décalée, toujours selon la graine du
jour).

| Épreuve            | Temps | Ce qu'on fait                                                                                                 | Points                                     |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Chrono à l'aveugle | 20 s  | arrêter le chrono à 12,00 s ; il disparaît au bout de 1,5 à 5,5 s                                             | 12, moins 1 par dixième de seconde d'écart |
| Douze clics        | 6 s   | cliquer exactement 12 fois, sans compteur (bouton placé au hasard, qui saute ou non)                          | 12, moins 4 par clic d'écart               |
| Compter            | 10 s  | 4 s pour compter 9 à 15 objets qui flottent (sans leurs sosies), puis répondre parmi 5 nombres qui se suivent | 12 juste, 4 à un près                      |
| Douze ou pas douze | 16 s  | quatre questions : la réponse est-elle 12 ?                                                                   | 3 par bonne réponse                        |
| Fais 12            | 20 s  | toucher des nombres qui font 12 ensemble, quatre paquets                                                      | 3 par paquet                               |
| Le dodécagone      | 9 s   | trouver la forme à 12 côtés parmi 8, 11 ou 15 formes à 10, 11, 13 ou 14 côtés                                 | 12 ou 0                                    |
| L'horloge          | 9 s   | trouver l'horloge qui indique « 12 h 12 », « midi pile »…                                                     | 12 ou 0                                    |
| Douze lettres      | 9 s   | trouver le mot de 12 lettres (les tirets et accents ne comptent pas)                                          | 12 ou 0                                    |
| Le compteur fou    | 12 s  | des sosies de 12 défilent (21, 112, 1,2…) : cliquer quand c'est 12                                            | 12 ou 0 (80 ms de marge)                   |
| Calculs            | 12 s  | cocher tout ce qui fait 12 (√144, XII, 0xC…)                                                                  | 12 × (bons − intrus) / nombre de bons      |
| Le vrai 12         | 9 s   | trouver le seul « 12 » parmi 17, 23 ou 29 sosies (I2, l2, 1Z…)                                                | 12 ou 0                                    |
| L'Oracle           | 9 s   | une question (« Combien de pattes a une araignée ? ») : la bonne réponse est 12                               | 12 ou 0. C'est toujours 12.                |

- La réponse de chaque épreuve part au serveur, qui recalcule l'épreuve du jour et compte les
  points lui-même (`scoreTrial`). Le joueur reçoit les épreuves sans leurs réponses quand elles
  ne servent pas à l'affichage (`trialView` : questions sans réponse, calculs sans valeur, sans le
  nombre d'objets ni l'index de la bonne case).
- Temps écoulé : la réponse en cours est envoyée (clics faits, paquets trouvés, cases cochées),
  sinon une réponse vide (0 point).
- **Recharger la page en pleine épreuve, c'est 0** : l'épreuve lancée est notée dans
  `localStorage` (`potopia:douze-started`) ; au retour, elle est envoyée vide.
- Les faits sont vérifiés un par un ; la longueur des mots, la valeur des calculs, la géométrie
  (faces, arêtes et sommets des prismes et pyramides) et les diviseurs sont calculés par le code.

### Un mois sans revoir la même réponse

Les épreuves à contenu piochent dans des réserves qui **tournent** (`rotation`, `src/trials.ts`) :
chaque réserve est rangée une fois pour toutes dans un ordre mélangé fixe, et chaque jour prend
les éléments suivants. Rien ne revient avant que toute la réserve soit passée, et les tests
vérifient qu'aucune réponse ne revient en 31 jours, quel que soit le jour de départ.

| Réserve (`src/content.ts`)      | Taille                                                                                    | Par jour           |
| ------------------------------- | ----------------------------------------------------------------------------------------- | ------------------ |
| « Douze ou pas douze » (`QUIZ`) | 168 questions : faits, géométrie, diviseurs, lettres d'un mot ; 69 font 12, 99 non        | 4 (1 à 3 font 12)  |
| L'Oracle (`ORACLE`)             | 48 questions                                                                              | 1                  |
| L'horloge (`CLOCKS`)            | 60 heures (pile, à 12, 24, 36, 48 min), leurres calculés (12 min ou 1 h d'écart, reflet…) | 1                  |
| Douze lettres (`WORDS`)         | 39 mots de 12 lettres, 42 sosies de 11 et 13                                              | 1 (+ 3 sosies)     |
| Calculs (`CALCS`)               | 94 calculs qui font 12, 98 sosies (11, 13…)                                               | 6 (2 ou 3 font 12) |
| Compter (`COUNTABLES`)          | 16 objets et leurs sosies                                                                 | 1 (nombre tiré)    |

Les autres épreuves (chrono, clics, fais 12, dodécagone, compteur fou, vrai 12) sont tirées au
hasard chaque jour.

- Petits bips synthétisés (WebAudio, aucun fichier son) au volume du site (`ui/sound.ts`).

## La journée

- `src/play.ts` : `getDay` (les 12 épreuves et celles déjà jouées) et `playRound`. Les épreuves se
  jouent dans l'ordre, une seule fois chacune (contrainte unique : deux envois simultanés ne
  passent pas tous les deux) ; juste après minuit, une réponse pensée pour la veille est refusée
  (409). La 12e publie la journée dans le fil d'activité (`douze/day_completed` : numéro du jour,
  points et nombre d'épreuves parfaites ; mise en avant en or à 120 points et plus, ou 12 pile).
  Sur la place, l'avatar dit « Douze. » (confettis à 144).
- Fin de journée : total sur 144, un titre par tranche de 12 points (`src/titles.ts`, un titre à
  part pour 12 pile), le détail des 12 épreuves et le temps avant les suivantes.

## Le classement

`src/leaderboard.ts`, `ui/Leaderboard.tsx`, sous le jeu, comme celui de Pose JoJo :

- **Jour** : tous ceux qui ont joué, plus moi ; points = somme des épreuves jouées (144 au plus),
  épreuves jouées et parfaites (12/12) ; à égalité, le plus d'épreuves parfaites passe devant.
- **Semaine** (depuis lundi) et **mois** : cumul des points, jours joués, meilleure journée,
  épreuves parfaites ; à égalité, le moins de jours joués. Ex æquo au même rang.
- **Historique** : flèches ‹ › jusqu'au premier jour où quelqu'un a joué
  (`GET /api/douze/leaderboard?period=…&date=AAAA-MM-JJ`). Podium des 3 premiers ; la période en
  cours se rafraîchit chaque minute et après chaque épreuve.

## Données

Schéma Postgres `douze`, une table `rounds` (modèle `DouzeRound`) : une ligne par épreuve jouée
(`user_id`, `date` à Paris, `slot` 0 à 11, `kind`, `points` 0 à 12), unique par (`user_id`,
`date`, `slot`), index sur `date`. Migration `20261113190000_douze` (ajout seul).

## Routes

- `GET /api/douze/day` : la journée du membre (date, numéro, épreuves, épreuves jouées).
- `POST /api/douze/play` : `{ date, slot, answer }` → l'épreuve enregistrée, ses points, une
  phrase (« Arrêté à 12,08 s ») et la journée.
- `GET /api/douze/leaderboard` : `?period=week|month`, `?date=AAAA-MM-JJ`.

## Tests

`test/trials.test.ts` : 12 épreuves par jour, l'Oracle en dernier, mêmes épreuves pour tous ;
même date = même contenu, chaque épreuve change d'un jour à l'autre, le vrai 12 jamais à la case
de la veille (sur un an), tailles de grilles et réponses proposées qui varient ;
sur 90 jours, chaque épreuve peut rapporter 12 et rien sans réponse ; 31 jours de suite sans
répétition (questions, Oracle, horloge, mot, calculs qui font 12), taille des réserves ; barèmes ;
réponses mal formées refusées ; contenu (questions, Oracle, mots, calculs, horloges sans
doublon) ; titres.
`test/play.test.ts` (base de test) : journée sans les réponses, ouvert dès la mise en ligne
(journée n° 1), points calculés par le serveur, refus (ordre, double envoi, veille, mal
formé), fil d'activité, classements du jour et de la semaine.
