# Proposal: Refactor Deep Learning Slides

> Découper l'article monolithique deep-learning en 7 slides distinctes

---

## Pourquoi

L'article actuel "Deep Learning pour l'impatient" est une slide unique de ~1300 lignes contenant :
- 8 chapitres théoriques
- 1 laboratoire interactif avec ~400 lignes de JavaScript
- ~300 lignes de CSS custom

### Problèmes identifiés

1. **Lab noyé dans le contenu** - Le laboratoire interactif manque d'espace et de visibilité
2. **Navigation difficile** - Malgré la TOC injectée, l'article reste monolithique
3. **Temps de chargement** - Tout est chargé d'un coup (MathJax, Chart.js, TailwindCSS)
4. **Maintenance** - Fichier trop long, difficile à éditer
5. **Progression** - Impossible de suivre l'avancement par chapitre

---

## Quoi

Découper l'article en **7 slides** suivant une progression pédagogique :

| # | Slide ID | Titre | Contenu actuel |
|---|----------|-------|----------------|
| 01 | `introduction` | Introduction | Hero + Chapitre 1 (L'Objectif) |
| 02 | `neurone` | Le Neurone | Chapitre 2 (Anatomie d'un Neurone) |
| 03 | `forward-loss` | Forward & Loss | Chapitres 3-4 (Propagation + Erreur) |
| 04 | `backpropagation` | Rétropropagation | Chapitre 5 |
| 05 | `optimisation` | Optimisation | Chapitre 6 (Gradient + Adam) |
| 06 | `contexte` | Contexte | Chapitres 7-8 (Histoire + Pièges) |
| 07 | `laboratoire` | Laboratoire | Section Lab (plein écran) |

### Structure cible

```
parcours/epics/deep-learning-intro/
├── epic.json                    # Mise à jour avec 7 slides
├── thumbnail.svg
├── _shared/                     # Nouveau : styles/scripts partagés
│   ├── deep-learning.css        # Styles communs extraits
│   └── neural-network.js        # Classe DeepNeuralNetwork extraite
└── slides/
    ├── 01-introduction/
    │   └── index.html
    ├── 02-neurone/
    │   └── index.html
    ├── 03-forward-loss/
    │   └── index.html
    ├── 04-backpropagation/
    │   └── index.html
    ├── 05-optimisation/
    │   └── index.html
    ├── 06-contexte/
    │   └── index.html
    └── 07-laboratoire/
        └── index.html           # Lab en plein écran
```

---

## Bénéfices

1. **Lab isolé** - Plus d'espace, expérience immersive, chargement à la demande
2. **Progression visible** - 7 étapes dans le menu latéral
3. **Performance** - Chaque slide charge uniquement ses dépendances
4. **Maintenance** - Fichiers plus courts (~150-200 lignes chacun)
5. **TOC par slide** - Chaque slide peut avoir sa propre TOC interne si besoin

---

## Impact

### Fichiers modifiés

| Fichier | Action |
|---------|--------|
| `parcours/epics/deep-learning-intro/epic.json` | Mise à jour structure |
| `parcours/epics/deep-learning-intro/slides/01-retropropagation/` | Supprimé |
| `parcours/epics/deep-learning-intro/slides/01-introduction/` | Nouveau |
| `parcours/epics/deep-learning-intro/slides/02-neurone/` | Nouveau |
| `parcours/epics/deep-learning-intro/slides/03-forward-loss/` | Nouveau |
| `parcours/epics/deep-learning-intro/slides/04-backpropagation/` | Nouveau |
| `parcours/epics/deep-learning-intro/slides/05-optimisation/` | Nouveau |
| `parcours/epics/deep-learning-intro/slides/06-contexte/` | Nouveau |
| `parcours/epics/deep-learning-intro/slides/07-laboratoire/` | Nouveau |
| `parcours/epics/deep-learning-intro/_shared/` | Nouveau (styles partagés) |

### Specs impactées

Aucune modification de spec requise - il s'agit d'un refactoring de contenu.

---

## Risques

| Risque | Mitigation |
|--------|------------|
| Duplication CSS | Extraire dans `_shared/deep-learning.css` |
| Lab cassé après extraction | Tester le lab en isolation |
| Liens internes cassés | Pas de liens internes dans l'article actuel |

---

## Estimation

- **Complexité** : Moyenne
- **Fichiers** : ~10 nouveaux fichiers
- **Temps** : ~30 min d'implémentation

---

*Proposal créée le 2025-12-23*
