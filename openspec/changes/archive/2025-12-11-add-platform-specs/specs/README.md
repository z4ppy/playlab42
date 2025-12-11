# Specs Delta - add-platform-specs

Cette proposal crée les spécifications techniques fondamentales du projet (version standalone).

## Scope

**Version standalone** : Tools et games autonomes uniquement, pas de backend.

## Specs à créer

| Spec | Chemin final | Description |
|------|--------------|-------------|
| Platform | `openspec/specs/platform/spec.md` | Architecture, stack, modes (standalone) |
| Catalogue | `openspec/specs/catalogue/spec.md` | Base de données JSON des tools/games |
| SeededRandom | `openspec/specs/seeded-random/spec.md` | Générateur aléatoire |
| GameEngine | `openspec/specs/game-engine/spec.md` | Interface moteur de jeu |
| Bot | `openspec/specs/bot/spec.md` | Interface Bot (IA) et configuration slots |
| Manifests | `openspec/specs/manifests/spec.md` | Formats tool.json, game.json |
| Portal | `openspec/specs/portal/spec.md` | Interface utilisateur du portail |
| GameKit | `openspec/specs/gamekit/spec.md` | SDK pour les jeux |

## Specs reportées (version avec backend)

| Spec | Raison |
|------|--------|
| SDK | `openspec/specs/sdk/spec.md` | Nécessite backend |
| WebSocket | `openspec/specs/websocket/spec.md` | Nécessite backend |

## Format des specs

Chaque spec suit le format :

```markdown
# [Nom] Specification

## Overview
Description générale

## Requirements

### Requirement: [Nom]
The system SHALL [comportement].

#### Scenario: [Nom]
- **WHEN** [condition]
- **THEN** [résultat]

## Interface
\`\`\`typescript
// Définition TypeScript
\`\`\`

## Examples
Exemples concrets d'utilisation
```

## Après archivage

Ces specs seront déplacées vers `openspec/specs/` lors de l'archivage.
