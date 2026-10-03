# Guides Playlab42

Une idée, un premier outil, un jeu à construire : choisissez le guide qui
correspond à votre prochaine étape. Les exemples et contrats techniques restent
dans leurs guides de référence, sans copie à maintenir.

## Lire dans le laboratoire

Depuis le portail, ouvrez **Les guides** : les documents sont présentés dans un
lecteur HTML avec un plan, des liens de section et les thèmes du laboratoire.
Les liens entre documents restent dans ce lecteur. Le lien **Lire la source
Markdown** permet de retrouver chaque fichier canonique.

Le site est généré dans `docs/site/`, sans backend, CDN ou iframe :

```bash
# Dans le worktree, via le conteneur de développement
make build-guides
make serve
```

`make build-guides` exécute `node scripts/build-guides.js` dans Docker.
Ne modifiez pas les pages générées : éditez les Markdown sous `docs/`, puis
régénérez. Un fichier Markdown hors de `docs/` est signalé comme **source
Markdown**, et non présenté comme une page du lecteur.

## Prendre ses repères

- [Architecture](architecture.md) : comprendre les composants et leurs limites.
- [Premiers pas](../GETTING_STARTED.md) : préparer l'environnement Docker.
- [Contribuer](contributing.md) : connaître le workflow et les vérifications.
- [L'usine logicielle](software-factory.md) : comprendre la chaîne de livraison et les points restant à améliorer.

## Créer une contribution

| Guide | Description | Niveau |
|-------|-------------|--------|
| [Kit de contribution](contribution-kit.md) | Gabarits, composants partagés et galerie UI | Tous |
| [Créer un outil](create-tool.md) | Créer un outil HTML standalone | Débutant |
| [Créer un parcours](create-epic.md) | Organiser des slides pédagogiques en Epic | Débutant |
| [Créer un moteur de jeu](create-game-engine.md) | Créer un moteur isomorphe | Intermédiaire |
| [Créer un client de jeu](create-game-client.md) | Créer une interface de jeu | Intermédiaire |
| [Créer un bot](create-bot.md) | Créer une IA pour un jeu | Avancé |

## Vérifier et travailler avec l'IA

- [Qualité logicielle](software-quality.md) : conception, lint, sécurité, tests et revue, avec un plan progressif.
- [Stratégie de tests](../TESTING_STRATEGY.md) : choisir les preuves adaptées.
- [Skills du projet](project-skills.md) : utiliser les assistants avec les mêmes conventions.
- [Workflow OpenSpec](openspec-workflow.md) : clarifier et suivre un changement.
- [Données locales](local-data.md) : comprendre la persistance navigateur.
- [Bibliothèques runtime](runtime-libraries.md) : utiliser les distributions locales.

## Par où commencer ?

1. **Lisez d'abord** le guide [Architecture](architecture.md) pour comprendre la structure du projet
2. **Débutants** : Commencez par [Créer un outil](create-tool.md) - c'est le plus simple
3. **Intermédiaires** : Enchaînez avec [Créer un moteur](create-game-engine.md) puis [Créer un client](create-game-client.md)
4. **Avancés** : Terminez avec [Créer un bot](create-bot.md)

## Prérequis

- Connaissances de base en HTML, CSS, JavaScript
- Docker installé sur votre machine
- Un éditeur de code (VS Code recommandé)

## Environnement de développement

Toutes les commandes se font via Docker :

```bash
# Initialiser l'environnement
make init

# Lancer le serveur de développement
make serve

# Accéder au shell du container
make shell
```

## Conventions

- **Commentaires** : En français
- **Commits** : En français
- **Nommage fichiers** : kebab-case (`mon-outil.html`)
- **Nommage variables** : camelCase (`maVariable`)
- **Nommage types** : PascalCase (`MonType`)

## Ressources

- [Spécification du portail](../../openspec/specs/portal/spec.md)
- [Conventions du projet](../../openspec/project.md)
- [Exemples d'interface](../../tools/ui-kit/index.html) et [de jeu](../../games/tictactoe/index.html)
