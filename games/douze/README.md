# DOUZE — douze épreuves absurdes par jour

_Douze._

Chaque jour, **douze épreuves express** autour du nombre 12, les mêmes pour tout le monde, notées
chacune **sur 12** : une journée parfaite vaut **144 points** (12 × 12, une grosse). Les épreuves
s'enchaînent façon jeu télé : annonce en grand, quelques secondes pour jouer, points, suivante.

Jeu intégré au portail : page `/douze`, routes `/api/douze/*`, tuile « DOUZE » dans le registre
des apps (illustration `apps/web/public/apps/douze.webp`). Pas de récompense en monnaie.

## Ouverture

Le jeu ouvre le **12/12/2026 à 12 h 12**, heure de Paris (`OPENS_AT`, `src/daily.ts`). Avant,
la page affiche un compte à rebours et le serveur refuse les parties (409). Journée n° 1 : le
12 décembre 2026 (`FIRST_DAY`), pour le fil d'activité.

- **En local** (`NODE_ENV` autre que `production`) : le jeu est ouvert tout de suite (option
  `early` des routes), pour le tester avec de vraies parties et le classement.
- **En local et pour les admins** : « S'entraîner pour de faux » avant l'ouverture et « Rejouer
  pour de faux » après la journée (`allowPractice`) : points calculés dans le navigateur, rien
  d'enregistré.

## Les douze épreuves

`src/trials.ts` (génération, temps, notation), `src/content.ts` (questions, mots, calculs,
horloges), `ui/Trials.tsx` (affichage). Chaque jour, les onze premières sont tirées dans un ordre
mélangé ; **l'Oracle est toujours la 12e**. Le contenu de chaque épreuve dépend de la date (graine
tirée de la date et du type d'épreuve) : même journée pour tout le monde.

| Épreuve            | Temps | Ce qu'on fait                                                                   | Points                                     |
| ------------------ | ----- | ------------------------------------------------------------------------------- | ------------------------------------------ |
| Chrono à l'aveugle | 20 s  | arrêter le chrono à 12,00 s ; il disparaît au bout de 2 à 5 s                   | 12, moins 1 par dixième de seconde d'écart |
| Douze clics        | 6 s   | cliquer exactement 12 fois, sans compteur (le bouton saute un jour sur deux)    | 12, moins 4 par clic d'écart               |
| Compter            | 10 s  | 4 s pour compter des objets qui flottent (sans leurs sosies), puis répondre     | 12 juste, 4 à un près                      |
| Douze ou pas douze | 16 s  | quatre questions : la réponse est-elle 12 ?                                     | 3 par bonne réponse                        |
| Fais 12            | 20 s  | toucher des nombres qui font 12 ensemble, quatre paquets                        | 3 par paquet                               |
| Le dodécagone      | 9 s   | trouver la forme à 12 côtés parmi des formes à 10, 11, 13 et 14 côtés           | 12 ou 0                                    |
| L'horloge          | 9 s   | trouver l'horloge qui indique « 12 h 12 », « midi pile »…                       | 12 ou 0                                    |
| Douze lettres      | 9 s   | trouver le mot de 12 lettres (les tirets et accents ne comptent pas)            | 12 ou 0                                    |
| Le compteur fou    | 12 s  | des sosies de 12 défilent (21, 112, 1,2…) : cliquer quand c'est 12              | 12 ou 0 (80 ms de marge)                   |
| Calculs            | 12 s  | cocher tout ce qui fait 12 (√144, XII, 0xC…)                                    | 12 × (bons − intrus) / nombre de bons      |
| Le vrai 12         | 9 s   | trouver le seul « 12 » parmi I2, l2, 1Z…                                        | 12 ou 0                                    |
| L'Oracle           | 9 s   | une question (« Combien de pattes a une araignée ? ») : la bonne réponse est 12 | 12 ou 0. C'est toujours 12.                |

- La réponse de chaque épreuve part au serveur, qui recalcule l'épreuve du jour et compte les
  points lui-même (`scoreTrial`). Le joueur reçoit les épreuves sans leurs réponses quand elles
  ne servent pas à l'affichage (`trialView` : questions sans réponse, calculs sans valeur, sans le
  nombre d'objets ni l'index de la bonne case).
- Temps écoulé : la réponse en cours est envoyée (clics faits, paquets trouvés, cases cochées),
  sinon une réponse vide (0 point).
- **Recharger la page en pleine épreuve, c'est 0** : l'épreuve lancée est notée dans
  `localStorage` (`potopia:douze-started`) ; au retour, elle est envoyée vide.
- Les questions et réponses sont vérifiées (« Douze ou pas douze » : réponse réelle de chaque
  question) ; la longueur des mots et la valeur des calculs sont calculées par le code.
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

- `GET /api/douze/day` : la journée du membre (`open`, `opensAt`, épreuves, épreuves jouées).
- `POST /api/douze/play` : `{ date, slot, answer }` → l'épreuve enregistrée, ses points, une
  phrase (« Arrêté à 12,08 s ») et la journée.
- `GET /api/douze/leaderboard` : `?period=week|month`, `?date=AAAA-MM-JJ`.

## Tests

`test/trials.test.ts` : 12 épreuves par jour, l'Oracle en dernier, mêmes épreuves pour tous ;
sur 90 jours, chaque épreuve peut rapporter 12 et rien sans réponse ; barèmes ; réponses
mal formées refusées ; contenu (questions, Oracle, mots, calculs, horloges) ; titres.
`test/play.test.ts` (base de test) : journée sans les réponses, fermeture avant l'ouverture (et
ouverture en avance), points calculés par le serveur, refus (ordre, double envoi, veille, mal
formé), fil d'activité, classements du jour et de la semaine.
