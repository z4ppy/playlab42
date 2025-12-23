# Delta: parcours/spec.md

> Ajout d'une section Glossaire à la spécification Parcours.

---

## ADDED: Section 15. Glossaire

### 15.1 Concepts

Le glossaire permet de définir des termes techniques qui seront affichés au survol dans les slides.

**Niveaux de définition :**
- **Global** : `parcours/glossary.json` - Termes partagés entre tous les epics
- **Epic** : `epic.json` (champ `glossary`) ou `glossary.json` dans le dossier epic

**Priorité** : Epic > Global (l'epic peut redéfinir un terme global)

### 15.2 Format du glossaire

```typescript
interface Glossary {
  [term: string]: GlossaryEntry;
}

interface GlossaryEntry {
  /** Définition courte (affichée dans le tooltip) */
  short: string;

  /** Définition longue (affichée dans la page glossaire) */
  long?: string;

  /** Termes liés */
  see?: string[];

  /** Catégorie pour regroupement */
  category?: string;
}
```

**Exemple :**

```json
{
  "régression": {
    "short": "Prédire une valeur numérique continue",
    "long": "En machine learning, la régression consiste à prédire une valeur numérique continue (prix, température, âge) par opposition à la classification qui prédit des catégories.",
    "see": ["classification"],
    "category": "Machine Learning"
  }
}
```

### 15.3 Fichiers glossaire

**Glossaire global :**
```
parcours/
└── glossary.json    # Optionnel, termes partagés
```

**Glossaire epic (deux options) :**

Option A - Dans `epic.json` :
```json
{
  "id": "mon-epic",
  "title": "Mon Epic",
  "glossary": {
    "terme1": { "short": "..." },
    "terme2": { "short": "..." }
  }
}
```

Option B - Fichier séparé :
```
parcours/epics/mon-epic/
├── epic.json
└── glossary.json    # Glossaire de l'epic
```

### 15.4 Marquage des termes dans les slides

**HTML :**
```html
<!-- Terme simple -->
<dfn>régression</dfn>

<!-- Terme avec texte différent -->
<dfn data-term="régression">régresser</dfn>

<!-- Classe alternative -->
<span class="term" data-term="régression">régression</span>
```

**Markdown (après transformation) :**
```markdown
La [[régression]] consiste à prédire...

<!-- Terme avec texte différent -->
La [[régression|forme régressive]] consiste à...
```

### 15.5 Affichage tooltip

```
Comportement :
1. Terme affiché avec underline pointillé
2. Au hover (desktop) ou tap (mobile) : tooltip apparaît
3. Tooltip contient : terme + définition courte + "voir aussi"
4. Clic sur "Plus" → navigation vers page glossaire (si existe)

Positionnement :
- Par défaut : au-dessus du terme
- Si débordement haut : en-dessous
- Si débordement latéral : ajustement horizontal
```

**Styles :**
```css
dfn, .term {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: var(--color-accent);
  text-underline-offset: 2px;
  cursor: help;
}

.glossary-tooltip {
  position: absolute;
  max-width: 300px;
  padding: 0.75rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
}
```

### 15.6 Page glossaire auto-générée

**Déclaration dans `epic.json` :**
```json
{
  "content": [
    { "id": "01-intro" },
    { "id": "glossaire", "type": "glossary", "optional": true }
  ]
}
```

**Comportement :**
- Le type `glossary` génère automatiquement le contenu
- Pas besoin de créer de fichier `index.html`
- Termes triés alphabétiquement
- Regroupement par catégorie (si définie)
- Liens vers les termes liés ("voir aussi")
- Ancres pour chaque terme (`#term-regression`)

**Template généré :**
```html
<section class="glossary">
  <h2>Glossaire</h2>

  <div class="glossary-category">
    <h3>Machine Learning</h3>

    <dl>
      <dt id="term-classification">Classification</dt>
      <dd>
        <p class="short">Prédire une catégorie parmi plusieurs.</p>
        <p class="long">Tâche de machine learning consistant à...</p>
        <p class="see">Voir aussi : <a href="#term-regression">régression</a></p>
      </dd>

      <dt id="term-regression">Régression</dt>
      <dd>...</dd>
    </dl>
  </div>
</section>
```

### 15.7 Build & Validation

**Chargement au build :**
```
1. Charger parcours/glossary.json (si existe)
2. Pour chaque epic :
   a. Charger epic.glossary ou glossary.json
   b. Fusionner avec global (epic prioritaire)
   c. Stocker dans le catalogue
```

**Validation :**

| Règle | Niveau |
|-------|--------|
| Terme référencé dans `see` existe | Warning |
| Terme marqué dans slide existe dans glossaire | Warning |
| Définition `short` présente | Erreur |
| Définition `short` < 200 caractères | Warning |

**Output `data/parcours.json` :**
```typescript
interface ParcoursEntry {
  // ... champs existants ...

  /** Glossaire de l'epic (fusionné avec global) */
  glossary?: Glossary;

  /** Nombre de termes définis */
  glossaryTermCount?: number;
}
```

### 15.8 API JavaScript

**Module `ParcoursGlossary.js` :**
```typescript
class ParcoursGlossary {
  /**
   * Charge le glossaire pour un epic.
   */
  async load(epicId: string): Promise<Glossary>;

  /**
   * Récupère la définition d'un terme.
   */
  get(term: string): GlossaryEntry | undefined;

  /**
   * Vérifie si un terme est défini.
   */
  has(term: string): boolean;

  /**
   * Liste tous les termes.
   */
  terms(): string[];

  /**
   * Attache les tooltips aux éléments dfn d'un conteneur.
   */
  attachTooltips(container: HTMLElement): void;

  /**
   * Détache les tooltips.
   */
  detachTooltips(): void;
}
```

**Helper `slide-utils.js` :**
```typescript
/**
 * Marque automatiquement les termes du glossaire dans le contenu.
 * @param container - Élément contenant le texte
 * @param terms - Liste des termes à marquer
 */
function markGlossaryTerms(container: HTMLElement, terms: string[]): void;
```

### 15.9 Accessibilité

- Tooltips accessibles au clavier (focus sur le terme)
- `role="tooltip"` et `aria-describedby` pour les lecteurs d'écran
- Animation respecte `prefers-reduced-motion`
- Contraste suffisant pour le underline

### 15.10 Mobile

- Tap sur le terme affiche le tooltip
- Tap ailleurs ferme le tooltip
- Pas de hover (incompatible tactile)
- Tooltip positionné pour éviter le clavier virtuel

---

## MODIFIED: Section 4. Epic & Slides

### Epic Manifest (`epic.json`)

```typescript
interface EpicManifest {
  // ... champs existants ...

  /** Glossaire de l'epic */
  glossary?: Glossary;
}
```

### Slide Manifest (`slide.json`)

```typescript
interface SlideManifest {
  // ... champs existants ...

  /** Type de slide */
  type: "page" | "image" | "interactive" | "glossary";
}
```

---

## MODIFIED: Section 12. Structure des fichiers

```
parcours/
├── index.json
├── glossary.json              # NOUVEAU - Glossaire global (optionnel)
└── epics/
    └── mon-epic/
        ├── epic.json
        ├── glossary.json      # NOUVEAU - Glossaire epic (optionnel)
        └── slides/
```

---

*Delta créé le 2025-12-23*
