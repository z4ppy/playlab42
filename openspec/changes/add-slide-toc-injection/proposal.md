# Proposal: Injection de Table des Matières par les Slides

**Change ID**: `add-slide-toc-injection`
**Auteur**: cyrille
**Date**: 2025-12-23
**Statut**: Draft

---

## Contexte

Certaines slides sont des articles longs avec plusieurs sections internes (chapitres, sous-parties). Actuellement, le viewer de parcours navigue entre les **slides** d'un epic, mais n'a pas connaissance de la structure **interne** d'une slide.

**Exemple concret** : L'article "Deep Learning pour l'impatient" contient 8 chapitres dans une seule slide. L'utilisateur doit scroller manuellement pour naviguer entre les sections.

## Problème

1. **Pas de navigation intra-slide** : Impossible de sauter directement à une section
2. **Pas de visibilité** : L'utilisateur ne voit pas la structure interne de la slide
3. **Navigation custom non-standard** : Chaque slide qui veut cette feature doit implémenter sa propre nav (comme le deep-learning), ce qui crée des incohérences

## Solution proposée

Permettre aux slides d'**injecter leur table des matières** dans le viewer via un protocole de communication `postMessage`.

### Principe

La TOC de la slide s'intègre **dans le menu latéral existant** comme sous-nœuds de la slide courante :

```
┌──────────────────────────────────────────────────────────────┐
│ Viewer                                                        │
│                                                               │
│  ┌─────────────────────┐    ┌──────────────────────────────┐ │
│  │ Sidebar             │    │ Contenu                       │ │
│  │                     │    │                               │ │
│  │ ▼ 📖 Deep Learning  │◄───│ La slide envoie sa TOC       │ │
│  │   ├─ 🎯 Intro       │    │ via sendTOC([...])           │ │
│  │   ├─ ⚡ Neurone     │    │                               │ │
│  │   ├─ ⬅️ Backprop    │    │ Le viewer injecte les items  │ │
│  │   └─ 🧪 Lab         │    │ comme enfants de la slide    │ │
│  │                     │    │                               │ │
│  │ ○ Slide suivante    │    │                               │ │
│  │                     │    │                               │ │
│  └─────────────────────┘    └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Comportement** :
- La slide courante devient **expansible** si elle a une TOC
- Les items TOC apparaissent comme **enfants** de la slide dans le menu
- Clic sur un item → scroll vers l'ancre dans la slide
- Par défaut, le premier item est "actif" (comme la slide se charge au début)

### Messages

| Message | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `slide:toc` | slide → viewer | `{ items: TocItem[] }` | Envoie la TOC au viewer |
| `slide:toc:clear` | slide → viewer | - | Efface la TOC (optionnel, auto au changement) |
| `viewer:scroll-to` | viewer → slide | `{ anchor: string }` | Demande à la slide de scroller |

### Format TocItem

```typescript
interface TocItem {
  id: string;        // ID de l'ancre (#intro, #backprop)
  label: string;     // Texte affiché (tronqué si trop long)
  icon?: string;     // Emoji optionnel
  level?: number;    // Niveau de profondeur (1, 2, 3...)
}
```

### Limites

| Limite | Valeur | Raison |
|--------|--------|--------|
| Max items TOC | 15 | Éviter surcharge du menu |
| Troncature labels | CSS `text-overflow: ellipsis` | Redimensionnable → auto-corrigé |
| Niveaux max | 2 (h2, h3) | Limiter la profondeur |

## Améliorations UX du menu

### Desktop : Menu redimensionnable

```
┌────────────────────┬──────────────────────────────────────────┐
│ Menu               │║│ Contenu                                 │
│                    │║│                                         │
│ ├─ Slide 1         │║│  L'utilisateur peut drag la bordure    │
│ ├─ Slide 2         │║│  pour redimensionner le menu            │
│ │  ├─ Intro        │║│                                         │
│ │  └─ Backprop     │║│                                         │
│                    │║│                                         │
└────────────────────┴──────────────────────────────────────────┘
                      ↑
                   Resize handle (drag)
```

**Comportement** :
- Bordure droite du menu draggable
- Largeur min: 200px, max: 400px
- Largeur sauvegardée en localStorage
- Curseur `col-resize` au survol

### Mobile : Drawer latéral (V1)

```
┌─────────────────────────────────────┐
│ [☰]  Titre slide           2/8 ▓▓░ │
├─────────────────────────────────────┤
│                                     │
│         CONTENU SLIDE               │
│                                     │
├─────────────────────────────────────┤
│ [← Préc]              [Suiv →]      │
└─────────────────────────────────────┘

        ↓ Clic sur ☰ ↓

┌────────────────┬────────────────────┐
│ Menu           │                    │
│                │  Backdrop          │
│ ▼ Deep Learn.  │  (clic = fermer)   │
│   ├─ Intro     │                    │
│   ├─ Neurone   │                    │
│   └─ Backprop  │                    │
│ ○ Slide suiv.  │                    │
│                │                    │
└────────────────┴────────────────────┘
```

**Comportement** :
- Drawer latéral classique (comportement existant)
- Ouverture via bouton ☰
- Fermeture via backdrop ou sélection item
- TOC intégrée dans le drawer existant

---

## Impact

### Fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| `lib/parcours-viewer.js` | Écouter les messages des slides |
| `lib/parcours/ParcoursUI.js` | Injecter les items TOC + resize handle |
| `lib/parcours-viewer.css` | Styles TOC + resize handle + troncature |
| `parcours/_shared/slide-utils.js` | Fonctions `sendTOC()`, `clearTOC()` |
| `openspec/specs/parcours/spec.md` | Documenter le protocole |

### Specs impactées

- **parcours/spec.md** : Ajouter section "Communication slide ↔ viewer"

### Rétrocompatibilité

- **100% rétrocompatible** : Les slides existantes continuent de fonctionner
- **Opt-in** : Seules les slides qui appellent `sendTOC()` affichent une TOC

## Alternatives considérées

### 1. Découper les articles longs en plusieurs slides
- **Avantage** : Pas de nouvelle feature
- **Inconvénient** : Perd la cohérence d'un article, navigation lourde

### 2. Navigation custom dans chaque slide
- **Avantage** : Flexibilité totale
- **Inconvénient** : Incohérence UI, duplication de code, pas intégré au viewer

### 3. Détection automatique des headings
- **Avantage** : Pas de code côté slide
- **Inconvénient** : Complexe (parser HTML dans iframe), moins de contrôle

## Décision

**Solution retenue** : Injection explicite via `sendTOC()` car :
- Contrôle total côté slide sur ce qui apparaît
- Simple à implémenter
- Extensible (on pourrait ajouter des callbacks, highlight, etc.)

---

## Évolutions futures (hors scope V1)

- **Slides Markdown** : Extraction automatique des headings au build
- **Bottom sheet mobile** : Remplacer le drawer par un bottom sheet avec swipe
- **Highlight ancre active** : IntersectionObserver pour suivre la section visible

---

## Références

- Article deep-learning avec nav custom (à migrer)
- `parcours/_shared/slide-utils.js` (existant)
