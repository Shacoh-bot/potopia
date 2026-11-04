# Morpion

Adaptation du projet personnel « DM Morpion » : duels en ligne entre deux membres, sans IA.

## Jouer

La tuile **Morpion** du portail ouvre `/morpion`. Choisir un thème et un membre, puis proposer un duel.
Le membre reçoit une notification et doit accepter sur `/morpion/<id>` avant le premier coup.
Le créateur joue les croix (pion 1), l'invité les ronds (pion 2). Les noms et les images des pions dépendent du thème.

Les invitations et les coups sont synchronisés automatiquement (salon : 4 secondes ; partie : 2 secondes,
sans requêtes quand l'onglet est masqué). Une déconnexion ou un rechargement conserve la partie.
Après victoire, égalité ou annulation, une revanche propose une nouvelle invitation. Le score compte toutes
les manches gagnées par ce duo, tous thèmes confondus. Aucun gain de monnaie n'est attribué.
Une invitation peut être déclinée ou retirée ; chaque joueur peut quitter une partie après confirmation.

## Thèmes et sons

Les ressources utilisées sont copiées du projet d'origine dans `apps/web/public/morpion-assets/` :

| Dossier | Univers          | Pion 1      | Pion 2       |
| ------- | ---------------- | ----------- | ------------ |
| mario   | Super Mario Bros | Étoile      | Champignon   |
| sw      | Star Wars        | Sabres      | Étoile noire |
| simpson | Les Simpson      | Homer       | M. Burns     |
| got     | Game of Thrones  | Stark       | Lannister    |
| ghibli  | Ghibli           | Épouvantail | Nekobasu     |

Chaque dossier contient le décor, la case vide, deux pions, la musique principale et les sons de pose,
de victoire des deux joueurs et d'égalité. Les versions alternatives inutilisées de l'ancien projet,
Bootstrap, jQuery et l'ancien code IA ne sont pas importés.

Le bouton **Activer les sons du thème** démarre la musique après un geste utilisateur. Le volume du
bandeau pilote tous les sons ; la musique est atténuée à 45 % de ce volume, interrompue pendant le
son de résultat, puis reprend. Quitter la page arrête le son. Les médias restent soumis à l'arrêt
du temps et à la priorité audio du portail. Les médias fournis conservent leurs ayants droit respectifs.

## Architecture

- Domaine Postgres `morpion`, modèle `MorpionGame` ; migration additive `20261104230000_morpion`.
- Une clé de duo unique empêche les invitations croisées et les parties actives en doublon.
- États : `WAITING`, `PLAYING`, `WON`, `DRAW`, `ABANDONED`.
- Règles et résultat calculés côté serveur, version optimiste pour les coups simultanés.
- Thème fixé à la création ; changer de thème passe par le salon et une nouvelle partie.
- API privée : `GET/POST /api/morpion/games`, `GET/POST /api/morpion/games/<id>`.
  POST de collection : `partnerId`, `theme`. POST de partie : `action` (`accept`, `move`, `cancel`),
  `version`, et `cell` (0 à 8) pour un coup.
- Authentification et validation zod à chaque route ; seul l'invité accepte, seuls les deux joueurs
  lisent ou modifient le duel. Dix invitations en attente au maximum par créateur.
- Réutilisation des services publics de `core` pour les membres et les notifications ; aucune lecture
  directe de tables d'autres domaines. Écritures composables via `{ tx }`.
- Pas de nouvelle variable d'environnement.

## Vérifications

`pnpm --filter @app/morpion test` teste les huit alignements, les cases invalides, les invitations,
les droits, les tours, les coups concurrents, les résultats, le score, la revanche et les transactions
sur la base PostgreSQL de test. `pnpm --filter @app/morpion lint` et `typecheck` vérifient le module.
