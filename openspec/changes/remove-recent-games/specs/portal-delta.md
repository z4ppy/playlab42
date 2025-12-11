# Delta: portal/spec.md

## MODIFIED Requirements

### Requirement: Recent Games (modifié)

**Avant:**
> The system SHALL track recently played games.

**Après:**
> The system SHALL track recently played games in localStorage for future use, but the UI display is disabled.

#### Scenario: Play a game
- **WHEN** a game is launched
- **THEN** it is added to the `recent_games` localStorage entry
- **AND** no UI section is displayed (désactivé temporairement)

---

## MODIFIED Screens

### Catalog (Home) - Wireframe mis à jour

```
┌─────────────────────────────────────────────────────────────┐
│  PLAYLAB42                                      [⚙ Settings] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┬──────────────┐                            │
│  │   🔧 Outils  │    🎮 Jeux   │  ← Onglets                 │
│  └──────────────┴──────────────┘                            │
│                                                              │
│  [Recherche: ___________]                                    │
│                                                              │
│  Filtres: [Tous] [Tag1] [Tag2] [Tag3]                       │
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  thumb  │ │  thumb  │ │  thumb  │ │  thumb  │           │
│  │─────────│ │─────────│ │─────────│ │─────────│           │
│  │ Item 1  │ │ Item 2  │ │ Item 3  │ │ Item 4  │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                              │
│  [Pseudo: Player1]                                           │
└─────────────────────────────────────────────────────────────┘
```

Note: La section "Joué récemment" a été retirée du wireframe.

---

## Storage Keys (inchangé)

| Key | Content | Description |
|-----|---------|-------------|
| `recent_games` | `["snake", ...]` | Recent game slugs (conservé pour usage futur) |

Le tracking reste actif même si l'affichage est désactivé.
