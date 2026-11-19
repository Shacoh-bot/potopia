# Sacrebleu Survivors

Nom de travail provisoire ; le titre reste à confirmer (voir la direction artistique).

Survivors-like solo original, jouable dans le navigateur. Gontran de Sainte-Bafferie, un paladin
barbu aux cheveux grisonnants,
défend le Bois de Fierfeuille pendant dix minutes. Pixel art dessiné dans le code, sons de
synthèse ; aucun fichier, nom de personnage, logo ou code de Warcraft ou de Vampire Survivors.

La [direction artistique](DIRECTION_ARTISTIQUE.md) fixe la chevalerie française de comédie,
les conventions de nommage et la référence du premier paladin, Gontran de Sainte-Bafferie.

Le marteau porté est compact et dessiné directement dans le sprite, relié à la main du paladin.
Le jeu et le portrait utilisent la même couche de pixels pour conserver une prise cohérente.
Le sprite original de 32 × 40 pixels décline une armure massive d'or et d'acier, une étoffe bleu
nuit, une barbe grisonnante et un petit livre relié. Le marteau reste bas, près de la main.
Deux poses de marche alternent les jambes. Ni éclairs, ni halo, ni yeux lumineux sur le personnage.

## Jouer

L'écran de jeu conserve le titre, les commandes, les jauges, le portrait, l'arsenal et le
bestiaire. Le surtitre, le sous-titre promotionnel, l'encart « Votre serment » et les phrases
de pied de page sont retirés pour alléger l'interface.

- Dans la plateforme : tuile **Sacrebleu Survivors**, route `/survivors`, réservée aux membres.
- Aperçu autonome local, sans Discord, base ni `.env` :
  `pnpm --filter @app/survivors preview`, puis `http://127.0.0.1:4173`.
  Cet aperçu utilise exactement le même composant et le même moteur ; il n'ajoute aucune route
  sans authentification à la plateforme. L'écoute est limitée à la boucle locale.
- ZQSD, WASD ou flèches pour se déplacer ; joystick sur écran tactile ; attaques automatiques.
- P ou Échap pour la pause ; les boutons permettent de couper les bruitages et de passer en plein
  écran lorsque le navigateur le permet. Le volume global de la plateforme est respecté.
- Ramasser les éclats pour monter de niveau et choisir un des trois dons (clic ou touches 1–3).
  Les cristaux font 16, 20 ou 24 pixels selon leur valeur, avec contour sombre, facettes et halo
  pour ressortir dans l'herbe. Les croix rendent de la vie. Chaque don possède cinq rangs.
- Deux élites à 03:00 et 06:00 : le gnoll Sire Grincecroc et l'ourse Dame Griffepoil. Le chef
  gnoll **Baron de Croquebotte** apparaît à 09:00 : il faut le vaincre **et**
  rester vivant jusqu'à la relève à 10:00 pour gagner. Boss encore vivant à 10:00 : défaite.
- Les pauses, les choix de dons, la perte de focus et les onglets masqués ne font pas avancer
  le chronomètre. Il mesure le temps simulé actif, pas le temps passé dans les menus.

## Terrain : le Bois de Fierfeuille

Forêt pastorale lumineuse : grands feuillus, herbe verte, chemins ocre sinueux, fleurs sauvages,
buissons, champignons, souches, clôtures et panneau au carrefour. Un petit sanctuaire marque la
clairière de départ. L'ambiance évoque les premières aventures en forêt d'Elwynn avec un décor
original, sans reprendre sa carte ni ses ressources graphiques. Le nom mêle noblesse et
feuillage pour suivre la direction de chevalerie française de comédie.

Tout le terrain reste praticable. Le décor passe derrière les combattants pour préserver la
lecture de la horde. Terrain et arbres sont préparés dans des Canvas réutilisés ; le cache est
borné à 36 blocs de 384 pixels, régénérables de manière déterministe pendant les déplacements.

Recette du décor : démarrage, combat, choix d'un don et défilement au-delà de la clairière
observés dans le navigateur.

## Bestiaire

Les huit familles remplacent les anciens morts-vivants. Dessins originaux dans `ui/sprites.ts`,
caractéristiques, noms et horaires partagés dans `src/bestiary.ts`. Le guide illustré repliable
« Les fréquentations de Fierfeuille » présente les huit familles sous le terrain de jeu.
Les huit portraits et descriptions ainsi que les nouveaux bandits en combat ont été vérifiés
dans le navigateur.

| Famille  | Nom                      | Arrivée | Particularité                                     |
| -------- | ------------------------ | ------- | ------------------------------------------------- |
| Bandit   | Malandrin de Videgousset | 00:00   | Approche directe, poignard et foulard rouge.      |
| Loup     | Loup de Croquejarret     | 00:18   | Rapide, contourne avant de mordre.                |
| Sanglier | Sanglier de Foncegroin   | 00:45   | Charge annoncée, direction fixe et récupération.  |
| Murloc   | Glouglou de Flaquefière  | 01:15   | Amphibien à nageoire, avance par petits bonds.    |
| Araignée | Tisseuse de Mauvaisfil   | 01:45   | Alterne arrêts et ruées.                          |
| Gnoll    | Gnoll de Grincecroc      | 02:20   | Maraudeur robuste à massue.                       |
| Kobold   | Kobold de Chandellecourt | 02:55   | Approche hésitante et recul à très courte portée. |
| Ours     | Ours de Grosdodo         | 03:30   | Lent, très résistant, dégâts de contact élevés.   |

Les horaires ouvrent la sélection pondérée de chaque famille ; la première apparition dépend
du tirage et du plafond de horde. Les élites et le Baron ont des silhouettes agrandies et une
couronne ; le Baron porte aussi un étendard et charge avec un avertissement au sol. La préparation
fige la direction de charge : on peut esquiver latéralement. Aucun projectile ennemi ni effet
de poison ou de toile dans cette version.

## Arsenal

- **Jugement** : jusqu'à trois marteaux par salve, en ligne droite ; chaque projectile inflige
  ses dégâts à une cible puis disparaît à l'impact, ou après 1,5 seconde sans impact.
- **Concécration** : dégâts de zone périodiques autour du héros.
- **Marteaux bénis** : jusqu'à trois marteaux d'acier bleuté et d'or en orbite, avec une icône
  de marteau dans l'arsenal et les améliorations.
- Dons passifs : vie avec soin, cadence d'attaque, vitesse et rayon de ramassage.

## Technique et vérifications

`src/engine.ts` est une simulation TypeScript pure avec générateur aléatoire reproductible.
`ui/render.ts` dessine le Canvas 2D ; `ui/forest.ts` prépare le décor forestier par blocs réutilisés,
et les sprites des combattants sont préparés une seule fois. Pas fixe
à 60 Hz, grille spatiale pour les collisions, horde courante plafonnée à 220 (plus les élites et
le boss), expérience agrégée au-delà de 360 objets, effets visuels bornés. Le Canvas adapte son
cadrage à l'écran. Les éléments de décor sont traversables.

`ui/Game.tsx` relie commandes, menus et simulation ; les mises à jour React sont limitées à
10 Hz hors changements de phase. Écouteurs, animation, observateur de taille et contexte audio
sont libérés au démontage. Les APIs navigateur sont utilisées après montage, sans import Next
dans le module.

```sh
pnpm --filter @app/survivors test
pnpm --filter @app/survivors typecheck
pnpm --filter @app/survivors lint
pnpm --filter @app/survivors preview:build
```

Les tests couvrent déplacement, collisions, disparition de Jugement au premier impact et
expiration sans retour, progression, pause, boss, victoire/défaite, charges,
contournement, recul des kobolds, arrivée des familles, validité des sprites et une simulation
de dix minutes avec horde saturée. La recette visuelle et l'équilibrage avec des joueurs
restent complémentaires à ces tests.

Vérifications du prototype (19 novembre 2026) : 18 tests passent, dont deux parties
complètes simulées (horde saturée sans arme et arsenal complet avec victoire). TypeScript du
module et de l'application web, lint des fichiers modifiés, frontières et build de l'aperçu
validés. Dans le navigateur : démarrage, combat, ramassage, choix d'un don et pause clavier
observés ; disposition contrôlée à 390 × 844 sans débordement horizontal. Les commandes tactiles
sur un appareil physique et une partie entière jouée par une personne restent à recetter.

## Périmètre du prototype

Parties rejouables sans limite ; pas de sauvegarde, classement, récompense en monnaie, progression
permanente ou multijoueur. Aucun schéma Prisma ni migration : le serveur ne reçoit aucun résultat.
Un rechargement abandonne la partie. Ces extensions nécessiteront un contrat serveur et des
contrôles de résultats adaptés avant toute récompense.
