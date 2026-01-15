# Programmation dynamique : fondements mathématiques et algorithmes avancés

La programmation dynamique constitue l'une des techniques algorithmiques les plus puissantes pour résoudre des problèmes d'optimisation. Inventée par **Richard Bellman** en 1953 à la RAND Corporation, cette méthode repose sur deux propriétés fondamentales — la sous-structure optimale et le chevauchement des sous-problèmes — permettant de transformer des algorithmes exponentiels en solutions polynomiales. Cet article présente une analyse rigoureuse des principes mathématiques, des preuves formelles pour les problèmes classiques, et des techniques avancées essentielles pour tout expert en algorithmique.

## Richard Bellman et l'origine stratégique du terme

L'histoire du nom "programmation dynamique" révèle autant de politique que de mathématiques. Dans son autobiographie *Eye of the Hurricane* (1984), Bellman explique qu'en 1950, il cherchait un nom pour ses travaux sur les "processus de décision multi-étapes". Le contexte politique était crucial : Charles Wilson, alors Secrétaire de la Défense, nourrissait une "peur pathologique du mot 'recherche'". Bellman choisit donc **"programming"** (au sens militaire de planification, comme dans "linear programming") et **"dynamic"** car ce terme avait "une signification absolument précise en physique classique" et, surtout, "il est impossible d'utiliser le mot 'dynamique' de manière péjorative".

Bellman (1920-1984), mathématicien américain formé à Princeton sous Solomon Lefschetz, publia **619 articles et 39 livres**. Son ouvrage fondateur *Dynamic Programming* (Princeton, 1957) reste une référence. L'équation de Bellman, qui exprime la valeur d'un problème de décision en fonction des choix initiaux et de la valeur des problèmes résiduels, constitue le cœur mathématique de cette approche :

$$V_{i-1}(y) = \max_a \left[ \text{gain}(a, i-1) + V_i(\text{nouvel\_état}(y, a)) \right]$$

Bellman introduisit également le terme **"malédiction de la dimensionnalité"** pour décrire la croissance exponentielle de la complexité avec le nombre de dimensions de l'espace d'états.

## Définitions formelles des deux propriétés fondamentales

### La sous-structure optimale : preuve par "couper-coller"

Un problème exhibe une **sous-structure optimale** si une solution optimale contient des solutions optimales à ses sous-problèmes. Formellement, soit P un problème avec solution optimale S*, et soit P' un sous-problème contenu dans P. Si s' est la partie de S* résolvant P', alors s' doit être optimale pour P'.

La **preuve par contradiction** (technique "couper-coller" du CLRS) suit ce schéma :

1. Supposons S* optimale pour P, contenant s' solution au sous-problème P'
2. Supposons par l'absurde que s' n'est pas optimale pour P'
3. Alors il existe s'' meilleure que s' pour P'
4. Construisons S'' en remplaçant s' par s'' dans S*
5. S'' est meilleure que S*, contradiction avec l'optimalité de S*
6. Donc s' est nécessairement optimale ∎

**Contre-exemple important** : le problème du plus long chemin simple ne possède pas de sous-structure optimale car combiner des sous-chemins optimaux peut créer des cycles, violant la contrainte de simplicité.

### Le chevauchement des sous-problèmes : quantification de la redondance

Un problème présente des **sous-problèmes chevauchants** lorsque le même sous-problème est résolu plusieurs fois dans une solution récursive naïve. La distinction avec diviser-pour-régner est cruciale :

| Critère | Programmation dynamique | Diviser-pour-régner |
|---------|------------------------|---------------------|
| Nature des sous-problèmes | Chevauchants, dépendants | Indépendants, disjoints |
| Réutilisation | Solutions cachées et réutilisées | Aucune — chaque sous-problème résolu une fois |
| Exemple | Fibonacci : F(n-1) et F(n-2) requièrent tous deux F(n-3) | Merge sort : sous-tableaux disjoints |

Pour Fibonacci calculé naïvement, le nombre total d'appels récursifs est **O(φⁿ)** où φ ≈ 1.618, alors que le nombre de sous-problèmes distincts n'est que **O(n)**. Ce ratio exponentiel justifie la mémoïsation.

## Mémoïsation versus tabulation : analyse comparative

La **mémoïsation (top-down)** conserve la structure récursive naturelle en ajoutant un cache. Avant de calculer un sous-problème, on vérifie s'il a déjà été résolu. Cette approche bénéficie d'une évaluation paresseuse — seuls les sous-problèmes nécessaires sont calculés — mais souffre du surcoût de la récursion et du risque de débordement de pile.

La **tabulation (bottom-up)** remplit itérativement un tableau depuis les cas de base vers la solution finale. Elle élimine le surcoût récursif, offre une meilleure localité de cache et facilite l'optimisation de l'espace, mais peut calculer des sous-problèmes inutiles et requiert de déterminer l'ordre de dépendance à l'avance.

| Critère | Mémoïsation | Tabulation |
|---------|-------------|------------|
| Direction | Descendante (top-down) | Ascendante (bottom-up) |
| Évaluation | Paresseuse (à la demande) | Avide (tous les sous-problèmes) |
| Contrôle de l'espace | Plus difficile | Optimisation facile |
| Risque de pile | Oui | Non |
| Cas d'usage optimal | Dépendances éparses | Tous les sous-problèmes nécessaires |

## Suite de Fibonacci : de O(2ⁿ) à O(log n)

### Analyse de la complexité exponentielle naïve

La récurrence F(n) = F(n-1) + F(n-2) avec F(0)=0, F(1)=1 génère un arbre d'appels où le nombre total de nœuds suit exactement **2×F(n) - 1**. La preuve rigoureuse de la complexité T(n) = Θ(φⁿ) s'obtient via l'équation caractéristique x² = x + 1, dont les racines sont φ = (1+√5)/2 et ψ = (1-√5)/2.

```
T(n) = T(n-1) + T(n-2) + O(1) ≥ 2T(n-2) + O(1) = Ω(2^{n/2})
```

Plus précisément, T(n) = Θ(φⁿ) ≈ Θ(1.618ⁿ).

### Version mémoïsée O(n) temps, O(n) espace

```python
memo = {}
def fib_memo(n):
    if n in memo: return memo[n]
    if n <= 1: return n
    memo[n] = fib_memo(n-1) + fib_memo(n-2)
    return memo[n]
```

Chaque sous-problème F(i) est calculé exactement une fois. Avec n+1 sous-problèmes et O(1) travail par sous-problème, la complexité est **O(n)**.

### Version itérative O(n) temps, O(1) espace

Puisque F(n) ne dépend que de F(n-1) et F(n-2), seules deux variables suffisent :

```python
def fib_iter(n):
    if n <= 1: return n
    a, b = 0, 1
    for _ in range(2, n+1):
        a, b = b, a + b
    return b
```

### Exponentiation matricielle O(log n)

L'identité matricielle fondamentale, prouvable par induction :

$$\begin{pmatrix} 1 & 1 \\ 1 & 0 \end{pmatrix}^n = \begin{pmatrix} F(n+1) & F(n) \\ F(n) & F(n-1) \end{pmatrix}$$

L'exponentiation rapide par carrés successifs permet de calculer Mⁿ en **O(log n)** multiplications matricielles 2×2, chacune en O(1).

### Formule de Binet et ses limites pratiques

La formule fermée F(n) = (φⁿ - ψⁿ)/√5 est théoriquement O(1), mais les erreurs d'arrondi sur les flottants la rendent imprécise pour n > ~70 en double précision.

## Problème du sac à dos : pseudo-polynomialité et preuve de correction

### Récurrence et preuve de la sous-structure optimale

Pour n objets de poids w[i] et valeurs v[i] avec capacité W, la récurrence du sac à dos 0/1 est :

$$dp[i][w] = \max(dp[i-1][w], \; dp[i-1][w-w[i]] + v[i])$$

**Preuve par contradiction** : Soit (x₁, ..., xₙ) une solution optimale. Si xₙ = 1 (objet n pris), alors (x₁, ..., x_{n-1}) doit être optimale pour la capacité W - wₙ. Sinon, une meilleure solution Y pour cette capacité permettrait de construire (Y, 1) avec valeur supérieure, contradiction.

### Pourquoi O(nW) est pseudo-polynomial

Cette complexité est **polynomiale en W** mais **exponentielle en log W** (la taille de l'entrée). Avec k = log₂(W) bits pour représenter W, l'algorithme effectue O(n × 2ᵏ) opérations — exponentiel en la taille de l'entrée. C'est pourquoi le sac à dos reste **NP-complet** malgré cet algorithme : il est "faiblement NP-complet", admettant une solution pseudo-polynomiale.

### Variante unbounded et reconstruction

Pour le sac à dos avec répétition, la récurrence devient unidimensionnelle :

$$dp[w] = \max_{i : w[i] \leq w}(dp[w], \; dp[w-w[i]] + v[i])$$

La **reconstruction** de la solution s'effectue par backtracking : si dp[i][w] ≠ dp[i-1][w], l'objet i a été pris ; on décrémente w de w[i] et on continue.

## Distance d'édition de Levenshtein : algorithme de Wagner-Fischer

### Définition et récurrence

La distance d'édition entre chaînes A[1..m] et B[1..n] compte le minimum d'opérations (insertion, suppression, substitution) pour transformer A en B. L'algorithme de Wagner-Fischer (1974) utilise :

$$dp[i][j] = \begin{cases}
i & \text{si } j = 0 \\
j & \text{si } i = 0 \\
dp[i-1][j-1] & \text{si } A[i] = B[j] \\
1 + \min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]) & \text{sinon}
\end{cases}$$

### Preuve de correction par induction forte

**Invariant** : dp[i][j] = distance minimale entre A[1..i] et B[1..j].

*Hypothèse d'induction* : supposons dp[i'][j'] correct pour tout (i',j') avec i'+j' < i+j.

*Étape inductive* : toute séquence optimale se termine par un match (coût dp[i-1][j-1]), une suppression (coût dp[i-1][j]+1), une insertion (coût dp[i][j-1]+1), ou une substitution (coût dp[i-1][j-1]+1). Le minimum couvre tous les cas.

### Optimisation spatiale à O(min(n,m))

Puisque dp[i][j] ne dépend que de dp[i-1][j], dp[i][j-1], dp[i-1][j-1], deux lignes suffisent. Pour reconstruire la solution avec espace linéaire, l'**algorithme de Hirschberg** (1975) utilise diviser-pour-régner : identifier le point (q, n/2) sur le chemin optimal puis résoudre récursivement.

## Plus longue sous-suite commune : distinction critique

### Sous-suite versus sous-chaîne

Une **sous-suite** préserve l'ordre relatif sans exiger la contiguïté ("ACE" est sous-suite de "ABCDE"). Une **sous-chaîne** exige la contiguïté ("BCD" dans "ABCDE").

### Théorème de sous-structure optimale (CLRS)

Pour X[1..m], Y[1..n] et leur LCS Z[1..k] :

1. Si xₘ = yₙ, alors zₖ = xₘ = yₙ et Z[1..k-1] est LCS de X[1..m-1] et Y[1..n-1]
2. Si xₘ ≠ yₙ et zₖ ≠ xₘ, alors Z est LCS de X[1..m-1] et Y
3. Si xₘ ≠ yₙ et zₖ ≠ yₙ, alors Z est LCS de X et Y[1..n-1]

**Preuve du point 1** : Supposons zₖ ≠ xₘ(=yₙ). On pourrait ajouter xₘ à Z, obtenant une sous-suite commune de longueur k+1, contradiction. Donc zₖ = xₘ. Si Z[1..k-1] n'était pas LCS de X[1..m-1], Y[1..n-1], on pourrait la remplacer par une meilleure W et construire W ∪ {xₘ} de longueur > k, contradiction. ∎

## Plus longue sous-suite croissante : de O(n²) à O(n log n)

### Approche quadratique classique

Soit d[i] = longueur de la LIS se terminant à l'indice i :

$$d[i] = \max(1, \max_{j < i, A[j] < A[i]}(d[j] + 1))$$

### Optimisation avec recherche binaire

L'insight clé : maintenir un tableau tail[] où tail[l] = plus petit élément terminal de toute LIS de longueur l+1. Ce tableau reste **toujours trié**.

```python
def lis_nlogn(A):
    tail = []
    for x in A:
        pos = bisect_left(tail, x)
        if pos == len(tail):
            tail.append(x)
        else:
            tail[pos] = x
    return len(tail)
```

**Preuve de correction** : L'invariant "tail[l] = minimum ending value for all LIS of length l+1" est préservé. En maintenant les plus petites valeurs terminales, on maximise les possibilités d'extension future.

### Connexion au tri par patience

Le jeu de patience (Hammersley, 1972) établit une bijection : le nombre minimal de piles égale la longueur maximale de la LIS. Les sommets des piles forment une séquence croissante, permettant la recherche binaire.

## Techniques avancées de programmation dynamique

### DP sur intervalles

Pour des problèmes où l'état est un intervalle [i,j], comme la multiplication de chaînes de matrices :

$$M[i,j] = \min_{i \leq k < j} \{M[i,k] + M[k+1,j] + d_{i-1} \cdot d_k \cdot d_j\}$$

L'ordre de calcul procède par longueur d'intervalle croissante. Complexité : **O(n³)** temps, O(n²) espace.

### DP avec bitmask

Lorsque l'état inclut un sous-ensemble d'éléments (n ≤ 20-25), on représente ce sous-ensemble par un entier bitmask. Pour le problème du voyageur de commerce :

$$dp[\text{mask}][i] = \text{coût minimal pour visiter les villes de mask, terminant en } i$$

$$dp[\text{mask}][i] = \min_{j \in \text{mask}, j \neq i}(dp[\text{mask} \setminus \{i\}][j] + \text{dist}(j, i))$$

Complexité : **O(2ⁿ × n²)** temps, O(2ⁿ × n) espace.

### Équation de Bellman et processus de décision markoviens

Le principe d'optimalité de Bellman s'étend aux MDP stochastiques :

$$V(s) = \max_a \left[ R(s,a) + \gamma \sum_{s'} P(s'|s,a) V(s') \right]$$

L'**itération de la valeur** applique cette mise à jour jusqu'à convergence, fondement de l'apprentissage par renforcement moderne.

## Identifier un problème de programmation dynamique

### Indicateurs linguistiques et structurels

- Vocabulaire d'optimisation : "minimum", "maximum", "plus long", "nombre de façons"
- Choix à chaque étape affectant les états futurs
- Structure de dépendance permettant la décomposition

### Comparaison avec les approches alternatives

**DP vs Diviser-pour-régner** : D&C s'applique quand les sous-problèmes sont indépendants (merge sort). DP s'impose quand ils se chevauchent (Fibonacci).

**DP vs Glouton** : L'approche gloutonne choisit localement sans garantie globale. Le sac à dos 0/1 échoue avec le ratio valeur/poids : pour les objets {(60,10), (100,20), (120,30)} et capacité 50, le glouton donne 160 mais l'optimal est **220** (objets 2+3). La DP considère toutes les possibilités.

### Méthodologie CLRS en quatre étapes

1. **Caractériser** la structure de la solution optimale
2. **Définir récursivement** la valeur optimale
3. **Calculer** bottom-up ou top-down avec mémoïsation
4. **Construire** la solution à partir des informations stockées

## Conclusion : principes unificateurs

La programmation dynamique transforme l'explosion combinatoire en calcul polynomial grâce à deux mécanismes fondamentaux : la reconnaissance que des solutions partielles se réutilisent (chevauchement) et que l'optimum global se construit depuis des optima locaux (sous-structure). La distinction pseudo-polynomial/polynomial rappelle que la complexité dépend de la représentation de l'entrée — un algorithme O(nW) reste exponentiel en bits.

Les techniques avancées (interval DP, bitmask DP, équation de Bellman) étendent ce paradigme à des structures d'état sophistiquées, du séquencement de tâches à l'intelligence artificielle. Maîtriser la DP exige de reconnaître ses conditions d'applicabilité, de formuler des récurrences correctes, et de prouver rigoureusement leur optimalité — compétences fondamentales pour tout algorithmicien expert.