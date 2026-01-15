# La notation Big O : analyse mathématique complète de la complexité algorithmique

La notation Big O constitue le langage universel des informaticiens pour comparer l'efficacité des algorithmes. Elle répond à une question fondamentale : **comment le temps d'exécution ou la mémoire utilisée évoluent-ils lorsque la taille des données augmente ?** Introduite en 1894 par le mathématicien Paul Bachmann pour la théorie des nombres, cette notation a été adoptée par l'informatique dans les années 1960-70 et standardisée par Donald Knuth. Elle permet de comparer les performances algorithmiques indépendamment du matériel — un algorithme O(n²) sera toujours dépassé par un O(n log n) pour des données suffisamment grandes, quel que soit l'ordinateur utilisé.

---

## Section A — Définition formelle et principes fondamentaux

### Ce que mesure réellement Big O

Imaginez deux algorithmes de tri : l'un effectue **50n** opérations, l'autre **2n²** opérations. Pour 10 éléments, le premier est plus lent (500 vs 200). Mais pour 1000 éléments, la situation s'inverse dramatiquement (50 000 vs 2 000 000). La notation Big O capture précisément cette asymétrie en se concentrant sur le **comportement asymptotique** — c'est-à-dire ce qui se passe quand n devient très grand.

L'idée centrale est de classifier les algorithmes par leur **taux de croissance** plutôt que par leur performance exacte. Un algorithme O(n) sera toujours plus rapide qu'un algorithme O(n²) pour des entrées suffisamment grandes, indépendamment des constantes cachées ou des optimisations de bas niveau.

### La notation de Landau : définition mathématique rigoureuse

Les « symboles de Landau » (ou notation de Bachmann-Landau) forment une famille de notations décrivant le comportement asymptotique des fonctions. Le terme « Landau » honore Edmund Landau qui a systématisé leur usage, bien que Paul Bachmann en soit l'inventeur. La lettre O provient de l'allemand *Ordnung* (ordre), désignant l'ordre d'approximation.

**Big O — O(g(n)) — Borne supérieure asymptotique**

La définition formelle avec quantificateurs s'énonce ainsi :

$$f(n) = O(g(n)) \iff \exists c > 0, \exists n_0 \in \mathbb{N} : \forall n \geq n_0, |f(n)| \leq c \cdot |g(n)|$$

En notation ensembliste, plus rigoureuse :

$$O(g) = \{f : \mathbb{N} \to \mathbb{R} \mid \exists c > 0, \exists n_0 \in \mathbb{N}, \forall n \geq n_0, 0 \leq f(n) \leq c \cdot g(n)\}$$

Cette définition signifie que f(n) ne croît pas plus vite que g(n) à partir d'un certain seuil. Le Big O fournit une **borne supérieure** sur le taux de croissance — il répond à la question « dans le pire cas, à quelle vitesse mon algorithme ralentit-il ? »

**Définition alternative par limite :**

$$f = O(g) \iff \limsup_{n \to \infty} \frac{|f(n)|}{g(n)} < \infty$$

Cette formulation équivalente indique que le rapport f(n)/g(n) reste borné quand n tend vers l'infini.

**Big Omega — Ω(g(n)) — Borne inférieure asymptotique**

$$f(n) = \Omega(g(n)) \iff \exists c > 0, \exists n_0 \in \mathbb{N} : \forall n \geq n_0, f(n) \geq c \cdot g(n)$$

Omega indique que f(n) croît **au moins** aussi vite que g(n). C'est la borne inférieure, utile pour les preuves d'optimalité : si un problème est Ω(n log n), aucun algorithme ne peut faire mieux asymptotiquement.

**Relation avec Big O :** f(n) = Ω(g(n)) ⟺ g(n) = O(f(n))

**Exemple :** n² = Ω(n) car pour c = 1 et n₀ = 1 : n² ≥ n pour tout n ≥ 1.

**Big Theta — Θ(g(n)) — Borne exacte**

$$f(n) = \Theta(g(n)) \iff \exists c_1 > 0, c_2 > 0, \exists n_0 : \forall n \geq n_0, c_1 \cdot g(n) \leq f(n) \leq c_2 \cdot g(n)$$

Le Theta, introduit par Donald Knuth en 1976, encadre f(n) entre deux constantes multiplicatives de g(n). Un algorithme est Θ(n log n) quand sa complexité est **exactement** de cet ordre — ni plus lent, ni plus rapide asymptotiquement. Le théorème fondamental établit que f(n) = Θ(g(n)) si et seulement si f(n) = O(g(n)) **et** f(n) = Ω(g(n)).

**Petit o et petit omega — domination stricte**

$$f(n) = o(g(n)) \iff \lim_{n \to \infty} \frac{f(n)}{g(n)} = 0$$

Le petit o indique que f(n) est **négligeable** devant g(n). Par exemple, n = o(n²) car n/n² → 0. Le petit omega (ω) représente la domination stricte inverse : f(n) = ω(g(n)) signifie que f croît strictement plus vite que g.

$$f(n) = \omega(g(n)) \iff \lim_{n \to \infty} \frac{f(n)}{g(n)} = \infty$$

**Exemple :** 2n = o(n²) car lim(n→∞) 2n/n² = 0, mais 2n² ≠ o(n²).

| Notation | Analogie | Signification |
|----------|----------|---------------|
| f = O(g) | f ≤ g | f croît au plus aussi vite que g |
| f = o(g) | f < g | f croît strictement moins vite |
| f = Ω(g) | f ≥ g | f croît au moins aussi vite |
| f = ω(g) | f > g | f croît strictement plus vite |
| f = Θ(g) | f = g | f et g ont le même taux de croissance |

### Comportement asymptotique : signification intuitive et mathématique

Le terme **asymptotique** (du grec "asumptōtos" — qui ne se rejoint pas) décrit le comportement d'une fonction lorsque son argument tend vers l'infini. Mathématiquement :

Deux fonctions f et g sont **asymptotiquement équivalentes** (f ~ g) si :
$$\lim_{n \to \infty} \frac{f(n)}{g(n)} = 1$$

Pour f(n) = n² + 3n, lorsque n = 1000, le terme 3n ne représente que 0,3% de la valeur totale. En pratique, on dit que f(n) est "asymptotiquement équivalent à n²" car le terme dominant écrase tous les autres.

### Analyse du pire cas, cas moyen et meilleur cas

L'analyse de complexité distingue trois scénarios pour une même taille d'entrée n :

| Cas | Définition mathématique | Utilisation |
|-----|------------------------|-------------|
| **Pire cas** (worst-case) | T_worst(n) = max{T(x) : \|x\| = n} | Garanties de performance, systèmes critiques |
| **Cas moyen** (average-case) | T_avg(n) = Σ P(x)·T(x) | Comportement typique avec distribution connue |
| **Meilleur cas** (best-case) | T_best(n) = min{T(x) : \|x\| = n} | Rarement pertinent en pratique |

**Le pire cas est privilégié** pour plusieurs raisons : il fournit une **garantie absolue** de performance, ne nécessite aucune hypothèse sur la distribution des entrées, et protège contre les entrées adverses. Pour les systèmes temps-réel (contrôle aérien, dispositifs médicaux), accepter un algorithme qui "fonctionne bien en moyenne" serait catastrophique.

**Exemple concret — Recherche linéaire :**

```python
def recherche_lineaire(tableau, cible):
    for i, element in enumerate(tableau):
        if element == cible:
            return i
    return -1
```

- **Meilleur cas** : O(1) — élément en première position
- **Cas moyen** : O(n/2) = O(n) — élément au milieu statistiquement (en supposant une distribution uniforme, la moyenne des positions est (1 + 2 + ... + n)/n = (n+1)/2)
- **Pire cas** : O(n) — élément absent ou en dernière position

**Exemple éclairant — Quicksort :**

Le **tri rapide (Quicksort)** illustre l'importance de cette distinction. Son pire cas survient quand le pivot choisi est systématiquement le plus petit ou le plus grand élément (tableau déjà trié), donnant une complexité **Θ(n²)**. Son cas moyen avec pivot aléatoire est **Θ(n log n)**, ce qui explique son utilisation massive malgré un pire cas défavorable.

### Règles de simplification avec preuves mathématiques

Deux règles fondamentales permettent de simplifier les expressions Big O : l'élimination des constantes multiplicatives et la conservation du terme dominant.

#### Règle 1 : Ignorer les constantes multiplicatives — O(k·n) = O(n)

**Intuition :** Un algorithme qui fait 2n opérations croît au même rythme qu'un algorithme qui en fait 5n ou 1000n. Quand n double, le temps double dans tous les cas — seul le facteur de proportionnalité change.

```python
# Ces trois fonctions ont toutes une complexité O(n)
def version_simple(arr):
    for x in arr:           # n opérations
        traiter(x)

def version_double(arr):
    for x in arr:           # 2n opérations au total
        traiter(x)
        traiter(x)

def version_constante(arr):
    for x in arr:           # 5n opérations au total
        for _ in range(5):  # Boucle constante (ne dépend pas de n)
            traiter(x)
```

**Preuve formelle :**

Soit f(n) = k·n pour une constante k > 0. Nous voulons montrer que f(n) = O(n).

Choisissons c = k et n₀ = 1. Pour tout n ≥ 1 :
$$k \cdot n \leq k \cdot n$$

La définition de Big O est satisfaite avec c = k. Donc k·n = O(n). ∎

De manière générale, si f(n) = O(k·g(n)), alors en posant c' = c·k, on obtient f(n) = O(g(n)).

*Intuition physique* : Doubler la vitesse d'un processeur divise le temps par 2, mais ne change pas le comportement asymptotique. Un algorithme qui prend 2n opérations reste linéaire — il sera toujours dépassé par un O(n²) pour n suffisamment grand.

#### Règle 2 : Garder uniquement le terme dominant — O(n² + n) = O(n²)

**Intuition :** Dans une expression comme n² + n, quand n = 1000, on a n² = 1 000 000 et n = 1 000. Le terme n ne représente que 0,1% du total — il devient négligeable.

```python
def exemple_quadratique_plus_lineaire(arr):
    n = len(arr)
    
    # Partie quadratique : O(n²)
    for i in range(n):
        for j in range(n):
            comparer(arr[i], arr[j])
    
    # Partie linéaire : O(n) — négligeable face à O(n²)
    for x in arr:
        afficher(x)

# Complexité totale : O(n² + n) = O(n²)
```

**Preuve formelle :**

Nous voulons montrer qu'il existe c > 0 et n₀ tels que pour tout n ≥ n₀ : n² + n ≤ c·n².

Pour n ≥ 1, on a n ≤ n². Donc :
$$n^2 + n \leq n^2 + n^2 = 2n^2$$

En choisissant c = 2 et n₀ = 1, la définition est satisfaite. Donc n² + n = O(n²). ∎

**Vérification alternative :** Divisons les deux membres par n² (pour n > 0) :
$$1 + \frac{1}{n} \leq c$$

Pour n ≥ 1 : 1 + 1/n ≤ 1 + 1 = 2. Donc c = 2 suffit.

#### Règle 3 : Le terme de croissance la plus rapide domine

**Preuve que O(log n + n) = O(n) :**

Fait fondamental : log n < n pour tout n ≥ 1 (log n = o(n), croissance strictement inférieure).

Soit f(n) = log n + n :
- log n + n < n + n = 2n pour tout n ≥ 1
- Choisissons c = 2 et n₀ = 1

Donc log n + n = O(n). ∎

**Cas général pour un polynôme :**

Soit f(n) = aₐnᵈ + aₐ₋₁nᵈ⁻¹ + ... + a₀ avec aₐ > 0. Pour n ≥ 1, chaque terme aᵢnⁱ satisfait |aᵢnⁱ| ≤ |aᵢ|nᵈ. Donc |f(n)| ≤ (Σ|aᵢ|)·nᵈ, ce qui prouve que **tout polynôme de degré d est Θ(nᵈ)**.

**Théorème général (CLRS) :** Pour tout polynôme p(n) = Σᵢ₌₀ᵈ aᵢnⁱ avec aᵈ > 0 :
$$p(n) = \Theta(n^d)$$

Le degré le plus élevé détermine la complexité asymptotique.

### Propriétés mathématiques fondamentales

Les notations asymptotiques possèdent des propriétés algébriques importantes :

- **Réflexivité** : f = O(f), f = Ω(f), f = Θ(f). Preuve : c = 1 et n₀ = 0 satisfont f(n) ≤ 1·f(n).
- **Transitivité** : Si f = O(g) et g = O(h), alors f = O(h). Preuve : Si f ≤ c₁·g pour n ≥ n₁ et g ≤ c₂·h pour n ≥ n₂, alors f ≤ c₁·c₂·h pour n ≥ max(n₁, n₂).
- **Symétrie** (uniquement pour Θ) : f = Θ(g) ⟺ g = Θ(f).
- **Règle de la somme** : O(f) + O(g) = O(max(f, g)).
- **Règle du produit** : O(f) · O(g) = O(f · g).

### Exemples concrets d'application des règles

**Exemple 1 : Deux boucles séquentielles**

```
pour i de 1 à n:
    opération_1()         // O(n)
pour j de 1 à n:
    opération_2()         // O(n)
```

Complexité totale : O(n) + O(n) = O(n). Les boucles séquentielles s'additionnent, et le terme dominant reste linéaire.

**Exemple 2 : Boucles imbriquées avec constante**

```
pour i de 1 à 100:       // 100 itérations (constante)
    pour j de 1 à n:
        opération()      // n itérations
```

Complexité : 100 × n = O(n). La constante 100 disparaît asymptotiquement.

**Exemple 3 : Algorithme mixte**

```
pour i de 1 à n:
    pour j de 1 à n:
        opération_A()    // O(n²)
pour k de 1 à n:
    opération_B()        // O(n)
```

Complexité totale : O(n²) + O(n) = O(n²). Le terme quadratique domine.

### Application pratique à du vrai code

```python
def algorithme_complexe(arr):
    n = len(arr)
    resultat = 0
    
    # Bloc 1 : O(n²)
    for i in range(n):
        for j in range(n):
            resultat += arr[i] * arr[j]
    
    # Bloc 2 : O(n)
    for x in arr:
        resultat += x
    
    # Bloc 3 : O(n log n) — tri
    arr_trie = sorted(arr)
    
    # Bloc 4 : O(log n) — recherche dichotomique
    recherche_binaire(arr_trie, resultat)
    
    # Bloc 5 : O(1)
    return resultat * 2

# Analyse :
# O(n²) + O(n) + O(n log n) + O(log n) + O(1)
# = O(n²)  ← le terme quadratique domine
```

---

## Section B — Complexité temporelle versus complexité spatiale

### Définitions et différences fondamentales

**Complexité temporelle** : mesure le nombre d'opérations élémentaires (comparaisons, affectations, opérations arithmétiques) qu'un algorithme effectue en fonction de la taille de l'entrée n. Elle détermine « combien de temps » l'algorithme prendra, indépendamment de la vitesse du processeur. Elle ne mesure pas le temps réel en secondes, qui dépend du matériel.

**Complexité spatiale** : mesure la quantité de mémoire (variables, structures de données auxiliaires, pile de récursion) utilisée par l'algorithme. Elle peut inclure l'espace de l'entrée elle-même ou se concentrer sur l'espace **supplémentaire** requis (espace auxiliaire).

| Aspect | Temps | Espace |
|--------|-------|--------|
| Ressource mesurée | Cycles CPU | Mémoire RAM |
| Nature | Irréversible (temps perdu) | Réutilisable (mémoire libérée) |
| Impact utilisateur | Latence, réactivité | Capacité, scalabilité |
| Notation | T(n) | S(n) |

Un algorithme peut être excellent en temps mais gourmand en espace, ou inversement. Cette tension fondamentale génère les **trade-offs temps/espace**, au cœur de nombreuses décisions d'ingénierie.

```python
def exemple_temps_vs_espace(n):
    # Complexité temporelle : O(n) — une boucle
    # Complexité spatiale : O(n) — création d'un tableau
    tableau = [i * 2 for i in range(n)]
    
    somme = 0
    for x in tableau:
        somme += x
    return somme
```

### Complexité spatiale auxiliaire vs totale

Cette distinction est cruciale pour comparer équitablement les algorithmes :

| Type | Définition | Ce qu'elle inclut |
|------|------------|-------------------|
| **Espace auxiliaire** | Mémoire supplémentaire utilisée | Variables, tableaux temporaires, pile de récursion |
| **Espace total** | Empreinte mémoire complète | Données d'entrée + espace auxiliaire |

**Formule :** Complexité spatiale totale = Espace d'entrée + Espace auxiliaire

```python
def somme_tableau(arr):
    """
    Espace d'entrée : O(n) — le tableau arr
    Espace auxiliaire : O(1) — uniquement les variables somme et i
    Espace total : O(n)
    """
    somme = 0
    for i in range(len(arr)):
        somme += arr[i]
    return somme
```

**Pourquoi cette distinction importe :** Lors de la comparaison d'algorithmes de tri, l'espace auxiliaire est le critère pertinent. Merge Sort utilise O(n) d'espace auxiliaire (tableaux temporaires), tandis que Heap Sort utilise O(1). Pourtant, tous deux ont une complexité spatiale totale de O(n) puisqu'ils stockent les mêmes données d'entrée.

### La pile de récursion : un piège fréquent

Chaque appel récursif consomme de l'espace sur la pile d'exécution. La complexité spatiale d'un algorithme récursif est au minimum proportionnelle à la **profondeur maximale de récursion**.

```python
def factorielle_recursive(n):
    """
    Pile d'appels : fact(5) → fact(4) → fact(3) → fact(2) → fact(1)
    Complexité temporelle : O(n)
    Complexité spatiale : O(n) — n frames sur la pile
    """
    if n <= 1:
        return 1
    return n * factorielle_recursive(n - 1)

def factorielle_iterative(n):
    """
    Pas de récursion
    Complexité temporelle : O(n)
    Complexité spatiale : O(1) — uniquement deux variables
    """
    resultat = 1
    for i in range(2, n + 1):
        resultat *= i
    return resultat
```

**Erreur courante avec Fibonacci récursif :**

```python
def fibonacci_recursif(n):
    if n <= 1:
        return n
    return fibonacci_recursif(n-1) + fibonacci_recursif(n-2)
```

Beaucoup pensent : "La complexité temporelle est O(2ⁿ), donc la spatiale aussi." **C'est faux.** Les appels ne s'exécutent pas simultanément — un chemin complet se termine avant que l'autre ne démarre. La profondeur maximale de pile est n, donc l'espace est O(n), pas O(2ⁿ).

### Algorithmes in-place : O(1) d'espace auxiliaire

Un algorithme **in-place** opère directement sur les données d'entrée sans allouer de mémoire proportionnelle à n :

```python
def inverser_sur_place(arr):
    """O(1) espace auxiliaire — modification en place"""
    n = len(arr)
    for i in range(n // 2):
        arr[i], arr[n - 1 - i] = arr[n - 1 - i], arr[i]
    # Pas de tableau supplémentaire créé

def inverser_hors_place(arr):
    """O(n) espace auxiliaire — nouveau tableau créé"""
    n = len(arr)
    inverse = [0] * n  # Allocation de n éléments
    for i in range(n):
        inverse[n - 1 - i] = arr[i]
    return inverse
```

| Algorithme de tri | Temps | Espace auxiliaire |
|-------------------|-------|-------------------|
| Tri à bulles | O(n²) | O(1) — in-place |
| Tri par insertion | O(n²) | O(1) — in-place |
| Tri par tas (Heapsort) | O(n log n) | O(1) — in-place |
| Tri fusion (Mergesort) | O(n log n) | O(n) — tableaux temporaires |
| Tri rapide (Quicksort) | O(n log n) moy. | O(log n) — pile de récursion |

### Trade-offs classiques entre temps et espace

Le principe général est qu'on peut souvent **réduire le temps en augmentant l'espace**, ou inversement. Cette relation n'est pas symétrique : économiser de l'espace coûte généralement du temps, tandis que l'inverse n'est pas toujours vrai.

#### La mémoïsation : paradigme du trade-off

La mémoïsation consiste à stocker les résultats de calculs coûteux pour éviter de les recalculer. L'exemple canonique est la suite de Fibonacci :

**Pseudo-code :**
```
// Version récursive naïve — O(2ⁿ) temps, O(n) espace (pile)
fonction fib_naif(n):
    si n ≤ 1: retourner n
    retourner fib_naif(n-1) + fib_naif(n-2)

// Version mémoïsée — O(n) temps, O(n) espace
memo = {}
fonction fib_memo(n):
    si n dans memo: retourner memo[n]
    si n ≤ 1: retourner n
    memo[n] = fib_memo(n-1) + fib_memo(n-2)
    retourner memo[n]

// Version itérative optimale — O(n) temps, O(1) espace
fonction fib_iteratif(n):
    si n ≤ 1: retourner n
    prev, curr = 0, 1
    pour i de 2 à n:
        prev, curr = curr, prev + curr
    retourner curr
```

**Code Python équivalent :**
```python
# SANS mémoïsation : O(2^n) temps, O(n) espace
def fib_naif(n):
    if n <= 1:
        return n
    return fib_naif(n-1) + fib_naif(n-2)

# AVEC mémoïsation : O(n) temps, O(n) espace
memo = {}
def fib_memo(n):
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib_memo(n-1) + fib_memo(n-2)
    return memo[n]

# Version optimale : O(n) temps, O(1) espace
def fib_iteratif(n):
    if n <= 1:
        return n
    prev2, prev1 = 0, 1
    for _ in range(2, n + 1):
        prev2, prev1 = prev1, prev1 + prev2
    return prev1
```

| Approche | Temps | Espace | Commentaire |
|----------|-------|--------|-------------|
| Récursive naïve | **O(2ⁿ)** | O(n) | Recalcule exponentiellement |
| Mémoïsée | **O(n)** | O(n) | Échange mémoire contre temps |
| Itérative | **O(n)** | **O(1)** | Optimale sur les deux axes |

La mémoïsation transforme une complexité exponentielle en linéaire au prix de O(n) mémoire — un trade-off souvent excellent.

Pour calculer le 30ᵉ nombre de Fibonacci : la version naïve effectue **2 692 537 appels**, la version mémoïsée seulement **31 calculs** — un gain de 86 000x en échangeant O(n) d'espace mémoire.

#### Tables de hachage versus recherche linéaire

Les tables de hachage (HashMaps) illustrent comment la mémoire supplémentaire accélère les opérations :

| Structure | Recherche | Insertion | Espace |
|-----------|-----------|-----------|--------|
| Tableau non trié | O(n) | O(1) | O(n) |
| Table de hachage | **O(1)** moyen | O(1) | O(n) + overhead |
| Arbre binaire équilibré | O(log n) | O(log n) | O(n) |

Les HashMaps utilisent **plus de mémoire** (facteur de charge, gestion des collisions) mais offrent un accès quasi-instantané. C'est un trade-off classique : payer en espace pour gagner en temps.

```python
def recherche_dans_liste(liste, cible):
    """O(n) temps, O(1) espace auxiliaire"""
    for element in liste:
        if element == cible:
            return True
    return False

def recherche_avec_hashset(liste, cible):
    """O(1) temps moyen, O(n) espace auxiliaire"""
    ensemble = set(liste)  # Construction O(n), stockage O(n)
    return cible in ensemble  # Lookup O(1)
```

#### Pré-calcul vs calcul à la demande

```python
# Calcul à la demande : O(1) espace, temps variable
def calculer_carre(n):
    return n * n

# Table pré-calculée : O(n) espace, O(1) lookup
carres = [i * i for i in range(10001)]
def lookup_carre(n):
    return carres[n]
```

Dans les systèmes embarqués ou les jeux vidéo, les fonctions trigonométriques sont parfois pré-calculées dans des tables :

| Approche | Temps d'accès | Espace | Usage |
|----------|--------------|--------|-------|
| Table pré-calculée | O(1) | O(n) élevé | Jeux, systèmes temps réel |
| Calcul direct | O(k) selon précision | O(1) | Quand l'espace est critique |

Ce même principe s'applique aux **Rainbow tables** en cryptographie (casser des mots de passe), à la **compression de données** (accès rapide vs taille réduite), ou au **cache d'images** (rendu instantané vs économie de RAM).

### Exemples d'algorithmes illustrant les compromis

**Tri in-place versus tri fusion**

| Algorithme | Temps moyen | Temps pire | Espace | Stabilité |
|------------|-------------|------------|--------|-----------|
| QuickSort (in-place) | O(n log n) | O(n²) | **O(log n)** | Non |
| MergeSort | O(n log n) | O(n log n) | **O(n)** | Oui |
| HeapSort | O(n log n) | O(n log n) | **O(1)** | Non |

**QuickSort** privilégie l'espace : il trie « sur place » avec seulement O(log n) de mémoire pour la pile de récursion, mais son pire cas est quadratique. **MergeSort** privilégie la prévisibilité : sa complexité est garantie O(n log n) mais il consomme O(n) d'espace auxiliaire pour les fusions. **HeapSort** est optimal en espace (O(1)) mais souffre d'une mauvaise localité de cache.

*Choix pratique* : QuickSort pour les systèmes à mémoire limitée ; MergeSort pour les données séquentielles (listes chaînées) ou quand la stabilité du tri est requise.

### Erreurs courantes dans l'analyse spatiale

**Erreur 1 : Oublier la pile de récursion**
```python
def somme_recursive(arr, n):
    if n == 0:
        return 0
    return arr[n-1] + somme_recursive(arr, n-1)
# FAUX : "Pas de structure de données → O(1)"
# VRAI : n appels récursifs → O(n) espace
```

**Erreur 2 : Confondre auxiliaire et total**
```python
def afficher_tableau(arr):
    for x in arr:
        print(x)
# Espace total : O(n) — inclut arr
# Espace auxiliaire : O(1) — seule variable de boucle
```

**Erreur 3 : Ignorer le coût des structures de données**
```python
# Un tableau de n entiers : ~4n octets
# Une table de hachage de n entiers : ~16n-32n octets
# (overhead : buckets, facteur de charge, gestion des collisions)
```

---

## Section C — Hiérarchie des complexités algorithmiques

La hiérarchie des complexités, du plus rapide au plus lent, s'ordonne ainsi :

$$O(1) < O(\log n) < O(\sqrt{n}) < O(n) < O(n \log n) < O(n^2) < O(n^3) < O(2^n) < O(n!) < O(n^n)$$

### Vue d'ensemble comparative

Le tableau suivant illustre l'impact dramatique de la complexité sur les temps d'exécution réels, en supposant **1 milliard d'opérations par seconde** :

| n | O(1) | O(log n) | O(n) | O(n log n) | O(n²) | O(2ⁿ) | O(n!) |
|---|------|----------|------|------------|-------|-------|-------|
| 10 | 1 ns | 3 ns | 10 ns | 33 ns | 100 ns | 1 μs | 3,6 ms |
| 20 | 1 ns | 4 ns | 20 ns | 86 ns | 400 ns | 1 ms | **77 ans** |
| 100 | 1 ns | 7 ns | 100 ns | 664 ns | 10 μs | 10¹⁸ ans | ∞ |
| 1 000 | 1 ns | 10 ns | 1 μs | 10 μs | 1 ms | ∞ | ∞ |
| 1 000 000 | 1 ns | 20 ns | 1 ms | 20 ms | 16 min | ∞ | ∞ |

### O(1) — Complexité constante : l'idéal absolu

Un algorithme O(1) effectue le même nombre d'opérations quelle que soit la taille de l'entrée. Le temps est **constant** — traiter 10 ou 10 millions d'éléments prend le même temps.

**Pourquoi c'est constant :** L'algorithme accède directement à une donnée via un index, un pointeur ou un calcul d'adresse — aucune traversée nécessaire.

**Opérations typiques :**
- Accès à un élément de tableau par index : `tableau[i]`
- Push/pop sur une pile
- Opérations sur HashMap (en moyenne) : get, put, contains
- Vérification de parité : `n % 2 == 0`
- Insertion en tête de liste chaînée

**Pseudo-code :**
```
fonction accès_tableau(T, i):
    retourner T[i]    // Une seule opération, toujours

fonction push(pile P, x):
    P.sommet ← P.sommet + 1
    P[P.sommet] ← x   // Coût constant
```

**Code Python :**
```python
def acceder_element(tableau, index):
    """O(1) — Calcul direct de l'adresse mémoire"""
    return tableau[index]

def empiler(pile, element):
    """O(1) — Modifie uniquement le sommet"""
    pile.append(element)

def depiler(pile):
    """O(1) — Retire uniquement le sommet"""
    return pile.pop()

class Noeud:
    def __init__(self, valeur, suivant=None):
        self.valeur = valeur
        self.suivant = suivant

def inserer_en_tete(tete, valeur):
    """O(1) — Création et liaison en temps constant"""
    return Noeud(valeur, tete)
```

*Intuition* : C'est comme ouvrir un livre à une page marquée — peu importe l'épaisseur du livre, le temps est identique. L'accès tableau calcule directement l'adresse mémoire : adresse_base + index × taille_élément.

**Comment reconnaître O(1) dans le code :**
- Aucune boucle dépendant de n
- Accès direct : `dict[key]`, `array[index]`
- Opérations mathématiques simples
- Modification d'un nombre fixe d'éléments

---

### O(log n) — Complexité logarithmique : la puissance de diviser

À chaque étape, l'algorithme **divise** l'espace de recherche par un facteur constant (généralement 2). Pour n = 1 000 000, seulement **~20 étapes** suffisent car log₂(10⁶) ≈ 20.

**Pourquoi "log n" :** Chaque étape **divise par deux** l'espace de recherche. Avec 1 024 éléments :
```
1024 → 512 → 256 → 128 → 64 → 32 → 16 → 8 → 4 → 2 → 1
```
Exactement 10 étapes = log₂(1024).

**Algorithmes emblématiques :**
- Recherche dichotomique (binary search)
- Opérations sur arbres binaires équilibrés (AVL, Red-Black)
- Exponentiation rapide

**Pseudo-code :**
```
fonction recherche_binaire(T, x):
    gauche ← 0
    droite ← longueur(T) - 1
    
    tant que gauche ≤ droite:
        milieu ← (gauche + droite) / 2
        si T[milieu] = x:
            retourner milieu
        sinon si T[milieu] < x:
            gauche ← milieu + 1    // Élimine la moitié gauche
        sinon:
            droite ← milieu - 1    // Élimine la moitié droite
    
    retourner -1  // Non trouvé
```

**Code Python :**
```python
def recherche_dichotomique(arr, cible):
    """O(log n) — Division par 2 à chaque itération"""
    gauche, droite = 0, len(arr) - 1
    
    while gauche <= droite:
        milieu = gauche + (droite - gauche) // 2
        
        if arr[milieu] == cible:
            return milieu
        elif arr[milieu] < cible:
            gauche = milieu + 1   # Éliminer la moitié gauche
        else:
            droite = milieu - 1   # Éliminer la moitié droite
    
    return -1

def puissance_rapide(base, exposant):
    """O(log n) — Exponentiation par carrés successifs"""
    resultat = 1
    while exposant > 0:
        if exposant % 2 == 1:
            resultat *= base
        base *= base
        exposant //= 2  # Division par 2
    return resultat
```

*Pourquoi log₂(n) ?* Si n = 2^k, il faut exactement k divisions par 2 pour atteindre 1 élément. Pour n = 1024 = 2¹⁰, seulement 10 comparaisons suffisent.

*Intuition* : C'est le jeu « Plus ou Moins » — deviner un nombre entre 1 et 100 en maximum 7 essais en divisant systématiquement l'intervalle.

**Comment reconnaître O(log n) dans le code :**
- Variable de boucle **multipliée ou divisée** : `i *= 2` ou `i //= 2`
- Réduction de moitié de l'espace de recherche
- Parcours d'un seul chemin dans un arbre (pas tous les nœuds)
- Mots-clés : "binaire", "dichotomie", "diviser par 2"

---

### O(n) — Complexité linéaire : proportionnelle aux données

Le temps croît **proportionnellement** à la taille de l'entrée. Doubler n double le temps d'exécution.

**Pourquoi c'est linéaire :** L'algorithme doit examiner chaque élément exactement une fois (ou un nombre constant de fois). Aucun raccourci possible.

**Opérations typiques :**
- Parcours de tableau
- Recherche linéaire
- Calcul de somme, minimum, maximum
- Copie d'un tableau
- Comptage d'occurrences

**Pseudo-code :**
```
fonction recherche_linéaire(T, x):
    pour i de 0 à longueur(T) - 1:
        si T[i] = x:
            retourner i
    retourner -1

fonction somme(T):
    total ← 0
    pour chaque élément e dans T:
        total ← total + e
    retourner total
```

**Code Python :**
```python
def trouver_maximum(arr):
    """O(n) — Doit examiner chaque élément"""
    if not arr:
        return None
    maximum = arr[0]
    for element in arr:
        if element > maximum:
            maximum = element
    return maximum

def recherche_lineaire(arr, cible):
    """O(n) — Dans le pire cas, examine tout le tableau"""
    for i, element in enumerate(arr):
        if element == cible:
            return i
    return -1

def compter_occurrences(arr, cible):
    """O(n) — Parcours complet nécessaire"""
    compteur = 0
    for element in arr:
        if element == cible:
            compteur += 1
    return compteur
```

*Intuition* : Lire un livre page par page — 500 pages prennent deux fois plus de temps que 250 pages. Chaque élément doit être examiné exactement une fois.

**Comment reconnaître O(n) dans le code :**
- **Une seule boucle** parcourant l'entrée : `for x in collection`
- Travail constant sur chaque élément
- Pas de boucles imbriquées sur les mêmes données

---

### O(n log n) — Complexité linéarithmique : l'optimal des tris comparatifs

Cette complexité combine une dimension linéaire (traiter chaque élément) et logarithmique (structure d'arbre ou divisions successives). C'est la **borne inférieure théorique** pour tout algorithme de tri basé sur les comparaisons.

**Pourquoi "n log n" :** Structure **diviser-pour-régner** typique. Le tableau est récursivement divisé en deux (log n niveaux de profondeur), et à chaque niveau, tous les n éléments sont traités lors de la fusion.

**Analyse par le théorème maître :** Pour T(n) = 2T(n/2) + O(n) :
- a = 2 (deux sous-problèmes)
- b = 2 (taille divisée par 2)
- d = 1 (travail linéaire pour fusionner)
- Comme d = log_b(a), on obtient O(n^d · log n) = O(n log n)

**Algorithmes emblématiques :**
- Tri fusion (Merge Sort) — toujours O(n log n)
- Tri rapide (Quicksort) — en moyenne
- Tri par tas (Heapsort)
- FFT (Transformation de Fourier rapide)
- Timsort (tri Python natif)

**Pseudo-code :**
```
fonction tri_fusion(T):
    si longueur(T) ≤ 1:
        retourner T
    
    milieu ← longueur(T) / 2
    gauche ← tri_fusion(T[0..milieu-1])
    droite ← tri_fusion(T[milieu..fin])
    
    retourner fusion(gauche, droite)

fonction fusion(G, D):
    résultat ← []
    i ← 0, j ← 0
    
    tant que i < longueur(G) ET j < longueur(D):
        si G[i] ≤ D[j]:
            ajouter G[i] à résultat; i ← i + 1
        sinon:
            ajouter D[j] à résultat; j ← j + 1
    
    ajouter éléments restants de G et D
    retourner résultat
```

**Code Python :**
```python
def tri_fusion(arr):
    """O(n log n) — Diviser, conquérir, fusionner"""
    if len(arr) <= 1:
        return arr
    
    milieu = len(arr) // 2
    gauche = tri_fusion(arr[:milieu])    # T(n/2)
    droite = tri_fusion(arr[milieu:])    # T(n/2)
    
    return fusionner(gauche, droite)     # O(n)

def fusionner(gauche, droite):
    """O(n) — Fusion de deux tableaux triés"""
    resultat = []
    i = j = 0
    
    while i < len(gauche) and j < len(droite):
        if gauche[i] <= droite[j]:
            resultat.append(gauche[i])
            i += 1
        else:
            resultat.append(droite[j])
            j += 1
    
    resultat.extend(gauche[i:])
    resultat.extend(droite[j:])
    return resultat
```

*Pourquoi n × log(n) ?* Le tri fusion divise récursivement le tableau, créant **log₂(n) niveaux** de récursion. À chaque niveau, la fusion totale parcourt les **n éléments**. Total : n × log n opérations.

**Comment reconnaître O(n log n) dans le code :**
- Structure **diviser-pour-régner** avec deux appels récursifs sur des moitiés
- Travail linéaire O(n) à chaque niveau de récursion
- Algorithmes de tri efficaces
- Pattern : "diviser → récursion → fusionner"

---

### O(n²) — Complexité quadratique : le piège des boucles imbriquées

Deux boucles imbriquées de 0 à n génèrent n × n = n² opérations. Cette complexité devient rapidement **problématique** : pour n = 10 000, on atteint 100 millions d'opérations.

**Pourquoi c'est quadratique :** Deux boucles imbriquées parcourent chacune les n éléments. Pour chaque élément, on examine tous les autres : n × n = n².

**Algorithmes typiques :**
- Tri à bulles (Bubble Sort)
- Tri par sélection (Selection Sort)
- Tri par insertion (pire cas)
- Comparaison de tous les couples
- Vérification de toutes les paires

**Pseudo-code — Tri à bulles :**
```
fonction tri_bulles(T):
    n ← longueur(T)
    
    pour i de n-1 à 1:
        échangé ← faux
        pour j de 0 à i-1:
            si T[j] > T[j+1]:
                échanger T[j] et T[j+1]
                échangé ← vrai
        si non échangé:
            sortir    // Optimisation : tableau déjà trié
    
    retourner T
```

**Code Python :**
```python
def tri_a_bulles(arr):
    """O(n²) — Comparaisons adjacentes répétées"""
    n = len(arr)
    for i in range(n):                  # n itérations
        for j in range(n - i - 1):      # ~n itérations
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

def tri_par_selection(arr):
    """O(n²) — Recherche du minimum pour chaque position"""
    n = len(arr)
    for i in range(n):                  # n positions
        idx_min = i
        for j in range(i + 1, n):       # ~n éléments restants
            if arr[j] < arr[idx_min]:
                idx_min = j
        arr[i], arr[idx_min] = arr[idx_min], arr[i]
    return arr

def contient_doublon_naif(arr):
    """O(n²) — Compare chaque paire"""
    n = len(arr)
    for i in range(n):
        for j in range(i + 1, n):
            if arr[i] == arr[j]:
                return True
    return False
```

*Analyse mathématique* : La boucle extérieure fait n-1 itérations, l'intérieure fait i comparaisons. Total : (n-1) + (n-2) + ... + 1 = **n(n-1)/2 = O(n²)**.

*Intuition* : Dans une réunion de n personnes, si chacun serre la main de tous les autres, le nombre de poignées de main est n(n-1)/2 ≈ n²/2.

**Comment reconnaître O(n²) dans le code :**
- **Deux boucles imbriquées** sur les mêmes données
- "Pour chaque élément, examiner tous les autres"
- Algorithmes de tri simples (naïfs)
- Comparaisons de toutes les paires

---

### O(n³) — Complexité cubique : trois dimensions

Trois boucles imbriquées génèrent n³ opérations. Cette complexité est acceptable pour n < 500 environ.

**Exemples typiques :**
- Multiplication matricielle naïve
- Algorithme de Floyd-Warshall (plus courts chemins entre toutes les paires)
- Vérification de tous les triplets

**Exemple canonique : multiplication naïve de matrices**

**Pseudo-code :**
```
fonction multiplication_matrices(A, B):
    n ← dimension(A)
    C ← matrice n×n initialisée à 0
    
    pour i de 0 à n-1:
        pour j de 0 à n-1:
            pour k de 0 à n-1:
                C[i][j] ← C[i][j] + A[i][k] × B[k][j]
    
    retourner C
```

**Code Python :**
```python
def multiplication_matrices(A, B):
    """O(n³) — Trois boucles imbriquées"""
    n = len(A)
    C = [[0] * n for _ in range(n)]
    
    for i in range(n):          # Lignes de A
        for j in range(n):      # Colonnes de B
            for k in range(n):  # Somme des produits
                C[i][j] += A[i][k] * B[k][j]
    return C

def floyd_warshall(graphe):
    """O(n³) — Plus courts chemins entre toutes les paires"""
    n = len(graphe)
    dist = [ligne[:] for ligne in graphe]
    
    for k in range(n):          # Nœud intermédiaire
        for i in range(n):      # Source
            for j in range(n):  # Destination
                if dist[i][k] + dist[k][j] < dist[i][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]
    return dist
```

Pour chaque élément C[i][j] (n² éléments), on calcule une somme de n produits. Total : **n × n × n = n³ opérations**. L'algorithme de Strassen (1969) réduit cette complexité à O(n^2.807) par une approche diviser-pour-régner astucieuse.

**Comment reconnaître O(n³) dans le code :**
- **Trois boucles imbriquées** sur des données de taille n
- Opérations matricielles naïves
- "Pour chaque paire, considérer tous les intermédiaires possibles"

---

### O(2ⁿ) — Complexité exponentielle : l'explosion combinatoire

Le temps **double** à chaque élément ajouté. Ces algorithmes deviennent impraticables dès que n dépasse environ **25-30**.

**Pourquoi c'est exponentiel :** Récursion avec **branchement** : chaque appel génère deux (ou plus) nouveaux appels. L'arbre de récursion double de taille à chaque niveau, atteignant 2ⁿ nœuds.

**Problèmes typiques :**
- Génération de tous les sous-ensembles
- Fibonacci récursif naïf
- Recherche exhaustive sans élagage (problèmes NP)
- Tours de Hanoï
- Problème du sac à dos (brute force)

**Pseudo-code — Génération des sous-ensembles :**
```
fonction sous_ensembles(S):
    si S est vide:
        retourner {ensemble vide}
    
    x ← premier élément de S
    reste ← S sans x
    sous_ens ← sous_ensembles(reste)
    
    résultat ← sous_ens
    pour chaque s dans sous_ens:
        ajouter (s ∪ {x}) à résultat
    
    retourner résultat
```

**Code Python :**
```python
def fibonacci_naif(n):
    """O(2^n) — Arbre de récursion qui double à chaque niveau"""
    if n <= 1:
        return n
    return fibonacci_naif(n - 1) + fibonacci_naif(n - 2)

def generer_sous_ensembles(arr):
    """O(2^n) — Il existe exactement 2^n sous-ensembles"""
    resultat = []
    n = len(arr)
    
    for i in range(2 ** n):     # 2^n itérations
        sous_ensemble = []
        for j in range(n):
            if i & (1 << j):    # Bit j activé ?
                sous_ensemble.append(arr[j])
        resultat.append(sous_ensemble)
    return resultat

def resoudre_sac_a_dos_brute(poids, valeurs, capacite, index=0):
    """O(2^n) — Arbre binaire : inclure ou exclure chaque objet"""
    if index >= len(poids) or capacite <= 0:
        return 0
    
    # Option 1 : ne pas prendre l'objet
    sans = resoudre_sac_a_dos_brute(poids, valeurs, capacite, index + 1)
    
    # Option 2 : prendre l'objet (si possible)
    avec = 0
    if poids[index] <= capacite:
        avec = valeurs[index] + resoudre_sac_a_dos_brute(
            poids, valeurs, capacite - poids[index], index + 1
        )
    
    return max(sans, avec)
```

*Pourquoi 2ⁿ ?* Un ensemble de n éléments possède exactement **2ⁿ sous-ensembles** — chaque élément peut être présent ou absent, soit 2 choix par élément.

*Données concrètes* : 2³⁰ ≈ 1 milliard d'opérations ≈ 1 seconde. 2⁴⁰ ≈ 18 minutes. 2⁵⁰ ≈ 13 jours. **2⁶⁴ ≈ 585 ans**.

**Comment reconnaître O(2ⁿ) dans le code :**
- **Deux appels récursifs** sans mémoïsation
- Génération de tous les sous-ensembles
- Arbres de décision binaires : "inclure ou exclure"
- Pattern : `f(n) = f(n-1) + f(n-2)` ou similaire

---

### O(n!) — Complexité factorielle : la frontière de l'impossible

Le temps croît de façon **factorielle** : n! = n × (n-1) × (n-2) × ... × 1. C'est la croissance la plus rapide couramment rencontrée, rendant les algorithmes inutilisables dès n ≈ 12.

**Pourquoi c'est factoriel :** Énumération de **toutes les permutations**. Pour n éléments : n choix pour la première position, (n-1) pour la deuxième, etc. Total : n × (n-1) × (n-2) × ... × 1 = n!

**Problèmes emblématiques :**
- Problème du voyageur de commerce (brute force)
- Génération de toutes les permutations
- Ordonnancement optimal exhaustif

**Pseudo-code :**
```
fonction permutations(L):
    si longueur(L) ≤ 1:
        retourner [L]
    
    résultat ← []
    pour chaque élément e dans L:
        reste ← L sans e
        pour chaque perm dans permutations(reste):
            ajouter (e + perm) à résultat
    
    retourner résultat

fonction TSP_brute_force(villes, distances):
    meilleur_coût ← +∞
    ville_départ ← villes[0]
    
    pour chaque permutation P de villes[1..n-1]:
        circuit ← [ville_départ] + P + [ville_départ]
        coût ← calculer_distance_totale(circuit)
        si coût < meilleur_coût:
            meilleur_coût ← coût
            meilleur_circuit ← circuit
    
    retourner meilleur_circuit
```

**Code Python :**
```python
from itertools import permutations

def voyageur_de_commerce_brute(distances):
    """O(n!) — Teste toutes les routes possibles"""
    n = len(distances)
    villes = list(range(1, n))  # Toutes sauf la ville de départ
    
    distance_min = float('inf')
    meilleure_route = None
    
    for perm in permutations(villes):  # (n-1)! permutations
        route = [0] + list(perm) + [0]
        distance = sum(
            distances[route[i]][route[i + 1]]
            for i in range(len(route) - 1)
        )
        if distance < distance_min:
            distance_min = distance
            meilleure_route = route
    
    return meilleure_route, distance_min

def generer_permutations(arr):
    """O(n!) — Génère toutes les n! permutations"""
    if len(arr) <= 1:
        return [arr]
    
    resultat = []
    for i, elem in enumerate(arr):
        reste = arr[:i] + arr[i + 1:]
        for perm in generer_permutations(reste):
            resultat.append([elem] + perm)
    return resultat
```

*Données terrifiantes* : 10! = 3 628 800 (millisecondes). 13! ≈ 6 secondes. 15! ≈ 22 minutes. **20! ≈ 77 ans**. 25! ≈ **490 milliards d'années** — plus que l'âge de l'univers.

**Comment reconnaître O(n!) dans le code :**
- Génération ou parcours de **toutes les permutations**
- Récursion avec ensemble de choix décroissant
- "Essayer tous les ordres possibles"
- Problèmes d'optimisation combinatoire résolus par force brute

---

### Tableau récapitulatif des complexités

| Complexité | Nom | n=10 | n=100 | n=1000 | n max (~1 sec) |
|------------|-----|------|-------|--------|----------------|
| O(1) | Constante | 1 | 1 | 1 | ∞ |
| O(log n) | Logarithmique | 3 | 7 | 10 | 10¹⁸ |
| O(n) | Linéaire | 10 | 100 | 1 000 | ~10⁸ |
| O(n log n) | Linéarithmique | 33 | 664 | 10 000 | ~10⁶ |
| O(n²) | Quadratique | 100 | 10 000 | 10⁶ | ~10⁴ |
| O(n³) | Cubique | 1 000 | 10⁶ | 10⁹ | ~500 |
| O(2ⁿ) | Exponentielle | 1 024 | 10³⁰ | ∞ | ~25 |
| O(n!) | Factorielle | 3.6×10⁶ | ∞ | ∞ | ~11 |

### Guide rapide de reconnaissance des complexités

| Pattern dans le code | Complexité |
|---------------------|------------|
| Pas de boucle, accès direct | **O(1)** |
| Boucle qui divise/multiplie par constante | **O(log n)** |
| Une boucle simple : `for x in data` | **O(n)** |
| Diviser-pour-régner + fusion linéaire | **O(n log n)** |
| Deux boucles imbriquées sur n | **O(n²)** |
| Trois boucles imbriquées sur n | **O(n³)** |
| Deux appels récursifs (sans mémo) | **O(2ⁿ)** |
| Génération de toutes les permutations | **O(n!)** |

### Analogies pédagogiques pour retenir la hiérarchie

| Complexité | Analogie du monde réel |
|------------|------------------------|
| O(1) | Ouvrir un livre à une page marquée — instantané |
| O(log n) | Chercher dans un dictionnaire — on divise par 2 à chaque étape |
| O(n) | Lire un livre page par page — proportionnel à l'épaisseur |
| O(n log n) | Trier des copies d'examen par fusion — diviser, trier, fusionner |
| O(n²) | Poignées de main dans un groupe — chacun salue tous les autres |
| O(2ⁿ) | Configurations de n interrupteurs — chacun double les possibilités |
| O(n!) | Tous les ordres possibles pour asseoir n personnes — explosion totale |

---

## Contexte historique : de Bachmann à Knuth

### Paul Bachmann (1837-1920) : l'invention

Paul Gustav Heinrich Bachmann introduit le symbole **O** en **1894** dans le second volume de son ouvrage *Die Analytische Zahlentheorie* (La théorie analytique des nombres). Le O représente « Ordnung » (ordre en allemand), désignant l'ordre d'approximation d'une fonction. La notation servait alors à décrire le comportement asymptotique des fonctions arithmétiques, notamment dans le contexte du théorème des nombres premiers.

### Edmund Landau (1877-1938) : la popularisation

Edmund Landau adopte la notation O de Bachmann et l'enrichit en **1909** avec le « petit o » dans son *Handbuch der Lehre von der Verteilung der Primzahlen*. Bien qu'il n'ait pas inventé la notation, sa systématisation dans près de 400 publications a conduit au terme « **symboles de Landau** ». Hardy et Littlewood ajouteront Ω en 1914.

### Donald Knuth (né 1938) : la standardisation informatique

Le « père de l'analyse des algorithmes », récipiendaire du Prix Turing 1974, standardise la notation Big O pour l'informatique dans *The Art of Computer Programming* (1968+). Il introduit la notation **Θ** en 1976 pour les bornes exactes et clarifie l'usage de **Ω** avec sa définition moderne. Cette œuvre monumentale reste la référence absolue en algorithmique.

---

## Conclusion

La notation Big O transcende la simple mesure de performance pour devenir un **outil de pensée algorithmique** et un **langage de communication** universel entre développeurs. Elle permet de distinguer immédiatement un algorithme viable (O(n log n)) d'un algorithme condamné (O(2ⁿ)), de justifier un trade-off temps/espace, ou de prouver l'optimalité d'une solution.

### Les enseignements fondamentaux

**Premièrement**, les **constantes disparaissent** asymptotiquement mais comptent en pratique pour des données de taille raisonnable. Un algorithme O(n) avec une constante de 1000 sera plus lent qu'un O(n²) pour n < 32.

**Deuxièmement**, la distinction entre **O, Ω et Θ** est cruciale pour une analyse précise — dire qu'un algorithme est « O(n²) » quand il est Θ(n log n) est techniquement correct mais trompeur.

**Troisièmement**, la frontière entre **polynomial et exponentiel** sépare le praticable de l'impossible — aucune amélioration matérielle ne compensera jamais le passage de O(n²) à O(2ⁿ).

**Quatrièmement**, le choix entre complexité temporelle et spatiale est rarement binaire. La mémoïsation illustre parfaitement ce compromis : sacrifier O(n) d'espace transforme une complexité exponentielle O(2ⁿ) en linéaire O(n). Les contraintes du système (mémoire embarquée vs serveur cloud) dictent souvent ce choix.

**Cinquièmement**, reconnaître les patterns de complexité dans le code est une compétence qui s'acquiert par la pratique. Une boucle simple suggère O(n), des boucles imbriquées O(n²), et une récursion à deux branches sans mémoïsation signale généralement O(2ⁿ). Cette reconnaissance intuitive permet d'évaluer rapidement la scalabilité d'une solution avant même de l'implémenter.

### Application pratique

Au-delà de la théorie, cette notation guide quotidiennement les choix d'ingénierie : utiliser une HashMap plutôt qu'une liste pour les recherches fréquentes, préférer un tri O(n log n) à un tri O(n²), ou reconnaître qu'un problème NP-complet nécessite des heuristiques plutôt qu'une recherche exhaustive.

La maîtrise de Big O ne consiste pas à mémoriser des formules, mais à développer une intuition sur le comportement des algorithmes face à la croissance des données — une compétence indispensable pour tout développeur confronté aux défis du passage à l'échelle. Elle transforme ainsi le développeur en architecte capable d'anticiper les performances de ses systèmes à grande échelle.