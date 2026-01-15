# Proposal: add-algorithm-complexity-epic

## Résumé

Ajouter une epic pédagogique complète sur **La Complexité Algorithmique** : un guide technique exhaustif couvrant les fondamentaux mathématiques, la notation Big O, les algorithmes de tri et recherche, les structures de données, les algorithmes sur les graphes, la programmation dynamique et les notions avancées (classes de complexité P/NP).

## Motivation

### Contexte

La complexité algorithmique est un **pilier fondamental** de l'informatique. Tout développeur doit maîtriser ces concepts pour :
- Écrire du code performant
- Choisir les bonnes structures de données
- Comprendre pourquoi certains problèmes sont "difficiles"
- Réussir les entretiens techniques (LeetCode, HackerRank, etc.)

### Objectifs

- Fournir une **référence complète et accessible** sur la complexité algorithmique
- Offrir des **visualisations interactives** pour chaque concept clé
- Permettre une **compréhension intuitive** avant les formules mathématiques
- Proposer des **tableaux récapitulatifs** pratiques

### Cas d'usage

1. **Développeur junior** : Acquérir les bases de la complexité et comprendre Big O
2. **Développeur confirmé** : Réviser et approfondir les algorithmes classiques
3. **Préparation entretiens** : Référence rapide des complexités par algorithme
4. **Formateur** : Support pédagogique avec visualisations interactives

## Changements proposés

### Structure de l'Epic

L'article sera découpé en **11 sections** + annexes, chacune correspondant à une slide :

```
parcours/epics/algorithm-complexity/
├── epic.json
├── thumbnail.svg
├── glossary.json            # Glossaire des termes techniques
├── assets/
│   └── images/              # Graphiques, schémas statiques
└── slides/
    ├── 01-introduction/
    │   ├── slide.json
    │   └── index.html
    ├── 02-prerequis-maths/
    │   ├── slide.json
    │   └── index.html
    ├── 03-big-o-notation/
    │   ├── slide.json
    │   └── index.html
    ├── 04-algorithmes-tri/
    │   ├── slide.json
    │   └── index.html
    ├── 05-algorithmes-recherche/
    │   ├── slide.json
    │   └── index.html
    ├── 06-structures-index/
    │   ├── slide.json
    │   └── index.html
    ├── 07-algorithmes-graphes/
    │   ├── slide.json
    │   └── index.html
    ├── 08-programmation-dynamique/
    │   ├── slide.json
    │   └── index.html
    ├── 09-paradigmes-algorithmiques/
    │   ├── slide.json
    │   └── index.html
    ├── 10-notions-avancees/
    │   ├── slide.json
    │   └── index.html
    ├── 11-conclusion/
    │   ├── slide.json
    │   └── index.html
    └── 12-glossaire/
        ├── slide.json
        └── index.html         # Auto-généré
```

### Contenu des slides

| Slide | Titre | Contenu |
|-------|-------|---------|
| 01 | Introduction | Pourquoi mesurer la performance, limites du chronomètre, objectif d'une métrique universelle |
| 02 | Prérequis mathématiques | Logarithmes, puissances, factorielles, croissance des fonctions |
| 03 | Notation Big O | Définition, règles de simplification, complexité temporelle vs spatiale, hiérarchie O(1) à O(n!) |
| 04 | Algorithmes de tri | Tris simples (O(n²)), tris efficaces (O(n log n)), tris hybrides, tris linéaires |
| 05 | Algorithmes de recherche | Séquentielle, dichotomique, interpolation, hachage |
| 06 | Structures d'index | Tables de hachage, BST, arbres B/B+, comparaison Hash vs B-Tree |
| 07 | Algorithmes sur les graphes | Parcours BFS/DFS, plus courts chemins (Dijkstra, Bellman-Ford, Floyd-Warshall), arbres couvrants |
| 08 | Programmation dynamique | Principes, mémoïsation vs bottom-up, exemples (Fibonacci, Knapsack, Levenshtein, LCS, LIS) |
| 09 | Paradigmes algorithmiques | Force brute, glouton, diviser pour régner, backtracking |
| 10 | Notions avancées | Classes P, NP, NP-complet, P=NP?, complexité amortie, notations Omega/Theta |
| 11 | Conclusion | Importance du choix algorithmique, trade-offs, cache/localité/parallélisme |
| 12 | Glossaire | Auto-généré depuis glossary.json |

### Visualisations interactives prévues

Chaque slide comportera des **visualisations interactives** similaires à l'epic Deep Learning :

| Slide | Visualisation |
|-------|---------------|
| 02 | Graphique comparatif des fonctions de croissance (log n, n, n log n, n², 2^n, n!) |
| 03 | Hiérarchie des complexités avec animation |
| 04 | Animation des algorithmes de tri (Bubble, Quick, Merge) |
| 05 | Animation recherche dichotomique |
| 06 | Visualisation arbre B-Tree vs Hash Table |
| 07 | Animation BFS/DFS sur un graphe, Dijkstra |
| 08 | Visualisation mémoïsation (Fibonacci, Knapsack) |

### Workflow de création

**Phase 1 : Template (cette proposal)**
- Créer la structure de fichiers
- Définir l'architecture des slides
- Préparer le répertoire `chapters/` pour le contenu markdown source

**Phase 2 : Rédaction des chapitres**
- Chaque chapitre est rédigé en **Markdown** dans `chapters/`
- Les fichiers markdown contiennent le texte brut + indications pour les visualisations
- Format : `chapters/01-introduction.md`, `chapters/02-prerequis-maths.md`, etc.

**Phase 3 : Conversion en slides HTML**
- Transformer chaque chapitre Markdown en slide HTML
- Ajouter les visualisations interactives (Canvas, JavaScript)
- Intégrer MathJax pour les formules
- Appliquer les styles de l'epic Deep Learning

> **⚠️ INSTRUCTIONS POUR LA PHASE 3 :**
>
> ### Règles de contenu
> - **Conserver** tout le contenu pertinent et correct
> - **Supprimer uniquement** si erroné, redondant ou hors sujet
> - **Garder les preuves** importantes ou explicatives d'un type de problème
> - **NE JAMAIS résumer** pour raccourcir
>
> ### Structure pédagogique par concept (4 temps)
> 1. **Langage naturel** : historique, contexte, intuition, définition
> 2. **Mathématiques + Graphiques** : formules LaTeX, visualisations interactives
> 3. **Pseudo-code** : algorithme commenté en français
> 4. **Références** : sources, auteurs, citations
>
> ### Visualisations à ajouter
> - Graphiques de fonctions (courbes de croissance)
> - Animations d'algorithmes (tri, recherche, parcours)
> - Schémas de structures (arbres, graphes, hash tables)
>
> **Lire chaque chapitre en entier** avant conversion.

### Manifest de l'Epic (`epic.json`)

```json
{
  "id": "algorithm-complexity",
  "title": "La Complexité Algorithmique",
  "description": "Guide complet sur la complexité algorithmique : notation Big O, algorithmes de tri et recherche, structures de données, graphes et programmation dynamique.",
  "hierarchy": ["fondamentaux"],
  "tags": ["algorithmes", "complexite", "big-o", "structures-donnees", "tri", "graphes"],
  "metadata": {
    "author": "cyrille",
    "created": "2026-01-13",
    "duration": "2h",
    "difficulty": "intermediate",
    "language": "fr"
  },
  "icon": "📊",
  "thumbnail": "thumbnail.svg",
  "content": [
    {
      "id": "fondamentaux",
      "title": "Fondamentaux",
      "icon": "📚",
      "content": [
        { "id": "01-introduction" },
        { "id": "02-prerequis-maths" },
        { "id": "03-big-o-notation" }
      ]
    },
    {
      "id": "algorithmes",
      "title": "Algorithmes classiques",
      "icon": "⚙️",
      "content": [
        { "id": "04-algorithmes-tri" },
        { "id": "05-algorithmes-recherche" }
      ]
    },
    {
      "id": "structures",
      "title": "Structures de données",
      "icon": "🗃️",
      "content": [
        { "id": "06-structures-index" },
        { "id": "07-algorithmes-graphes" }
      ]
    },
    {
      "id": "techniques",
      "title": "Techniques avancées",
      "icon": "🧠",
      "content": [
        { "id": "08-programmation-dynamique" },
        { "id": "09-paradigmes-algorithmiques" }
      ]
    },
    { "id": "10-notions-avancees", "optional": true },
    { "id": "11-conclusion" },
    { "id": "12-glossaire", "type": "glossary", "optional": true }
  ]
}
```

## Impact

| Fichier | Changement |
|---------|------------|
| `parcours/epics/algorithm-complexity/` | Nouveau dossier avec epic + 12 slides |
| `parcours/index.json` | Ajout tags si nécessaire |
| `data/parcours.json` | Mis à jour par build |

## Specs impactées

Aucune spec à modifier. L'epic suit le format existant défini dans `openspec/specs/parcours/spec.md`.

## Risques

- **Faible** : Ajout pur, pas de breaking changes
- Contenu dense à formater correctement en HTML avec visualisations interactives

## Statut

- [ ] Proposal validée
- [x] **Chapitres Markdown complets (11/11)** ✅
- [ ] Slides HTML créées
- [ ] Visualisations interactives implémentées
- [ ] Glossaire complété
- [ ] Tests et validation

---

## État des chapitres Markdown

### Tous les chapitres sont reçus ✅

| Fichier | Chapitres | Taille | Contenu |
|---------|-----------|--------|---------|
| `01-02-introduction-prerequis.md` | I + II | 17 Ko | Introduction + Prérequis mathématiques (combinés) |
| `03-big-o-notation.md` | III | 50 Ko | Notation Big O (version complète enrichie) |
| `04-algorithmes-tri.md` | IV | 16 Ko | Algorithmes de tri |
| `05-algorithmes-recherche.md` | V | 25 Ko | Algorithmes de recherche |
| `06-structures-index.md` | VI | 17 Ko | Structures d'index et tables de hachage |
| `07-algorithmes-graphes.md` | VII | 28 Ko | Algorithmes sur les graphes |
| `08-programmation-dynamique.md` | VIII | 15 Ko | Programmation dynamique (Bellman, mémoïsation, exemples) |
| `09-paradigmes-algorithmiques.md` | IX | 27 Ko | Paradigmes (force brute, glouton, diviser pour régner, backtracking) |
| `10-notions-avancees.md` | X | 30 Ko | Classes P, NP, NP-complet, complexité amortie |
| `11-conclusion.md` | XI | 13 Ko | Synthèse, trade-offs, IA, quantique |

**Total** : ~238 Ko de contenu markdown source.

---

## Annexe : Structure des chapitres Markdown

Les fichiers markdown dans `chapters/` serviront de source pour les slides HTML :

```
chapters/
├── 01-02-introduction-prerequis.md  ✅ (chapitres I+II combinés)
├── 03-big-o-notation.md             ✅ (version complète 50 Ko)
├── 04-algorithmes-tri.md            ✅
├── 05-algorithmes-recherche.md      ✅
├── 06-structures-index.md           ✅
├── 07-algorithmes-graphes.md        ✅
├── 08-programmation-dynamique.md    ✅
├── 09-paradigmes-algorithmiques.md  ✅
├── 10-notions-avancees.md           ✅
└── 11-conclusion.md                 ✅
```

**Format attendu des chapitres Markdown :**

```markdown
---
title: Titre du chapitre
duration: XX min
---

# Titre principal

## Section 1

Contenu...

<!-- VIZ: Nom de la visualisation
Description de ce qui doit être affiché
Paramètres interactifs si applicable
-->

## Section 2

Contenu avec formules $O(n \log n)$...

| Tableau | Récapitulatif |
|---------|---------------|
| ...     | ...           |
```

**Les chapitres seront fournis séparément** et cette proposal sera mise à jour au fur et à mesure de leur réception.
