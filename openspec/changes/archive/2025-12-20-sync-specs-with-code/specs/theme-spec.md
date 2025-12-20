# Theme Specification

> Nouvelle spec à créer dans `openspec/specs/theme/spec.md`

## Overview

Le système de thèmes gère l'apparence visuelle de Playlab42 (clair/sombre). Il :

- Supporte trois modes : DARK, LIGHT, SYSTEM
- Persiste le choix utilisateur en localStorage
- Réagit aux préférences système (`prefers-color-scheme`)
- Notifie les composants via un événement custom

**Fichier** : `lib/theme.js`

## Requirements

### Requirement: Theme Modes

The system SHALL support three theme modes.

#### Scenario: Dark mode
- **WHEN** theme is set to DARK
- **THEN** `data-theme="dark"` is applied to document

#### Scenario: Light mode
- **WHEN** theme is set to LIGHT
- **THEN** `data-theme="light"` is applied to document

#### Scenario: System mode
- **WHEN** theme is set to SYSTEM
- **THEN** theme follows `prefers-color-scheme` media query

### Requirement: Persistence

The system SHALL persist theme preference in localStorage.

#### Scenario: Save preference
- **WHEN** user changes theme
- **THEN** choice is saved to `playlab42_theme` key

#### Scenario: Restore preference
- **WHEN** page loads
- **THEN** saved preference is applied before first paint

### Requirement: System Preference Detection

The system SHALL detect and react to system preference changes.

#### Scenario: System preference change
- **WHEN** user changes OS dark/light mode
- **AND** theme is set to SYSTEM
- **THEN** effective theme updates automatically

### Requirement: Change Notification

The system SHALL notify components of theme changes.

#### Scenario: Theme change event
- **WHEN** effective theme changes
- **THEN** `themechange` CustomEvent is dispatched on window
- **AND** event.detail contains `{ theme, effectiveTheme }`

## Interface

```typescript
/**
 * Modes de thème disponibles.
 */
type ThemeMode = 'dark' | 'light' | 'system';

/**
 * Thème effectif (résolu).
 */
type EffectiveTheme = 'dark' | 'light';

/**
 * Retourne le mode de thème actuel.
 */
function getTheme(): ThemeMode;

/**
 * Définit le mode de thème.
 * @param theme - Le mode à appliquer
 */
function setTheme(theme: ThemeMode): void;

/**
 * Bascule entre dark et light (ignore system).
 */
function toggleTheme(): void;

/**
 * Retourne le thème effectif (résolu depuis system si nécessaire).
 */
function getEffectiveTheme(): EffectiveTheme;

/**
 * Initialise le système de thèmes.
 * À appeler au plus tôt pour éviter le flash.
 */
function initTheme(): void;

/**
 * Enregistre un callback pour les changements de thème.
 * @param callback - Fonction appelée avec le nouveau thème effectif
 * @returns Fonction pour se désinscrire
 */
function onThemeChange(callback: (theme: EffectiveTheme) => void): () => void;
```

## Constantes

```typescript
const THEME_STORAGE_KEY = 'playlab42_theme';
const THEME_MODES = ['dark', 'light', 'system'] as const;
const DEFAULT_THEME: ThemeMode = 'system';
```

## Exemples

### Initialisation précoce (éviter flash)

```html
<head>
  <script>
    // Inline dans le head pour éviter FOUC
    (function() {
      const saved = localStorage.getItem('playlab42_theme');
      const theme = saved || 'system';
      let effective = theme;
      if (theme === 'system') {
        effective = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', effective);
    })();
  </script>
</head>
```

### Utilisation dans un composant

```javascript
import { getEffectiveTheme, onThemeChange } from './lib/theme.js';

// Lire le thème actuel
const theme = getEffectiveTheme(); // 'dark' ou 'light'

// Réagir aux changements
const unsubscribe = onThemeChange((newTheme) => {
  console.log('Thème changé:', newTheme);
  updateComponentStyles(newTheme);
});

// Se désinscrire plus tard
unsubscribe();
```

### Toggle dans l'UI

```javascript
import { toggleTheme, getTheme } from './lib/theme.js';

themeButton.addEventListener('click', () => {
  toggleTheme();
  updateButtonIcon(getTheme());
});
```

## Intégration CSS

```css
/* Variables par thème */
:root[data-theme="light"] {
  --bg-color: #ffffff;
  --text-color: #1a1a2e;
  --accent-color: #6c5ce7;
}

:root[data-theme="dark"] {
  --bg-color: #1a1a2e;
  --text-color: #e0e0e0;
  --accent-color: #a29bfe;
}

/* Utilisation */
body {
  background-color: var(--bg-color);
  color: var(--text-color);
}
```

## Bonnes Pratiques

### ✅ À faire

- Initialiser le thème dans le `<head>` pour éviter le flash
- Utiliser les variables CSS pour tous les styles liés au thème
- Écouter `themechange` pour les composants dynamiques

### ❌ À éviter

- Ne pas utiliser `@media (prefers-color-scheme)` directement en CSS (géré par JS)
- Ne pas stocker le thème ailleurs que dans localStorage
- Ne pas modifier `data-theme` directement (utiliser `setTheme()`)
