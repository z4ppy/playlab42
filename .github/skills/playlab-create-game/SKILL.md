---
name: playlab-create-game
description: >-
  Créer un mini-jeu Playlab42 ou modifier réellement ses règles : moteur
  isomorphe déterministe, actions, vues joueur, bots, manifeste game.json,
  client autonome et tests, y compris les jeux solo en temps réel avec gravité,
  chronomètre ou commandes maintenues. Utiliser aussi pour un replay, une fuite
  d'information cachée ou une action invalide. Pour un défaut uniquement
  visuel, de thème ou de focus, utiliser playlab-ui sans changer le moteur.
---

# Créer un jeu Playlab42

## Préparer

Lire [AGENTS.md](../../../AGENTS.md), `openspec/AGENTS.md` et le changement approuvé
si une nouvelle capacité est introduite. Pour une création, définir les règles,
joueurs, actions légales, fin de partie et informations visibles avant de coder.
Les chemins en code sont relatifs à la racine du dépôt.
Lire [le contrat et les références](references/game.md), puis les sources du jeu
le plus proche, pas l'ensemble des jeux.

Partir de `templates/game/` par le générateur documenté dans
`docs/guides/contribution-kit.md`. Ne pas créer un second générateur ni modifier
un moteur existant pour faire fonctionner un nouveau client.

## Construire le moteur

1. Créer `games/<id>/engine.js` en ESM, ou suivre le pipeline TypeScript optionnel
   déjà présent. Documenter les états, actions et configurations en français.
2. Implémenter le contrat existant : `init`, `applyAction`, `isValidAction`,
   `getValidActions`, `getPlayerView`, `isGameOver`, `getWinners`,
   `getCurrentPlayer`. Conserver leurs signatures ; ne pas inventer un SDK.
3. Garder le moteur indépendant de `window`, `document`, stockage, réseau et
   horloge. Le client gère DOM, animations et temporisation ; le moteur gère les
   règles. Un même état et une même action donnent le même résultat.
4. Ne pas muter l'état reçu. Valider avant de produire le nouvel état ; rejeter
   explicitement les actions invalides selon le contrat.
5. Garder l'état entièrement JSON. Pour l'aléatoire, utiliser `SeededRandom` ;
   restaurer et sauvegarder `rngState` lors des transitions. Pas de `Math.random()`
   ni générateur caché mutable sur l'instance.
6. Exposer uniquement l'information autorisée dans `getPlayerView`.
   Faire décider les bots à partir de cette vue, pas de l'état secret.
7. Tester initialisation, transitions, actions invalides, mauvais joueur,
   victoire/nul, immutabilité, replay et reprise après sérialisation.
8. Pour un jeu temps réel, lire la section dédiée de `references/game.md`.
   Transmettre le temps au moteur par des actions explicites et sérialiser ses
   délais : une horloge cachée rendrait les replays et reprises non vérifiables.

## Relier les surfaces

- Créer `game.json` avec l'id du dossier et les champs requis réels ; vérifier
  tous les chemins et les bots déclarés. Utiliser le format actuel, pas une
  métadonnée inventée. Renseigner `author` avec le nom de la personne qui
  réalise le jeu (`git config user.name` ou demande explicite) : il est affiché
  sur la carte. Jamais « Playlab42 », « AI Assistant » ni « Anonyme ».
- Ajouter `index.html` autonome et un client qui transmet les actions au moteur.
  Utiliser `playlab-ui` pour clavier, thèmes et primitives partagées.
- Intégrer `GameKit` uniquement avec l'API lue dans les sources/guide.
  Le mode autonome doit rester utilisable hors portail.
- Fournir les bots pertinents et leurs tests selon le contrat Bot existant.
  Garder les décisions reproductibles avec le RNG fourni.

## Valider

Ne lancer de runtime que dans Docker, si le rôle l'autorise. Sinon transmettre
les commandes au parent/opérateur, sans annoncer des tests réussis.

```bash
# Adapter aux fichiers de tests réellement créés
make npm CMD="test -- --runTestsByPath games/mon-jeu/engine.test.js"
make npm CMD="exec -- eslint games/mon-jeu/"
make build-catalogue
```

Pour TypeScript : `make typecheck` puis `make build-ts`.
Vérifier le jeu autonome et dans le portail via `make serve` / `make info`,
puis les parcours navigateur pertinents via `make test-e2e`.
Pour un jeu temps réel, couvrir aussi les commandes maintenues, la perte de focus,
le temps figé en pause et le nettoyage à `unload`. Ajouter ces parcours dans la
suite `e2e/` existante, pas seulement dans un script temporaire de session.
Ne pas versionner `data/*.json` ni les sorties `dist/`.

## Livrer

Décrire les règles implémentées, les fichiers ajoutés, la seed/reprise, les tests
effectués et les limites éventuelles. Un client jouable seul ne prouve pas
l'isomorphisme, la pureté ni la protection des informations cachées.
