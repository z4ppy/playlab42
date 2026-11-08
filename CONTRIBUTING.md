# Contribuer à Playlab42

Merci de l’intérêt que vous portez à Playlab42. Une petite contribution peut devenir un excellent support de formation : un outil, un jeu, un bot, un parcours, une ressource, une correction ou un coup de plume dans la documentation.

Ce fichier donne le chemin le plus court. Le guide détaillé est dans [docs/guides/contributing.md](docs/guides/contributing.md).

En participant, vous acceptez de respecter le [code de conduite](CODE_OF_CONDUCT.md).

## Avant de commencer

- **Une idée, un bug ?** Cherchez d’abord dans les [issues](https://github.com/z4ppy/playlab42/issues), puis ouvrez-en une avec le modèle adapté. Pour un gros changement, discutez-en avant d’écrire le code.
- **Une faille de sécurité ?** Ne l’ouvrez pas en issue publique : suivez [SECURITY.md](SECURITY.md).
- **Pas d’idée précise ?** Les corrections de documentation, l’accessibilité et l’usage sur mobile sont toujours bienvenus.

## Mettre en place l’environnement

Prérequis : Git et Node.js 24 ou plus.

```bash
git clone https://github.com/<votre-compte>/playlab42.git && cd playlab42
npm ci
npm start        # puis ouvrir http://localhost:5242
```

L’environnement de référence du projet est **Docker-first** (Git, Docker avec Docker Compose et Make) :

```bash
make init
make npm CMD="run build:dev"
make info        # affiche l’URL locale
make serve
```

Le détail (ports, worktrees, commandes du quotidien, éléments optionnels comme le laboratoire GPT-2) est dans le [guide de démarrage](docs/GETTING_STARTED.md).

## Proposer une modification

1. Créez un fork puis une branche dédiée : `feat/…`, `fix/…` ou `docs/…`.
2. Suivez le guide correspondant à votre contribution :

   | Vous créez… | Guide |
   |-------------|-------|
   | un outil | [create-tool](docs/guides/create-tool.md) |
   | un jeu | [moteur](docs/guides/create-game-engine.md), [interface](docs/guides/create-game-client.md), [bots](docs/guides/create-bot.md) |
   | un parcours | [create-epic](docs/guides/create-epic.md) |
   | autre chose | [guide de contribution](docs/guides/contributing.md), [kit et gabarits](docs/guides/contribution-kit.md) |

3. Renseignez `author` dans le manifeste (`game.json`, `tool.json`, `metadata.author` d’un parcours) avec **votre nom ou pseudo** : il est affiché sur la carte. Évitez « Playlab42 », « AI Assistant » ou « Anonyme ».
4. Vérifiez votre travail avant d’ouvrir la Pull Request :

   ```bash
   make lint        # qualité du code    (ou npm run lint)
   make typecheck   # types              (ou npm run typecheck)
   make test        # tests Jest         (ou npm test)
   ```

   Essayez aussi le résultat dans le navigateur, en thème clair **et** sombre, et sur un écran étroit (≈ 360 px de large) : le contenu doit rester utilisable au doigt.
5. Ouvrez la Pull Request vers `main` en remplissant le [modèle](.github/PULL_REQUEST_TEMPLATE.md). Indiquez les contrôles réellement exécutés et ceux que vous n’avez pas pu lancer.

## Conventions

- **Langue** : commentaires, commits et documentation en français.
- **Commits** : un message court à l’impératif ou au préfixe conventionnel (`feat(jeux): …`, `fix: …`, `docs: …`), expliquant le *pourquoi* si ce n’est pas évident.
- **Code** : JavaScript en modules ES, fonctions pures quand c’est possible, moteurs de jeux isomorphes (sans DOM). Voir [AGENTS.md](AGENTS.md).
- **Tests** : toute logique modifiée ou ajoutée est testée ; les tests existants doivent rester verts.
- **Spécifications** : les évolutions de comportement passent par un change [OpenSpec](docs/guides/openspec-workflow.md), ou la PR justifie son absence.
- **Dépendances** : évitez d’en ajouter ; le site est statique et se contente de fichiers locaux.

## Avec un agent IA

Les agents de code lisent [AGENTS.md](AGENTS.md) et les [skills de projet](docs/guides/project-skills.md). Vous restez responsable de ce que vous soumettez : relisez, exécutez les contrôles et vérifiez que l’auteur déclaré est bien vous.

## Licence des contributions

Playlab42 est distribué sous licence [Apache 2.0](LICENSE). En soumettant une contribution, vous acceptez qu’elle soit publiée sous cette même licence (article 5 de la licence). N’ajoutez pas de code, d’image ou de texte dont vous n’avez pas les droits, et indiquez la licence de toute ressource tierce.
