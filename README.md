# Playlab42

Plateforme pédagogique de mini-jeux collaboratifs pour la formation dev assistée par IA.

## Vision

**Playlab42** est une vitrine collaborative de mini-jeux créés pendant des formations. Les participants développent des jeux, des interfaces et des bots avec l'assistance de l'IA. Le projet s'enrichit au fil des sessions.

### Cas d'usage

- **Jouer** : Catalogue de mini-jeux accessibles via navigateur
- **Créer** : Développer son propre jeu pendant une formation
- **Apprendre** : Support pédagogique pour TypeScript, WebSocket, IA/ML
- **Expérimenter** : Entraîner des bots et réseaux de neurones

## Fonctionnalités principales

| Feature | Description |
|---------|-------------|
| **Catalogue** | Liste des jeux disponibles avec recherche/filtres |
| **Lobby** | Créer ou rejoindre des parties, spectateurs |
| **Multijoueur** | WebSocket temps réel et tour par tour |
| **Profils** | Authentification, avatars, scores |
| **Bots** | Interface pour créer des IA joueurs |
| **Entraînement ML** | Mode accéléré pour entraîner des modèles |

## Architecture

### Jeux autonomes

Chaque jeu est une **mini-application autonome** jouable directement :

```
games/tic-tac-toe/
├── index.html      # Double-clic = ça marche !
├── engine.ts       # Moteur de règles (pur, isomorphe)
└── game.json       # Manifest pour la plateforme
```

### Plateforme (optionnelle)

```
┌─────────────────────────────────────────────────────────────┐
│                      PLATEFORME                              │
│  Catalogue │ Lobby │ Profils │ Scores │ Multi-joueur        │
└─────────────────────────────────────────────────────────────┘
                              │
                         iframe + SDK
                              │
┌─────────────────────────────────────────────────────────────┐
│                    JEUX AUTONOMES                            │
│  Tic-Tac-Toe │ Snake │ Poker │ ... (standalone ou connecté) │
└─────────────────────────────────────────────────────────────┘
```

### Backend (multi-joueur)

```
┌─────────────────────────────────────────────────────────────┐
│                       BACKEND                                │
│  Auth │ API REST │ WebSocket │ Sessions │ Scores            │
└─────────────────────────────────────────────────────────────┘
```

Le backend est **virtualisable** : mode localStorage pour jouer sans serveur.

## Méthodologie

Le développement suit le workflow **OpenSpec** :

1. **Proposal** : Décrire le changement avant de coder
2. **Apply** : Implémenter selon le plan validé
3. **Archive** : Documenter après déploiement

Voir `openspec/AGENTS.md` pour les détails.

## Démarrage rapide

```bash
# Cloner et se positionner
cd playlab42

# Initialiser l'environnement
make init

# Lancer Claude Code
make claude

# Créer une nouvelle fonctionnalité
/openspec:proposal
```

## Structure

```
playlab42/
├── games/              # Jeux autonomes (jouables directement)
│   ├── tic-tac-toe/
│   │   ├── index.html  # Point d'entrée standalone
│   │   ├── engine.ts   # Moteur isomorphe
│   │   └── game.json   # Manifest
│   └── snake/
├── src/
│   ├── core/           # Types partagés, SDK, utilitaires
│   ├── platform/       # Shell, catalogue, lobby (optionnel)
│   └── server/         # Backend multi-joueur (optionnel)
├── docs/               # Documentation
├── openspec/           # Spécifications et changes
└── .claude/            # Configuration Claude Code
```

## Documentation

- [Features MVP](./docs/FEATURES.md) - Liste complète des fonctionnalités
- [Concepts](./docs/CONCEPTS.md) - Définitions et glossaire
- [Guide création de jeu](./docs/guides/create-game.md) - Tutoriel pas à pas
- [Référence SDK](./docs/reference/sdk.md) - API client
- [Référence Game Engine](./docs/reference/game-engine.md) - Interface moteur

## Le "42"

Référence à Douglas Adams : la réponse à la grande question sur la vie, l'univers et le reste.

---

*Projet collaboratif - BU DAP*
