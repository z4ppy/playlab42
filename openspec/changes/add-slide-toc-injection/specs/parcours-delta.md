# Delta Spec: Parcours - Communication slide ↔ viewer

> Ajout à `openspec/specs/parcours/spec.md`

---

## ADDED Section: 14. Communication slide ↔ viewer

Les slides chargées dans l'iframe peuvent communiquer avec le viewer parent via `postMessage`.

### 14.1 Protocole

#### Messages slide → viewer

| Type | Payload | Description |
|------|---------|-------------|
| `slide:toc` | `{ items: TocItem[] }` | Envoie la table des matières interne |
| `slide:toc:clear` | - | Efface la TOC (optionnel, auto au changement) |

#### Messages viewer → slide

| Type | Payload | Description |
|------|---------|-------------|
| `viewer:scroll-to` | `{ anchor: string }` | Demande de scroller vers une ancre |

### 14.2 Format TocItem

```typescript
interface TocItem {
  /** Identifiant de l'ancre (ex: "intro", "backprop") */
  id: string;

  /** Texte affiché dans la navigation (tronqué si trop long) */
  label: string;

  /** Emoji optionnel */
  icon?: string;

  /** Niveau de profondeur (1 = h2, 2 = h3) */
  level?: number;
}
```

### 14.3 Limites

| Limite | Valeur | Raison |
|--------|--------|--------|
| Max items TOC | 15 | Éviter surcharge du menu |
| Troncature labels | CSS `text-overflow: ellipsis` | Corrigé par redimensionnement |
| Niveaux max | 2 (h2, h3) | Limiter la profondeur |

### 14.4 API slide-utils.js

```typescript
/**
 * Envoie la table des matières interne au viewer.
 * La TOC sera affichée dans le menu latéral comme enfants de la slide.
 *
 * @example
 * import { sendTOC } from '../../../../../parcours/_shared/slide-utils.js';
 *
 * sendTOC([
 *   { id: 'intro', label: 'Introduction', icon: '🎯' },
 *   { id: 'neuron', label: 'Le Neurone', icon: '⚡' },
 *   { id: 'backprop', label: 'Backpropagation', icon: '⬅️' },
 *   { id: 'lab', label: 'Laboratoire', icon: '🧪' }
 * ]);
 */
function sendTOC(items: TocItem[]): void;

/**
 * Efface la TOC du viewer.
 * Appelé automatiquement au changement de slide.
 */
function clearTOC(): void;

/**
 * Détecte automatiquement la TOC depuis les headings.
 *
 * @param selector - Sélecteur CSS pour les headings (défaut: 'h2[id], h3[id]')
 * @returns Liste d'items détectés
 *
 * @example
 * import { autoDetectTOC, sendTOC } from '...';
 *
 * // Détection automatique des h2 avec id
 * sendTOC(autoDetectTOC());
 */
function autoDetectTOC(selector?: string): TocItem[];
```

### 14.5 Comportement viewer

#### Intégration dans le menu latéral

La TOC de la slide s'intègre dans le **menu latéral existant** comme sous-nœuds :

```
Menu (sidebar) :
├── ✓ Slide 1
├── ▼ ● Slide 2 (avec TOC)      ← slide courante, expandable
│   ├── ○ Intro                  ← ancres intra-slide
│   ├── ○ Chapitre 1
│   ├── ● Chapitre 2             ← ancre active
│   └── ○ Conclusion
└── ○ Slide 3

Légende :
● = actif (slide ou ancre visible)
○ = non visité / non actif
✓ = slide visitée
▼ = section/slide expandée
```

#### Comportement

- Quand une slide envoie `slide:toc`, elle devient **expansible** dans le menu
- Les items TOC apparaissent comme **enfants** de la slide
- La slide est automatiquement **dépliée** pour montrer ses ancres
- Clic sur un item → envoie `viewer:scroll-to` à la slide
- La slide scrolle vers l'ancre avec `scrollIntoView({ behavior: 'smooth' })`

#### Reset

- Au changement de slide, les sous-items TOC sont **retirés** du menu
- L'ancienne slide redevient un item simple (non expansible)
- La nouvelle slide peut envoyer sa propre TOC

### 14.6 Sécurité

- Vérification de l'origine des messages (même origin)
- Validation du format des payloads
- Pas d'exécution de code arbitraire

---

## UPDATED Section: 10. Responsive

### Desktop : Menu redimensionnable

```
┌──────────────────┬─║─────────────────────────────────────────┐
│ Sidebar          │ ║ Contenu                                  │
│ (200-400px)      │ ║                                          │
│                  │ ║  Drag la bordure pour redimensionner     │
└──────────────────┴─║─────────────────────────────────────────┘
                     ↑
                  Resize handle
```

**Comportement** :
- Bordure droite de la sidebar draggable
- Largeur min: 200px, max: 400px
- Curseur `col-resize` au survol du handle
- Largeur persistée en `localStorage` (`parcours-menu-width`)
- Restaurée au prochain chargement

**Implémentation CSS** :
```css
.pv-resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.2s;
}
.pv-resize-handle:hover,
.pv-resize-handle.dragging {
  background: var(--color-accent);
}
```

### Mobile : Drawer latéral (V1)

Utilise le drawer existant, sans modification majeure.

**Comportement** :
- Ouverture : clic sur ☰
- Fermeture : clic backdrop ou sélection item
- La TOC s'affiche dans le drawer existant comme sous-items

**Note** : Un bottom sheet avec swipe pourra être ajouté dans une version ultérieure.

---

## Note sur StructureNode

La structure `parcours.json` n'est pas modifiée pour la V1.
Les TOC sont uniquement dynamiques via `postMessage` depuis les slides HTML.

**Évolution future** : Une propriété `toc?: TocItem[]` pourrait être ajoutée à StructureNode pour les slides Markdown (extraction au build).

---

## UPDATED Section: 12. Structure des fichiers

Ajouter dans `parcours/_shared/` :

```
parcours/_shared/
├── slide-base.css
├── slide-utils.js          # Utilitaires + API TOC
└── slide-utils.test.js     # Tests unitaires
```
