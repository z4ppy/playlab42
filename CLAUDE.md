# Playlab42 - Instructions pour Claude Code

## À propos du projet

**Playlab42** est une plateforme pédagogique de mini-jeux et outils collaboratifs pour la formation dev assistée par IA.

### Architecture

| Composant | Description |
|-----------|-------------|
| **Tools** | Outils HTML standalone (un fichier, pas de backend) |
| **Games** | Jeux autonomes (moteur isomorphe, multi-joueur possible) |
| **Core** | Types partagés, SDK optionnel, utilitaires (SeededRandom) |
| **Platform** | Catalogue unifié tools + games (charge en iframe) |
| **Server** | Backend multi-joueur (virtualisable en localStorage) |

### Concepts clés

- **Tool** : Outil HTML standalone (un fichier, ouvrable directement)
- **Game** : Mini-app standalone avec moteur de règles
- **Game Engine** : Moteur isomorphe, TypeScript pur, déterministe, seedé
- **SDK (optionnel)** : `window.playlab` injecté pour le multi-joueur
- **Backend virtualisable** : Mode localStorage (solo) ou serveur (multi)

### Objectif pédagogique

Support de formation où les participants créent des outils et jeux avec assistance IA.
Le projet s'enrichit des contributions de chaque session.

**Qualité code** : Ce projet étant un support de cours, le code doit être exemplaire :
- Bien commenté en français
- Nommage explicite (pas d'abréviations obscures)
- Tests unitaires systématiques
- Types TypeScript exhaustifs

## Environnement Docker-first

**IMPORTANT** : Tout tourne dans Docker, rien sur le host.

```bash
# Initialiser l'environnement
make init

# Shell de développement
make shell

# Commandes npm (dans le container)
make npm CMD="install lodash"
make npm CMD="run test"

# Serveur de dev
make dev
```

**Ne jamais exécuter npm, node, ou autres outils directement sur le host.**

## Workflow OpenSpec

<!-- OPENSPEC:START -->
Toujours ouvrir `@/openspec/AGENTS.md` quand la requête :
- Mentionne planning ou proposals (mots comme proposal, spec, change, plan)
- Introduit nouvelles capabilities, breaking changes, changements d'architecture
- Semble ambiguë et nécessite la spec officielle avant de coder

Utiliser `@/openspec/AGENTS.md` pour apprendre :
- Comment créer et appliquer des propositions de changement
- Format et conventions des specs
- Structure et guidelines du projet
<!-- OPENSPEC:END -->

## Commandes disponibles

- `/openspec:proposal` - Créer une nouvelle proposition
- `/openspec:apply` - Implémenter un changement approuvé
- `/openspec:archive` - Archiver après déploiement

## Conventions

- **Langue** : Commentaires et commits en français
- **Code** : TypeScript strict, fonctions pures quand possible
- **Nommage** : camelCase (variables), PascalCase (types), kebab-case (fichiers)
- **Simplicité** : Préférer solutions simples, éviter over-engineering
- **Isomorphisme** : Les moteurs de jeux doivent tourner client ET serveur
- **Docker-first** : Tout dans le container, rien sur le host

## Stack technique

- TypeScript strict + Node.js 20+
- Jest pour les tests
- Docker pour **tout** l'environnement
- WebSocket pour le temps réel
- OpenSpec pour le workflow

## Structure du projet

```
playlab42/
├── tools/                   # Outils HTML standalone
│   └── [tool-name].html     # Un fichier = un outil
├── games/                   # Jeux autonomes
│   └── [game-id]/
│       ├── index.html       # Point d'entrée standalone
│       ├── engine.ts        # Moteur isomorphe (optionnel si inline)
│       └── game.json        # Manifest
├── src/
│   ├── core/                # Partagé
│   │   ├── types/           # Interfaces communes
│   │   ├── sdk/             # PlayLabSDK (optionnel)
│   │   └── utils/           # SeededRandom, helpers
│   ├── platform/            # Catalogue (optionnel)
│   │   └── index.html       # Liste tools + games
│   └── server/              # Backend (optionnel)
│       ├── api/             # Routes REST
│       ├── ws/              # WebSocket
│       └── sessions/        # Gestion parties
└── docs/                    # Documentation
```

## Références documentation

- `docs/FEATURES.md` - Liste complète des features MVP
- `docs/CONCEPTS.md` - Définitions et glossaire
- `docs/guides/create-tool.md` - Guide création d'outil
- `docs/guides/create-game.md` - Guide création de jeu

## Contexte utilisateur

- Prénom : Cyrille
- Organisation : BU DAP
