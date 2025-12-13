# Proposal: add-parcours-system

## Résumé

Ajouter un système de contenus pédagogiques "Parcours" à Playlab42, permettant de créer et naviguer dans des collections de slides éducatives organisées en Epics. 100% statique, compatible GitHub Pages.

## Motivation

### Contexte

Playlab42 est une plateforme de formation assistée par IA. Actuellement, elle propose des outils et des jeux, mais il manque un système structuré pour délivrer du contenu pédagogique.

### Objectifs

- Permettre la création de **contenus pédagogiques** (slides, tutoriels)
- Organiser ces contenus en **parcours d'apprentissage** (Epics)
- Offrir une **navigation fluide** avec raccourcis clavier et menu latéral
- Supporter une **taxonomie duale** : hiérarchie + tags
- **Suivre la progression** de l'utilisateur (localStorage)
- Rester **100% statique** : compatible GitHub Pages, hash routing

### Cas d'usage

1. **Formateur** : Crée des Epics de slides pour expliquer un concept
2. **Apprenant** : Parcourt les slides, voit sa progression
3. **Curieux** : Explore le catalogue par thèmes/tags

## Concepts clés

### Epic

Collection ordonnée de slides formant un parcours cohérent.
- Unité de publication dans le catalogue
- Contient 1 à N slides, organisées en sections optionnelles
- Possède ses métadonnées (titre, auteur, vignette, etc.)
- Placé dans une hiérarchie de catégories
- Taggé pour le filtrage

### Slide

Unité de contenu au sein d'un epic.
- N'existe pas seule dans le catalogue
- Types : `page` (HTML/MD), `image`, `interactive`
- Chaque slide a son dossier avec `slide.json` + `index.html/md`

### Hiérarchie

Arborescence de catégories pour l'exploration.
- Dynamique : nœuds avec < 3 epics → absorbés dans "autres"
- MVP : `playlab42` et `autres` uniquement

### Tags

Labels plats pour le filtrage transversal.
- Traversent toute la hiérarchie
- Agrégés au build avec compteurs

## Changements proposés

### 1. Structure des fichiers

```
parcours/
├── index.json                  # Config globale (featured, taxonomy)
├── _shared/                    # Assets partagés globaux
│   ├── slide-base.css
│   └── slide-utils.js
└── epics/
    └── hello-playlab42/
        ├── epic.json           # Manifest de l'Epic
        ├── thumbnail.png       # Vignette
        ├── assets/             # Médias de l'Epic
        │   ├── images/
        │   ├── videos/
        │   └── audio/
        └── slides/
            ├── 01-bienvenue/
            │   ├── slide.json  # Manifest de la slide
            │   ├── index.html  # Contenu
            │   └── assets/     # Médias locaux (optionnel)
            └── 02-premier-pas/
                ├── slide.json
                └── index.md
```

### 2. Format Epic (`epic.json`)

```json
{
  "id": "guide-contribution",
  "title": "Guide de Contribution",
  "description": "Apprenez à contribuer à PlayLab42.",
  "hierarchy": ["playlab42"],
  "tags": ["howto", "contribution"],
  "metadata": {
    "author": "cyrille",
    "created": "2025-01-15",
    "duration": "30 min",
    "difficulty": "beginner"
  },
  "icon": "📖",
  "thumbnail": "thumbnail.png",
  "content": [
    {
      "id": "intro",
      "title": "Introduction",
      "icon": "👋",
      "content": [
        { "id": "bienvenue" },
        { "id": "prerequis" }
      ]
    },
    {
      "id": "creation",
      "title": "Créer du contenu",
      "icon": "✏️",
      "content": [
        { "id": "creer-outil" },
        { "id": "creer-jeu" }
      ]
    }
  ],
  "references": {
    "prerequisites": [],
    "next": [],
    "related": ["hello-playlab42"]
  }
}
```

### 3. Format Slide (`slide.json`)

```json
{
  "id": "bienvenue",
  "title": "Bienvenue",
  "type": "page",
  "duration": "5 min",
  "icon": "👋"
}
```

### 4. Configuration globale (`index.json`)

```json
{
  "taxonomy": {
    "threshold": 3,
    "hierarchy": [
      { "id": "playlab42", "label": "PlayLab42", "icon": "🎮", "order": 1 },
      { "id": "autres", "label": "Autres", "icon": "📚", "order": 99 }
    ],
    "tagLabels": {
      "howto": "Tutoriels",
      "debutant": "Débutant"
    }
  },
  "featured": {
    "showRecent": true,
    "recentCount": 3,
    "sections": [
      {
        "id": "getting-started",
        "title": "Pour commencer",
        "icon": "🚀",
        "epics": ["hello-playlab42", "guide-contribution"]
      }
    ]
  }
}
```

### 5. Page d'accueil Parcours

```
┌─────────────────────────────────────────────────────────────────┐
│  🧭 Parcours (actif)  │  🛠️ Outils  │  🎮 Jeux                 │
├─────────────────────────────────────────────────────────────────┤
│  🔍 Rechercher...                                               │
│                                                                  │
│  ─── ⭐ MIS EN AVANT ──────────────────────────────────────────│
│  [Hello PlayLab42] [Guide Contribution] [Créer un jeu]         │
│                                                                  │
│  ─── 📁 EXPLORER ──────────────────────────────────────────────│
│  [🎮 PlayLab42 (3)] [📚 Autres (8)]                            │
│                                                                  │
│  ─── 🕐 RÉCENTS ───────────────────────────────────────────────│
│  [Epic récent 1] [Epic récent 2] [Epic récent 3]               │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Navigation dans un Epic

```
┌─────────────────────────────────────────────────────────────────┐
│ [← Catalogue]  [☰]  Guide Contribution           2/8  ▓▓░░░░░░ │
├────────────────────┬────────────────────────────────────────────┤
│ 📑 Sommaire        │  Breadcrumb: Introduction > Prérequis      │
│                    │                                            │
│ ▼ 👋 Introduction  │  ┌────────────────────────────────────┐   │
│   ├─ ✓ Bienvenue   │  │         CONTENU SLIDE              │   │
│   └─ ● Prérequis   │  └────────────────────────────────────┘   │
│                    │                                            │
│ ▶ ✏️ Créer contenu │                                            │
│                    ├────────────────────────────────────────────┤
│ Progression: 25%   │ [← Bienvenue]          [Créer contenu →]   │
└────────────────────┴────────────────────────────────────────────┘

Légende menu: ✓ visitée, ● active, ○ non visitée
```

### 7. URLs (hash routing pour GitHub Pages)

```
/#/parcours/                          # Catalogue
/#/parcours/{epicId}/                 # Epic (première slide)
/#/parcours/{epicId}/{slideId}        # Slide spécifique
```

### 8. Raccourcis clavier

| Touche | Action |
|--------|--------|
| `←` | Slide précédente |
| `→` | Slide suivante |
| `Escape` | Fermer menu / retour catalogue |
| `m` | Toggle menu |
| `Home` | Première slide |
| `End` | Dernière slide |

### 9. Build system

Script `build:parcours` qui :
- Scanne `parcours/epics/*/epic.json`
- Valide manifests et slides
- Applique threshold hiérarchie (>= 3 epics)
- Agrège tags avec compteurs
- Génère `data/parcours.json`

## Impact

| Fichier | Changement |
|---------|------------|
| `index.html` | Ajout onglet Parcours, templates (epic-card, category-card) |
| `app.js` | Gestion onglet Parcours, hash routing, recherche |
| `style.css` | Styles cartes, sections featured, récents |
| `parcours/` | Nouveau dossier structure complète |
| `parcours/index.json` | Configuration globale |
| `lib/parcours-viewer.js` | Viewer avec menu, navigation, progression |
| `lib/parcours-viewer.css` | Styles viewer, menu sidebar/drawer |
| `lib/parcours-slide.css` | Styles communs slides |
| `data/parcours.json` | Catalogue généré |
| `scripts/build-parcours.js` | Script de build |
| `package.json` | Script build:parcours |
| `docs/guides/create-epic.md` | Documentation |

## Specs impactées

### Nouvelle spec

- `openspec/specs/parcours/spec.md` - Spécification complète

### Specs existantes

- `openspec/specs/portal/spec.md` - Ajout onglet Parcours
- `openspec/specs/catalogue/spec.md` - Extension pour Parcours

## Contraintes techniques

| Contrainte | Solution |
|------------|----------|
| GitHub Pages (pas de serveur) | 100% statique, JS côté client |
| Pas de rewrite URL | Hash routing (`/#/parcours/...`) |
| Pas de build dynamique | Catalogue pré-généré |

### Performance

| Métrique | Cible |
|----------|-------|
| First paint | < 1s |
| Catalogue chargé | < 2s |
| Navigation slide | < 200ms |

### Tailles

| Élément | Limite |
|---------|--------|
| Vignette | 400x300px, < 100KB |
| Image | < 500KB |
| Vidéo | < 10MB |
| Audio | < 5MB |
| Total Epic | < 50MB |
| Catalogue JSON | < 500KB |

## Risques

- **Faible** : Ajout pur, pas de breaking changes
- Nécessite documentation pour créer des Epics

## Non-objectifs (MVP)

- Pas d'éditeur WYSIWYG de slides
- Pas de création/édition en ligne (consultation uniquement)
- Pas de système de quiz/évaluation
- Pas de synchronisation serveur de la progression
- Pas de conversion Markdown au runtime (build only)

## Évolutions futures

| MVP | Futur |
|-----|-------|
| HTML + Markdown | Svelte components |
| localStorage | Backend sync |
| Hash routing | History API (avec serveur) |
| Recherche client | Index full-text |
| 2 catégories | Hiérarchie riche |
| Progression locale | Badges, gamification |

## Statut

- [x] Implémenté et déployé le 2025-12-13
- Commit: eb741a1 - "Ajout du système de parcours pédagogiques (MVP)"
