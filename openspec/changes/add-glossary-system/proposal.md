# Proposal: add-glossary-system

> Ajouter un système de glossaire aux parcours avec tooltip au survol et page optionnelle.

---

## Pourquoi ?

### Problème constaté

Dans le parcours **deep-learning-intro**, plusieurs termes techniques sont utilisés sans explication préalable :

| Terme | 1ère apparition | Expliqué dans |
|-------|-----------------|---------------|
| Régression | slide 03 | Jamais |
| Classification | slide 03 | Jamais |
| Rétropropagation | slide 01 | slide 05 |
| Gradient | slide 01 | slide 06 |
| Outliers | slide 04 | Jamais |
| Overfitting | slide 01 | slide 07 |

Ce problème est récurrent dans les contenus pédagogiques : on utilise des termes avant de les expliquer, ou on suppose que le lecteur les connaît déjà.

### Solutions actuelles (insatisfaisantes)

1. **Définitions inline** : Alourdit le texte, duplique les définitions
2. **Notes de bas de page** : Casse le flux de lecture
3. **Glossaire en fin d'article** : Le lecteur doit naviguer constamment

### Solution proposée

Un **système de glossaire intégré** qui :
- Affiche les définitions **au survol** (tooltip)
- Marque visuellement les termes définis (underline pointillé)
- Génère optionnellement une **page glossaire** consultable

---

## Quoi ?

### Fonctionnalités

1. **Définition des termes** au niveau epic ou global
2. **Marquage des termes** dans les slides (HTML/Markdown)
3. **Tooltip au survol** avec définition courte
4. **Page glossaire optionnelle** auto-générée
5. **Termes globaux partagés** entre epics

### Format du glossaire

```json
// Dans epic.json
{
  "glossary": {
    "régression": {
      "short": "Prédire une valeur numérique continue",
      "long": "En machine learning, la régression consiste à prédire une valeur numérique continue (prix, température, âge) par opposition à la classification qui prédit des catégories.",
      "see": ["classification"]
    },
    "classification": {
      "short": "Prédire une catégorie parmi plusieurs",
      "long": "Tâche de machine learning consistant à prédire la classe d'appartenance d'une donnée (spam/non-spam, chat/chien, chiffre 0-9).",
      "see": ["régression"]
    }
  }
}
```

Ou fichier séparé `glossary.json` dans l'epic.

### Glossaire global partagé

```
parcours/
├── glossary.json          # Termes partagés (ML, programmation, etc.)
└── epics/
    └── mon-epic/
        └── glossary.json  # Termes spécifiques à l'epic (override possible)
```

### Marquage dans les slides

**HTML :**
```html
<!-- Marquage explicite -->
<dfn>régression</dfn>

<!-- Ou avec attribut pour terme différent du texte -->
<dfn data-term="régression">régresser</dfn>
```

**Markdown :**
```markdown
La *régression*{.term} consiste à prédire une valeur continue.

<!-- Ou syntaxe alternative -->
La [[régression]] consiste à prédire une valeur continue.
```

### Affichage tooltip

```
┌──────────────────────────────────────────────┐
│ La régression̲̲̲̲̲̲̲̲̲̲ consiste à prédire...       │
│            ↓                                  │
│  ┌────────────────────────────────────────┐  │
│  │ Régression                              │  │
│  │ ────────────────────────────────────── │  │
│  │ Prédire une valeur numérique continue. │  │
│  │                                         │  │
│  │ Voir aussi : classification             │  │
│  │ [📖 Plus de détails]                    │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘

Légende :
- Terme souligné en pointillé
- Tooltip apparaît au hover (desktop) ou tap (mobile)
- "Plus de détails" = lien vers page glossaire si elle existe
```

### Page glossaire optionnelle

Déclarée dans `epic.json` :

```json
{
  "content": [
    { "id": "01-intro" },
    { "id": "02-concepts" },
    { "id": "glossaire", "type": "glossary", "optional": true }
  ]
}
```

La slide `glossaire` est auto-générée à partir des définitions :

```
┌─────────────────────────────────────────────┐
│ Glossaire                                    │
├─────────────────────────────────────────────┤
│                                              │
│ Classification                               │
│ Prédire une catégorie parmi plusieurs.       │
│ Tâche de machine learning consistant à...    │
│ → Voir : régression                          │
│                                              │
│ ─────────────────────────────────────────── │
│                                              │
│ Régression                                   │
│ Prédire une valeur numérique continue.       │
│ En machine learning, la régression...        │
│ → Voir : classification                      │
│                                              │
└─────────────────────────────────────────────┘
```

---

## Impact

### Specs impactées

| Spec | Type de changement |
|------|-------------------|
| `parcours/spec.md` | ADDED - Section glossaire |

### Fichiers impactés

| Fichier | Changement |
|---------|------------|
| `parcours/index.json` | Optionnel : glossaire global |
| `parcours/epics/*/epic.json` | Nouveau champ `glossary` |
| `parcours/epics/*/glossary.json` | Nouveau fichier optionnel |
| `lib/parcours/ParcoursGlossary.js` | Nouveau module |
| `lib/parcours-slide.css` | Styles tooltip et termes |
| `scripts/build-parcours.js` | Génération page glossaire |
| `parcours/_shared/slide-utils.js` | Helper pour marquage termes |

### Compatibilité

- **Rétrocompatible** : Les epics sans glossaire fonctionnent normalement
- **Progressive enhancement** : Le glossaire est optionnel à tous les niveaux
- **Mobile** : Tap au lieu de hover pour afficher les tooltips

---

## Hors scope (v1)

- Recherche dans le glossaire
- Multi-langue (un glossaire par langue)
- Import de glossaires externes (Wikipedia, etc.)
- Statistiques d'utilisation des termes

---

## Questions ouvertes

1. **Priorité des définitions** : Epic > Global ? Ou fusion ?
2. **Auto-détection** : Faut-il souligner automatiquement les termes définis, ou exiger un marquage explicite ?
3. **Format Markdown** : Quelle syntaxe ? `*terme*{.term}` ou `[[terme]]` ou autre ?

---

*Proposal créée le 2025-12-23*
