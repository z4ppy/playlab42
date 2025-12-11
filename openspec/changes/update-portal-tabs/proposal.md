# Proposal: update-portal-tabs

## Résumé

Séparer les Tools et Games dans deux sections distinctes du portail avec un système d'onglets, au lieu de les afficher sur une seule page scrollable.

## Motivation

### Problème actuel

Le portail affiche actuellement Tools et Games sur une seule page avec des sections verticales :
- Mélange de deux types de contenus très différents
- L'utilisateur doit scroller pour voir tous les contenus
- Pas de navigation claire entre les deux catégories
- La section "Joué récemment" ne concerne que les jeux mais apparaît avec tout

### Solution proposée

Introduire un système d'onglets en haut du catalogue :
- **Onglet "Jeux"** : Affiche uniquement les games + section "Joué récemment"
- **Onglet "Outils"** : Affiche uniquement les tools

### Bénéfices

- Navigation plus claire et intuitive
- Séparation logique des deux types de contenus
- Moins de scroll nécessaire
- Possibilité d'ajouter des fonctionnalités spécifiques par onglet à l'avenir
- Meilleure expérience mobile

## Scope

### Inclus

- Système d'onglets (Games / Tools)
- Persistance de l'onglet sélectionné (localStorage)
- Adaptation des filtres par onglet
- Mise à jour de la spec portal

### Exclus

- Changement du format catalogue.json
- Modification des autres écrans (game view, settings)

## Impact

### Specs modifiées

| Spec | Modification |
|------|--------------|
| `portal/spec.md` | Ajout système d'onglets, mise à jour wireframes, nouvel état `activeTab` |

### Fichiers impactés

| Fichier | Modification |
|---------|--------------|
| `index.html` | Ajout structure onglets |
| `style.css` | Styles des onglets |
| `app.js` | Logique de navigation entre onglets |

## Design

### Wireframe proposé

```
┌─────────────────────────────────────────────────────────────┐
│  PLAYLAB42                                      [⚙ Settings] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┬──────────────┐                            │
│  │   🔧 Outils  │    🎮 Jeux   │                            │
│  └──────────────┴──────────────┘                            │
│                                                              │
│  [Recherche: ___________]                                    │
│                                                              │
│  Filtres: [Tous] [Arcade] [Puzzle] [Strategy]               │
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  thumb  │ │  thumb  │ │  thumb  │ │  thumb  │           │
│  │─────────│ │─────────│ │─────────│ │─────────│           │
│  │ Snake   │ │ Tetris  │ │ Morpion │ │ Pong    │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                              │
│  ── Joué récemment ──                                        │
│  ┌─────────┐ ┌─────────┐                                    │
│  │ Snake   │ │ Tetris  │                                    │
│  └─────────┘ └─────────┘                                    │
└─────────────────────────────────────────────────────────────┘
```

### État applicatif

```typescript
interface PortalState {
  currentView: "catalog" | "game" | "settings";
  activeTab: "games" | "tools";  // NOUVEAU
  currentGame: string | null;
  preferences: UserPreferences;
  recentGames: string[];
}
```

### Comportement

1. **Onglet par défaut** : "Outils"
2. **Persistance** : L'onglet actif est sauvegardé dans localStorage
3. **Filtres indépendants** : Chaque onglet a ses propres tags de filtrage
4. **Recherche globale** : La recherche s'applique à l'onglet actif
5. **Section récents** : Visible uniquement dans l'onglet "Jeux"

## Questions ouvertes

1. Faut-il des icônes dans les onglets ? → Oui (🎮 / 🔧)
2. Faut-il un compteur d'items par onglet ? → Non (simplicité)
3. Animation de transition entre onglets ? → Fade simple

## Validation

- [ ] Les onglets sont cliquables et changent le contenu
- [ ] L'onglet actif est visuellement distinct
- [ ] Le filtre et la recherche fonctionnent par onglet
- [ ] L'onglet sélectionné persiste au rechargement
- [ ] La section "Joué récemment" n'apparaît que dans Games
- [ ] Responsive : onglets adaptés mobile
