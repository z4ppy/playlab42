# Paradigmes algorithmiques et analyse de complexité

La résolution efficace de problèmes computationnels repose sur un arsenal de paradigmes algorithmiques, chacun offrant une approche distincte pour structurer la recherche de solutions. Ce chapitre présente huit paradigmes fondamentaux — de la force brute aux algorithmes d'approximation — avec leurs caractérisations formelles, preuves mathématiques et analyses de complexité. **La maîtrise de ces paradigmes constitue le socle de toute conception algorithmique avancée**, permettant au praticien de sélectionner l'approche optimale selon les contraintes du problème.

---

## 1. Force brute : l'exploration exhaustive

### Définition formelle et caractérisation

La **force brute** constitue le paradigme le plus fondamental : elle explore systématiquement l'intégralité de l'espace des solutions pour identifier celles satisfaisant le problème posé.

**Définition mathématique** : Soit $S$ l'espace des solutions d'un problème $P$ et $V: S \rightarrow \{vrai, faux\}$ une fonction de validation. L'algorithme de force brute énumère tous les éléments $s \in S$ et retourne $\{s \in S : V(s) = vrai\}$.

Cette approche garantit la **complétude** (trouver une solution si elle existe) et l'**optimalité** (identifier la meilleure solution parmi toutes), au prix d'une complexité souvent prohibitive.

### Complexités caractéristiques

| Complexité | Structure de l'espace | Application typique |
|------------|----------------------|---------------------|
| **O(n!)** | Permutations de n éléments | TSP, arrangements |
| **O(2ⁿ)** | Sous-ensembles de n éléments | SAT, sac à dos |
| **O(nᵏ)** | k-combinaisons parmi n | k-uplets, cliques de taille k |
| **O(mⁿ)** | Assignations de n éléments à m valeurs | Coloration de graphe |

Ces complexités croissent de façon vertigineuse : pour n=20, on a 20! ≈ 2.4×10¹⁸ permutations et 2²⁰ ≈ 10⁶ sous-ensembles.

### Exemple canonique : TSP en force brute

Le problème du voyageur de commerce (TSP) cherche le circuit hamiltonien de coût minimal dans un graphe complet pondéré.

```
ALGORITHME TSP_ForceBrute(D[1..n][1..n])
// D : matrice des distances, n : nombre de villes
// Sortie : tour optimal et son coût

    meilleurCoût ← +∞
    meilleurTour ← NULL
    villes ← [2, 3, ..., n]    // On fixe la ville 1 comme départ
    
    POUR CHAQUE permutation π DE villes FAIRE
        coût ← D[1][π[1]]
        POUR i DE 1 À n-2 FAIRE
            coût ← coût + D[π[i]][π[i+1]]
        FIN POUR
        coût ← coût + D[π[n-1]][1]    // Retour à l'origine
        
        SI coût < meilleurCoût ALORS
            meilleurCoût ← coût
            meilleurTour ← [1] ⊕ π ⊕ [1]
        FIN SI
    FIN POUR
    
    RETOURNER (meilleurTour, meilleurCoût)
```

**Analyse** : L'algorithme examine (n-1)!/2 tours (en exploitant la symétrie), chacun évalué en O(n). La complexité totale est **O(n!)** en temps et **O(n)** en espace.

### Quand utiliser la force brute

La force brute reste pertinente dans plusieurs contextes :
- **Petites instances** : n ≤ 10-12 pour O(n!), n ≤ 20-25 pour O(2ⁿ)
- **Vérification et validation** : confirmer l'exactitude d'algorithmes optimisés
- **Baseline de comparaison** : établir une référence de performance
- **Prototypage rapide** : valider la compréhension du problème avant d'optimiser

---

## 2. Backtracking : l'élagage intelligent

### Définition et différence avec la force brute

Le **backtracking** (retour sur trace) construit incrémentalement des candidats solutions et abandonne une branche dès qu'elle ne peut mener à une solution valide. Cette technique transforme l'exploration exhaustive en parcours en profondeur avec élagage précoce.

**Formalisation** : Soit T un arbre de recherche représentant l'espace des solutions partielles. Le backtracking effectue un parcours DFS de T utilisant une fonction `rejeter(c)` retournant VRAI si le candidat partiel c ne peut être complété en solution valide.

| Critère | Force brute | Backtracking |
|---------|-------------|--------------|
| **Exploration** | Solutions complètes | Solutions partielles avec élagage |
| **Validation** | Après construction complète | Pendant la construction |
| **Efficacité** | Toujours maximale | Souvent bien meilleure en pratique |

### Template général et techniques d'élagage

```
PROCÉDURE Backtrack(état)
    SI EstSolution(état) ALORS
        TraiterSolution(état)
        RETOURNER VRAI
    FIN SI
    
    POUR CHAQUE choix DANS ChoixDisponibles(état) FAIRE
        SI EstPrometteur(état, choix) ALORS    // Élagage
            FaireChoix(état, choix)
            SI Backtrack(état) ALORS RETOURNER VRAI FIN SI
            DéfaireChoix(état, choix)          // Retour arrière
        FIN SI
    FIN POUR
    
    RETOURNER FAUX
```

Les techniques d'élagage incluent :
- **Contraintes de faisabilité** : vérification immédiate des contraintes
- **Propagation de contraintes** : réduction du domaine des variables futures (forward checking, arc consistency)
- **Heuristiques d'ordre** : MRV (variable la plus contrainte d'abord), LCV (valeur la moins contraignante d'abord)

### Exemple canonique : le problème des N-Reines

Placer N reines sur un échiquier N×N tel qu'aucune paire ne s'attaque.

```
ALGORITHME N_Reines(N)
// echiquier[i] = colonne de la reine à la ligne i

    FONCTION EstSécurisé(ligne, colonne)
        POUR i DE 1 À ligne - 1 FAIRE
            SI echiquier[i] = colonne ALORS RETOURNER FAUX FIN SI
            SI |ligne - i| = |colonne - echiquier[i]| ALORS RETOURNER FAUX FIN SI
        FIN POUR
        RETOURNER VRAI
    FIN FONCTION
    
    PROCÉDURE PlacerReine(ligne)
        SI ligne > N ALORS
            EnregistrerSolution(echiquier)
            RETOURNER
        FIN SI
        
        POUR colonne DE 1 À N FAIRE
            SI EstSécurisé(ligne, colonne) ALORS
                echiquier[ligne] ← colonne
                PlacerReine(ligne + 1)
                echiquier[ligne] ← 0
            FIN SI
        FIN POUR
    FIN PROCÉDURE
```

**Analyse** : Le pire cas reste O(N!), mais l'élagage réduit drastiquement l'exploration. Pour N=8, on visite environ **15 000 nœuds** au lieu de 16.8 millions en force brute, soit un facteur d'amélioration supérieur à **1000×**.

---

## 3. Branch and Bound : l'optimisation exacte guidée par les bornes

### Définition formelle

Le **Branch and Bound** étend le backtracking aux problèmes d'optimisation en utilisant des bornes pour guider et élaguer l'exploration. Proposé par Land et Doig (1960), ce paradigme maintient :
- **L** : borne inférieure globale sur l'optimum f*
- **U** : borne supérieure globale (meilleure solution trouvée)
- Un arbre de recherche où chaque nœud représente un sous-problème

**Propriété fondamentale** : L ≤ f* ≤ U. Un nœud est élagué si sa borne inférieure dépasse U.

### Calcul des bornes : la clé de l'efficacité

**Borne inférieure** : Pour un nœud N avec sous-espace S_N, on calcule LB(N) ≤ min{f(x) : x ∈ S_N}.

Méthodes principales :
- **Relaxation linéaire** : supprimer les contraintes d'intégrité
- **Relaxation lagrangienne** : pénaliser les contraintes difficiles
- **Heuristiques spécifiques** : réduction de matrice (TSP), relaxation fractionnaire (sac à dos)

**Borne supérieure** : Toute solution faisable fournit une borne supérieure. Plus elle est serrée (proche de l'optimum), plus l'élagage est efficace.

### Stratégies de parcours

| Stratégie | Mémoire | Caractéristique |
|-----------|---------|-----------------|
| **Best-First** | O(nœuds actifs) | Trouve rapidement l'optimum |
| **Depth-First** | O(profondeur) | Économe en mémoire |
| **Breadth-First** | O(b^d) | Exploration systématique |

### Exemple : TSP par réduction de matrice

```
ALGORITHME TSP_BranchBound(D, n)
    FONCTION Réduction(M)
        coût ← 0
        // Réduction des lignes
        POUR CHAQUE ligne i FAIRE
            min ← minimum(M[i][*])
            SI 0 < min < ∞ ALORS
                M[i][*] ← M[i][*] - min
                coût ← coût + min
            FIN SI
        FIN POUR
        // Réduction des colonnes (similaire)
        RETOURNER (M, coût)
    FIN FONCTION
    
    (M₀, LB₀) ← Réduction(D)
    PQ ← FilePriorité()
    PQ.insérer(NœudRacine([], M₀, LB₀))
    meilleurCoût ← +∞
    
    TANT QUE PQ non vide FAIRE
        N ← PQ.extraireMin()
        SI N.coût ≥ meilleurCoût ALORS CONTINUER FIN SI
        
        SI N.niveau = n - 1 ALORS
            // Compléter le tour
            coûtFinal ← N.coût + distance au retour
            SI coûtFinal < meilleurCoût ALORS
                meilleurCoût ← coûtFinal
                meilleurTour ← N.chemin
            FIN SI
        SINON
            // Brancher sur la prochaine ville
            POUR CHAQUE ville v non visitée FAIRE
                M' ← copie et mise à jour de N.matrice
                (M', coûtRed) ← Réduction(M')
                LB ← N.coût + D[dernière][v] + coûtRed
                SI LB < meilleurCoût ALORS
                    PQ.insérer(Nœud(N.chemin ⊕ [v], M', LB))
                FIN SI
            FIN POUR
        FIN SI
    FIN TANT QUE
```

**Complexité** : O(n!) en pire cas, mais typiquement bien meilleur grâce à l'élagage. La performance dépend cruciallement de la qualité des bornes.

---

## 4. Algorithmes gloutons : l'optimalité locale

### Définition et propriétés nécessaires

Un **algorithme glouton** construit une solution pas à pas en effectuant à chaque étape le choix localement optimal, sans reconsidérer les décisions antérieures.

Pour qu'un algorithme glouton soit correct, deux propriétés sont nécessaires :

**1. Propriété du choix glouton** : Il existe une solution optimale contenant le premier choix fait par l'algorithme glouton.

**2. Sous-structure optimale** : Une solution optimale contient les solutions optimales de ses sous-problèmes.

### Techniques de preuve de correction

#### Technique de l'échange (Exchange Argument)

**Principe** : Montrer que toute solution peut être transformée en la solution gloutonne sans dégrader sa qualité.

**Template** :
1. Soit G la solution gloutonne et O une solution optimale
2. Si G ≠ O, soit i le premier indice où elles diffèrent
3. Construire O' en échangeant l'élément divergent
4. Prouver que coût(O') ≤ coût(O)
5. Par induction, G est optimale

#### Théorie des matroïdes

**Définition** : Un matroïde M = (S, I) est défini par un ensemble fini S et une famille I de sous-ensembles "indépendants" satisfaisant :
1. ∅ ∈ I
2. Si B ∈ I et A ⊆ B, alors A ∈ I (hérédité)
3. Si A, B ∈ I et |A| < |B|, alors ∃x ∈ B\A tel que A ∪ {x} ∈ I (échange)

**Théorème (Rado-Edmonds)** : Pour tout matroïde pondéré, l'algorithme glouton trouve une base de poids optimal.

**Exemples de matroïdes** :
- **Matroïde graphique** : S = arêtes, I = forêts (sous-graphes acycliques)
- **Matroïde uniforme** : I = sous-ensembles de taille ≤ k

### Exemple : Algorithme de Huffman

Le codage de Huffman construit un code préfixe optimal minimisant la longueur moyenne pondérée.

```
ALGORITHME Huffman(A, f)
// A : alphabet, f : fréquences

    Q ← FilePrioritéMin(A, f)
    
    POUR i DE 1 À |A| - 1 FAIRE
        z ← nouveau Nœud
        z.gauche ← Q.extraireMin()
        z.droite ← Q.extraireMin()
        z.freq ← z.gauche.freq + z.droite.freq
        Q.insérer(z)
    FIN POUR
    
    RETOURNER Q.extraireMin()    // Racine de l'arbre
```

**Preuve d'optimalité** :

*Lemme 1 (Échange)* : Soient x et y les deux caractères de plus faibles fréquences. Il existe un arbre optimal où x et y sont frères au niveau le plus profond.

*Preuve* : Soit T* optimal avec a et b au niveau maximal. Si {a,b} ≠ {x,y}, l'échange x↔a et y↔b ne peut qu'améliorer le coût car f(x) ≤ f(a) et f(y) ≤ f(b). ∎

*Lemme 2 (Sous-structure)* : L'arbre optimal pour A' = A\{x,y}∪{z} avec f(z)=f(x)+f(y), étendu en faisant x et y enfants de z, est optimal pour A.

**Complexité** : O(n log n) — n-1 insertions et 2(n-1) extractions dans un tas.

### Exemple : Algorithme de Dijkstra

```
ALGORITHME Dijkstra(G, w, s)
    POUR CHAQUE v ∈ V FAIRE
        d[v] ← ∞ ; π[v] ← NIL
    FIN POUR
    d[s] ← 0
    Q ← FilePrioritéMin(V, d)
    
    TANT QUE Q non vide FAIRE
        u ← Q.extraireMin()
        POUR CHAQUE v ∈ Adjacent(u) FAIRE
            SI d[v] > d[u] + w(u,v) ALORS
                d[v] ← d[u] + w(u,v)
                π[v] ← u
                Q.diminuerClé(v, d[v])
            FIN SI
        FIN POUR
    FIN TANT QUE
```

**Complexité** : O(V² + E) avec tableau, O((V+E) log V) avec tas binaire, **O(V log V + E)** avec tas de Fibonacci.

### Contre-exemples fondamentaux

**Sac à dos 0/1** : Avec capacité W=50 et objets {(10, 60), (20, 100), (30, 120)} (poids, valeur), le glouton par ratio choisit les deux premiers objets (valeur 160) alors que l'optimum est {B, C} avec valeur **220**.

**Rendu de monnaie {1, 3, 4}** : Pour rendre 6, le glouton donne 4+1+1 (3 pièces) au lieu de 3+3 (2 pièces).

**Leçon** : Toujours vérifier la propriété du choix glouton avant d'appliquer ce paradigme.

---

## 5. Diviser pour régner : la récursivité structurée

### Les trois étapes fondamentales

**Diviser pour régner** décompose un problème selon trois étapes :
1. **DIVISER** : Décomposer en sous-problèmes de même nature
2. **RÉGNER** : Résoudre récursivement (ou directement si cas de base)
3. **COMBINER** : Fusionner les solutions des sous-problèmes

La récurrence associée est T(n) = aT(n/b) + f(n) où a sous-problèmes de taille n/b sont créés avec un travail de combinaison f(n).

### Le Théorème Maître

**Énoncé** : Pour T(n) = aT(n/b) + f(n) avec a ≥ 1, b > 1 :

**Cas 1** : Si f(n) = O(n^{log_b(a) - ε}) pour ε > 0, alors **T(n) = Θ(n^{log_b a})**

**Cas 2** : Si f(n) = Θ(n^{log_b a} · logᵏ n) pour k ≥ 0, alors **T(n) = Θ(n^{log_b a} · log^{k+1} n)**

**Cas 3** : Si f(n) = Ω(n^{log_b(a) + ε}) et af(n/b) ≤ cf(n) pour c < 1, alors **T(n) = Θ(f(n))**

**Intuition par arbre de récursion** :
- **Cas 1** : Le travail est dominé par les feuilles (n^{log_b a} nœuds)
- **Cas 2** : Tous les niveaux contribuent également → facteur log n
- **Cas 3** : Le travail est dominé par la racine

### Applications du Théorème Maître

| Algorithme | Récurrence | Cas | Complexité |
|------------|------------|-----|------------|
| Recherche binaire | T(n) = T(n/2) + O(1) | 2 | **O(log n)** |
| MergeSort | T(n) = 2T(n/2) + O(n) | 2 | **O(n log n)** |
| Karatsuba | T(n) = 3T(n/2) + O(n) | 1 | **O(n^{1.585})** |
| Strassen | T(n) = 7T(n/2) + O(n²) | 1 | **O(n^{2.807})** |

### Exemple : Multiplication de Karatsuba

Pour multiplier deux entiers à n chiffres, l'algorithme naïf nécessite O(n²) opérations. Karatsuba (1960) réduit cela à O(n^{1.585}).

**Idée clé** : Pour x = x₁·Bᵐ + x₀ et y = y₁·Bᵐ + y₀, on calcule :
- z₂ = x₁y₁
- z₀ = x₀y₀  
- z₁ = (x₁ + x₀)(y₁ + y₀) - z₂ - z₀

Puis xy = z₂·B^{2m} + z₁·Bᵐ + z₀, avec seulement **3 multiplications** au lieu de 4.

```
ALGORITHME Karatsuba(x, y, n)
    SI n = 1 ALORS RETOURNER x × y FIN SI
    
    m ← ⌈n/2⌉
    x₁, x₀ ← x / Bᵐ, x mod Bᵐ
    y₁, y₀ ← y / Bᵐ, y mod Bᵐ
    
    z₂ ← Karatsuba(x₁, y₁, m)
    z₀ ← Karatsuba(x₀, y₀, m)
    z₁ ← Karatsuba(x₁ + x₀, y₁ + y₀, m+1) - z₂ - z₀
    
    RETOURNER z₂·B^{2m} + z₁·Bᵐ + z₀
```

### Exemple : MergeSort avec preuve de correction

```
ALGORITHME MergeSort(A, p, r)
    SI p < r ALORS
        q ← ⌊(p + r) / 2⌋
        MergeSort(A, p, q)
        MergeSort(A, q+1, r)
        Merge(A, p, q, r)
    FIN SI

PROCÉDURE Merge(A, p, q, r)
    L ← A[p..q] ⊕ [∞]    // Avec sentinelle
    R ← A[q+1..r] ⊕ [∞]
    i, j ← 1, 1
    
    POUR k DE p À r FAIRE
        SI L[i] ≤ R[j] ALORS
            A[k] ← L[i] ; i ← i + 1
        SINON
            A[k] ← R[j] ; j ← j + 1
        FIN SI
    FIN POUR
```

**Invariant de boucle pour Merge** : Au début de chaque itération, A[p..k-1] contient les k-p plus petits éléments de L et R, triés.

**Complexité** : T(n) = 2T(n/2) + Θ(n) → **O(n log n)** temps, **O(n)** espace auxiliaire.

---

## 6. Programmation dynamique : mémorisation et sous-structure optimale

### Définition et propriétés clés

La **programmation dynamique** (Bellman, 1952) résout des problèmes d'optimisation en exploitant deux propriétés :

**1. Sous-structure optimale** : Une solution optimale contient les solutions optimales de ses sous-problèmes.

**2. Chevauchement des sous-problèmes** : Les mêmes sous-problèmes sont résolus plusieurs fois dans une approche récursive naïve.

**Différence avec diviser pour régner** : En DPR, les sous-problèmes sont indépendants. En DP, ils se chevauchent — on mémorise donc les résultats pour éviter les recalculs exponentiels.

### Approches : Top-Down vs Bottom-Up

**Top-Down (mémoïsation)** : Récursion naturelle avec cache
- Calcule uniquement les sous-problèmes nécessaires
- Plus intuitif, suit la structure récursive

**Bottom-Up (tabulation)** : Construction itérative de la table
- Pas de surcoût d'appels récursifs
- Possibilité d'optimiser l'espace mémoire

### Exemple : Sac à dos 0/1

**Récurrence** :
```
dp[i][w] = max(dp[i-1][w], dp[i-1][w-wᵢ] + vᵢ)  si wᵢ ≤ w
         = dp[i-1][w]                            sinon
```

**Preuve de sous-structure optimale** : Si l'objet n appartient à une solution optimale O, alors O \ {n} est optimal pour (n-1 objets, capacité W-wₙ). Sinon, on pourrait améliorer O — contradiction.

```
ALGORITHME Knapsack(W, w[], v[], n)
    POUR i DE 0 À n FAIRE
        POUR cap DE 0 À W FAIRE
            SI i = 0 OU cap = 0 ALORS
                dp[i][cap] ← 0
            SINON SI w[i-1] ≤ cap ALORS
                inclure ← v[i-1] + dp[i-1][cap - w[i-1]]
                exclure ← dp[i-1][cap]
                dp[i][cap] ← max(inclure, exclure)
            SINON
                dp[i][cap] ← dp[i-1][cap]
            FIN SI
        FIN POUR
    FIN POUR
    RETOURNER dp[n][W]
```

**Complexité** : **O(nW)** temps et espace, optimisable à **O(W)** en espace.

### Exemple : Plus longue sous-suite commune (LCS)

**Récurrence** :
```
c[i,j] = 0                              si i = 0 ou j = 0
       = c[i-1, j-1] + 1               si X[i] = Y[j]
       = max(c[i, j-1], c[i-1, j])     sinon
```

**Complexité** : **O(nm)** temps et espace.

### Exemple : Distance d'édition (Levenshtein)

**Récurrence** :
```
d[i,j] = j                                          si i = 0
       = i                                          si j = 0
       = d[i-1, j-1]                               si a[i] = b[j]
       = 1 + min(d[i-1,j], d[i,j-1], d[i-1,j-1])  sinon
```

**Applications** : Correcteurs orthographiques, alignement de séquences biologiques (Smith-Waterman).

### Exemple : Plus longue sous-suite croissante (LIS)

**Approche O(n²)** :
```
dp[i] = max(1, max{dp[j] + 1 | j < i et arr[j] < arr[i]})
```

**Approche optimisée O(n log n)** : Maintenir un tableau `tails[]` où tails[l] est le plus petit élément terminal d'une LIS de longueur l+1, mis à jour par recherche binaire.

### Exemple : Multiplication de chaîne de matrices

**Récurrence** :
```
m[i,j] = 0                                                    si i = j
       = min_{i≤k<j}(m[i,k] + m[k+1,j] + p_{i-1}·pₖ·pⱼ)     si i < j
```

**Complexité** : **O(n³)** temps, O(n²) espace.

### Tableau récapitulatif des complexités DP

| Problème | Temps | Espace | Espace optimisé |
|----------|-------|--------|-----------------|
| Fibonacci | O(n) | O(n) | **O(1)** |
| Knapsack 0/1 | O(nW) | O(nW) | O(W) |
| LCS | O(nm) | O(nm) | O(min(n,m)) |
| Distance d'édition | O(nm) | O(nm) | O(min(n,m)) |
| LIS | O(n²) ou O(n log n) | O(n) | O(n) |
| Matrices en chaîne | O(n³) | O(n²) | O(n²) |

---

## 7. Algorithmes randomisés : exploiter l'aléatoire

### Classification : Las Vegas vs Monte Carlo

| Type | Correction | Temps | Exemple |
|------|-----------|-------|---------|
| **Las Vegas** | Toujours correct | Variable (aléatoire) | QuickSort randomisé |
| **Monte Carlo** | Possibilité d'erreur | Déterministe | Miller-Rabin |

### Outils d'analyse probabiliste

**Linéarité de l'espérance** : Pour toutes variables aléatoires X₁, ..., Xₙ (même dépendantes) :
$$E\left[\sum_{i=1}^{n} X_i\right] = \sum_{i=1}^{n} E[X_i]$$

**Variables indicatrices** : Pour un événement A, I_A vaut 1 si A se produit, 0 sinon. Propriété : E[I_A] = Pr[A].

**Inégalité de Markov** : Pour X ≥ 0 et a > 0 : Pr[X ≥ a] ≤ E[X]/a.

### Exemple : QuickSort randomisé

**Pourquoi le pivot aléatoire ?** Le QuickSort déterministe a un temps Ω(n²) sur entrées triées. Le pivot aléatoire élimine cette dépendance aux entrées adverses.

**Analyse par indicateurs** : Soient z₁, ..., zₙ les éléments triés. X_{ij} = 1 si zᵢ et zⱼ sont comparés.

**Observation clé** : zᵢ et zⱼ sont comparés ssi l'un d'eux est choisi comme pivot avant tout élément de rang entre i et j. Donc Pr[X_{ij} = 1] = 2/(j-i+1).

**Théorème** : Le nombre espéré de comparaisons est :
$$E[X] = \sum_{i<j} \frac{2}{j-i+1} < 2n \sum_{k=1}^{n} \frac{1}{k} = O(n \log n)$$

### Exemple : Algorithme de Karger (min-cut)

L'algorithme contracte aléatoirement des arêtes jusqu'à ce qu'il ne reste que 2 sommets.

**Théorème** : La probabilité de retourner une coupe minimale C* est au moins 2/n².

*Preuve* : À l'étape i, le graphe a n-i+1 sommets et au moins c(n-i+1)/2 arêtes (où c = |C*|). Donc Pr[ne pas couper C*] ≥ (n-i-1)/(n-i+1). Le produit téléscopique donne ≥ 2/(n(n-1)).

**Amplification** : En répétant O(n² log n) fois, Pr[échec total] ≤ 1/n^c pour c arbitraire.

### Exemple : Test de Miller-Rabin

Pour n-1 = 2ˢ·d (d impair), un nombre a est témoin si aᵈ ≢ 1 (mod n) et a^{2ʳd} ≢ -1 (mod n) pour tout r < s.

**Théorème** : Pour tout n composé, au moins 3/4 des valeurs a sont des témoins.

Avec k itérations, Pr[erreur] ≤ (1/4)ᵏ. Pour k=50, Pr[erreur] ≈ 10⁻³⁰.

---

## 8. Algorithmes d'approximation : solutions garanties pour problèmes NP-difficiles

### Définition du ratio d'approximation

Un algorithme A est une **α-approximation** si pour toute instance I :
- **Minimisation** : A(I) ≤ α · OPT(I)
- **Maximisation** : A(I) ≥ OPT(I) / α

### Schémas d'approximation

| Type | Temps | Définition |
|------|-------|------------|
| **PTAS** | poly(n) pour ε fixé | (1+ε)-approximation |
| **FPTAS** | poly(n, 1/ε) | (1+ε)-approximation, polynomial aussi en 1/ε |

### Exemple : Vertex Cover (2-approximation)

```
ALGORITHME ApproxVertexCover(G)
    C ← ∅ ; E' ← E
    TANT QUE E' ≠ ∅ FAIRE
        Choisir (u, v) ∈ E'
        C ← C ∪ {u, v}
        Supprimer de E' toutes les arêtes incidentes à u ou v
    FIN TANT QUE
    RETOURNER C
```

**Preuve du ratio 2** : Soit M l'ensemble des arêtes choisies (couplage maximal). |C| = 2|M|. Toute couverture doit contenir au moins un sommet par arête de M (arêtes disjointes), donc OPT ≥ |M|. Ainsi **|C| ≤ 2·OPT**.

### Exemple : TSP métrique (2-approximation)

L'algorithme Double-Tree construit un arbre couvrant minimal T, double ses arêtes, trouve un tour eulérien, puis applique des raccourcis.

**Preuve** : c(T) ≤ c(C*) car supprimer une arête du tour optimal donne un arbre couvrant. Le tour eulérien coûte 2·c(T). Par inégalité triangulaire, les raccourcis ne dégradent pas. Donc **c(tour) ≤ 2·OPT**.

L'algorithme de **Christofides** améliore ce ratio à **1.5** en ajoutant un couplage parfait minimal sur les sommets de degré impair.

### Exemple : Set Cover (O(log n)-approximation)

L'algorithme glouton choisit itérativement l'ensemble couvrant le plus de nouveaux éléments.

**Théorème** : Le ratio est Hₙ ≈ ln n, et c'est essentiellement optimal (sous P ≠ NP).

### Exemple : Knapsack FPTAS

En arrondissant les valeurs par K = εvₘₐₓ/n, les nouvelles valeurs sont bornées par n/ε. L'algorithme DP sur ces valeurs arrondies s'exécute en **O(n³/ε)** et garantit une (1-ε)-approximation.

### Résultats d'inapproximabilité

| Problème | Meilleur ratio | Impossibilité |
|----------|---------------|---------------|
| Vertex Cover | 2 | < 1.3606 (P ≠ NP), < 2-ε (UGC) |
| Set Cover | O(log n) | (1-o(1))ln n optimal |
| TSP métrique | 1.5 | Légèrement améliorable |
| TSP général | ∞ | Aucun ratio fini |
| Knapsack | FPTAS | — |

---

## Tableau comparatif des paradigmes

| Paradigme | Complexité typique | Garantie | Application type |
|-----------|-------------------|----------|------------------|
| **Force brute** | O(n!), O(2ⁿ) | Optimale | Petites instances, vérification |
| **Backtracking** | Exponentiel (élagué) | Optimale | CSP, puzzles combinatoires |
| **Branch & Bound** | Exponentiel (élagué) | Optimale | Optimisation combinatoire |
| **Glouton** | O(n log n) | Conditionnelle | Arbres couvrants, codage |
| **Diviser pour régner** | O(n log n) | Selon problème | Tri, multiplication |
| **Programmation dynamique** | O(n²), O(nW) | Optimale | Optimisation, comptage |
| **Randomisé** | Variable | Probabiliste | Tri, tests, coupes |
| **Approximation** | Polynomial | α-approché | Problèmes NP-difficiles |

---

## Références bibliographiques

**Ouvrages de référence** :
- Cormen, T.H., Leiserson, C.E., Rivest, R.L., Stein, C. *Introduction to Algorithms* (CLRS), 4th ed., MIT Press, 2022.
- Kleinberg, J., Tardos, E. *Algorithm Design*, Pearson, 2006.
- Sedgewick, R., Wayne, K. *Algorithms*, 4th ed., Addison-Wesley, 2011.

**Algorithmes d'approximation** :
- Vazirani, V.V. *Approximation Algorithms*, Springer, 2001.
- Williamson, D.P., Shmoys, D.B. *The Design of Approximation Algorithms*, Cambridge, 2011.

**Algorithmes randomisés** :
- Motwani, R., Raghavan, P. *Randomized Algorithms*, Cambridge, 1995.

**Articles fondateurs** :
- Bellman, R. (1952). "On the theory of dynamic programming." *PNAS*.
- Land, A.H., Doig, A.G. (1960). "An automatic method for solving discrete programming problems." *Econometrica*.
- Karatsuba, A., Ofman, Y. (1962). "Multiplication of multidigit numbers on automata." *Soviet Physics Doklady*.
- Strassen, V. (1969). "Gaussian elimination is not optimal." *Numerische Mathematik*.
- Christofides, N. (1976). "Worst-case analysis of a new heuristic for the travelling salesman problem." Technical Report, CMU.
- Cook, S.A. (1971). "The complexity of theorem-proving procedures." *STOC*.
- Feige, U. (1998). "A threshold of ln n for approximating set cover." *JACM*.