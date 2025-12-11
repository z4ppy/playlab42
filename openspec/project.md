# Playlab42 - Conventions du Projet

## Vision

**Playlab42** est une plateforme pédagogique de mini-jeux collaboratifs destinée à :

- **Formation dev assistée par IA** : Les participants créent des jeux pendant les sessions
- **Entraînement de bots** : Interface pour développer et tester des IA joueuses
- **Expérimentation ML** : Mode accéléré pour entraîner des réseaux de neurones
- **Vitrine collaborative** : Le projet s'enrichit des contributions de chaque formation

## Principes directeurs

### Isomorphisme

Les moteurs de jeux doivent tourner **client ET serveur** :
- **Client** : Mode solo, entraînement ML local, debug
- **Serveur** : Multijoueur, anti-triche, ML distant

Contraintes :
- TypeScript pur (pas de dépendances Node ou Browser)
- Pas d'I/O dans le moteur (pas de fetch, fs, DOM)
- État 100% sérialisable JSON
- Fonctions pures et déterministes

### Déterminisme

Chaque partie doit être rejouable exactement :
- Random seedé (pas de `Math.random()` direct)
- Même seed + mêmes actions = même résultat
- Permet replay et analyse ML

### Qualité pédagogique

Ce projet est un **support de cours**, le code doit être exemplaire :
- Commentaires en français, clairs et utiles
- Nommage explicite (pas d'abréviations obscures)
- Tests unitaires systématiques
- Types TypeScript exhaustifs
- README par module

### Simplicité

- Préférer les implémentations simples
- Pas de framework sans justification
- Un fichier jusqu'à preuve du contraire
- Éviter l'over-engineering

### Contribution collaborative

- Le projet s'enrichit des participations de chaque session
- Chaque contribution suit le workflow OpenSpec
- Documentation au fil de l'eau

## Stack technique

| Aspect | Choix |
|--------|-------|
| Langage | TypeScript strict |
| Runtime | Node.js 20+ |
| Tests | Jest |
| Infra | Docker |
| Temps réel | WebSocket |
| Workflow | OpenSpec |

## Conventions de code

### Langue

- Commentaires en français
- Messages de commit en français
- Documentation en français

### Nommage

| Élément | Convention | Exemple |
|---------|------------|---------|
| Variables/fonctions | camelCase | `getPlayerView` |
| Types/classes | PascalCase | `GameEngine` |
| Fichiers | kebab-case | `game-engine.ts` |
| Constantes | SCREAMING_SNAKE | `MAX_PLAYERS` |

### Structure fichiers

```
playlab42/
├── games/                   # Jeux autonomes (priorité)
│   └── [game-id]/
│       ├── index.html       # Point d'entrée standalone (jouable seul)
│       ├── engine.ts        # Moteur isomorphe (optionnel si inline)
│       ├── bot.ts           # Bot exemple (optionnel)
│       └── game.json        # Manifest pour la plateforme
├── src/
│   ├── core/                # Partagé
│   │   ├── types/           # Interfaces communes
│   │   ├── sdk/             # PlayLabSDK (optionnel, pour multi)
│   │   └── utils/           # SeededRandom, helpers
│   ├── platform/            # Shell (optionnel)
│   │   ├── catalog/         # Liste des jeux
│   │   ├── lobby/           # Création/join parties
│   │   └── profile/         # Profil utilisateur
│   └── server/              # Backend (optionnel, pour multi)
│       ├── api/             # Routes REST
│       ├── ws/              # WebSocket
│       └── sessions/        # Gestion parties
└── docs/                    # Documentation
```

**Note** : Les jeux sont en dehors de `src/` car ce sont des apps autonomes.

## Types de jeux supportés

### Tour par tour

- Un joueur joue à la fois
- Timeout par tour configurable
- Action automatique si timeout (skip, forfait, ou défaut)
- Exemples : Tic-Tac-Toe, Échecs, Puissance 4

### Temps réel

- Tous les joueurs jouent simultanément
- Game loop avec tick rate configurable
- Actions bufferisées entre les ticks
- Exemples : Snake, Pong, course

## Modes d'exécution

| Mode | Location | Usage |
|------|----------|-------|
| Solo local | Client | Entraînement, jeu offline |
| Solo serveur | Serveur | Anti-triche, ML distant |
| Multi local | Client | Hot-seat, debug |
| Multi serveur | Serveur | Jeu en ligne |
| Entraînement | Serveur | N parties accélérées bot vs bot |

## Documentation requise

Chaque module doit avoir :
- README expliquant son rôle
- Types bien documentés (JSDoc)
- Tests unitaires
- Exemples d'utilisation

Chaque jeu doit avoir :
- `game.json` (manifest complet)
- README avec règles du jeu
- Au moins un bot exemple
- Tests du moteur
