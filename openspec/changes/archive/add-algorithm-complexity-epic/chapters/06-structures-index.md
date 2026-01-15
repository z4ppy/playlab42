# Structures d'index et tables de hachage

Les structures d'index constituent le fondement algorithmique des systèmes de bases de données modernes, permettant de transformer des recherches linéaires O(n) en opérations quasi-instantanées. Ce chapitre examine rigoureusement deux paradigmes fondamentaux : les **tables de hachage** offrant une complexité moyenne O(1), et les **arbres équilibrés** (BST, B-trees, B+ trees) garantissant O(log n) avec support des requêtes par intervalle. La compréhension de ces structures et de leurs preuves mathématiques est essentielle pour concevoir des systèmes performants.

---

## A. Tables de hachage : la quête du temps constant

### Principe fondamental et hypothèse de hachage uniforme

Une table de hachage associe des clés à des emplacements (buckets) via une fonction de hachage h : U → {0, 1, ..., m-1}. L'efficacité repose sur l'**hypothèse de hachage uniforme simple (SUHA)** : chaque clé k a une probabilité égale 1/m d'être hachée vers n'importe quel emplacement, indépendamment des autres clés.

Le **facteur de charge** α = n/m représente le ratio entre le nombre d'éléments n et le nombre d'emplacements m. Ce paramètre gouverne la performance : maintenir α = O(1) garantit des opérations en temps constant moyen.

### Preuve de la complexité moyenne O(1)

**Théorème (Recherche infructueuse avec chaînage séparé)** : Dans une table de hachage utilisant le chaînage séparé, une recherche infructueuse prend un temps moyen Θ(1 + α).

*Preuve* : Sous l'hypothèse SUHA, une clé k est équiprobablement assignée à l'un des m emplacements. La recherche consiste à calculer h(k) puis parcourir la liste chainée correspondante. La longueur moyenne de chaque liste est n/m = α, donc le temps espéré est :

$$E[\text{temps}] = 1 + \alpha = \Theta(1 + \alpha)$$

**Théorème (Recherche fructueuse)** : Une recherche fructueuse prend un temps moyen Θ(1 + α/2).

*Preuve* : Considérons les insertions effectuées en fin de liste. Pour le i-ème élément inséré, la longueur espérée de la liste lors de l'insertion est (i-1)/m. Le nombre moyen d'éléments examinés lors d'une recherche est :

$$E[\text{éléments examinés}] = \frac{1}{n}\sum_{i=1}^{n}\left(1 + \frac{i-1}{m}\right) = 1 + \frac{1}{mn}\cdot\frac{n(n-1)}{2} = 1 + \frac{\alpha}{2} - \frac{1}{2m}$$

Quand m = Θ(n), nous obtenons α = O(1), d'où **toutes les opérations sont O(1) en moyenne**.

### Complexité pire cas O(n) : quand et pourquoi

Le pire cas survient lorsque toutes les clés hachent vers le même emplacement, créant une liste chainée de longueur n. Cette situation se produit dans deux scénarios :

**Entrées adversariales** : Pour toute fonction de hachage déterministe h connue de l'attaquant, celui-ci peut choisir n clés k₁, k₂, ..., kₙ telles que h(kᵢ) = j pour un j fixé. C'est pourquoi le hachage universel (sélection aléatoire de h) est essentiel en pratique.

**Paradoxe des anniversaires** : Pour m emplacements et n insertions, la probabilité d'au moins une collision est :

$$P(\text{collision}) \approx 1 - e^{-n(n-1)/(2m)}$$

Après environ √(2m) éléments, cette probabilité dépasse **50%**. Pour n = O(√m), les collisions deviennent probables, limitant la taille pratique des tables sans redimensionnement.

### Fonctions de hachage : propriétés mathématiques

**Méthode de division** : h(k) = k mod m

Cette méthode simple nécessite un choix judicieux de m. Il faut **éviter les puissances de 2** (h(k) ne considère que les bits de poids faible) et **les puissances de 10**. Les nombres premiers éloignés des puissances de 2 constituent le meilleur choix. Exemple : pour ~2000 chaînes avec au maximum 3 éléments par recherche infructueuse, m = 701 (premier) est approprié.

**Méthode de multiplication** (Knuth) :

$$h(k) = \lfloor m \cdot (kA \mod 1) \rfloor$$

où A ∈ (0,1). Knuth recommande le **nombre d'or** :

$$A = \frac{\sqrt{5} - 1}{2} \approx 0.6180339887$$

Cette valeur distribue particulièrement bien les clés grâce aux propriétés mathématiques du nombre d'or.

**Hachage universel (Carter-Wegman, 1979)** : Une famille H de fonctions de hachage est **universelle** si pour tous x ≠ y :

$$\Pr_{h \in H}[h(x) = h(y)] \leq \frac{1}{m}$$

*Construction de Carter-Wegman* : Pour un premier p ≥ |U| :

$$h_{a,b}(k) = ((ak + b) \mod p) \mod m$$

où a ∈ {1,...,p-1}, b ∈ {0,...,p-1} sont choisis aléatoirement.

*Preuve d'universalité* : Pour x ≠ y distincts, l'application (a,b) → (ax+b mod p, ay+b mod p) est une bijection sur ℤₚ × ℤₚ. Puisqu'il existe p² choix de (a,b) et au plus p²/m peuvent mapper x et y vers la même valeur mod m, la probabilité de collision est ≤ 1/m. Cette construction garantit E[longueur de chaîne] = O(1) même contre un adversaire.

**Hachage parfait (FKS, 1984)** : Fredman, Komlós et Szemerédi ont conçu un schéma de dictionnaire statique avec temps de requête **O(1) pire cas**, espace O(n), et temps de construction O(n) espéré. La construction à deux niveaux utilise le hachage universel au premier niveau (n buckets), puis des tables sans collision de taille nᵢ² au second niveau, avec espace total Σnᵢ² = O(n).

### Gestion des collisions : analyse comparative

**Chaînage séparé** :
```
CHAINED-HASH-INSERT(T, k):
    insérer k en tête de la liste T[h(k)]

CHAINED-HASH-SEARCH(T, k):
    rechercher k dans la liste T[h(k)]
```

La longueur espérée de chaîne est simplement α = n/m. Cette méthode tolère des facteurs de charge α > 1.

**Adressage ouvert - Sondage linéaire** : h(k,i) = (h'(k) + i) mod m

Cette méthode souffre du **problème de clustering primaire** : les séquences d'emplacements occupés s'accumulent en blocs. L'analyse de Knuth (1962) établit :

- Sondes espérées (recherche infructueuse) : $E_U(\alpha) = \frac{1}{2}\left(1 + \frac{1}{(1-\alpha)^2}\right)$
- Sondes espérées (recherche fructueuse) : $E_S(\alpha) = \frac{1}{2}\left(1 + \frac{1}{1-\alpha}\right)$

Pour α = 0.5 : recherche infructueuse ≈ **2.5 sondes**, recherche fructueuse ≈ **1.5 sondes**.

**Sondage quadratique** : h(k,i) = (h'(k) + c₁i + c₂i²) mod m

Élimine le clustering primaire mais introduit le **clustering secondaire** : les clés avec même h' suivent la même séquence de sondage. Requiert m premier pour garantir la couverture complète de la table.

**Double hachage** : h(k,i) = (h₁(k) + i·h₂(k)) mod m

Sous l'hypothèse de hachage uniforme, les sondes espérées sont :
- Recherche infructueuse : ≤ 1/(1-α)
- Recherche fructueuse : ≤ (1/α)·ln(1/(1-α))

| Méthode | Chaînage | Linéaire | Double hachage |
|---------|----------|----------|----------------|
| E[recherche infructueuse] | 1+α | ½(1+1/(1-α)²) | 1/(1-α) |
| E[recherche fructueuse] | 1+α/2 | ½(1+1/(1-α)) | (1/α)ln(1/(1-α)) |
| Facteur de charge optimal | 1-3 | ≤0.5-0.7 | ≤0.5-0.7 |

### Analyse amortie et redimensionnement dynamique

**Stratégie** : Doubler la table quand α dépasse un seuil αₘₐₓ.

**Analyse agrégée** : Pour n insertions avec doublement aux puissances de 2 :

$$\text{Hachages totaux} = n + n + \frac{n}{2} + \frac{n}{4} + ... = n + 2n = 3n$$

**Preuve par méthode du potentiel** : Définissons Φ(h) = 2|n - m/2|.

- *Ajout sans redimensionnement* : coût amorti = 1 + 2 = **3**
- *Ajout avec redimensionnement (α = 1)* : coût réel = 1 + m (copie), Φ passe de m à 0, coût amorti = 1 + m - m = **1**

**Théorème** : Toute séquence de n opérations prend un temps O(n), soit **O(1) amorti par opération**.

---

## B. Arbres binaires de recherche (BST)

### Complexité moyenne O(log n) : preuve formelle

Un BST aléatoire est construit en insérant n clés distinctes dans un ordre uniformément aléatoire (toutes les n! permutations équiprobables).

**Théorème** : La hauteur espérée d'un BST aléatoire sur n clés est O(log n).

*Preuve (CLRS, Section 12.4)* : Définissons Xₙ = hauteur et Yₙ = 2^Xₙ. Quand la clé de rang i devient racine (probabilité 1/n), les sous-arbres contiennent les clés {1,...,i-1} et {i+1,...,n}.

La récurrence E[Yₙ] ≤ (4/n)·Σᵢ E[Yᵢ] conduit par induction à E[Yₙ] ≤ cn³. Par l'inégalité de Jensen :

$$E[X_n] = E[\log_2 Y_n] \leq \log_2 E[Y_n] \leq \log_2(cn^3) = 3\log_2 n + O(1) = O(\log n)$$

Le résultat raffiné de Reed (1995) établit : E[hauteur] = α·ln n - β·ln ln n + O(1), où **α ≈ 4.31107**.

**Connexion BST-Quicksort** : Quicksort et l'insertion BST effectuent exactement les mêmes comparaisons. L'arbre de récursion de Quicksort correspond à la structure du BST : le pivot à chaque appel récursif est la racine d'un sous-arbre. Cette isomorphie implique E[comparaisons Quicksort] = E[longueur totale des chemins BST] = 2n·ln n + O(n) = **Θ(n log n)**.

### Complexité pire cas O(n) : arbre dégénéré

**Théorème** : Un BST construit par insertion de n éléments en ordre trié a une hauteur n-1.

*Démonstration* : Quand les éléments arrivent en ordre croissant x₁ < x₂ < ... < xₙ, chaque xᵢ devient l'enfant droit de xᵢ₋₁, formant une chaîne linéaire. Après n insertions, hauteur = n-1. Les comparaisons totales pour la construction sont Σᵢ₌₁ⁿ⁻¹ i = n(n-1)/2 = **O(n²)**, et chaque recherche requiert O(n).

---

## C. Arbres B et B+ : l'optimisation des accès disque

### Contexte historique et définition

Les B-trees ont été inventés par **Rudolf Bayer et Edward M. McCreight** chez Boeing Research Labs en 1970, publiés dans *Acta Informatica* (Vol. 1, No. 3, 1972). L'origine du "B" reste ambiguë : "Boeing", "Bayer", "Balanced", ou "Broad".

**Définition (B-tree de degré minimum t)** : Un arbre T satisfaisant :

1. Chaque nœud x contient x.n clés ordonnées et x.n+1 enfants
2. Les clés séparent les plages des sous-arbres
3. Toutes les feuilles ont la même profondeur h
4. **Bornes de degré (t ≥ 2)** :
   - Minimum : chaque nœud non-racine a ≥ t-1 clés (t enfants)
   - Maximum : chaque nœud a ≤ 2t-1 clés (2t enfants)
   - Racine : ≥ 1 clé si non-feuille

### Théorème de la borne de hauteur : preuve complète

**Théorème (CLRS 18.1)** : Pour un B-tree de n clés, hauteur h, et degré minimum t ≥ 2 :

$$h \leq \log_t\left(\frac{n+1}{2}\right)$$

*Preuve* : La hauteur est maximisée quand tous les nœuds ont le minimum de clés. Dans un tel arbre "maigre" :
- Racine : 1 clé (2 enfants)
- Autres nœuds : t-1 clés (t enfants)

Comptage des nœuds par profondeur :
- Profondeur 0 : 1 nœud
- Profondeur 1 : ≥ 2 nœuds
- Profondeur k : ≥ 2t^(k-1) nœuds

Le nombre total de clés dans un arbre de hauteur h :

$$n \geq 1 + (t-1)\sum_{i=1}^{h}2t^{i-1} = 1 + 2(t-1)\cdot\frac{t^h-1}{t-1} = 2t^h - 1$$

Résolvant pour h :

$$t^h \leq \frac{n+1}{2} \implies h \leq \log_t\left(\frac{n+1}{2}\right) \quad \blacksquare$$

### Complexité O(log n) pour toutes les opérations

**Théorème** : B-TREE-SEARCH a une complexité temporelle O(t · log_t n) = O(log n).

*Preuve* : Les accès disque correspondent à la traversée d'un chemin racine-feuille :

$$\text{Accès disque} = h + 1 \leq \log_t\left(\frac{n+1}{2}\right) + 1 = O(\log_t n)$$

Le temps CPU par nœud avec recherche binaire est O(log t). Le temps CPU total :

$$O(h \cdot \log t) = O\left(\frac{\log n}{\log t} \cdot \log t\right) = O(\log n)$$

```
B-TREE-SEARCH(x, k):
    i ← 1
    while i ≤ x.n and k > x.key[i]:
        i ← i + 1
    if i ≤ x.n and k = x.key[i]:
        return (x, i)
    if x.leaf:
        return NIL
    else:
        DISK-READ(x.c[i])
        return B-TREE-SEARCH(x.c[i], k)
```

### Optimisation des accès disque

**Pourquoi des nœuds larges minimisent les I/O** : Pour un stockage disque avec taille de bloc B octets, taille de clé k, et taille de pointeur p :

$$\text{Enfants max par nœud} \approx m = \frac{B - p}{k + p}$$

Avec degré minimum t ≈ m/2 :

$$\text{Accès disque} = O\left(\log_{m/2} n\right) = O\left(\frac{\log n}{\log(B/(k+p))}\right)$$

**Exemple concret** : Avec B = 4096 octets, k = 8 octets, p = 8 octets :
- Maximum ~256 enfants par nœud
- Pour n = 10⁹ clés : h ≤ log₁₂₈(5×10⁸) ≈ **4 accès disque**

### B+ trees : la structure privilégiée des bases de données

Les B+ trees modifient la structure standard avec des différences architecturales cruciales :

1. **Stockage des données** : Toutes les paires clé-valeur uniquement dans les **feuilles**. Les nœuds internes ne contiennent que des clés de navigation.

2. **Feuilles chaînées** : Les feuilles forment une **liste doublement chaînée** en ordre trié des clés.

3. **Fan-out supérieur** : Sans données dans les nœuds internes, plus de clés par nœud, réduisant la hauteur.

**Complexité des requêtes par intervalle** :

**Théorème** : Les requêtes d'intervalle en B+ tree ont une complexité O(log n + k), où k est le nombre de résultats.

*Preuve* : Pour une requête [x_min, x_max] :
- Phase 1 (localisation) : Traversée racine-feuille jusqu'à x_min : O(log n)
- Phase 2 (scan séquentiel) : Parcours des pointeurs next-leaf, collectant les clés dans l'intervalle. Chaque accès feuille récupère O(t) clés. Total feuilles accédées : ⌈k/t⌉

$$\text{Complexité totale} = O(\log n) + O\left(\frac{k}{t}\right) = O(\log n + k) \quad \blacksquare$$

---

## D. Comparaison Hash Index vs B-Tree : guide de décision

### Matrice de complexité opérationnelle

| Opération | Hash Index | B-Tree Index |
|-----------|-----------|--------------|
| **Recherche exacte** | O(1) moyen | O(log n) |
| **Requête intervalle** | Non supporté | O(log n + k) |
| **Traversée ordonnée** | Non | Oui (naturel) |
| **Insertion** | O(1) amorti | O(log n) |
| **Suppression** | O(1) amorti | O(log n) |
| **Min/Max** | O(n) | O(log n) |
| **Préfixe (LIKE 'abc%')** | Non supporté | Supporté |

### Implémentations dans les SGBD majeurs

**PostgreSQL** utilise des pages de **8 Ko** par défaut. Les index B-tree bénéficient d'un fill factor de 90%, réservant 10% pour les insertions futures. Les index hash, crash-safe depuis PostgreSQL 10, stockent uniquement un hash 32-bit par clé, permettant une réduction de taille jusqu'à **50x pour les longues chaînes** (UUIDs, URLs). Les benchmarks EnterpriseDB montrent un gain de **10-22%** pour les recherches d'égalité avec hash.

**MySQL/InnoDB** emploie des pages de **16 Ko**. L'index cluster (clé primaire) *est* la table - toutes les données résident au niveau feuille. L'**Adaptive Hash Index** construit automatiquement un index hash en mémoire sur les pages B-tree fréquemment accédées. Les index hash explicites ne sont disponibles que pour le moteur MEMORY.

**MongoDB** utilise les B-trees (WiredTiger implémente des B+ trees). Les index hachés servent principalement au **sharding haché** pour une distribution uniforme des données, particulièrement efficace avec les champs monotones croissants (ObjectId, timestamps) mais incompatibles avec les requêtes d'intervalle.

### Critères de choix pratiques

**Choisir Hash quand** :
- Requêtes d'égalité exclusivement
- Valeurs longues (≥25 caractères) pour économiser la mémoire
- Cardinalité élevée (valeurs uniques ou quasi-uniques)
- Patterns clé-valeur stables

**Choisir B-Tree quand** :
- Requêtes d'intervalle nécessaires
- Résultats triés requis (ORDER BY)
- Patterns LIKE avec préfixe
- Index composites multi-colonnes
- Patterns de requêtes évolutifs ou incertains

La différence O(log n) vs O(1) est souvent **négligeable en pratique** : log₂(1 milliard) ≈ 30 comparaisons, et les nœuds B-tree de haut niveau sont généralement en cache. Un B-tree peut localiser une valeur parmi **8 To de données en seulement 4 accès disque**.

---

## Conclusion

L'analyse rigoureuse des structures d'index révèle un **compromis fondamental** entre flexibilité et performance brute. Les tables de hachage atteignent O(1) moyen grâce à la distribution uniforme des clés, mais cette efficacité repose sur l'hypothèse SUHA et s'effondre à O(n) sous entrées adversariales ou distributions dégénérées. Le hachage universel de Carter-Wegman et le hachage parfait FKS offrent des garanties probabilistes et déterministes respectivement.

Les B-trees garantissent O(log n) pour toutes les opérations avec une borne de hauteur h ≤ log_t((n+1)/2), permettant de servir des milliards de clés en quelques accès disque. Les B+ trees, avec leurs feuilles chaînées, ajoutent un support optimal des requêtes d'intervalle en O(log n + k).

Le choix entre ces structures n'est pas binaire : les systèmes modernes comme InnoDB combinent B-trees persistants avec hash adaptatifs en mémoire. La compréhension des preuves mathématiques sous-jacentes permet d'anticiper les performances réelles et de concevoir des systèmes robustes face aux distributions de données adversariales ou pathologiques.