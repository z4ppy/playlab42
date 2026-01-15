# Chapitres Markdown — La Complexité Algorithmique

Ce répertoire contient les **chapitres sources en Markdown** qui seront convertis en slides HTML pour l'epic "La Complexité Algorithmique".

## État actuel : COMPLET ✅

| Fichier | Chapitre(s) | Taille | Statut |
|---------|-------------|--------|--------|
| `01-02-introduction-prerequis.md` | I + II | 17 Ko | ✅ |
| `03-big-o-notation.md` | III | 50 Ko | ✅ |
| `04-algorithmes-tri.md` | IV | 16 Ko | ✅ |
| `05-algorithmes-recherche.md` | V | 25 Ko | ✅ |
| `06-structures-index.md` | VI | 17 Ko | ✅ |
| `07-algorithmes-graphes.md` | VII | 28 Ko | ✅ |
| `08-programmation-dynamique.md` | VIII | 15 Ko | ✅ |
| `09-paradigmes-algorithmiques.md` | IX | 27 Ko | ✅ |
| `10-notions-avancees.md` | X | 30 Ko | ✅ |
| `11-conclusion.md` | XI | 13 Ko | ✅ |

**Total** : ~238 Ko de contenu source.

## Résumé du contenu par chapitre

### I + II. Introduction et Prérequis mathématiques
- Pourquoi mesurer la performance d'un algorithme
- Limites du chronomètre, naissance de Big O
- Logarithmes, puissances, factorielles, croissance des fonctions

### III. La notation Big O (Grand O)
- Définition formelle de Landau, notations O, Ω, Θ, o, ω
- Règles de simplification avec preuves
- Complexité temporelle vs spatiale
- Hiérarchie des complexités O(1) à O(n!)

### IV. Algorithmes de tri
- Tris quadratiques : Bubble, Insertion, Selection
- Tris efficaces : QuickSort, MergeSort, HeapSort
- Tris hybrides : Introsort, Timsort
- Tris linéaires : Counting, Radix, Bucket

### V. Algorithmes de recherche
- Recherche séquentielle O(n)
- Recherche dichotomique O(log n)
- Recherche par interpolation O(log log n)
- Recherche par hachage O(1)

### VI. Structures d'index et tables de hachage
- Tables de hachage : O(1) moyen, collisions
- Arbres binaires de recherche (BST)
- Arbres B et B+ pour bases de données
- Comparaison Hash Index vs B-Tree

### VII. Algorithmes sur les graphes
- Parcours BFS et DFS en O(V+E)
- Plus courts chemins : Dijkstra, Bellman-Ford, Floyd-Warshall, A*
- Arbres couvrants minimaux : Prim, Kruskal

### VIII. Programmation dynamique
- Principes : sous-structure optimale, chevauchement
- Mémoïsation vs approche bottom-up
- Exemples : Fibonacci, Knapsack, Levenshtein, LCS, LIS

### IX. Paradigmes algorithmiques
- Force brute : O(n!), O(2ⁿ)
- Glouton (Greedy) : O(n log n)
- Diviser pour régner : O(n log n)
- Backtracking : O(2ⁿ), O(n!)

### X. Notions avancées
- Classes P, NP, NP-complet, NP-difficile
- Le problème P = NP ?
- Complexité amortie
- Notations Ω (Omega), Θ (Theta)

### XI. Conclusion
- Importance du choix algorithmique
- Trade-offs temps/espace/énergie
- Impact environnemental et IA
- Informatique quantique et perspectives

## Prochaine étape : Phase 3

La **Phase 3** consiste à convertir ces chapitres en slides HTML avec :
- Visualisations interactives (Canvas/JavaScript)
- Formules MathJax
- Styles cohérents avec l'epic Deep Learning

---

## ⚠️ INSTRUCTIONS POUR LA CONVERSION

Les chapitres Markdown contiennent **~238 Ko de contenu riche et détaillé** qui doit être **intégralement préservé** lors de la conversion en HTML.

### Règles de contenu

**Conserver :**
- ✅ Tout le contenu pertinent et correct
- ✅ Toutes les **références** : auteurs, dates, sources, citations
- ✅ Les **preuves importantes** ou explicatives d'un type de problème

**Supprimer uniquement si :**
- ❌ Contenu **erroné**
- ❌ Contenu **redondant** (doublon entre chapitres)
- ❌ Contenu **hors sujet**

**Ne jamais :**
- ❌ Résumer pour raccourcir
- ❌ Supprimer des informations jugées "secondaires"

---

## 📚 STRUCTURE PÉDAGOGIQUE PAR CONCEPT

Chaque concept doit être expliqué selon cette **logique en 4 temps** :

### 1. 📖 Langage naturel
- **Historique et contexte** : origine, auteurs, dates clés
- **Intuition** : analogies, métaphores, cas concrets
- **Définition** en termes accessibles

### 2. 📐 Mathématiques + Graphiques
- **Formules** avec notation LaTeX (MathJax)
- **Graphiques interactifs** pour illustrer les formules
- **Tableaux comparatifs** des complexités

### 3. 💻 Pseudo-code
- Algorithme clair et commenté
- En français (conventions du projet)
- Structure lisible avec indentation

### 4. 📎 Références
- Sources académiques (CLRS, Knuth, etc.)
- Auteurs et dates
- Citations importantes

---

## 🎨 VISUALISATIONS À AJOUTER

Pour chaque chapitre, prévoir des **illustrations interactives** :

| Type | Usage | Exemple |
|------|-------|---------|
| **Graphique de fonctions** | Comparer les croissances | O(1), O(log n), O(n), O(n²), O(2ⁿ) |
| **Animation d'algorithme** | Montrer l'exécution pas à pas | Tri, recherche, parcours |
| **Schéma de structure** | Visualiser les données | Arbres, graphes, tables de hachage |
| **Diagramme temporel** | Illustrer la complexité | Nombre d'opérations vs taille |

---

## Méthode recommandée

1. **Lire le chapitre en entier** avant de commencer
2. Identifier les **concepts clés** à illustrer
3. Pour chaque concept, vérifier la présence des 4 temps (langage, maths, pseudo-code, références)
4. Ajouter les **visualisations** manquantes
5. Convertir section par section en vérifiant la complétude
