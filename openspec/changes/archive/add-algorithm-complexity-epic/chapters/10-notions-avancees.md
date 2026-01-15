# Chapitre X — Notions avancées de complexité algorithmique

Ce chapitre explore les territoires les plus profonds de la théorie de la complexité : les classes P, NP et leurs variantes, la complexité amortie qui révèle la vraie performance des structures de données, et les notations asymptotiques complémentaires au Big O. Ces concepts, bien qu'optionnels pour le développeur au quotidien, constituent le socle théorique sur lequel repose toute l'informatique moderne — et leur compréhension sépare le praticien du véritable architecte algorithmique.

---

## Section A — Classes de complexité : P, NP, NP-complet et NP-difficile

### L'architecture de la calculabilité

La théorie de la complexité ne se contente pas de mesurer le temps d'exécution des algorithmes : elle **classifie les problèmes eux-mêmes** selon leur difficulté intrinsèque. Cette classification, initiée dans les années 1970 par Stephen Cook, Leonid Levin et Richard Karp, a révélé une structure étonnamment riche au sein des problèmes calculables.

### La classe P : les problèmes « faciles »

**Définition formelle** : Un problème de décision appartient à la classe **P** (Polynomial time) s'il existe un algorithme déterministe qui le résout en temps O(n^k) pour une constante k, où n est la taille de l'entrée.

$$P = \bigcup_{k \geq 0} \text{DTIME}(n^k)$$

où DTIME(f(n)) désigne l'ensemble des problèmes résolubles par une machine de Turing déterministe en temps O(f(n)).

**Intuition** : Les problèmes dans P sont ceux pour lesquels on peut trouver une solution efficacement — « efficacement » signifiant ici « en temps polynomial ». Le temps polynomial est considéré comme « tractable » car il reste gérable même pour de grandes entrées (contrairement au temps exponentiel).

**Exemples de problèmes dans P** :
- Tri d'un tableau : O(n log n)
- Recherche du plus court chemin (Dijkstra) : O((V + E) log V)
- Test de primalité (AKS, 2002) : O(n^6) où n est le nombre de chiffres
- Multiplication de matrices : O(n³) naïvement, O(n^2.37) avec Coppersmith-Winograd
- Calcul du PGCD (Euclide) : O(log min(a,b))
- Résolution de systèmes d'équations linéaires : O(n³)

### La classe NP : vérification rapide, résolution incertaine

**Définition formelle** : Un problème de décision appartient à la classe **NP** (Nondeterministic Polynomial time) s'il existe un vérificateur polynomial — c'est-à-dire un algorithme déterministe V tel que pour toute instance x :
- Si x est une instance positive (réponse « oui »), il existe un certificat c de taille polynomiale tel que V(x, c) accepte en temps polynomial
- Si x est une instance négative, aucun certificat ne fait accepter V

$$\text{NP} = \{L \mid \exists \text{ vérificateur polynomial } V, \exists k : x \in L \Leftrightarrow \exists c, |c| \leq |x|^k, V(x,c) = 1\}$$

**Intuition** : NP contient les problèmes dont les solutions sont **faciles à vérifier** mais pas nécessairement faciles à trouver. Si quelqu'un vous donne une solution, vous pouvez confirmer qu'elle est correcte rapidement — mais trouver cette solution par vous-même peut être extraordinairement difficile.

**L'exemple du Sudoku** : Vérifier qu'une grille Sudoku complète respecte les règles (pas de doublon dans chaque ligne, colonne et région) prend un temps linéaire. Mais résoudre un Sudoku depuis une grille partiellement remplie n'a pas d'algorithme polynomial connu pour le cas général (9×9 est facile, mais le problème généralisé n×n est NP-complet).

**Exemples de problèmes dans NP** :
- SAT (satisfiabilité booléenne) : étant donné une formule logique, existe-t-il une assignation de variables qui la rende vraie ?
- Problème du voyageur de commerce (décision) : existe-t-il un circuit de longueur ≤ k ?
- Problème du sac à dos : peut-on remplir le sac pour atteindre exactement une valeur donnée ?
- Coloration de graphe : peut-on colorer les sommets avec k couleurs sans que deux sommets adjacents aient la même couleur ?
- Clique : le graphe contient-il une clique de taille k ?

**Relation fondamentale** : P ⊆ NP (tout problème résoluble en temps polynomial est aussi vérifiable en temps polynomial — il suffit d'ignorer le certificat et de résoudre le problème).

### Le problème du millénaire : P = NP ?

La question « P = NP ? » demande si tout problème dont la solution peut être vérifiée rapidement peut aussi être résolu rapidement. Formulée indépendamment par Stephen Cook en 1971 et Leonid Levin en 1973, elle reste l'un des sept problèmes du millénaire du Clay Mathematics Institute, avec un prix d'un million de dollars pour sa résolution.

**Si P = NP** (considéré improbable par la majorité des experts) :
- Tout problème NP aurait un algorithme polynomial
- La cryptographie moderne s'effondrerait (RSA, courbes elliptiques, etc.)
- L'optimisation combinatoire deviendrait triviale
- L'intelligence artificielle ferait un bond prodigieux
- Comme l'a écrit Gödel : « le travail mental d'un mathématicien concernant les questions oui-ou-non pourrait être entièrement remplacé par une machine »

**Si P ≠ NP** (consensus actuel) :
- Certains problèmes sont intrinsèquement difficiles à résoudre
- La cryptographie à clé publique reste sécurisée
- Les algorithmes d'approximation et les heuristiques restent indispensables

**Pourquoi le problème est-il si difficile ?** Les techniques classiques de preuves (diagonalisation, relativisation) ont été démontrées insuffisantes. En 1975, Baker, Gill et Solovay ont montré l'existence d'oracles A et B tels que P^A = NP^A et P^B ≠ NP^B — ce qui signifie qu'aucune preuve « relativisant » ne peut trancher la question.

### NP-complétude : les problèmes les plus difficiles de NP

**Définition** : Un problème L est **NP-difficile** (NP-hard) si tout problème de NP peut être réduit à L en temps polynomial. Formellement :

$$L \text{ est NP-difficile} \Leftrightarrow \forall L' \in \text{NP}, L' \leq_p L$$

où ≤_p désigne la réduction polynomiale de Karp (réduction many-one).

**Définition** : Un problème L est **NP-complet** s'il est à la fois dans NP et NP-difficile :

$$L \text{ est NP-complet} \Leftrightarrow L \in \text{NP} \land L \text{ est NP-difficile}$$

**Signification** : Les problèmes NP-complets sont les « plus difficiles » de NP. Si l'on trouvait un algorithme polynomial pour **un seul** problème NP-complet, alors P = NP et tous les problèmes de NP seraient résolubles en temps polynomial.

### Le théorème de Cook-Levin : la pierre angulaire

**Théorème (Cook-Levin, 1971)** : Le problème SAT (satisfiabilité booléenne) est NP-complet.

Ce théorème fondateur a établi l'existence même de problèmes NP-complets et fourni le premier exemple concret.

**Énoncé de SAT** : Étant donné une formule booléenne φ en forme normale conjonctive (CNF), existe-t-il une assignation des variables qui rende φ vraie ?

**Exemple** : φ = (x₁ ∨ ¬x₂ ∨ x₃) ∧ (¬x₁ ∨ x₂) ∧ (¬x₃)

Cette formule est satisfiable avec x₁ = vrai, x₂ = vrai, x₃ = faux.

**Idée de la preuve** (esquisse) :

1. **SAT ∈ NP** : Étant donné une assignation candidate, on peut vérifier en temps polynomial si elle satisfait toutes les clauses.

2. **SAT est NP-difficile** : Pour tout problème L ∈ NP, il existe un vérificateur V fonctionnant en temps polynomial p(n). On construit une formule booléenne φ qui encode :
   - La configuration initiale de la machine de Turing V
   - Les règles de transition de V
   - L'acceptation finale
   
   Cette formule φ est satisfiable si et seulement si V accepte — et sa construction prend un temps polynomial en |x|.

La preuve complète utilise le concept de « tableau de calcul » (computation tableau) où chaque cellule représente l'état d'une case du ruban à un instant donné, et des contraintes logiques encodent les transitions valides de la machine de Turing.

### Les 21 problèmes de Karp : l'explosion de la NP-complétude

En 1972, Richard Karp a publié « Reducibility Among Combinatorial Problems », démontrant que 21 problèmes combinatoires classiques sont NP-complets par réduction depuis SAT. Cette publication a révélé que la NP-complétude n'était pas un phénomène isolé mais une propriété partagée par de nombreux problèmes importants.

**Arbre des réductions de Karp** (sélection) :

```
SAT
├── 3-SAT
│   ├── CHROMATIC NUMBER (coloration de graphe)
│   │   └── CLIQUE COVER
│   └── EXACT COVER
│       ├── 3D-MATCHING
│       └── KNAPSACK
│           ├── PARTITION
│           └── JOB SEQUENCING
├── CLIQUE
│   ├── VERTEX COVER
│   │   ├── FEEDBACK VERTEX SET
│   │   └── HAMILTONIAN CIRCUIT
│   │       └── TRAVELING SALESMAN
│   └── SET PACKING
└── 0-1 INTEGER PROGRAMMING
```

**Exemple de réduction : 3-SAT → CLIQUE**

On transforme une formule 3-CNF en un graphe où :
- Chaque littéral de chaque clause devient un sommet
- On relie deux sommets si et seulement si :
  - Ils appartiennent à des clauses différentes
  - Ils ne sont pas contradictoires (x et ¬x ne peuvent pas être reliés)

La formule à m clauses est satisfiable si et seulement si le graphe contient une clique de taille m.

### Problèmes NP-intermédiaires : le théorème de Ladner

**Théorème (Ladner, 1975)** : Si P ≠ NP, alors il existe des problèmes dans NP qui ne sont ni dans P, ni NP-complets.

$$P \neq \text{NP} \Rightarrow \exists L \in \text{NP} \setminus P : L \text{ n'est pas NP-complet}$$

**Idée de la preuve** : Ladner construit un langage « artificiel » SAT_H en ajoutant un padding (remplissage) à SAT :

$$\text{SAT}_H = \{\phi 0 1^{|\phi|^{H(|\phi|)}} : \phi \in \text{SAT}\}$$

où H est une fonction calculable soigneusement choisie qui croît suffisamment lentement pour que SAT_H ne soit pas dans P, mais suffisamment vite pour qu'il ne soit pas NP-complet (les réductions vers lui produisent des instances trop longues).

**Candidats naturels pour NP-intermédiaire** :

| Problème | Statut | Remarque |
|----------|--------|----------|
| **Isomorphisme de graphes** | Candidat majeur | Si NP-complet, la hiérarchie polynomiale s'effondre |
| **Factorisation d'entiers** | Candidat majeur | En NP ∩ coNP, donc probablement pas NP-complet |
| **Logarithme discret** | Candidat | Similaire à la factorisation |
| **Équivalence de Nash** | Candidat | Problème PPAD-complet |
| **Jeux de parité** | Candidat | Algorithme quasi-polynomial connu |

En 2015, László Babai a annoncé un algorithme **quasi-polynomial** O(exp((log n)^O(1))) pour l'isomorphisme de graphes — un résultat majeur suggérant fortement que ce problème n'est pas NP-complet.

### Diagramme récapitulatif des classes de complexité

```
┌─────────────────────────────────────────────────────────┐
│                     NP-difficile                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │                    NP                            │   │
│  │  ┌───────────────────────────────────────────┐  │   │
│  │  │         NP-complet                        │  │   │
│  │  │  (SAT, 3-SAT, TSP, CLIQUE, KNAPSACK...)  │  │   │
│  │  └───────────────────────────────────────────┘  │   │
│  │                                                  │   │
│  │  ┌───────────────────────────────────────────┐  │   │
│  │  │      NP-intermédiaire (si P ≠ NP)        │  │   │
│  │  │  (Factorisation, Isomorphisme graphes?)  │  │   │
│  │  └───────────────────────────────────────────┘  │   │
│  │                                                  │   │
│  │  ┌───────────────────────────────────────────┐  │   │
│  │  │                  P                        │  │   │
│  │  │  (Tri, Plus court chemin, Primalité...)  │  │   │
│  │  └───────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Problèmes NP-difficiles hors NP :                     │
│  (Problème de l'arrêt, Jeux à somme nulle généralisés) │
└─────────────────────────────────────────────────────────┘
```

### Implications pratiques

La NP-complétude d'un problème n'est pas une condamnation à l'impuissance. Elle guide les choix d'ingénierie :

1. **Algorithmes d'approximation** : Trouver une solution garantie à un facteur constant de l'optimal (ex : 2-approximation pour Vertex Cover)

2. **Heuristiques** : Algorithmes sans garantie théorique mais efficaces en pratique (algorithmes génétiques, recuit simulé)

3. **Cas particuliers tractables** : De nombreux problèmes NP-complets ont des cas spéciaux polynomiaux (2-SAT est dans P, graphes planaires pour certains problèmes)

4. **Complexité paramétrée** : Algorithmes O(f(k) · n^c) où k est un paramètre du problème, efficaces quand k est petit

---

## Section B — Complexité amortie : la vraie mesure des structures de données

### Motivation : quand le pire cas ment

L'analyse du pire cas peut être trompeuse pour les structures de données où les opérations coûteuses sont rares. Considérons un tableau dynamique (ArrayList, vector) : l'insertion prend généralement O(1), mais occasionnellement O(n) lors du redimensionnement. L'analyse du pire cas donnerait O(n) par insertion, soit O(n²) pour n insertions — une surestimation grossière.

L'**analyse amortie**, introduite formellement par Robert Tarjan en 1985, moyenne le coût des opérations sur une séquence, révélant leur vraie performance. Elle garantit que le coût total de n opérations ne dépasse jamais n fois le coût amorti, **sans faire appel aux probabilités**.

### Les trois méthodes d'analyse amortie

#### Méthode agrégée (Aggregate Method)

**Principe** : Calculer le coût total d'une séquence de n opérations, puis diviser par n.

$$\text{Coût amorti} = \frac{\text{Coût total de } n \text{ opérations}}{n}$$

**Exemple : Compteur binaire**

Un compteur de k bits représente un entier de 0 à 2^k - 1. L'opération INCREMENT incrémente le compteur de 1, en basculant les bits nécessaires.

```
Incrément de 00111 :
  00111 → basculer bit 0 → 00110
        → basculer bit 1 → 00100
        → basculer bit 2 → 00000
        → basculer bit 3 → 01000
  Coût : 4 basculements
```

**Analyse naïve** : Chaque incrément peut basculer jusqu'à k bits → O(k) par opération → O(nk) pour n incréments.

**Analyse agrégée** :
- Le bit 0 est basculé à chaque incrément : n fois
- Le bit 1 est basculé tous les 2 incréments : ⌊n/2⌋ fois
- Le bit i est basculé tous les 2^i incréments : ⌊n/2^i⌋ fois

Coût total = ∑(i=0 à k-1) ⌊n/2^i⌋ < n × ∑(i=0 à ∞) 1/2^i = n × 2 = **2n**

**Coût amorti par incrément = 2n/n = O(1)**

#### Méthode comptable (Accounting Method / Banker's Method)

**Principe** : Attribuer un « crédit » (coût fictif) à chaque opération. Les opérations peu coûteuses paient plus qu'elles ne consomment, accumulant des crédits pour les opérations futures coûteuses.

**Contrainte fondamentale** : Le solde des crédits ne doit jamais devenir négatif.

$$\sum_{i=1}^{n} \hat{c}_i \geq \sum_{i=1}^{n} c_i \quad \text{pour tout } n$$

où ĉᵢ est le coût amorti (crédit payé) et cᵢ le coût réel.

**Exemple : Tableau dynamique avec doublement**

Chaque insertion coûte 1 unité. Lors d'un redimensionnement (quand le tableau est plein), on alloue un tableau de taille double et on copie tous les éléments (coût n).

**Schéma de crédit** : Chaque insertion paie **3 crédits** :
- 1 crédit pour l'insertion elle-même
- 2 crédits déposés sur l'élément inséré

Lors du redimensionnement après avoir rempli un tableau de taille n :
- On doit copier n éléments (coût n)
- Les n/2 derniers éléments insérés ont chacun 2 crédits stockés
- Total des crédits disponibles : n (suffisant pour payer la copie)

**Coût amorti = 3 = O(1) par insertion**

**Preuve formelle** : Soit n le nombre d'éléments et c la capacité. Après chaque insertion sans redimensionnement, le crédit stocké augmente de 2. Juste avant un redimensionnement, n = c et le crédit stocké est au moins 2(c - c/2) = c. Ce crédit paie exactement le coût de copie c.

#### Méthode du potentiel (Physicist's Method)

**Principe** : Définir une fonction de potentiel Φ : États → ℝ⁺ qui capture l'« énergie stockée » dans la structure de données. Le coût amorti d'une opération est son coût réel plus la variation de potentiel.

$$\hat{c}_i = c_i + \Phi(D_i) - \Phi(D_{i-1})$$

**Contraintes** :
- Φ(D₀) = 0 (potentiel initial nul)
- Φ(Dᵢ) ≥ 0 pour tout i (potentiel toujours positif)

**Propriété fondamentale** : 

$$\sum_{i=1}^{n} \hat{c}_i = \sum_{i=1}^{n} c_i + \Phi(D_n) - \Phi(D_0) = \sum_{i=1}^{n} c_i + \Phi(D_n) \geq \sum_{i=1}^{n} c_i$$

Le coût amorti total majore le coût réel total.

**Exemple : Tableau dynamique avec la méthode du potentiel**

Soit n le nombre d'éléments et c la capacité. Fonction de potentiel :

$$\Phi(D) = 2n - c$$

**Vérifications** :
- Φ(D₀) = 2(0) - 0 = 0 ✓
- Après redimensionnement : n = c/2, donc Φ = 2(c/2) - c = 0 ≥ 0 ✓
- Avant redimensionnement : n = c, donc Φ = 2c - c = c ≥ 0 ✓

**Analyse d'une insertion sans redimensionnement** :
- Coût réel : c = 1
- ΔΦ = (2(n+1) - c) - (2n - c) = 2
- Coût amorti : ĉ = 1 + 2 = **3**

**Analyse d'une insertion avec redimensionnement** (quand n = c) :
- Coût réel : c = 1 + n = 1 + c (insertion + copie)
- Potentiel avant : Φ = 2c - c = c
- Potentiel après : Φ' = 2(c+1) - 2c = 2 (nouvelle capacité = 2c)
- ΔΦ = 2 - c
- Coût amorti : ĉ = (1 + c) + (2 - c) = **3**

**Dans tous les cas, le coût amorti est O(1).**

### Application : Analyse de structures de données classiques

| Structure | Opération | Pire cas | Amorti |
|-----------|-----------|----------|--------|
| Tableau dynamique | Insertion | O(n) | **O(1)** |
| Pile avec MULTIPOP | Pop de k éléments | O(k) | **O(1)** |
| Compteur binaire | Incrément | O(log n) | **O(1)** |
| Arbre Splay | Recherche/Insertion | O(n) | **O(log n)** |
| Union-Find (avec rang et compression) | Union/Find | O(log n) | **O(α(n))** |
| Table de hachage (redimensionnement) | Insertion | O(n) | **O(1)** |

*Note : α(n) est la fonction inverse d'Ackermann, qui croît extrêmement lentement (α(n) ≤ 4 pour tout n ≤ 10^600).*

### Différence avec l'analyse en moyenne

**Analyse amortie** :
- Aucune hypothèse probabiliste
- Garantie sur le pire cas d'une séquence
- Valide pour TOUTE séquence d'opérations
- Déterministe

**Analyse en moyenne** :
- Suppose une distribution de probabilité sur les entrées
- Donne une espérance, pas une garantie
- Peut être invalide si les entrées ne suivent pas la distribution supposée

L'analyse amortie est plus forte : elle garantit que le coût total ne dépasse jamais n × (coût amorti), quelle que soit la séquence d'opérations.

---

## Section C — Autres notations asymptotiques : Ω, Θ, o et ω

### Vue d'ensemble des notations

La notation Big O n'est qu'une partie d'une famille complète de notations décrivant le comportement asymptotique des fonctions. Chaque notation répond à une question différente :

| Notation | Question | Analogie |
|----------|----------|----------|
| f = O(g) | f croît-elle au plus aussi vite que g ? | f ≤ g |
| f = Ω(g) | f croît-elle au moins aussi vite que g ? | f ≥ g |
| f = Θ(g) | f croît-elle exactement comme g ? | f = g |
| f = o(g) | f croît-elle strictement moins vite que g ? | f < g |
| f = ω(g) | f croît-elle strictement plus vite que g ? | f > g |

### Big Omega Ω — Borne inférieure asymptotique

**Définition formelle** :

$$f(n) = \Omega(g(n)) \Leftrightarrow \exists c > 0, \exists n_0 \in \mathbb{N} : \forall n \geq n_0, f(n) \geq c \cdot g(n)$$

**Interprétation** : f(n) croît **au moins** aussi vite que g(n). Big Omega donne une borne inférieure sur le taux de croissance.

**Exemple 1** : Montrons que 3n² + 2n = Ω(n²)

Choisissons c = 1 et n₀ = 1. Pour tout n ≥ 1 :
$$3n^2 + 2n \geq 3n^2 \geq 1 \cdot n^2$$

Donc 3n² + 2n = Ω(n²). ∎

**Exemple 2** : Montrons que n² = Ω(n)

Choisissons c = 1 et n₀ = 1. Pour tout n ≥ 1 :
$$n^2 \geq n = 1 \cdot n$$

Donc n² = Ω(n). ∎

**Exemple 3** : Montrons que n ≠ Ω(n²)

Supposons par l'absurde qu'il existe c > 0 et n₀ tels que pour tout n ≥ n₀ : n ≥ c·n².

Cela implique 1 ≥ c·n pour tout n ≥ n₀, soit n ≤ 1/c.

Mais pour n > max(n₀, 1/c), cette inégalité est violée. Contradiction. ∎

**Application en algorithmique** : Ω est utilisé pour établir des **bornes inférieures** sur la complexité des problèmes. Par exemple :

- Tout algorithme de tri par comparaison est Ω(n log n) dans le pire cas
- La recherche dans un tableau non trié est Ω(n)
- Toute opération sur n bits nécessite Ω(n) temps pour lire l'entrée

### Big Theta Θ — Borne exacte

**Définition formelle** :

$$f(n) = \Theta(g(n)) \Leftrightarrow \exists c_1, c_2 > 0, \exists n_0 : \forall n \geq n_0, c_1 \cdot g(n) \leq f(n) \leq c_2 \cdot g(n)$$

**Théorème fondamental** :

$$f(n) = \Theta(g(n)) \Leftrightarrow f(n) = O(g(n)) \text{ ET } f(n) = \Omega(g(n))$$

**Preuve** :

(⇒) Si f = Θ(g), alors par définition f(n) ≤ c₂·g(n) donc f = O(g), et f(n) ≥ c₁·g(n) donc f = Ω(g).

(⇐) Si f = O(g), il existe c₂ et n₁ tels que f(n) ≤ c₂·g(n) pour n ≥ n₁.
Si f = Ω(g), il existe c₁ et n₂ tels que f(n) ≥ c₁·g(n) pour n ≥ n₂.
Pour n₀ = max(n₁, n₂), les deux inégalités sont satisfaites, donc f = Θ(g). ∎

**Exemple** : Montrons que 5n² - 3n + 7 = Θ(n²)

*Borne supérieure (O)* : Pour n ≥ 1 : 5n² - 3n + 7 ≤ 5n² + 7n² = 12n²
Donc 5n² - 3n + 7 = O(n²) avec c = 12.

*Borne inférieure (Ω)* : Pour n ≥ 2 : 5n² - 3n + 7 ≥ 5n² - 3n² = 2n²
Donc 5n² - 3n + 7 = Ω(n²) avec c = 2.

*Conclusion* : 5n² - 3n + 7 = Θ(n²). ∎

**Usage pratique** : Θ est la notation la plus précise. Dire qu'un algorithme est **Θ(n log n)** signifie qu'il ne peut pas faire mieux que n log n (borne inférieure) et qu'il atteint effectivement cette performance (borne supérieure).

### Petit o et petit ω — Domination stricte

**Petit o — strictement dominé** :

$$f(n) = o(g(n)) \Leftrightarrow \lim_{n \to \infty} \frac{f(n)}{g(n)} = 0$$

Équivalent : ∀ε > 0, ∃n₀ : ∀n ≥ n₀, f(n) < ε·g(n)

**Intuition** : f devient **négligeable** devant g quand n grandit.

**Exemples** :
- n = o(n²) car lim(n/n²) = lim(1/n) = 0
- n² = o(2^n) car toute polynomiale est négligeable devant toute exponentielle
- log n = o(n^ε) pour tout ε > 0
- n^k = o(n^(k+1)) pour tout k

**Petit ω — domine strictement** :

$$f(n) = \omega(g(n)) \Leftrightarrow \lim_{n \to \infty} \frac{f(n)}{g(n)} = +\infty$$

Équivalent : f = ω(g) ⟺ g = o(f)

**Exemples** :
- n² = ω(n) car lim(n²/n) = lim(n) = +∞
- 2^n = ω(n^k) pour tout k
- n! = ω(2^n)

### Relations entre les notations

**Diagramme des implications** :

```
        f = Θ(g)
       ↙       ↘
   f = O(g)    f = Ω(g)
       ↓           ↓
   f = o(g)?    f = ω(g)?
       
Note : f = Θ(g) implique f = O(g) et f = Ω(g)
       f = o(g) implique f = O(g) mais PAS l'inverse
       f = ω(g) implique f = Ω(g) mais PAS l'inverse
```

**Tableau récapitulatif** :

| Notation | Définition limite | Analogie | Symétrie |
|----------|------------------|----------|----------|
| f = O(g) | lim sup f/g < ∞ | f ≤ g | g = Ω(f) |
| f = Ω(g) | lim inf f/g > 0 | f ≥ g | g = O(f) |
| f = Θ(g) | 0 < lim f/g < ∞ | f = g | g = Θ(f) |
| f = o(g) | lim f/g = 0 | f < g | g = ω(f) |
| f = ω(g) | lim f/g = ∞ | f > g | g = o(f) |

### Utilisation pratique des notations

**Big O** : Utilisé principalement pour l'**analyse du pire cas**. « L'algorithme est O(n²) » signifie qu'il ne dépassera jamais un multiple constant de n² opérations.

**Big Omega** : Utilisé pour les **bornes inférieures théoriques**. « Le tri par comparaison est Ω(n log n) » signifie qu'aucun algorithme de tri par comparaison ne peut faire mieux.

**Big Theta** : Utilisé quand la complexité exacte est connue. « Merge sort est Θ(n log n) » signifie qu'il prend exactement cet ordre de grandeur, ni plus ni moins.

**Petit o** : Utilisé pour exprimer la négligeabilité. « Les termes de faible ordre sont o(n²) » signifie qu'ils deviennent négligeables face au terme dominant n².

### Preuves mathématiques supplémentaires

**Théorème** : Si f = Θ(g) et g = Θ(h), alors f = Θ(h). (Transitivité)

**Preuve** :
Par hypothèse :
- ∃ c₁, c₂, n₁ : ∀n ≥ n₁, c₁·g(n) ≤ f(n) ≤ c₂·g(n)
- ∃ c₃, c₄, n₂ : ∀n ≥ n₂, c₃·h(n) ≤ g(n) ≤ c₄·h(n)

Pour n ≥ max(n₁, n₂) :
- f(n) ≤ c₂·g(n) ≤ c₂·c₄·h(n)
- f(n) ≥ c₁·g(n) ≥ c₁·c₃·h(n)

Donc f = Θ(h) avec constantes c₁·c₃ et c₂·c₄. ∎

**Théorème** : f = o(g) si et seulement si f = O(g) et f ≠ Θ(g).

**Preuve** :
(⇒) Si f = o(g), alors pour tout ε > 0, f(n) < ε·g(n) pour n assez grand.
En particulier, f(n) < 1·g(n), donc f = O(g).
Supposons f = Θ(g). Alors ∃c > 0 : f(n) ≥ c·g(n) pour n assez grand.
Mais f = o(g) implique f(n) < (c/2)·g(n) pour n assez grand. Contradiction.

(⇐) f = O(g) et f ≠ Θ(g) implique f ≠ Ω(g) (sinon f serait Θ(g)).
Donc ∀c > 0, ∃ infiniment de n tels que f(n) < c·g(n).
Ceci implique lim inf f/g = 0, et avec f = O(g), on a lim sup f/g < ∞.
En fait, puisque f/g ne peut pas avoir de limite inférieure positive,
et f = O(g) borne supérieurement, on obtient lim f/g = 0, donc f = o(g). ∎

---

## Conclusion : la complexité comme boussole intellectuelle

Les notions avancées de ce chapitre — classes de complexité, analyse amortie, notations asymptotiques complètes — ne sont pas de simples curiosités théoriques. Elles constituent le cadre conceptuel qui guide les décisions d'architecture logicielle à grande échelle.

**La NP-complétude** répond à une question fondamentale : ce problème a-t-il une solution efficace, ou dois-je me contenter d'approximations ? Des milliers de problèmes pratiques (ordonnancement, optimisation, planification) sont NP-complets, et cette connaissance évite de perdre des années à chercher des algorithmes polynomiaux qui n'existent probablement pas.

**L'analyse amortie** révèle la vraie performance des structures de données. Elle explique pourquoi un ArrayList en Java (avec son redimensionnement occasionnel en O(n)) reste performant en pratique : le coût amorti de chaque insertion est O(1), garantissant une performance prévisible sur de longues séquences d'opérations.

**Les notations Ω et Θ** complètent le vocabulaire du Big O. Elles permettent d'exprimer non seulement des bornes supérieures, mais aussi des bornes inférieures (impossibilité de faire mieux) et des caractérisations exactes (complexité précise). Cette précision est essentielle pour les preuves d'optimalité et les comparaisons d'algorithmes.

La question P = NP, toujours ouverte après plus de 50 ans, illustre la profondeur de ces problèmes. Sa résolution — dans un sens ou dans l'autre — transformerait notre compréhension de la computation et de l'intelligence. En attendant, la théorie de la NP-complétude fournit une carte fiable du paysage computationnel, distinguant les sommets accessibles des cimes infranchissables.

---

## Références et lectures complémentaires

### Ouvrages fondamentaux

- **Cormen, Leiserson, Rivest, Stein** — *Introduction to Algorithms* (4th ed., MIT Press, 2022). Chapitres 34 (NP-Completeness) et 17 (Amortized Analysis).

- **Sipser, Michael** — *Introduction to the Theory of Computation* (3rd ed., Cengage, 2012). Référence pour les classes de complexité et la NP-complétude.

- **Arora, Sanjeev & Barak, Boaz** — *Computational Complexity: A Modern Approach* (Cambridge, 2009). Traitement rigoureux accessible en ligne.

- **Garey, Michael R. & Johnson, David S.** — *Computers and Intractability: A Guide to the Theory of NP-Completeness* (W.H. Freeman, 1979). Le classique des réductions NP-complètes.

### Articles historiques

- **Cook, Stephen A.** — "The Complexity of Theorem Proving Procedures" (STOC 1971). L'article fondateur de la NP-complétude.

- **Karp, Richard M.** — "Reducibility Among Combinatorial Problems" (1972). Les 21 problèmes NP-complets originaux.

- **Tarjan, Robert E.** — "Amortized Computational Complexity" (SIAM J. Algebraic and Discrete Methods, 1985). Introduction formelle de l'analyse amortie.

- **Ladner, Richard E.** — "On the Structure of Polynomial Time Reducibility" (JACM, 1975). Le théorème des problèmes NP-intermédiaires.

- **Babai, László** — "Graph Isomorphism in Quasipolynomial Time" (STOC 2016). Algorithme quasi-polynomial pour l'isomorphisme de graphes.
