# Tasks: add-algorithm-complexity-epic

## Phase 1 : Infrastructure

- [ ] Créer le dossier `parcours/epics/algorithm-complexity/`
- [ ] Créer `epic.json` avec la structure définie
- [ ] Créer les dossiers de slides (01 à 12)
- [ ] Créer les fichiers `slide.json` pour chaque slide
- [ ] Créer `glossary.json` (template vide)
- [ ] Créer `thumbnail.svg`

## Phase 2 : Rédaction des chapitres Markdown ✅ COMPLET

### Fondamentaux
- [x] `chapters/01-02-introduction-prerequis.md` — Introduction + Prérequis mathématiques (combinés)
- [x] `chapters/03-big-o-notation.md` — Notation Big O (version complète 50 Ko)

### Algorithmes classiques
- [x] `chapters/04-algorithmes-tri.md` — Algorithmes de tri
- [x] `chapters/05-algorithmes-recherche.md` — Algorithmes de recherche

### Structures de données
- [x] `chapters/06-structures-index.md` — Structures d'index et tables de hachage
- [x] `chapters/07-algorithmes-graphes.md` — Algorithmes sur les graphes

### Techniques avancées
- [x] `chapters/08-programmation-dynamique.md` — Programmation dynamique
- [x] `chapters/09-paradigmes-algorithmiques.md` — Paradigmes algorithmiques

### Compléments
- [x] `chapters/10-notions-avancees.md` — Notions avancées (P/NP)
- [x] `chapters/11-conclusion.md` — Conclusion

## Phase 3 : Conversion en slides HTML ✅ COMPLET

> **⚠️ INSTRUCTIONS CRITIQUES :**
>
> ### Règles de contenu (~238 Ko source)
> - **Conserver** tout le contenu pertinent et correct
> - **Supprimer uniquement** si erroné, redondant ou hors sujet
> - **Garder les preuves** importantes ou explicatives
> - **NE JAMAIS résumer** pour raccourcir
>
> ### Structure pédagogique par concept
> Chaque concept = **4 temps** :
> 1. **Langage** : historique, contexte, intuition
> 2. **Maths + Graphiques** : formules, visualisations
> 3. **Pseudo-code** : algorithme commenté
> 4. **Références** : sources, citations
>
> ### Visualisations à créer
> - Graphiques de fonctions (croissance)
> - Animations d'algorithmes
> - Schémas de structures de données
>
> **Lire chaque chapitre en entier** avant conversion.

### Slides de base
- [x] `slides/01-introduction/index.html`
- [x] `slides/02-prerequis-maths/index.html`
- [x] `slides/03-big-o-notation/index.html`
- [x] `slides/04-algorithmes-tri/index.html`
- [x] `slides/05-algorithmes-recherche/index.html`
- [x] `slides/06-structures-index/index.html`
- [x] `slides/07-algorithmes-graphes/index.html`
- [x] `slides/08-programmation-dynamique/index.html`
- [x] `slides/09-paradigmes-algorithmiques/index.html`
- [x] `slides/10-notions-avancees/index.html`
- [x] `slides/11-conclusion/index.html`
- [x] `slides/12-glossaire/index.html` (auto-généré)

## Phase 4 : Visualisations interactives ✅ COMPLET

### Graphiques et animations
- [x] Graphique comparatif des fonctions de croissance (slide 02)
- [x] Hiérarchie des complexités avec animation (slide 03)
- [x] Animation des algorithmes de tri (slide 04)
  - [x] Bubble Sort
  - [x] Quick Sort
  - [x] Merge Sort
  - [x] Heap Sort
- [x] Animation recherche dichotomique (slide 05)
- [x] Visualisation B-Tree vs Hash Table (slide 06)
- [x] Animation parcours de graphes (slide 07)
  - [x] BFS
  - [x] DFS
  - [x] Dijkstra
- [x] Visualisation mémoïsation (slide 08)
  - [x] Fibonacci
  - [x] Knapsack

## Phase 5 : Glossaire ✅ COMPLET

- [x] Compléter `glossary.json` avec tous les termes techniques
  - Notation Big O, O, Omega, Theta
  - Complexité temporelle, spatiale
  - Stable (tri), En place (tri)
  - Diviser pour régner
  - Mémoïsation
  - Graphe, sommet, arête
  - Arbre binaire de recherche
  - Table de hachage, collision
  - P, NP, NP-complet, NP-difficile

## Phase 6 : Finalisation

- [ ] Vérifier tous les liens internes
- [ ] Tester la navigation entre slides
- [ ] Valider le responsive (mobile, tablet, desktop)
- [ ] Vérifier le thème clair/sombre
- [ ] Lancer `make build-parcours`
- [ ] Tester dans le portail

## Notes

### Dépendances
- Styles partagés : `parcours/_shared/slide-utils.js`
- Theme : `lib/theme.css`
- MathJax pour les formules
- TailwindCSS

### Inspiration
- Epic Deep Learning : structure, visualisations, glossaire
- Animations Canvas pour les algorithmes de tri

### Points d'attention
- Utiliser les classes CSS de l'epic Deep Learning (dl-accent-*, etc.)
- Formules LaTeX via MathJax ($$ ... $$)
- Tableaux récapitulatifs pour chaque famille d'algorithmes
