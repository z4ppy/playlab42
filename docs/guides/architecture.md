# Architecture Playlab42

Playlab42 possède deux architectures complémentaires : **l'application statique**
utilisée dans le navigateur et **l'usine logicielle** qui fabrique, vérifie et
publie ses fichiers. Elles ne nécessitent ni backend applicatif ni WebSocket.

## Vue d'ensemble

```text
À la construction
  Sources + manifests + specs
    → TypeScript / runtime / catalogues / guides
    → site/ → archive testée → GitHub Pages

Dans le navigateur
  Portail : Parcours | Outils | Jeux | Liens
    ├─ recherche, filtres, reprise, réglages, lien Guides
    ├─ outils / jeux dans une iframe
    ├─ viewer de parcours / slides
    └─ localStorage : préférences, scores et progression
```

Le serveur de développement ne fait que servir des fichiers. Les moteurs
compatibles Node sont testés dans Node ; cela ne signifie pas qu'un serveur
de jeu est déployé. Les données ne sont pas synchronisées entre appareils.

## Les composants

| Dossier | Responsabilité |
|---------|----------------|
| `index.html`, `app.js`, `app/`, `style.css` | Portail, catalogues, recherche, navigation, paramètres |
| `tools/` | Outils autonomes, HTML unique ou modules locaux |
| `games/` | Moteurs de règles, clients et bots |
| `parcours/` | Manifests d'epics, slides, viewer et ressources éditoriales partagées |
| `lib/` | GameKit, thèmes, données locales, PRNG, helpers et contrats de types |
| `bookmarks/` | Sources de la bibliothèque de liens |
| `data/` | Catalogues et ressources de bookmarks générés |
| `docs/` | Documentation Markdown canonique et lecteur statique généré |
| `scripts/`, `templates/` | Build, tests et kit de contribution |
| `openspec/` | Specs principales, changes actifs, archives et configuration |
| `.github/skills/` | Skills canoniques, métier et OpenSpec |
| `.github/workflows/` | Validation, publication et audits |
| `site/` | Sortie publique préparée, jamais versionnée |

### Portail et contenus

Le portail lit `data/catalogue.json`, `data/parcours.json` et
`data/bookmarks.json`. Les manifests décrivent les entrées ; le catalogue
est reconstruit avant utilisation dans un checkout neuf. Les pages de guides
sont accessibles par le lien **Guides**, sans iframe ni backend.

Une iframe sépare les documents et leurs styles. Ce n'est pas une promesse
d'isolation de sécurité complète : le comportement effectif dépend du sandbox,
de l'origine et des validations de messages. Utiliser le SDK et les conventions
existants plutôt qu'inventer un protocole.
Le lecteur permet les références dans un nouvel onglet ; quitter la slide pour
le guide complet dans la fenêtre principale exige une activation utilisateur,
pas une navigation automatique.

### Outils

Un outil peut être `tools/<id>.html` avec son JSON historique, ou un dossier :

```text
tools/<id>/
  index.html
  tool.json
  src/ ou modules locaux (si nécessaire)
  dist/ (si TypeScript, généré)
```

HTML/CSS/JavaScript natifs restent la base. Les imports ESM et chargements
de ressources exigent un service HTTP statique. `file://` n'est utilisable
que pour les versions simples qui n'ont pas ces besoins : ce n'est pas une
garantie générale. Le [kit](contribution-kit.md) fournit un outil directement utilisable.

### Jeux : moteur, client, bot

- **Moteur** : règles pures, sans DOM, réseau ou système de fichiers.
  État sérialisable, actions validées et résultat déterministe.
- **Client** : interface, événements et affichage. GameKit assure les interactions
  prévues avec le portail : disponibilité, pause, préférences et scores.
- **Bot** : joueur automatique recevant la vue du joueur, les actions légales
  et le générateur aléatoire prévu. Ce n'est pas un agent de code.

Même seed et mêmes actions donnent la même partie. Les tests portent sur les
contrats observables : replay, immutabilité, actions illégales et fin de partie.
Les signatures réelles sont définies dans
[les types du moteur](../../lib/types/game-engine.ts), pas dans un exemple simplifié
de cette page.

### Parcours et guides

`epic.json` ordonne les slides et sections ; chaque slide garde son identifiant
et son `slide.json`. Le build valide et agrège les manifests, convertit les
slides Markdown si présentes et produit le catalogue.

Les slides réemploient `slide-base.css` et `slide-utils.js` pour thème, tableaux
et footer. La navigation du viewer conserve URL et progression.
Les guides sont rendus depuis les Markdown de `docs/` dans `docs/site/` :
ne jamais modifier directement ce dossier généré.

### Données et dépendances

Préférences, scores et progression restent dans le navigateur. Le
[guide des données locales](local-data.md) décrit validation et sauvegarde/restauration.

Les principales bibliothèques runtime sont épinglées, vérifiées puis copiées
depuis npm dans `assets/vendor/`. Certains contenus gardent des dépendances
externes : le projet ne promet pas que tous les outils fonctionneront hors réseau.
Voir [les bibliothèques runtime](runtime-libraries.md) et les limites du socle navigateur.

## L'usine logicielle

```text
Demande
  → OpenSpec : proposal / specs / design / tasks
  → skills : contexte et conventions, pas permissions supplémentaires
  → kit : gabarits, composants et exemples
  → implémentation + preuves locales Docker
  → PR + CI + revue humaine
  → main : CI complète → archive testée → Pages → contrôle HTTP
  → décision explicite de synchroniser / archiver après livraison
```

`AGENTS.md` est la source commune. Les skills vivent dans `.github/skills/` ;
`.claude/skills` est un lien vers cette source, pas une seconde copie ni une
installation automatique de commandes slash OPSX.

La publication réutilise les validations et le même artefact testé. Elle ne
crée pas de revue, merge ou release, et ne remplace pas les règles GitHub externes.
Le [guide de l'usine logicielle](software-factory.md) explique les étapes,
les preuves attendues et **les points restant à améliorer**.

## Stack et commandes

| Couche | Choix |
|--------|-------|
| Navigateur | HTML, CSS, JavaScript ESM ; TypeScript optionnel, transpilé avant usage |
| Développement | Node 26 dans Docker ; contrat Node minimum dans `package.json` |
| Build | esbuild, scripts npm, distributions runtime locales |
| Qualité | Jest, Playwright, ESLint, TypeScript, OpenSpec |
| Livraison | GitHub Actions et GitHub Pages |

```bash
make info
make npm CMD="run build:local"  # préparation complète sans collecte OG
make serve                    # URL externe affichée par make info
make typecheck
make test
make test-e2e
```

`make build` construit l'image Docker, pas les catalogues. Le port externe
du worktree est calculé dans la plage 5200–5299 ; 5242 est le port interne.
Les versions, signatures et commandes détaillées restent dans leurs sources
canoniques, sans copie concurrente dans ce guide.

## Voir aussi

- [Usine logicielle](software-factory.md)
- [Workflow OpenSpec](openspec-workflow.md)
- [Skills](project-skills.md)
- [Contribuer](contributing.md)
- [Kit de contribution](contribution-kit.md)
- [Déploiement](../DEPLOYMENT.md)
- [Moteur](create-game-engine.md), [client](create-game-client.md) et [bot](create-bot.md)

Actualisé le 3 octobre 2026.
