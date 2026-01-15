# Algorithmes de tri : guide technique complet pour développeurs

Tous les algorithmes de tri par comparaison sont fondamentalement limités par une borne théorique **Ω(n log n)**, prouvée via l'arbre de décision. Cette contrainte explique pourquoi QuickSort, MergeSort et HeapSort ne peuvent faire mieux asymptotiquement — et pourquoi les tris linéaires contournent cette limite en exploitant des propriétés spécifiques des données. Cet article détaille les 11 algorithmes majeurs avec preuves mathématiques, pseudocode et analyses comparatives.

---

## Les tris quadratiques : simplicité et cas particuliers

Les algorithmes O(n²) restent pertinents pour les petits tableaux (<16-32 éléments) où l'overhead des algorithmes récursifs devient prohibitif. Leur complexité provient de la somme arithmétique fondamentale : **∑(k=1 à n-1) k = n(n-1)/2**.

### Tri à bulles (Bubble Sort)

Le tri à bulles compare répétitivement les éléments adjacents et les permute s'ils sont mal ordonnés. Les plus grands éléments « remontent » vers la fin comme des bulles.

```
BUBBLE_SORT(T[0..n-1])
    pour i ← n-1 jusqu'à 1 faire
        échange_effectué ← FAUX
        pour j ← 0 jusqu'à i-1 faire
            si T[j+1] < T[j] alors
                échanger(T[j], T[j+1])
                échange_effectué ← VRAI
        si NON échange_effectué alors
            sortir  // Optimisation : arrêt anticipé
```

**Preuve de complexité O(n²)** : À l'itération i, on effectue i comparaisons. Le total est (n-1) + (n-2) + ... + 1 = **n(n-1)/2** comparaisons. Le meilleur cas O(n) survient sur un tableau déjà trié avec l'optimisation du flag — un seul parcours détecte l'absence d'échanges. Le tri est **stable** car la condition stricte `T[j] > T[j+1]` ne permute jamais deux éléments égaux.

### Tri par insertion (Insertion Sort)

Ce tri fonctionne comme on trie des cartes en main : chaque nouvel élément est inséré à sa position correcte dans la partie déjà triée.

```
INSERTION_SORT(T[0..n-1])
    pour i ← 1 jusqu'à n-1 faire
        clé ← T[i]
        j ← i
        tant que j > 0 ET T[j-1] > clé faire
            T[j] ← T[j-1]  // Décalage
            j ← j - 1
        T[j] ← clé
```

**Analyse de complexité** : Dans le pire cas (ordre inverse), chaque élément i nécessite i décalages, donnant **n(n-1)/2 = O(n²)** opérations. En cas moyen, la moitié des décalages suffisent : **n(n-1)/4**. Le meilleur cas O(n) survient sur des données triées — la boucle interne ne s'exécute jamais.

L'efficacité sur données quasi-triées s'explique mathématiquement : si chaque élément est à distance bornée d de sa position finale, la complexité devient **O(n × d)**. C'est pourquoi Timsort et Introsort utilisent Insertion Sort pour les petits sous-tableaux.

### Tri par sélection (Selection Sort)

Ce tri trouve le minimum de la partie non triée et l'échange avec le premier élément non trié.

```
SELECTION_SORT(T[0..n-1])
    pour i ← 0 jusqu'à n-2 faire
        indice_min ← i
        pour j ← i+1 jusqu'à n-1 faire
            si T[j] < T[indice_min] alors
                indice_min ← j
        si indice_min ≠ i alors
            échanger(T[i], T[indice_min])
```

**Caractéristique distinctive** : La complexité est **toujours Θ(n²)**, même sur un tableau trié. Trouver le minimum parmi k éléments requiert k-1 comparaisons — aucune optimisation n'est possible.

**Instabilité démontrée** : Sur [3a, 3b, 1], le tri échange 3a avec 1, produisant [1, 3b, 3a]. L'ordre relatif de 3a et 3b est inversé car l'échange à distance détruit la stabilité.

| Algorithme | Meilleur | Moyen | Pire | Stable | Adaptatif |
|-----------|----------|-------|------|--------|-----------|
| Bubble Sort | O(n)* | O(n²) | O(n²) | ✓ | ✓* |
| Insertion Sort | O(n) | O(n²) | O(n²) | ✓ | ✓ |
| Selection Sort | O(n²) | O(n²) | O(n²) | ✗ | ✗ |

*Avec optimisation du flag d'arrêt anticipé

---

## QuickSort : l'algorithme diviser-pour-régner dominant

Inventé par Tony Hoare en 1959, QuickSort partitionne le tableau autour d'un pivot, puis trie récursivement les sous-tableaux. Sa performance moyenne **O(n log n)** et son excellente localité de cache en font le choix par défaut de nombreuses implémentations.

### Schémas de partition

**Partition de Lomuto** (utilisée dans CLRS) :

```
PARTITION_LOMUTO(A, low, high)
    pivot ← A[high]
    i ← low - 1
    pour j ← low jusqu'à high-1 faire
        si A[j] ≤ pivot alors
            i ← i + 1
            échanger(A[i], A[j])
    échanger(A[i+1], A[high])
    retourner i + 1
```

**Partition de Hoare** (originale, plus efficace) :

```
PARTITION_HOARE(A, low, high)
    pivot ← A[low]
    i ← low - 1
    j ← high + 1
    tant que VRAI faire
        répéter i ← i + 1 jusqu'à A[i] ≥ pivot
        répéter j ← j - 1 jusqu'à A[j] ≤ pivot
        si i ≥ j alors retourner j
        échanger(A[i], A[j])
```

La partition de Hoare effectue **3 fois moins d'échanges** en moyenne que Lomuto. Cependant, le pivot n'est pas à sa position finale après partition — la récursion doit inclure l'indice retourné.

### Stratégies de choix du pivot

- **Premier/dernier élément** : Simple mais catastrophique sur données triées → O(n²)
- **Médiane de trois** : Choisir la médiane de {A[first], A[mid], A[last]} — recommandé par Sedgewick
- **Pivot aléatoire** : Élimine tout pire cas déterministe

### Preuves de complexité

**Pire cas O(n²)** : Quand le pivot est toujours le minimum ou maximum, la récurrence devient T(n) = T(n-1) + Θ(n), qui se résout en :

$$T(n) = \sum_{k=1}^{n-1} k = \frac{n(n-1)}{2} = \Theta(n^2)$$

**Cas moyen O(n log n)** : Par analyse des variables indicatrices, le nombre espéré de comparaisons est :

$$E[X] = \sum_{i=1}^{n} \sum_{j>i} \frac{2}{j-i+1} < 2n \cdot H_n \leq 2n(\ln n + 1) = O(n \log n)$$

où Hₙ est le n-ième nombre harmonique.

**Randomized QuickSort** garantit O(n log n) en espérance **pour toute entrée** — le pire cas dépend des choix aléatoires, pas des données adversariales.

```
RANDOMIZED_QUICKSORT(A, low, high)
    si low < high alors
        r ← random(low, high)
        échanger(A[r], A[high])
        p ← PARTITION_LOMUTO(A, low, high)
        RANDOMIZED_QUICKSORT(A, low, p-1)
        RANDOMIZED_QUICKSORT(A, p+1, high)
```

QuickSort est **instable** (les échanges à distance ignorent l'ordre original) et utilise O(log n) d'espace pour la pile de récursion.

---

## MergeSort : stabilité et garantie worst-case

Le tri fusion divise récursivement le tableau en deux, trie chaque moitié, puis fusionne. Inventé par John von Neumann en 1945, il garantit **O(n log n) dans tous les cas**.

```
MERGESORT(A, gauche, droite)
    si gauche >= droite alors retourner
    milieu ← gauche + (droite - gauche) / 2
    MERGESORT(A, gauche, milieu)
    MERGESORT(A, milieu+1, droite)
    MERGE(A, gauche, milieu, droite)

MERGE(A, gauche, milieu, droite)
    Créer L[0..n₁-1] ← A[gauche..milieu]
    Créer R[0..n₂-1] ← A[milieu+1..droite]
    i, j, k ← 0, 0, gauche
    tant que i < n₁ ET j < n₂ faire
        si L[i] ≤ R[j] alors  // ≤ pour stabilité
            A[k++] ← L[i++]
        sinon
            A[k++] ← R[j++]
    Copier éléments restants de L et R dans A
```

### Preuve par le théorème maître

La récurrence **T(n) = 2T(n/2) + Θ(n)** correspond au cas 2 du théorème maître avec a=2, b=2, f(n)=n.

Puisque f(n) = Θ(n^(log₂2)) = Θ(n), on conclut :

$$T(n) = \Theta(n^{\log_b a} \cdot \log n) = \Theta(n \log n)$$

L'arbre de récursion visualise cette preuve : **log₂ n niveaux**, chacun effectuant **cn opérations** de fusion, donnant cn × log n = O(n log n).

La **stabilité** provient de l'opérateur ≤ dans la fusion : les éléments égaux du sous-tableau gauche (originellement premiers) sont placés avant ceux du droit. La **complexité spatiale O(n)** vient des tableaux temporaires L et R.

---

## HeapSort : in-place avec garantie O(n log n)

HeapSort utilise un max-heap (tas binaire) où chaque nœud est ≥ ses enfants. Le tableau représente l'arbre : pour l'indice i, parent(i) = ⌊(i-1)/2⌋, gauche(i) = 2i+1, droite(i) = 2i+2.

```
HEAPSORT(A, n)
    BUILD_MAX_HEAP(A, n)
    pour i ← n-1 jusqu'à 1 faire
        échanger(A[0], A[i])
        MAX_HEAPIFY(A, i, 0)

MAX_HEAPIFY(A, n, i)
    plus_grand ← i
    g ← 2*i + 1
    d ← 2*i + 2
    si g < n ET A[g] > A[plus_grand] alors plus_grand ← g
    si d < n ET A[d] > A[plus_grand] alors plus_grand ← d
    si plus_grand ≠ i alors
        échanger(A[i], A[plus_grand])
        MAX_HEAPIFY(A, n, plus_grand)

BUILD_MAX_HEAP(A, n)
    pour i ← ⌊n/2⌋-1 jusqu'à 0 faire
        MAX_HEAPIFY(A, n, i)
```

### BuildHeap en O(n) : preuve contre-intuitive

L'intuition naïve suggère O(n log n) pour n/2 appels à MaxHeapify. Mais la majorité des nœuds ont une faible hauteur :

$$T(n) = \sum_{h=0}^{\lfloor \log n \rfloor} \lceil \frac{n}{2^{h+1}} \rceil \cdot O(h) = O\left(n \sum_{h=0}^{\infty} \frac{h}{2^h}\right) = O(n \cdot 2) = O(n)$$

La série converge car ∑(h/2^h) = 2. HeapSort est **in-place** mais **instable** (les échanges entre racine et fin du tas ignorent l'ordre original) et **peu cache-friendly** (accès mémoire dispersés).

---

## Tris hybrides : le meilleur des deux mondes

### Introsort : garantie worst-case pour std::sort

Créé par David Musser en 1997, Introsort combine QuickSort (performance moyenne), HeapSort (garantie worst-case) et Insertion Sort (petits tableaux).

```
INTROSORT(A)
    maxdepth ← 2 × ⌊log₂(n)⌋
    _introsort(A, maxdepth)

_introsort(A, maxdepth)
    si |A| < 16 alors
        INSERTION_SORT(A)
    sinon si maxdepth = 0 alors
        HEAPSORT(A)
    sinon
        p ← PARTITION(A)
        _introsort(A[..p-1], maxdepth - 1)
        _introsort(A[p+1..], maxdepth - 1)
```

Le seuil **2 × log₂ n** garantit O(n log n) : si QuickSort dégénère après cette profondeur, HeapSort prend le relais. C'est l'algorithme de `std::sort` en C++ (GCC, LLVM) et `Array.Sort` en .NET.

### Timsort : optimisé pour données réelles

Créé par Tim Peters en 2002 pour Python, Timsort détecte les **runs** (séquences déjà triées) et les fusionne intelligemment.

**Concept clé : minrun** (32-64 éléments). Chaque run est étendu à minrun via Insertion Sort. Les runs sont empilés avec des invariants garantissant des fusions équilibrées :
- |Z| > |Y| + |X|
- |Y| > |X|

Le **mode galloping** accélère les fusions déséquilibrées : quand 7+ éléments consécutifs proviennent du même run, une recherche exponentielle puis binaire localise la position en O(log k) au lieu de O(k).

| Données | Complexité Timsort |
|---------|-------------------|
| Déjà triées | O(n) |
| Partiellement triées | O(n + n×H) où H = entropie des runs |
| Aléatoires | O(n log n) |

Timsort est utilisé par Python (`sorted()`), Java (`Arrays.sort()` pour objets), JavaScript V8 et Swift.

---

## Tris linéaires : contourner Ω(n log n)

Ces algorithmes atteignent O(n) en exploitant des propriétés spécifiques, sans comparaisons entre éléments.

### Counting Sort : tri par indexation

Pour des entiers dans [0, k], on compte les occurrences puis calcule les positions cumulées.

```
COUNTING_SORT(A, k)
    C[0..k] ← tableau de zéros
    B[0..n-1] ← tableau de sortie
    
    // Comptage
    pour i ← 0 à n-1 faire
        C[A[i]] ← C[A[i]] + 1
    
    // Préfixes cumulés
    pour i ← 1 à k faire
        C[i] ← C[i] + C[i-1]
    
    // Placement stable (parcours inverse)
    pour i ← n-1 à 0 faire
        C[A[i]] ← C[A[i]] - 1
        B[C[A[i]]] ← A[i]
    
    retourner B
```

**Complexité O(n + k)** : linéaire quand k = O(n). La **stabilité** vient du parcours inverse — les éléments identiques conservent leur ordre relatif.

### Radix Sort : tri chiffre par chiffre

Radix Sort LSD applique Counting Sort successivement sur chaque chiffre, du poids faible au fort.

```
RADIX_SORT_LSD(A, base)
    d ← nombre de chiffres du maximum
    pour pos ← 0 à d-1 faire
        COUNTING_SORT_BY_DIGIT(A, pos, base)
```

**Complexité O(d × (n + k))** où d = nombre de chiffres et k = base. Pour des entiers 32 bits en base 256 : d=4 passes, soit **O(4n) = O(n)**.

La **stabilité est cruciale** : chaque passe préserve l'ordre établi par les passes précédentes.

### Bucket Sort : distribution probabiliste

Pour des flottants uniformément distribués dans [0,1), on distribue dans n seaux, trie chaque seau (Insertion Sort), puis concatène.

```
BUCKET_SORT(A)
    B[0..n-1] ← n listes vides
    pour i ← 0 à n-1 faire
        ajouter A[i] à B[⌊n × A[i]⌋]
    pour i ← 0 à n-1 faire
        INSERTION_SORT(B[i])
    concaténer B[0], B[1], ..., B[n-1]
```

**Preuve probabiliste de O(n)** : Soit nᵢ le nombre d'éléments dans le seau i. Avec distribution uniforme, E[nᵢ²] = 2 - 1/n. Le temps espéré devient :

$$E[T(n)] = O(n) + \sum_{i=0}^{n-1} O(E[n_i^2]) = O(n) + n \cdot O(2) = O(n)$$

---

## La borne inférieure Ω(n log n) : preuve fondamentale

Tout tri par comparaison peut être modélisé par un **arbre de décision binaire** où chaque nœud est une comparaison et chaque feuille une permutation de sortie.

**Arguments** :
1. Il existe **n! permutations** possibles → minimum n! feuilles
2. Un arbre binaire de hauteur h a au plus **2^h feuilles**
3. Donc 2^h ≥ n!, soit **h ≥ log₂(n!)**

Par la **formule de Stirling** (n! ≈ √(2πn)(n/e)^n) :

$$\log_2(n!) = n \log_2 n - n \log_2 e + O(\log n) = \Theta(n \log n)$$

**Conclusion** : Tout tri par comparaison nécessite **Ω(n log n)** comparaisons dans le pire cas. QuickSort, MergeSort et HeapSort sont donc **asymptotiquement optimaux**.

Les tris linéaires contournent cette borne car ils **n'utilisent pas de comparaisons** — ils exploitent l'indexation directe ou la distribution dans des structures prédéfinies.

---

## Tableau récapitulatif complet

| Algorithme | Meilleur | Moyen | Pire | Espace | Stable | In-place |
|------------|----------|-------|------|--------|--------|----------|
| Bubble Sort | O(n) | O(n²) | O(n²) | O(1) | ✓ | ✓ |
| Insertion Sort | O(n) | O(n²) | O(n²) | O(1) | ✓ | ✓ |
| Selection Sort | O(n²) | O(n²) | O(n²) | O(1) | ✗ | ✓ |
| QuickSort | O(n log n) | O(n log n) | O(n²) | O(log n) | ✗ | ✓ |
| MergeSort | O(n log n) | O(n log n) | O(n log n) | O(n) | ✓ | ✗ |
| HeapSort | O(n log n) | O(n log n) | O(n log n) | O(1) | ✗ | ✓ |
| Introsort | O(n log n) | O(n log n) | O(n log n) | O(log n) | ✗ | ✓ |
| Timsort | O(n) | O(n log n) | O(n log n) | O(n) | ✓ | ✗ |
| Counting Sort | O(n+k) | O(n+k) | O(n+k) | O(k) | ✓ | ✗ |
| Radix Sort | O(dn) | O(dn) | O(dn) | O(n+k) | ✓ | ✗ |
| Bucket Sort | O(n) | O(n) | O(n²) | O(n) | ✓* | ✗ |

*Selon l'algorithme de tri interne

---

## Conclusion : choisir le bon algorithme

Le choix optimal dépend du contexte d'utilisation :

- **Petits tableaux (<32 éléments)** : Insertion Sort, utilisé comme sous-routine par Timsort et Introsort
- **Données partiellement triées** : Timsort excelle avec O(n) sur données triées
- **Stabilité requise** : MergeSort ou Timsort (Python, Java pour objets)
- **Mémoire contrainte** : HeapSort (in-place, O(n log n) garanti) ou QuickSort
- **Usage général** : Introsort (C++ std::sort) combine les avantages sans les inconvénients
- **Entiers bornés** : Counting Sort ou Radix Sort atteignent O(n)
- **Distribution uniforme connue** : Bucket Sort en O(n) moyen

Les implémentations modernes (std::sort, Arrays.sort, sorted()) utilisent systématiquement des **algorithmes hybrides** pour combiner performance moyenne, garantie worst-case et efficacité sur données réelles.