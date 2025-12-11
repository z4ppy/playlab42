# Playlab42 - Instructions pour Claude Code

## À propos du projet

**Playlab42** est une plateforme pédagogique de mini-jeux collaboratifs pour la formation dev assistée par IA.

### Architecture

| Composant | Description |
|-----------|-------------|
| **Games** | Jeux autonomes (standalone, jouables sans plateforme) |
| **Core** | Types partagés, SDK optionnel, utilitaires (SeededRandom) |
| **Platform** | Shell, catalogue, lobby (charge les jeux en iframe) |
| **Server** | Backend multi-joueur (virtualisable en localStorage) |

### Concepts clés

- **Jeu autonome** : Mini-app standalone (index.html jouable directement)
- **Game Engine** : Moteur de règles isomorphe, TypeScript pur, déterministe, seedé
- **Game Manifest** : Fichier `game.json` (métadonnées, config, options)
- **SDK (optionnel)** : `window.playlab` injecté par la plateforme pour le multi-joueur
- **Backend virtualisable** : Mode localStorage (solo) ou serveur (multi)

### Objectif pédagogique

Support de formation où les participants créent des mini-jeux avec assistance IA.
Le projet s'enrichit des contributions de chaque session.

**Qualité code** : Ce projet étant un support de cours, le code doit être exemplaire :
- Bien commenté en français
- Nommage explicite (pas d'abréviations obscures)
- Tests unitaires systématiques
- Types TypeScript exhaustifs

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

## Stack technique

- TypeScript strict + Node.js 20+
- Jest pour les tests
- Docker pour l'environnement
- WebSocket pour le temps réel
- OpenSpec pour le workflow

## Structure du projet

```
playlab42/
├── games/                   # Jeux autonomes (priorité)
│   └── [game-id]/
│       ├── index.html       # Point d'entrée standalone
│       ├── engine.ts        # Moteur isomorphe (optionnel si inline)
│       └── game.json        # Manifest
├── src/
│   ├── core/                # Partagé
│   │   ├── types/           # Interfaces communes
│   │   ├── sdk/             # PlayLabSDK (optionnel)
│   │   └── utils/           # SeededRandom, helpers
│   ├── platform/            # Shell (optionnel)
│   │   ├── catalog/         # Liste des jeux
│   │   ├── lobby/           # Création/join parties
│   │   └── profile/         # Profil utilisateur
│   └── server/              # Backend (optionnel)
│       ├── api/             # Routes REST
│       ├── ws/              # WebSocket
│       └── sessions/        # Gestion parties
└── docs/                    # Documentation
```

## Références documentation

- `docs/FEATURES.md` - Liste complète des features MVP
- `docs/CONCEPTS.md` - Définitions et glossaire
- `docs/reference/game-engine.md` - Interface GameEngine
- `docs/reference/sdk.md` - API SDK client

## Contexte utilisateur

- Prénom : Cyrille
- Organisation : BU DAP
