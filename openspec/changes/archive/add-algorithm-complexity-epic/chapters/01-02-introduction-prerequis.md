# Complexité algorithmique : au-delà du chronomètre

Mesurer la performance d'un algorithme par son temps d'exécution brut est une erreur fondamentale que tout développeur expérimenté apprend à éviter. La notation Big O, introduite en 1894 par le mathématicien allemand Paul Bachmann, offre une métrique universelle et indépendante du matériel pour comparer les algorithmes à leur juste valeur. Ce premier volet pose les fondations : pourquoi le chronométrage est trompeur, comment l'analyse asymptotique résout ce problème, et quels outils mathématiques sont nécessaires pour maîtriser ce domaine.

---

## Chapitre I — Introduction à l'analyse de complexité

### Pourquoi chronométrer un algorithme ne suffit jamais

Imaginez deux développeurs exécutant exactement le même algorithme de tri sur leurs machines respectives. Le premier obtient **483 ms**, le second **140 ms**. Lequel a le meilleur algorithme ? La question est absurde : ils utilisent le même code. La différence provient uniquement des niveaux d'optimisation du compilateur (les benchmarks GCC montrent que `-O2` peut être **25% plus rapide** que `-O3` sur certains codes, contrairement à l'intuition).

Cette variabilité n'est pas anecdotique. Elle est structurelle et multifactorielle.

**Les caches CPU créent des écarts de performance considérables.** Un accès au cache L1 prend 1 à 4 cycles processeur ; un accès à la RAM en prend 60 à 270. Un même algorithme traitant des données tenant en cache L3 atteint **600 Go/s** de débit, contre seulement **51 Go/s** depuis la DDR4 — un facteur 12 de différence pour un code identique. Pire : la prédiction de branchement peut multiplier par **3,5** le temps d'exécution d'une simple somme conditionnelle selon que les données sont triées ou aléatoires.

Les environnements d'exécution ajoutent leur propre chaos. Une étude académique de 2017 a démontré que **56,5%** des combinaisons JVM/benchmark ne parviennent jamais à atteindre un état de performance stable. Les pauses du ramasse-miettes varient de moins d'une milliseconde (ZGC) à plusieurs minutes sur des applications mal configurées. Et dans le cloud, le coefficient de variation des benchmarks peut dépasser **10%** selon l'heure de la journée.

### L'impossibilité de comparer des pommes et des oranges

Le problème fondamental est l'absence de base commune. Comparer un algorithme en Python interprété à un équivalent en C compilé avec optimisations agressives ne dit rien sur la qualité intrinsèque de l'algorithme — seulement sur l'efficacité relative des implémentations.

Considérons un cas concret : le tri par insertion bat systématiquement le tri rapide (quicksort) sur des tableaux de **moins de 50 éléments**, malgré sa complexité théorique O(n²) contre O(n log n). Les constantes cachées et la meilleure localité de cache l'emportent à petite échelle. C'est pourquoi toutes les bibliothèques de tri modernes (Timsort en Python, Introsort en C++) utilisent le tri par insertion comme cas de base.

Un benchmark de bases de données illustre parfaitement l'absurdité des comparaisons naïves : une étude TPC-H a montré que PostgreSQL était plus rapide que MariaDB, SQLite plus rapide que PostgreSQL, et une variante de MariaDB plus rapide que SQLite. **Résultat logiquement contradictoire** : MariaDB était simultanément la plus lente et la plus rapide, selon un simple changement de type de colonne (DECIMAL vs DOUBLE).

### La naissance d'une métrique universelle

Face à ces limitations, les informaticiens ont adopté un outil venu des mathématiques pures : la notation asymptotique. Son histoire remonte à **1894**, quand **Paul Bachmann**, mathématicien allemand, introduit le symbole O (pour *Ordnung*, « ordre » en allemand) dans son traité *Analytische Zahlentheorie*. Son collègue **Edmund Landau** adopte et étend cette notation en 1909, ajoutant le petit-o pour les bornes strictes.

La transition vers l'informatique s'opère progressivement dans les années 1950-1960. **John von Neumann** distingue dès 1953 le temps polynomial du temps exponentiel. Mais c'est **Donald Knuth** qui popularise définitivement la notation dans la communauté informatique. En 1967, lors d'une conférence SIAM, interrogé sur son domaine de recherche, il répond simplement : « Analysis of Algorithms » — baptisant ainsi la discipline. Son article de 1976 « Big Omicron and Big Omega and Big Theta » formalise l'usage moderne en introduisant les notations Θ (borne exacte) et Ω (borne inférieure).

### Ce que la complexité asymptotique capture vraiment

L'analyse asymptotique répond à une question précise : **comment le temps d'exécution évolue-t-il quand la taille de l'entrée augmente ?** Elle ignore délibérément les constantes multiplicatives et les termes de faible ordre, car ceux-ci dépendent du matériel et deviennent négligeables pour de grandes entrées.

Cette abstraction permet des comparaisons universelles. Un algorithme O(n log n) battra toujours un algorithme O(n²) pour des entrées suffisamment grandes, **indépendamment du langage, du compilateur ou du processeur**. Si votre algorithme prend 1 seconde pour traiter 1000 éléments et que sa complexité est O(n²), doubler l'entrée quadruplera le temps. Avec O(n log n), doubler l'entrée n'augmente le temps que d'un facteur d'environ 2,1.

Les motivations sont autant pratiques que théoriques. **Côté pratique** : prédire la scalabilité d'un système, comparer des approches algorithmiques, planifier les ressources serveur. **Côté théorique** : prouver qu'un algorithme est optimal (le tri par comparaison ne peut pas faire mieux que O(n log n)), classifier les problèmes en classes de complexité (P, NP, etc.), et établir des bornes inférieures infranchissables.

### Les limites assumées de l'approche asymptotique

L'analyse de complexité n'est pas parfaite. Les constantes importent parfois : deux algorithmes O(n log n) peuvent différer d'un facteur 1000 en pratique. Le cas moyen peut masquer des cas pathologiques (quicksort est O(n²) dans le pire cas). Et pour de petites entrées, les termes de faible ordre peuvent dominer.

Mais comme le résument les auteurs de CLRS (*Introduction to Algorithms*) : « C'est la meilleure méthode disponible pour analyser les algorithmes. » Elle fournit un langage commun, des garanties théoriques, et une boussole fiable pour guider les choix d'architecture logicielle.

---

## Chapitre II — Prérequis mathématiques

### Le logarithme : diviser pour régner, compter pour comprendre

Le logarithme en base 2 répond à une question simple : **combien de fois faut-il diviser n par 2 pour atteindre 1 ?** Cette interprétation intuitive capture l'essence des algorithmes diviser-pour-régner.

Pour n = 8 : 8 → 4 → 2 → 1, soit 3 divisions. Donc log₂(8) = 3.
Pour n = 1 000 000 : il faut environ **20 divisions** pour atteindre 1, car log₂(1 000 000) ≈ 19,93.

Cette définition explique pourquoi la recherche dichotomique est si efficace. À chaque comparaison, l'espace de recherche est divisé par deux. Pour trouver un élément parmi un million d'entrées triées, **20 comparaisons suffisent**. Pour un milliard d'entrées : seulement 30 comparaisons. Doubler la taille des données n'ajoute qu'une seule comparaison.

La base 2 est privilégiée en informatique car les ordinateurs fonctionnent en binaire, les structures de données se ramifient souvent en deux branches (arbres binaires), et les algorithmes diviser-pour-régner partitionnent typiquement en deux sous-problèmes. Cependant, toutes les bases logarithmiques sont équivalentes pour l'analyse Big O — elles ne diffèrent que par un facteur constant.

**Tableau de croissance du logarithme :**

| n | log₂(n) | Interprétation |
|---|---------|----------------|
| 10 | 3,32 | ~3 comparaisons pour une recherche binaire |
| 100 | 6,64 | ~7 comparaisons |
| 1 000 | 9,97 | ~10 comparaisons |
| 10⁶ | 19,93 | ~20 comparaisons pour un million d'éléments |
| 10⁹ | 29,90 | ~30 comparaisons pour un milliard |

### Propriétés essentielles des logarithmes : l'intuition d'abord

**Propriété du produit** : log(a × b) = log(a) + log(b)

Intuitivement : si diviser *a* par 2 nécessite *x* étapes et diviser *b* par 2 nécessite *y* étapes, alors diviser a×b nécessite x+y étapes. Multiplier les grandeurs additionne les exposants.

**Propriété du quotient** : log(a / b) = log(a) − log(b)

Par le même raisonnement : diviser le résultat d'une division revient à soustraire les nombres d'étapes.

**Propriété de la puissance** : log(aᵏ) = k × log(a)

Élever à la puissance k revient à répéter k fois la même opération, donc à multiplier le nombre d'étapes par k.

**Changement de base** : log_a(x) = log_b(x) / log_b(a)

Cette formule explique pourquoi O(log₂ n) = O(log₁₀ n) = O(ln n) : le changement de base n'introduit qu'un facteur constant (1/log_b(a)), ignoré en notation Big O.

### Preuves formelles des propriétés logarithmiques

Toutes ces propriétés découlent de la définition fondamentale : **log_b(x) = y si et seulement si b^y = x**.

**Preuve de log(a × b) = log(a) + log(b) :**

Soit m = log_b(a) et n = log_b(b). Par définition : a = b^m et b = b^n.

Alors : a × b = b^m × b^n = b^(m+n) (règle des exposants)

Donc : log_b(a × b) = m + n = log_b(a) + log_b(b) ∎

**Preuve de log(a^k) = k × log(a) :**

Soit m = log_b(a), donc a = b^m.

Alors : a^k = (b^m)^k = b^(mk) (règle de la puissance d'une puissance)

Donc : log_b(a^k) = mk = k × log_b(a) ∎

**Preuve du changement de base :**

Soit k = log_a(x), donc a^k = x.

Prenons le logarithme base b des deux côtés : log_b(a^k) = log_b(x)

Par la propriété de la puissance : k × log_b(a) = log_b(x)

Donc : k = log_b(x) / log_b(a), soit log_a(x) = log_b(x) / log_b(a) ∎

### Puissances et exponentielles : la frontière du calculable

L'exponentielle 2^n incarne la croissance explosive. Chaque incrément de n **double** la valeur. Cette croissance apparaît naturellement dans de nombreux contextes informatiques.

**L'ensemble des parties** : un ensemble de n éléments possède exactement 2^n sous-ensembles. Chaque élément peut être présent ou absent — un choix binaire. Pour n éléments, on obtient 2^n combinaisons possibles. L'ensemble {a, b, c} possède 2³ = 8 sous-ensembles : ∅, {a}, {b}, {c}, {a,b}, {a,c}, {b,c}, {a,b,c}.

**La force brute** : les algorithmes explorant toutes les possibilités (satisfiabilité booléenne, sous-ensemble de somme donnée) ont typiquement une complexité O(2^n).

**Valeurs concrètes de 2^n :**

| n | 2^n | Ordre de grandeur |
|---|-----|-------------------|
| 10 | 1 024 | ~mille |
| 20 | 1 048 576 | ~un million |
| 30 | 1 073 741 824 | ~un milliard |
| 50 | 1,13 × 10¹⁵ | ~un million de milliards |
| 100 | 1,27 × 10³⁰ | plus que les atomes d'un corps humain |

À raison d'un milliard d'opérations par seconde, calculer 2^100 opérations prendrait **4 × 10¹³ années** — bien plus que l'âge de l'univers.

### Polynomiale contre exponentielle : pourquoi l'une est tractable, l'autre non

La distinction entre O(n^k) (polynomiale) et O(k^n) (exponentielle) est fondamentale en informatique théorique. Elle sépare les problèmes « résolubles en pratique » de ceux qui deviennent rapidement impossibles.

**Intuition** : dans n^k, la base (n) grandit tandis que l'exposant (k) reste fixe. Dans k^n, c'est l'exposant qui grandit. Or, faire croître un exposant est infiniment plus puissant que faire croître une base.

**Théorème** : Pour tout k > 0 et tout a > 1, lim(n→∞) n^k / a^n = 0.

Autrement dit : l'exponentielle finit toujours par dominer n'importe quelle polynomiale.

**Preuve par L'Hôpital** (pour k entier) : En appliquant la règle de L'Hôpital k fois :
lim(n→∞) n^k / a^n = lim(n→∞) k! / (a^n × (ln a)^k) = 0 ∎

**Conséquence pratique** : un algorithme O(n³) reste utilisable pour n = 1000 (10⁹ opérations). Un algorithme O(2^n) devient impraticable dès n ≈ 30 (10⁹ opérations). Même la loi de Moore ne sauve pas : doubler la puissance de calcul ne permet de traiter qu'**une seule entrée de plus** avec un algorithme exponentiel.

### La factorielle : au-delà de l'exponentielle

La factorielle n! = n × (n−1) × ... × 2 × 1 croît plus vite que toute exponentielle. Elle apparaît dans les problèmes de **permutation** : arranger n objets dans tous les ordres possibles.

| n | n! |
|---|-----|
| 5 | 120 |
| 10 | 3 628 800 |
| 15 | 1,31 × 10¹² |
| 20 | 2,43 × 10¹⁸ |

**Pourquoi n! domine 2^n** : considérons le ratio n!/2^n = (1/2) × (2/2) × (3/2) × ... × (n/2). Pour n ≥ 4, plus de la moitié des facteurs dépassent 1, et ils croissent sans limite. Chaque terme (n+1)!/2^(n+1) divisé par n!/2^n vaut (n+1)/2, qui tend vers l'infini.

**L'approximation de Stirling** : pour de grandes valeurs de n, n! ≈ √(2πn) × (n/e)^n.

Cette formule provient de l'approximation de la somme ln(1) + ln(2) + ... + ln(n) par l'intégrale ∫ln(x)dx = x·ln(x) − x. Le facteur √(2πn) émerge d'une analyse plus fine utilisant la méthode de Laplace sur la fonction gamma.

**Application classique : le problème du voyageur de commerce**. Trouver le chemin le plus court visitant n villes exactement une fois nécessite d'examiner (n−1)! permutations en force brute. Pour 10 villes : 362 880 routes. Pour 20 villes : **121 × 10¹⁵ routes** — impossible à énumérer.

### La hiérarchie complète des croissances

L'ordre suivant est fondamental et doit être mémorisé :

**1 < log n < √n < n < n log n < n² < n³ < 2^n < n! < n^n**

Chaque fonction finit par dominer toutes celles qui la précèdent, quelle que soit la constante multiplicative.

**Tableau comparatif des valeurs :**

| f(n) | n=10 | n=100 | n=1000 | n=10⁶ |
|------|------|-------|--------|-------|
| 1 | 1 | 1 | 1 | 1 |
| log₂ n | 3,3 | 6,6 | 10 | 20 |
| √n | 3,2 | 10 | 32 | 1 000 |
| n | 10 | 100 | 1 000 | 10⁶ |
| n log₂ n | 33 | 664 | 9 966 | 2×10⁷ |
| n² | 100 | 10⁴ | 10⁶ | 10¹² |
| n³ | 1 000 | 10⁶ | 10⁹ | 10¹⁸ |
| 2^n | 1 024 | 10³⁰ | 10³⁰¹ | astronomique |
| n! | 3,6×10⁶ | 10¹⁵⁸ | 10²⁵⁶⁷ | incalculable |

À n = 100, n³ vaut un million (gérable), 2^n vaut 10³⁰ (plus que les atomes d'un corps humain), et 100! vaut 10¹⁵⁸ (dépasse le nombre d'atomes dans l'univers observable, estimé à 10⁸⁰).

### Justification intuitive de chaque inégalité

- **1 < log n** : le logarithme croît (lentement) sans borne
- **log n < √n** : toute puissance positive de n domine le logarithme ; formellement, lim(log n / √n) = 0 par L'Hôpital
- **√n < n** : n^0,5 < n^1 pour n > 1
- **n < n log n** : le facteur log n > 1 pour n > 2
- **n log n < n²** : car log n < n pour tout n > 1
- **n² < n³** : degré inférieur dominé par degré supérieur
- **n³ < 2^n** : exponentielle domine toute polynomiale (preuve ci-dessus)
- **2^n < n!** : ratio n!/2^n croît sans limite (preuve ci-dessus)
- **n! < n^n** : dans n!, chaque facteur est ≤ n ; dans n^n, chaque facteur vaut exactement n

### Ce que signifie « asymptotique »

L'analyse asymptotique étudie le comportement des fonctions **quand n tend vers l'infini**. Elle ignore délibérément les constantes et les termes de faible ordre car ceux-ci deviennent négligeables à grande échelle.

Pour f(n) = 5n³ + 100n² + 10000n + 999999, à n = 1000 :
- Le terme 5n³ vaut 5 × 10⁹
- Tous les autres termes combinés valent moins de 10⁸
- Le terme dominant représente **plus de 98%** du total

**Définition formelle de O** : f(n) = O(g(n)) s'il existe des constantes c > 0 et n₀ telles que f(n) ≤ c × g(n) pour tout n ≥ n₀.

Cette définition capture l'idée que f ne croît pas plus vite que g, à une constante près. Elle permet de comparer des algorithmes sans se soucier des détails d'implémentation qui n'affectent que les constantes.

---

## Conclusion : les fondations sont posées

L'analyse de complexité algorithmique transforme une question empirique instable (« combien de temps prend mon code ? ») en une question mathématique précise (« comment le temps évolue-t-il avec la taille de l'entrée ? »). Les outils présentés — notation Big O héritée de Bachmann et Landau, propriétés des logarithmes, hiérarchie des croissances — constituent le vocabulaire commun de tout informaticien.

La distinction entre polynomiale et exponentielle n'est pas académique : elle sépare les problèmes qu'on peut résoudre en pratique de ceux qui résistent à toute puissance de calcul imaginable. Un algorithme O(n²) sur un milliard d'entrées nécessite 10¹⁸ opérations — difficile mais faisable sur un supercalculateur. Un algorithme O(2^n) sur les mêmes données nécessiterait plus d'opérations qu'il n'y a d'atomes dans l'univers observable.

Les chapitres suivants exploreront les définitions formelles de O, Ω et Θ, les techniques d'analyse (récurrences, méthode master, analyse amortie), et leur application aux structures de données et algorithmes classiques.