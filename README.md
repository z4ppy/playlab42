# Playlab42

Plateforme pédagogique de mini-jeux et outils collaboratifs pour la formation dev assistée par IA.

## Vision

**Playlab42** est une vitrine collaborative de mini-jeux et outils créés pendant des formations. Les participants développent des jeux, des outils et des bots avec l'assistance de l'IA. Le projet s'enrichit au fil des sessions.

### Cas d'usage

- **Utiliser** : Catalogue d'outils et jeux accessibles via navigateur
- **Jouer** : Mini-jeux standalone ou multi-joueur
- **Créer** : Développer ses propres outils/jeux pendant une formation
- **Apprendre** : Support pédagogique pour TypeScript, WebSocket, IA/ML
- **Expérimenter** : Entraîner des bots et réseaux de neurones

## Fonctionnalités principales

| Feature | Description |
|---------|-------------|
| **Catalogue** | Liste des outils et jeux avec recherche/filtres |
| **Tools** | Outils HTML standalone (JSON formatter, encodeurs, etc.) |
| **Games** | Mini-jeux avec moteur isomorphe |
| **Lobby** | Créer ou rejoindre des parties (multi-joueur) |
| **Profils** | Authentification, avatars, scores |
| **Bots** | Interface pour créer des IA joueurs |

## Architecture

### Tools (outils standalone)

Outils simples, un fichier HTML, pas de backend :

```
tools/json-formatter.html    # Tout-en-un, ouvrable directement
```

### Games (jeux autonomes)

Mini-applications avec moteur de règles :

```
games/tic-tac-toe/
├── index.html      # Jouable directement
├── engine.ts       # Moteur isomorphe (pur, déterministe)
└── game.json       # Manifest
```

### Plateforme

```
┌─────────────────────────────────────────────────────────────┐
│                    PLAYLAB42 (statique)                      │
│  Catalogue unifié : Tools + Games                            │
│  [🔧 Outils]  [🎮 Jeux]  [Recherche...]                     │
└─────────────────────────────────────────────────────────────┘
                              │
                         iframe / lien
                              │
┌─────────────────────────────────────────────────────────────┐
│              TOOLS & GAMES AUTONOMES                         │
│  JSON Formatter │ Base64 │ Tic-Tac-Toe │ Snake │ ...        │
└─────────────────────────────────────────────────────────────┘
```

### Backend (optionnel, multi-joueur)

```
┌─────────────────────────────────────────────────────────────┐
│                       BACKEND                                │
│  Auth │ API REST │ WebSocket │ Sessions │ Scores            │
└─────────────────────────────────────────────────────────────┘
```

Le backend est **virtualisable** : mode localStorage pour fonctionner sans serveur.

## Environnement Docker-first

**Tout tourne dans Docker**, rien sur le host :

```bash
# Initialiser (build + up + install)
make init

# Lancer le shell de développement
make shell

# Commandes npm (dans le container)
make npm CMD="install lodash"
make npm CMD="run build"

# Serveur de dev
make dev
```

## Démarrage rapide

```bash
# Cloner et se positionner
cd playlab42

# Initialiser l'environnement Docker
make init

# Lancer Claude Code
make claude

# Créer une nouvelle fonctionnalité
/openspec:proposal
```

## Structure

```
playlab42/
├── tools/              # Outils HTML standalone
│   ├── json-formatter.html
│   └── base64-encoder.html
├── games/              # Jeux autonomes
│   ├── tic-tac-toe/
│   │   ├── index.html
│   │   ├── engine.ts
│   │   └── game.json
│   └── snake/
├── src/
│   ├── core/           # Types partagés, SDK, utilitaires
│   ├── platform/       # Catalogue, lobby (optionnel)
│   └── server/         # Backend multi-joueur (optionnel)
├── docs/               # Documentation
├── openspec/           # Spécifications et changes
└── .claude/            # Configuration Claude Code
```

## Documentation

- [Features MVP](./docs/FEATURES.md) - Liste complète des fonctionnalités
- [Concepts](./docs/CONCEPTS.md) - Définitions et glossaire
- [Guide création d'outil](./docs/guides/create-tool.md) - Créer un tool
- [Guide création de jeu](./docs/guides/create-game.md) - Créer un game

## Le "42"

Référence à Douglas Adams : la réponse à la grande question sur la vie, l'univers et le reste.

---

*Projet collaboratif - BU DAP*
