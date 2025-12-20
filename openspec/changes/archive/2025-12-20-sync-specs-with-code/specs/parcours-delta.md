# Parcours Spec - Delta

> Modifications à apporter à `openspec/specs/parcours/spec.md`

## Section à ajouter : Architecture modulaire

Ajouter après la section "12. Structure des fichiers" :

---

## 13. Architecture du Viewer

Le viewer de parcours utilise une architecture modulaire pour séparer les responsabilités.

### Vue d'ensemble

```
lib/
├── parcours-viewer.js          # Orchestrateur principal
└── parcours/
    ├── ParcoursProgress.js     # Gestion de la progression
    ├── ParcoursNavigation.js   # Navigation entre slides
    └── ParcoursUI.js           # Rendu HTML
```

### ParcoursViewer (orchestrateur)

Classe principale qui coordonne les trois modules.

```typescript
class ParcoursViewer {
  private progress: ParcoursProgress;
  private navigation: ParcoursNavigation;
  private ui: ParcoursUI;

  /**
   * Charge un epic et affiche la première slide.
   */
  async load(epicId: string): Promise<void>;

  /**
   * Ferme le viewer et retourne au catalogue.
   */
  close(): void;

  /**
   * Libère les ressources.
   */
  dispose(): void;
}
```

### ParcoursProgress

Gère la progression utilisateur dans les epics.

```typescript
class ParcoursProgress {
  /**
   * Marque une slide comme visitée.
   */
  markVisited(epicId: string, slideId: string): void;

  /**
   * Retourne la liste des slides visitées pour un epic.
   */
  getVisited(epicId: string): string[];

  /**
   * Retourne la dernière slide visitée pour un epic.
   */
  getCurrent(epicId: string): string | null;

  /**
   * Sauvegarde la progression en localStorage.
   */
  save(): void;

  /**
   * Charge la progression depuis localStorage.
   */
  load(): void;
}
```

**Clé localStorage** : `playlab42_parcours_progress`

**Format de stockage** :
```typescript
interface StoredProgress {
  [epicId: string]: {
    visited: string[];
    current: string | null;
  };
}
```

### ParcoursNavigation

Gère la navigation entre slides et les raccourcis clavier.

```typescript
class ParcoursNavigation {
  /**
   * Va à la slide précédente.
   */
  prev(): void;

  /**
   * Va à la slide suivante.
   */
  next(): void;

  /**
   * Va à une slide spécifique.
   */
  goTo(slideId: string): void;

  /**
   * Retourne l'index de la slide courante.
   */
  getCurrentIndex(): number;

  /**
   * Active les raccourcis clavier.
   */
  enableKeyboardNavigation(): void;

  /**
   * Désactive les raccourcis clavier.
   */
  disableKeyboardNavigation(): void;
}
```

**Raccourcis clavier** :
| Touche | Action |
|--------|--------|
| `←` ArrowLeft | Slide précédente |
| `→` ArrowRight | Slide suivante |
| `Home` | Première slide |
| `End` | Dernière slide |
| `m` | Toggle menu latéral |
| `Escape` | Fermer le viewer |

### ParcoursUI

Gère le rendu HTML du viewer.

```typescript
class ParcoursUI {
  /**
   * Rend le conteneur principal du viewer.
   */
  render(): HTMLElement;

  /**
   * Met à jour le contenu de la slide.
   */
  updateSlide(html: string): void;

  /**
   * Met à jour le breadcrumb.
   */
  updateBreadcrumb(epic: Epic, slide: Slide): void;

  /**
   * Met à jour la barre de progression.
   */
  updateProgress(current: number, total: number): void;

  /**
   * Affiche/masque le menu latéral.
   */
  toggleMenu(): void;

  /**
   * Rend le sommaire des slides.
   */
  renderTableOfContents(slides: Slide[], visited: string[]): void;
}
```

### Communication entre modules

```
┌─────────────────────────────────────────────────────────────┐
│                    ParcoursViewer                           │
│                    (orchestrateur)                          │
├─────────────────────────────────────────────────────────────┤
│                          │                                  │
│    ┌─────────────────────┼─────────────────────┐           │
│    │                     │                     │           │
│    ▼                     ▼                     ▼           │
│ ┌──────────┐      ┌──────────────┐      ┌──────────┐      │
│ │ Progress │◄────►│  Navigation  │◄────►│    UI    │      │
│ └──────────┘      └──────────────┘      └──────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- **Progress** notifie Navigation quand la progression change
- **Navigation** notifie UI pour mettre à jour l'affichage
- **UI** notifie Navigation des clics utilisateur
- **ParcoursViewer** coordonne l'initialisation et le cleanup

---

## Section à modifier : Structure des fichiers

Mettre à jour la section "12. Structure des fichiers" pour inclure :

```
lib/
├── parcours-viewer.js          # Viewer de parcours (orchestration)
└── parcours/                   # Modules du viewer
    ├── ParcoursProgress.js     # Gestion progression
    ├── ParcoursNavigation.js   # Navigation slides
    └── ParcoursUI.js           # Rendu HTML
```
