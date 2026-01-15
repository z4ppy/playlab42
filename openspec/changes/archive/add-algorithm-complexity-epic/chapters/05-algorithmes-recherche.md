# Chapitre V – Les algorithmes de recherche

La recherche d'un élément dans une collection de données constitue l'une des opérations les plus fondamentales en informatique. Ce chapitre présente les principaux algorithmes de recherche, depuis la méthode séquentielle élémentaire jusqu'aux techniques sophistiquées de hachage, en établissant rigoureusement leurs complexités temporelles respectives. Le choix de l'algorithme approprié dépend crucialement de la structure des données (triées ou non), de leur distribution statistique, et du compromis entre temps de recherche et espace mémoire.

---

## A. La recherche séquentielle parcourt chaque élément un à un

### Principe et fonctionnement sur données non triées

La recherche séquentielle, également appelée recherche linéaire, constitue l'approche la plus intuitive : l'algorithme examine successivement chaque élément de la collection jusqu'à trouver la valeur recherchée ou épuiser l'ensemble des données. Cette méthode ne requiert **aucun prérequis** sur l'organisation des données, ce qui la rend universellement applicable mais généralement inefficace pour les grands ensembles.

L'analogie pédagogique naturelle est celle d'une personne cherchant un livre sur une étagère non rangée : elle doit examiner chaque ouvrage un par un jusqu'à trouver le bon titre. Cette simplicité conceptuelle se traduit par une implémentation directe.

**Pseudocode de la recherche séquentielle :**

```
FONCTION RechercheSequentielle(T[1..n], valeur)
    POUR i DE 1 À n FAIRE
        SI T[i] = valeur ALORS
            RETOURNER i        // Élément trouvé à l'indice i
        FIN SI
    FIN POUR
    RETOURNER -1               // Élément non trouvé
FIN FONCTION
```

### Preuve mathématique de la complexité O(n)

**Théorème :** La recherche séquentielle possède une complexité temporelle O(n) dans le pire cas.

**Démonstration :** Soit T(n) le nombre d'opérations élémentaires pour un tableau de taille n. À chaque itération, l'algorithme effectue un nombre constant c d'opérations (une comparaison, une incrémentation, un test de fin de boucle). Dans le pire cas — l'élément est absent ou situé en dernière position — la boucle s'exécute exactement n fois.

Le temps d'exécution s'exprime donc sous la forme :

$$T(n) = \sum_{i=1}^{n} c = c \cdot n$$

Par définition de la notation asymptotique, il existe des constantes $n_0$ et $k$ telles que pour tout $n \geq n_0$ : $T(n) \leq k \cdot n$. Ainsi, $T(n) = O(n)$.  ∎

### Analyse complète des cas

L'analyse probabiliste affine cette caractérisation selon les scénarios d'exécution.

| **Cas** | **Complexité** | **Situation** |
|---------|----------------|---------------|
| Meilleur cas | O(1) | Élément trouvé en première position |
| Pire cas | O(n) | Élément absent ou en dernière position |
| Cas moyen | O(n) | Position moyenne (n+1)/2 |

Pour le **cas moyen**, supposons que l'élément recherché se trouve avec probabilité égale à n'importe quelle position. Le nombre espéré de comparaisons vaut :

$$E[C] = \frac{1}{n} \sum_{i=1}^{n} i = \frac{1}{n} \cdot \frac{n(n+1)}{2} = \frac{n+1}{2}$$

Si l'on considère également la probabilité $q$ que l'élément soit absent, la formule générale devient $E[C] = \frac{n+1}{2}(1-q) + nq$, ce qui reste linéaire en n.

### Cas d'utilisation pertinents

Malgré sa complexité linéaire, la recherche séquentielle demeure le choix optimal dans plusieurs situations : lorsque les données ne sont pas triées et qu'une seule recherche est nécessaire (le coût de tri O(n log n) excéderait le gain), pour les petites collections où la simplicité prime sur l'efficacité asymptotique, ou encore pour les structures comme les listes chaînées ne permettant pas l'accès aléatoire en temps constant.

---

## B. La recherche dichotomique exploite la division récursive de l'espace

### Principe du diviser pour régner

La recherche dichotomique (ou binaire) représente un bond qualitatif en efficacité pour les données préalablement triées. L'algorithme compare l'élément recherché avec la valeur médiane du tableau : si les valeurs sont égales, la recherche aboutit ; sinon, elle se poursuit récursivement dans la moitié gauche ou droite selon que la valeur recherchée est inférieure ou supérieure à la médiane.

L'analogie classique est celle de la recherche dans un dictionnaire : plutôt que de parcourir chaque page, on ouvre le livre approximativement au milieu et on détermine dans quelle moitié poursuivre la recherche. Cette stratégie de **diviser pour régner** réduit l'espace de recherche de moitié à chaque étape.

**Pseudocode itératif (version recommandée) :**

```
FONCTION RechercheDichotomique(T[0..n-1], valeur)
    debut ← 0
    fin ← n - 1
    
    TANT QUE debut ≤ fin FAIRE
        // Calcul sécurisé du milieu (évite l'overflow)
        milieu ← debut + (fin - debut) / 2
        
        SI T[milieu] = valeur ALORS
            RETOURNER milieu
        SINON SI T[milieu] < valeur ALORS
            debut ← milieu + 1
        SINON
            fin ← milieu - 1
        FIN SI
    FIN TANT QUE
    
    RETOURNER -1    // Élément non trouvé
FIN FONCTION
```

**Version récursive :**

```
FONCTION RechercheDichotomiqueRec(T, valeur, debut, fin)
    SI debut > fin ALORS
        RETOURNER -1
    FIN SI
    
    milieu ← debut + (fin - debut) / 2
    
    SI T[milieu] = valeur ALORS
        RETOURNER milieu
    SINON SI T[milieu] > valeur ALORS
        RETOURNER RechercheDichotomiqueRec(T, valeur, debut, milieu - 1)
    SINON
        RETOURNER RechercheDichotomiqueRec(T, valeur, milieu + 1, fin)
    FIN SI
FIN FONCTION
```

### Preuve mathématique rigoureuse de la complexité logarithmique

**Théorème :** La recherche dichotomique possède une complexité temporelle O(log n).

**Démonstration par récurrence forte :**

Soit T(n) le temps d'exécution pour un tableau de n éléments, et c une constante représentant le coût d'une itération (hors appels récursifs). Nous démontrons que $T(n) \leq c \cdot \log_2(n) + T(1)$ pour tout $n \geq 1$.

*Cas de base (n = 1) :* L'inégalité $T(1) \leq c \cdot \log_2(1) + T(1) = T(1)$ est trivialement vérifiée.

*Hypothèse de récurrence :* Supposons que pour tout $k < n$, on ait $T(k) \leq c \cdot \log_2(k) + T(1)$.

*Étape d'induction :* À chaque itération, l'espace de recherche est divisé par 2. Donc :

$$T(n) \leq c + T\left(\frac{n}{2}\right)$$

En appliquant l'hypothèse de récurrence :

$$T(n) \leq c + c \cdot \log_2\left(\frac{n}{2}\right) + T(1) = c + c \cdot (\log_2(n) - 1) + T(1) = c \cdot \log_2(n) + T(1)$$

L'inégalité est donc vérifiée au rang n. Par le principe de récurrence forte, $T(n) = O(\log n)$.  ∎

**Démonstration alternative par le Master Theorem :**

La relation de récurrence $T(n) = T(n/2) + \Theta(1)$ correspond au cas $a = 1$, $b = 2$, $f(n) = 1$ du théorème maître. On calcule $\log_b a = \log_2 1 = 0$, et puisque $f(n) = \Theta(n^0) = \Theta(1)$, on se trouve dans le cas 2 : $T(n) = \Theta(\log n)$.

**Démonstration directe par comptage d'itérations :**

À chaque itération, l'espace de recherche passe de n à n/2. Après k itérations, il reste $n/2^k$ éléments. La recherche se termine quand cet espace atteint 1 :

$$\frac{n}{2^k} = 1 \implies 2^k = n \implies k = \log_2(n)$$

### Analyse détaillée des cas

| **Cas** | **Complexité** | **Nombre exact de comparaisons** |
|---------|----------------|----------------------------------|
| Meilleur cas | O(1) | 1 (élément au milieu) |
| Pire cas | O(log n) | ⌊log₂(n)⌋ + 1 |
| Cas moyen | O(log n) | ≈ log₂(n) − 1 (recherche fructueuse) |

Le nombre exact de comparaisons dans le pire cas est **⌊log₂(n)⌋ + 1**, résultat établi par Donald Knuth. Pour le cas moyen d'une recherche fructueuse, l'analyse de Knuth donne une formule précise impliquant des parties entières, qui converge vers log₂(n) − 1 pour les grandes valeurs de n.

La complexité spatiale diffère selon l'implémentation : **O(1)** pour la version itérative (seules quelques variables sont nécessaires), mais **O(log n)** pour la version récursive en raison de la pile d'appels.

### Le piège classique du calcul du milieu

Un bug subtil mais célèbre a affecté de nombreuses implémentations pendant des décennies, notamment dans la bibliothèque standard Java pendant neuf ans et dans l'ouvrage *Programming Pearls* de Jon Bentley pendant vingt ans.

**Code incorrect :**
```
milieu = (debut + fin) / 2    // BUG: risque d'overflow
```

Si `debut` et `fin` sont de grands entiers, leur somme peut dépasser la valeur maximale représentable (2³¹ − 1 pour un entier 32 bits), produisant un résultat négatif erroné.

**Code correct :**
```
milieu = debut + (fin - debut) / 2    // Pas de risque d'overflow
```

Cette formulation est mathématiquement équivalente mais évite l'addition potentiellement dangereuse des deux bornes.

---

## C. La recherche par interpolation anticipe la position de l'élément

### Intuition et formule d'interpolation

La recherche par interpolation, introduite par W. W. Peterson en 1957, améliore la recherche binaire lorsque les données sont **uniformément distribuées**. Au lieu de diviser systématiquement l'espace en deux, l'algorithme estime la position probable de l'élément recherché en fonction de sa valeur relative, comme un humain cherchant "Martin" dans un annuaire ouvre naturellement vers le milieu plutôt qu'au début.

La position estimée repose sur l'**interpolation linéaire** :

$$pos = lo + \left\lfloor \frac{(x - A[lo]) \times (hi - lo)}{A[hi] - A[lo]} \right\rfloor$$

où $x$ est la valeur recherchée, $lo$ et $hi$ les bornes de l'intervalle courant, et $A$ le tableau trié.

Cette formule dérive de l'hypothèse que les valeurs sont réparties linéairement : si la valeur recherchée représente une fraction $p = (x - A[lo])/(A[hi] - A[lo])$ de l'intervalle des valeurs, sa position devrait représenter la même fraction de l'intervalle des indices.

**Pseudocode de la recherche par interpolation :**

```
FONCTION RechercheInterpolation(T[0..n-1], valeur)
    lo ← 0
    hi ← n - 1
    
    TANT QUE lo ≤ hi ET valeur ≥ T[lo] ET valeur ≤ T[hi] FAIRE
        SI lo = hi ALORS
            SI T[lo] = valeur ALORS RETOURNER lo
            SINON RETOURNER -1
            FIN SI
        FIN SI
        
        // Estimation par interpolation linéaire
        pos ← lo + ⌊((valeur - T[lo]) × (hi - lo)) / (T[hi] - T[lo])⌋
        
        SI T[pos] = valeur ALORS
            RETOURNER pos
        SINON SI T[pos] < valeur ALORS
            lo ← pos + 1
        SINON
            hi ← pos - 1
        FIN SI
    FIN TANT QUE
    
    RETOURNER -1
FIN FONCTION
```

### Preuve mathématique de la complexité O(log log n)

Le résultat théorique majeur établissant la complexité O(log log n) fut démontré par Perl, Itai et Avni en 1978 dans un article fondateur des *Communications of the ACM*.

**Théorème (Perl, Itai, Avni, 1978) :** Sous l'hypothèse que les n clés sont tirées indépendamment d'une distribution uniforme, le nombre moyen d'accès de la recherche par interpolation est O(log log n).

**Esquisse de la démonstration :**

L'analyse repose sur la théorie des martingales. Définissons $D_j$ comme l'erreur (distance entre la position estimée et la position réelle) à l'étape j.

*Lemme clé :* L'espérance conditionnelle de l'erreur au carré satisfait $E[D_j^2 | S_1, ..., S_{j-1}] \leq D_{j-1}^2$, où $S_i$ représente l'état de la recherche à l'étape i.

Par analyse probabiliste utilisant la distribution binomiale des clés dans chaque sous-intervalle, on établit par récurrence que :

$$E[D_j | S_1] < n^{2^{-j}}$$

Pour $j \geq \log_2(\log_2 n)$, cette borne implique $E[D_j] \leq 2$, signifiant que l'erreur devient négligeable après O(log log n) itérations.

La preuve formelle utilise le **théorème d'échantillonnage optionnel** pour les supermartingales. En posant $Z_j = \log D_j$, on montre que la séquence $\{2^j Z_j\}$ forme une supermartingale, d'où :

$$E[2^T] \leq \log n \implies E[T] \leq \log(\log n)$$

où T est le temps d'arrêt de l'algorithme.  ∎

**Interprétation intuitive :** La recherche binaire réduit l'espace de n à n/2 (réduction multiplicative constante), nécessitant log n étapes. La recherche par interpolation, grâce à son estimation intelligente, réduit l'espace de n à environ √n (réduction quadratique), d'où la double logarithmique : après k étapes, l'espace restant est de l'ordre de $n^{2^{-k}}$.

### Analyse du pire cas O(n)

Le pire cas survient lorsque l'hypothèse de distribution uniforme est violée. Considérons un tableau avec des valeurs exponentiellement espacées : [1, 10, 100, 1000, ...]. La formule d'interpolation pointe systématiquement vers le début du tableau, forçant un parcours quasi-séquentiel.

Ce comportement dégénéré se produit également avec des données présentant des « trous » ou des concentrations locales. Contrairement à la recherche binaire qui **garantit** une réduction de moitié, l'interpolation peut ne réduire l'espace que d'un seul élément par itération.

### Comparaison quantitative avec la recherche binaire

| **Taille n** | **log₂(n)** | **log₂(log₂(n))** | **Gain** |
|--------------|-------------|-------------------|----------|
| 1 024 | 10 | 3,32 | 3× |
| 1 000 000 | 20 | 4,32 | 4,6× |
| 10⁹ | 30 | 4,91 | 6,1× |

Les expériences de Perl et al. sur 400 000 nombres uniformément distribués ont mesuré une moyenne de **4,28 accès** contre les 4,21 prédits par la théorie.

La recherche par interpolation excelle pour les accès coûteux (stockage sur disque, bases de données distantes) où minimiser le nombre de sondes prime sur le coût calculatoire par sonde. Elle est en revanche déconseillée lorsque la distribution est inconnue ou non uniforme.

---

## D. La recherche par hachage atteint le temps constant amorti

### Principes des fonctions de hachage

Le hachage représente une rupture conceptuelle : plutôt que de chercher par comparaisons successives, on calcule directement l'emplacement probable de l'élément. Une **fonction de hachage** h : U → {0, 1, ..., m−1} transforme une clé de l'univers U en un indice dans une table de m emplacements.

Les propriétés souhaitables d'une fonction de hachage sont : le **déterminisme** (même entrée produit toujours même sortie), l'**uniformité** (distribution équilibrée sur tous les emplacements), l'**efficacité** (calcul en temps constant), et l'**effet avalanche** (petite modification de l'entrée produit grande modification de la sortie).

L'**hypothèse de hachage uniforme simple (SUHA)** postule que chaque clé est également et indépendamment susceptible d'être hachée dans n'importe quel emplacement : P(h(k) = j) = 1/m pour tout j.

### Le facteur de charge détermine les performances

Le **facteur de charge** α = n/m, rapport entre le nombre d'éléments n et le nombre d'emplacements m, gouverne les performances de la table de hachage.

Pour le **chaînage séparé**, α peut dépasser 1 (plusieurs éléments par emplacement), avec des performances qui décroissent graduellement. Pour l'**adressage ouvert**, α doit rester strictement inférieur à 1 (un élément maximum par emplacement), avec un seuil critique généralement fixé à **0,7** au-delà duquel les performances se dégradent rapidement.

### Preuve de la complexité O(1) en moyenne

**Théorème :** Sous l'hypothèse SUHA, la recherche dans une table de hachage avec chaînage séparé requiert un temps espéré Θ(1 + α).

**Démonstration :**

*Recherche infructueuse :* L'élément recherché n'est pas dans la table. L'algorithme doit :
1. Calculer h(k) : temps O(1)
2. Parcourir la liste chaînée à l'emplacement h(k)

La longueur espérée de chaque liste est n/m = α (chaque élément a probabilité 1/m d'être dans une liste donnée). Le temps total est donc **Θ(1 + α)**.

*Recherche fructueuse :* L'élément recherché est dans la table. Soit $x_i$ le i-ème élément inséré. Les éléments examinés avant de trouver $x_i$ sont ceux insérés après lui dans la même liste.

$$E[\text{éléments examinés}] = 1 + \sum_{i=1}^{n} \sum_{j=i+1}^{n} \frac{1}{m} \cdot \frac{1}{n} = 1 + \frac{n-1}{2m} = 1 + \frac{\alpha}{2} - \frac{1}{2m}$$

Ce résultat est également **Θ(1 + α)**.

**Corollaire :** Si n = O(m), alors α = O(1), et toutes les opérations s'effectuent en **O(1) en moyenne**.

### Gestion des collisions

Une **collision** survient quand deux clés distinctes produisent le même indice de hachage. Deux stratégies principales existent pour les gérer.

**Le chaînage séparé** associe à chaque emplacement une liste chaînée contenant tous les éléments hachés vers cet index. L'insertion s'effectue en tête de liste en O(1) ; la recherche parcourt la liste en O(1 + α) en moyenne.

```
PROCÉDURE InsertionChainage(T, x)
    insérer x en tête de T[h(x.clé)]
FIN PROCÉDURE

FONCTION RechercheChainage(T, k)
    rechercher l'élément de clé k dans T[h(k)]
FIN FONCTION
```

**L'adressage ouvert** stocke tous les éléments directement dans la table. En cas de collision, l'algorithme sonde d'autres emplacements selon une séquence déterminée :

- **Sondage linéaire** : h(k, i) = (h'(k) + i) mod m — simple mais sujet au *clustering primaire* (accumulation en séquences continues)
- **Sondage quadratique** : h(k, i) = (h'(k) + c₁i + c₂i²) mod m — réduit le clustering primaire
- **Double hachage** : h(k, i) = (h₁(k) + i·h₂(k)) mod m — produit Θ(m²) séquences distinctes

Pour l'adressage ouvert, l'analyse de Knuth établit que le nombre espéré de sondes pour une recherche infructueuse est au plus **1/(1−α)**, et pour une recherche fructueuse **(1/α)·ln(1/(1−α))**.

### Preuve de la complexité amortie O(1)

Le redimensionnement dynamique (doublement de la table quand α dépasse un seuil) garantit des opérations en **O(1) amorti**.

**Théorème :** L'insertion de n éléments avec redimensionnement par doublement prend O(n) temps total, soit O(1) amorti par opération.

**Démonstration par analyse agrégée :**

Insérons n = 2^k éléments. Les redimensionnements se produisent aux puissances de 2. Le coût total des rehachages est :

$$\text{Coût total} = n + \frac{n}{2} + \frac{n}{4} + ... + 1 = n \cdot \sum_{i=0}^{k} \frac{1}{2^i} < 2n$$

Ajoutant les n insertions initiales (coût n), le total est inférieur à **3n**, soit O(1) par opération.

**Démonstration par méthode du potentiel :**

Définissons la fonction potentiel Φ(h) = 2|n − m/2|. L'analyse montre que le coût amorti de chaque opération (coût réel plus variation de potentiel) reste borné par une constante, que l'opération déclenche ou non un redimensionnement.

---

## E. Algorithmes complémentaires pour cas particuliers

### La recherche par sauts équilibre linéaire et binaire

Le **Jump Search** propose un compromis entre recherche séquentielle et dichotomique. L'algorithme saute par blocs de taille √n jusqu'à dépasser la valeur recherchée, puis effectue une recherche linéaire dans le dernier bloc visité.

**Pseudocode :**

```
FONCTION RechercheSaut(T[0..n-1], valeur)
    pas ← ⌊√n⌋
    prev ← 0
    
    // Phase 1: sauts
    TANT QUE T[min(pas, n) - 1] < valeur FAIRE
        prev ← pas
        pas ← pas + ⌊√n⌋
        SI prev ≥ n ALORS RETOURNER -1
    FIN TANT QUE
    
    // Phase 2: recherche linéaire
    TANT QUE T[prev] < valeur FAIRE
        prev ← prev + 1
        SI prev = min(pas, n) ALORS RETOURNER -1
    FIN TANT QUE
    
    SI T[prev] = valeur ALORS RETOURNER prev
    RETOURNER -1
FIN FONCTION
```

**Complexité O(√n) :** Le nombre total de comparaisons est (n/√n) + (√n − 1) = **2√n − 1**. La taille de saut √n minimise cette expression, comme le confirme l'analyse par dérivation de f(m) = n/m + m − 1.

Le Jump Search excelle lorsque les retours en arrière sont coûteux (accès séquentiel sur bande magnétique), où il n'effectue qu'un seul retour contre potentiellement log n pour la recherche binaire.

### La recherche exponentielle cible les éléments proches du début

La **recherche exponentielle**, développée par Bentley et Yao en 1976, combine une phase d'expansion géométrique avec une recherche binaire. Elle est particulièrement adaptée aux **tableaux non bornés** ou quand l'élément recherché est susceptible d'être proche du début.

L'algorithme double successivement l'indice (1, 2, 4, 8, 16...) jusqu'à dépasser la valeur recherchée, puis applique une recherche binaire sur l'intervalle [2^(j−1), 2^j] identifié.

**Complexité O(log i) :** Si l'élément se trouve à l'indice i, la phase d'expansion requiert ⌈log₂(i)⌉ comparaisons, et la phase de recherche binaire également O(log i). Pour un élément à l'indice 10 dans un tableau d'un million d'éléments, cet algorithme effectue environ **7 comparaisons** contre 20 pour une recherche binaire classique.

### La recherche ternaire optimise les fonctions unimodales

La **recherche ternaire** divise l'espace en trois parties à chaque itération, utilisant deux points de comparaison mid₁ = l + (r−l)/3 et mid₂ = r − (r−l)/3.

Pour la recherche dans un tableau trié, cette approche est **moins efficace** que la recherche binaire : bien qu'elle réduise l'espace plus rapidement (facteur 3 vs 2), elle requiert 4 comparaisons par itération contre 2. L'analyse montre que la recherche ternaire effectue environ **26% de comparaisons supplémentaires**.

En revanche, la recherche ternaire trouve son application naturelle dans l'**optimisation de fonctions unimodales** — fonctions strictement croissantes puis décroissantes (ou l'inverse). Elle permet de localiser un maximum ou minimum sans connaître la dérivée, propriété exploitée en programmation compétitive et en optimisation numérique.

---

## Synthèse comparative des algorithmes de recherche

| **Algorithme** | **Meilleur** | **Moyen** | **Pire** | **Prérequis** |
|----------------|--------------|-----------|----------|---------------|
| Séquentielle | O(1) | O(n) | O(n) | Aucun |
| Dichotomique | O(1) | O(log n) | O(log n) | Tableau trié |
| Interpolation | O(1) | O(log log n) | O(n) | Trié + distribution uniforme |
| Hachage | O(1) | O(1) | O(n) | Bonne fonction de hachage |
| Saut | O(1) | O(√n) | O(√n) | Tableau trié |
| Exponentielle | O(1) | O(log i) | O(log n) | Tableau trié |

Le choix de l'algorithme approprié dépend des caractéristiques des données (triées ou non, distribution statistique), des contraintes opérationnelles (mémoire disponible, fréquence des recherches vs insertions), et des coûts relatifs (accès mémoire vs calcul). La recherche dichotomique constitue généralement le choix par défaut pour les données triées, tandis que le hachage offre les meilleures performances moyennes au prix d'une complexité d'implémentation accrue et d'un espace mémoire supplémentaire.

---

## Conclusion

Ce chapitre a établi les fondements mathématiques des principaux algorithmes de recherche, depuis la complexité linéaire O(n) de la méthode séquentielle jusqu'au temps constant amorti O(1) du hachage. Les preuves rigoureuses présentées — par récurrence, par le théorème maître, par analyse probabiliste et par méthode du potentiel — illustrent la diversité des techniques d'analyse algorithmique.

Trois enseignements fondamentaux émergent de cette analyse. Premièrement, la **structure des données** conditionne fortement les performances : le tri préalable transforme une complexité linéaire en logarithmique. Deuxièmement, les **hypothèses statistiques** jouent un rôle crucial : la recherche par interpolation n'atteint O(log log n) que sous distribution uniforme, tandis que le hachage suppose une fonction de hachage de qualité. Troisièmement, l'**analyse amortie** révèle que le coût instantané d'une opération peut être trompeur : le redimensionnement occasionnel d'une table de hachage, bien que coûteux, se répartit sur l'ensemble des opérations pour maintenir un coût moyen constant.

Ces algorithmes de recherche constituent les briques élémentaires sur lesquelles reposent les structures de données avancées — arbres binaires de recherche, arbres B, tables de hachage distribuées — qui seront examinées dans les chapitres suivants.