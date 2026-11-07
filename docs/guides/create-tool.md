# Créer un Outil HTML

Ce guide vous accompagne dans la création d'un outil HTML standalone pour Playlab42.

## Objectif

Créer un outil simple et autonome qui sera intégré au catalogue du portail.

**Caractéristiques d'un outil :**
- Un seul fichier HTML (tout inclus : CSS + JS)
- Utilise `lib/theme.css` pour les styles et thèmes
- Utilise `lib/dom.js` pour les utilitaires DOM
- Utile et pratique
- Style cohérent avec la plateforme (dark/light)

## Prérequis

- Connaissances de base en HTML, CSS, JavaScript
- Docker installé (`make serve` pour tester)

## Structure d'un outil

Un outil Playlab42 se compose de :

```
tools/
├── mon-outil.html     # L'outil (fichier unique)
└── mon-outil.json     # Métadonnées (optionnel)
```

## Étapes

### 1. Créer le fichier HTML

Créez un fichier `tools/mon-outil.html` avec la structure suivante :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mon Outil - Playlab42</title>
  <link rel="stylesheet" href="../lib/theme.css">
  <style>
    /* Vos styles ici - utilisez les variables CSS */
  </style>
  <script type="module">
    import { initTheme } from '../lib/theme.js';
    initTheme();
  </script>
</head>
<body>
  <!-- Interface ici -->
  <script type="module">
    import { $, on, escapeHtml, debounce } from '../lib/dom.js';
    // Logique ici
  </script>
</body>
</html>
```

### 2. Utiliser les variables CSS du thème

Importez `lib/theme.css` pour avoir accès aux variables de design :

```css
/* Variables disponibles */
--color-bg           /* Fond principal */
--color-bg-secondary /* Fond secondaire */
--color-bg-card      /* Fond des cartes */
--color-text         /* Texte principal */
--color-text-muted   /* Texte secondaire */
--color-accent       /* Couleur d'accent */
--color-accent-hover /* Accent au survol */
--color-success      /* Succès */
--color-error        /* Erreur */
--color-border       /* Bordures */
--space-sm/md/lg/xl  /* Espacements */
--radius-sm/md/lg    /* Rayons de bordure */
--transition-normal  /* Transitions */
--font-family        /* Police système */
--font-mono          /* Police monospace */
```

Le thème (dark/light) est géré automatiquement via `lib/theme.js`.

### 3. Créer le manifest (optionnel mais recommandé)

Créez `tools/mon-outil.json` :

```json
{
  "id": "mon-outil",
  "name": "Mon Outil",
  "description": "Description courte de l'outil",
  "tags": ["utility", "dev"],
  "author": "Votre nom",
  "icon": "🔧",
  "version": "1.0.0"
}
```

**Champs du manifest :**

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `id` | Oui | Identifiant unique (kebab-case) |
| `name` | Oui | Nom affiché |
| `description` | Oui | Description courte |
| `tags` | Non | Tags pour filtrage |
| `author` | Recommandé | Nom de la personne qui a réalisé l'outil, affiché sur sa carte (« Par … ») |
| `icon` | Non | Emoji pour la vignette |
| `version` | Non | Version de l'outil |

### 4. Régénérer le catalogue

```bash
make npm CMD="run build:catalogue"
```

### 5. Tester

```bash
make serve
# Ouvrir http://localhost:3000
```

## Exemple complet : Compteur de mots

Voici un outil simple qui compte les mots et caractères d'un texte.

### `tools/word-counter.html`

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compteur de mots - Playlab42</title>
  <style>
    /* Variables de couleur Playlab42 */
    :root {
      --bg: #1a1a2e;
      --bg-secondary: #16213e;
      --text: #eee;
      --text-muted: #888;
      --accent: #e94560;
      --border: #333;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* En-tête */
    header {
      padding: 1rem;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
    }

    header h1 {
      font-size: 1.25rem;
    }

    header h1 span {
      color: var(--accent);
    }

    /* Zone principale */
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 1rem;
      gap: 1rem;
    }

    /* Zone de texte */
    textarea {
      flex: 1;
      padding: 1rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 1rem;
      resize: none;
      outline: none;
    }

    textarea:focus {
      border-color: var(--accent);
    }

    textarea::placeholder {
      color: var(--text-muted);
    }

    /* Statistiques */
    .stats {
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    .stat {
      background: var(--bg-secondary);
      padding: 1rem 1.5rem;
      border-radius: 8px;
      text-align: center;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: var(--accent);
    }

    .stat-label {
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }

    /* Pied de page */
    footer {
      padding: 0.5rem 1rem;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border);
      font-size: 0.75rem;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <header>
    <h1><span>📝</span> Compteur de mots</h1>
  </header>

  <main>
    <textarea
      id="input"
      placeholder="Tapez ou collez votre texte ici..."
    ></textarea>

    <div class="stats">
      <div class="stat">
        <div class="stat-value" id="words">0</div>
        <div class="stat-label">Mots</div>
      </div>
      <div class="stat">
        <div class="stat-value" id="chars">0</div>
        <div class="stat-label">Caractères</div>
      </div>
      <div class="stat">
        <div class="stat-value" id="chars-no-space">0</div>
        <div class="stat-label">Sans espaces</div>
      </div>
      <div class="stat">
        <div class="stat-value" id="lines">0</div>
        <div class="stat-label">Lignes</div>
      </div>
    </div>
  </main>

  <footer>
    Playlab42 - Compteur de mots
  </footer>

  <script>
    // Éléments DOM
    const inputEl = document.getElementById('input');
    const wordsEl = document.getElementById('words');
    const charsEl = document.getElementById('chars');
    const charsNoSpaceEl = document.getElementById('chars-no-space');
    const linesEl = document.getElementById('lines');

    /**
     * Compte les statistiques du texte
     */
    function countStats() {
      const text = inputEl.value;

      // Mots : séparer par espaces et filtrer les vides
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;

      // Caractères
      const chars = text.length;

      // Caractères sans espaces
      const charsNoSpace = text.replace(/\s/g, '').length;

      // Lignes
      const lines = text ? text.split('\n').length : 0;

      // Mise à jour affichage
      wordsEl.textContent = words;
      charsEl.textContent = chars;
      charsNoSpaceEl.textContent = charsNoSpace;
      linesEl.textContent = lines;
    }

    // Écouter les changements
    inputEl.addEventListener('input', countStats);

    // Focus initial
    inputEl.focus();
  </script>
</body>
</html>
```

### `tools/word-counter.json`

```json
{
  "id": "word-counter",
  "name": "Compteur de mots",
  "description": "Compte les mots, caractères et lignes d'un texte",
  "tags": ["utility", "text"],
  "author": "Playlab42",
  "icon": "📝",
  "version": "1.0.0"
}
```

## Bonnes pratiques

### Structure du code

1. **Un seul fichier** : Tout le CSS et JS dans le HTML
2. **Imports** : Utilisez `lib/theme.css`, `lib/dom.js`, `lib/theme.js`
3. **Responsive** : Fonctionne sur mobile et desktop

### Style

1. **Variables CSS** : Utilisez `var(--color-bg)`, etc. depuis theme.css
2. **Support thèmes** : Les variables s'adaptent automatiquement dark/light
3. **Transitions** : Ajoutez `transition: background-color var(--transition-normal)` pour une transition fluide
4. **Cohérence** : Header avec titre, main, footer
5. **Accessibilité** : Labels, placeholders, contraste

### JavaScript

1. **Utilitaires DOM** : Utilisez `$()`, `on()`, `escapeHtml()` depuis lib/dom.js
2. **Sécurité XSS** : Toujours `escapeHtml()` sur les entrées utilisateur
3. **Commentaires** : En français
4. **Fonctions pures** : Faciles à tester

### Performance

1. **Debounce** : Pour les événements fréquents (input)
2. **Pas de boucles infinies** : Attention aux watchers
3. **Léger** : Pas de bibliothèques lourdes

## Pour aller plus loin

### Ajouter des raccourcis clavier

```javascript
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    saveData();
  }
});
```

### Sauvegarder dans localStorage

```javascript
// Sauvegarder
localStorage.setItem('mon-outil-data', JSON.stringify(data));

// Charger
const saved = localStorage.getItem('mon-outil-data');
if (saved) {
  data = JSON.parse(saved);
}
```

### Charger depuis l'URL

```javascript
const params = new URLSearchParams(window.location.search);
const value = params.get('data');
if (value) {
  inputEl.value = decodeURIComponent(value);
}
```

## Voir aussi

- [Architecture](architecture.md) - Vue d'ensemble
- [JSON Formatter](../../tools/json-formatter.html) - Exemple réel
- [Spec Manifests](../../openspec/specs/manifests/spec.md) - Format des manifests
