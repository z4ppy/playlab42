# Algorithmes de graphes : fondements théoriques et applications

Les algorithmes de graphes constituent le socle de l'informatique moderne, de la navigation GPS aux réseaux sociaux. Ce chapitre présente les algorithmes fondamentaux avec une approche pédagogique : l'intuition d'abord, suivie des preuves mathématiques formelles. **Dijkstra** (1959), **Bellman-Ford** (1958), **Floyd-Warshall** (1962) et **A*** (1968) résolvent le problème des plus courts chemins avec des compromis différents en complexité et contraintes sur les poids. Les algorithmes de **Prim** et **Kruskal** construisent des arbres couvrants minimaux grâce à la propriété de la coupe, tandis que **BFS** et **DFS** offrent les briques élémentaires pour tout parcours de graphe en temps **O(V+E)**.

---

## Définitions formelles et représentations des graphes

Un **graphe** G = (V, E) est défini par un ensemble fini de sommets V (avec |V| = n) et un ensemble d'arêtes E (avec |E| = m). Dans un **graphe non-orienté**, les arêtes sont des paires non ordonnées {u, v}, tandis qu'un **graphe orienté** (digraphe) utilise des paires ordonnées (u, v) où l'arc va de u vers v. Un **graphe pondéré** associe une fonction de poids w : E → ℝ à chaque arête.

La représentation en mémoire influence directement les performances algorithmiques. La **matrice d'adjacence** A[i][j] permet une vérification d'arête en O(1) mais consomme O(V²) d'espace, idéale pour les graphes denses. La **liste d'adjacence** Adj[v] contenant les voisins de chaque sommet v utilise O(V + E) d'espace et permet un parcours des voisins en O(deg(v)), rendant les parcours BFS et DFS optimaux. Pour les algorithmes présentés dans ce chapitre, la liste d'adjacence est généralement préférable sauf pour Floyd-Warshall qui opère naturellement sur une matrice.

---

## Parcours en largeur : BFS explore niveau par niveau

### L'intuition des ondulations concentriques

Le parcours en largeur (Breadth-First Search) explore un graphe comme des ondulations circulaires se propageant quand on jette une pierre dans l'eau. À partir d'un sommet source s, l'algorithme visite d'abord tous les voisins directs (distance 1), puis tous les sommets à distance 2, et ainsi de suite. Cette exploration utilise une **file FIFO** (queue) garantissant que les sommets sont traités dans l'ordre de leur découverte.

```
BFS(G, s):
    pour chaque v ∈ V - {s}: dist[v] ← ∞, parent[v] ← NIL
    dist[s] ← 0, parent[s] ← NIL
    Q ← File vide
    ENFILER(Q, s)
    
    tant que Q ≠ ∅:
        u ← DÉFILER(Q)
        pour chaque v ∈ Adj[u]:
            si dist[v] = ∞:
                dist[v] ← dist[u] + 1
                parent[v] ← u
                ENFILER(Q, v)
```

### Preuve de correction pour les plus courts chemins

**Théorème** : Pour tout sommet v atteignable depuis s, dist[v] est la longueur du plus court chemin de s à v dans un graphe non pondéré.

**Preuve par contradiction** : Soit v le premier sommet pour lequel dist[v] > δ(s,v), où δ(s,v) désigne la vraie distance minimale. Considérons le plus court chemin P de s à v, et soit u le prédécesseur de v sur ce chemin. Puisque v est le premier sommet problématique, dist[u] = δ(s,u). Quand u est défilé, la boucle examine l'arête (u,v). Si v n'a pas encore été visité, dist[v] reçoit dist[u] + 1 = δ(s,u) + 1 = δ(s,v), contradiction. Si v a déjà été visité, alors dist[v] ≤ dist[u] + 1, car v aurait été découvert au plus tard en même temps que via u. Dans tous les cas, dist[v] = δ(s,v). ∎

### Complexité O(V+E) démontrée rigoureusement

L'initialisation prend O(V). Chaque sommet est enfilé **exactement une fois** (garde par dist[v] = ∞) puis défilé exactement une fois, totalisant O(V) opérations sur la file. Pour chaque sommet u défilé, on examine sa liste d'adjacence Adj[u]. La somme des degrés ∑deg(u) = 2|E| pour un graphe non-orienté, donc toutes les arêtes sont examinées en O(E). **Complexité totale : Θ(V + E)**.

---

## Parcours en profondeur : DFS et ses applications fondamentales

### L'exploration méthodique d'un labyrinthe

Le parcours en profondeur (Depth-First Search) suit un chemin aussi loin que possible avant de revenir en arrière (backtracking). L'analogie classique est l'exploration d'un labyrinthe en suivant toujours le mur de droite jusqu'à une impasse. DFS utilise une **pile** implicitement via la récursion, ou explicitement dans la version itérative.

```
DFS(G):
    pour chaque u ∈ V: couleur[u] ← BLANC, parent[u] ← NIL
    temps ← 0
    pour chaque u ∈ V:
        si couleur[u] = BLANC: DFS-VISITE(G, u)

DFS-VISITE(G, u):
    temps ← temps + 1
    debut[u] ← temps
    couleur[u] ← GRIS
    pour chaque v ∈ Adj[u]:
        si couleur[v] = BLANC:
            parent[v] ← u
            DFS-VISITE(G, v)
    couleur[u] ← NOIR
    temps ← temps + 1
    fin[u] ← temps
```

Les timestamps debut[v] et fin[v] permettent de classifier les arêtes. Une **arête arrière** (back edge) relie un sommet à un ancêtre gris dans l'arbre DFS. Une **arête avant** (forward edge) relie un sommet à un descendant noir. Une **arête transverse** (cross edge) relie des sommets sans relation ancêtre-descendant. Dans un graphe non-orienté, seules les arêtes d'arbre et arrière existent.

### Détection de cycles : preuve par les arêtes arrière

**Théorème** : Un graphe orienté contient un cycle si et seulement si DFS produit une arête arrière.

**Preuve (⟹)** : Si (u,v) est une arête arrière, alors v est un ancêtre de u dans l'arbre DFS, donc il existe un chemin v → ... → u. L'arête u → v complète le cycle.

**Preuve (⟸)** : Soit C un cycle, et v le premier sommet de C découvert par DFS. Soit u le prédécesseur de v dans C. Au moment où v devient gris, tous les autres sommets de C sont blancs. Par le théorème du chemin blanc, u devient descendant de v. Quand l'arête (u,v) est examinée, v est encore gris (son traitement englobe celui de u), donc (u,v) est une arête arrière. ∎

### Tri topologique via les timestamps de fin

Un **tri topologique** d'un DAG (graphe orienté acyclique) ordonne les sommets linéairement tel que pour toute arête (u,v), u précède v. L'algorithme consiste à exécuter DFS et trier les sommets par fin[v] décroissant.

**Théorème** : Pour toute arête (u,v) dans un DAG, fin[u] > fin[v].

**Preuve par cas** : Si debut[u] < debut[v], alors v est découvert pendant l'exploration de u (v est blanc). Par le théorème du chemin blanc, v devient descendant de u, donc fin[v] < fin[u]. Si debut[u] > debut[v], puisque G est acyclique et (u,v) ∈ E, il n'existe pas de chemin v → u. Donc u ne peut être descendant de v, ce qui implique que v finit avant que u soit découvert : fin[v] < debut[u] < fin[u]. ∎

La complexité du tri topologique est **O(V + E)**, dominée par le DFS.

---

## L'algorithme de Dijkstra trouve le plus court chemin avec une approche gloutonne

### Contexte historique et intuition

En 1956, Edsger W. Dijkstra conçut son célèbre algorithme en environ vingt minutes lors d'une pause-café à Amsterdam avec sa fiancée, sans papier ni crayon. Publié en 1959 dans "A Note on Two Problems in Connexion with Graphs", cet algorithme est devenu fondamental en informatique avec plus de **3000 citations**.

L'intuition est celle d'une **vague expansive** depuis le sommet source. À chaque étape, on sélectionne le sommet non finalisé ayant la plus petite distance estimée, on le finalise (sa distance ne peut plus s'améliorer), puis on **relaxe** les arêtes sortantes pour potentiellement améliorer les distances de ses voisins.

```
DIJKSTRA(G, w, s):
    pour chaque v ∈ V: d[v] ← ∞, π[v] ← NIL
    d[s] ← 0
    Q ← FILE-PRIORITÉ-MIN(V)    // indexée par d[v]
    S ← ∅
    
    tant que Q ≠ ∅:
        u ← EXTRAIRE-MIN(Q)
        S ← S ∪ {u}
        pour chaque (u,v) ∈ E:
            si d[v] > d[u] + w(u,v):         // Relaxation
                d[v] ← d[u] + w(u,v)
                π[v] ← u
                DIMINUER-CLÉ(Q, v, d[v])
```

### Preuve de correction par invariant de boucle

**Invariant** : Quand un sommet u est extrait de Q et ajouté à S, d[u] = δ(s,u), la distance optimale.

**Preuve par contradiction** : Supposons que u soit le premier sommet ajouté à S avec d[u] ≠ δ(s,u). Puisque d[s] = 0 = δ(s,s), on a u ≠ s. Il existe un chemin de s à u (sinon d[u] = ∞ = δ(s,u)). Considérons le plus court chemin P de s à u. Soit y le premier sommet de P hors de S au moment où u est extrait, et x son prédécesseur sur P (donc x ∈ S).

Puisque x ∈ S et u est le premier sommet problématique : d[x] = δ(s,x). Quand x a été ajouté à S, l'arête (x,y) a été relaxée :
$$d[y] ≤ d[x] + w(x,y) = δ(s,x) + w(x,y) = δ(s,y)$$

Puisque y est sur le plus court chemin vers u : δ(s,y) ≤ δ(s,u). Puisque tous les poids sont non-négatifs : δ(s,u) ≤ d[u]. Puisque u a été extrait avant y : d[u] ≤ d[y].

En combinant : d[u] ≤ d[y] ≤ δ(s,y) ≤ δ(s,u) ≤ d[u], donc d[u] = δ(s,u). **Contradiction**. ∎

### Pourquoi Dijkstra échoue avec des poids négatifs

L'invariant repose sur le fait qu'une fois un sommet finalisé, aucun chemin alternatif ne peut l'améliorer. Avec des poids négatifs, un détour par un sommet non encore traité pourrait réduire la distance.

**Contre-exemple** : Graphe A →(5) B, A →(6) C, C →(-3) B. Dijkstra traite A (d=0), puis B (d=5), puis C (d=6). Or le chemin A→C→B a pour coût 6+(-3)=3 < 5. Le sommet B est finalisé avec une distance incorrecte.

### Analyse de complexité selon la structure de données

| Implémentation | EXTRAIRE-MIN | DIMINUER-CLÉ | Complexité totale |
|----------------|--------------|--------------|-------------------|
| Tableau simple | O(V) | O(1) | **O(V²)** |
| Tas binaire | O(log V) | O(log V) | **O((V+E) log V)** |
| Tas de Fibonacci | O(log V) amorti | O(1) amorti | **O(E + V log V)** |

Avec un tas binaire, les V extractions coûtent O(V log V) et les E relaxations potentielles coûtent O(E log V). Le tas de Fibonacci, introduit par Fredman et Tarjan en 1984, réduit DIMINUER-CLÉ à O(1) amorti, atteignant la complexité **optimale O(E + V log V)** pour les graphes à poids non-négatifs arbitraires.

---

## Bellman-Ford gère les poids négatifs par relaxation itérative

### Principe de la programmation dynamique

L'algorithme de Bellman-Ford (1958) relaxe **toutes les arêtes** pendant V-1 itérations. L'intuition : après k itérations, l'algorithme a trouvé tous les plus courts chemins utilisant au plus k arêtes. Puisqu'un chemin simple dans un graphe à V sommets contient au plus V-1 arêtes, V-1 itérations suffisent.

```
BELLMAN-FORD(G, w, s):
    pour chaque v ∈ V: d[v] ← ∞, π[v] ← NIL
    d[s] ← 0
    
    pour i de 1 à |V| - 1:
        pour chaque arête (u,v) ∈ E:
            si d[v] > d[u] + w(u,v):
                d[v] ← d[u] + w(u,v)
                π[v] ← u
    
    pour chaque arête (u,v) ∈ E:
        si d[v] > d[u] + w(u,v):
            retourner "CYCLE NÉGATIF DÉTECTÉ"
    
    retourner (d, π)
```

### Preuve de correction par induction

**Théorème** : Si G ne contient pas de cycle de poids négatif, alors après V-1 itérations, d[v] = δ(s,v) pour tout v.

**Preuve par induction sur k** : Définissons d_k[v] comme la longueur minimale d'un chemin de s à v utilisant au plus k arêtes.

**Base (k=0)** : d_0[s] = 0, d_0[v] = ∞ pour v ≠ s. ✓

**Hérédité** : Supposons qu'après k-1 itérations, d[u] ≤ d_{k-1}[u] pour tout u. Considérons le plus court chemin P de s à v utilisant au plus k arêtes, et soit u le prédécesseur de v. Le sous-chemin de s à u utilise au plus k-1 arêtes. À l'itération k, quand (u,v) est relaxée :
$$d[v] ← \min(d[v], d[u] + w(u,v)) ≤ d_{k-1}[u] + w(u,v) = d_k[v]$$

Puisque tout chemin simple a au plus V-1 arêtes : d[v] ≤ d_{V-1}[v] = δ(s,v). Combiné avec la borne inférieure d[v] ≥ δ(s,v), on obtient **d[v] = δ(s,v)**. ∎

### Détection des cycles négatifs

**Théorème** : Si un cycle de poids négatif est atteignable depuis s, alors après V-1 itérations, il existe une arête (u,v) telle que d[v] > d[u] + w(u,v).

**Preuve par contradiction** : Soit v_0 → v_1 → ... → v_k = v_0 un cycle négatif, donc ∑w(v_{i-1}, v_i) < 0. Supposons qu'aucune arête ne soit "tendue". Alors pour tout i : d[v_i] ≤ d[v_{i-1}] + w(v_{i-1}, v_i).

En sommant sur le cycle : ∑d[v_i] ≤ ∑d[v_{i-1}] + ∑w(v_{i-1}, v_i). Puisque v_0 = v_k, les deux premières sommes sont égales, donc 0 ≤ ∑w(v_{i-1}, v_i). **Contradiction** avec le poids négatif du cycle. ∎

La complexité est **O(V × E)** : V-1 itérations parcourant chacune E arêtes, plus une passe finale de vérification en O(E).

---

## Floyd-Warshall résout tous les couples par programmation dynamique

### La récurrence fondamentale

L'algorithme de Floyd-Warshall (1962) calcule les plus courts chemins entre **toutes les paires** de sommets. L'idée clé est de construire progressivement les solutions en autorisant de plus en plus de sommets intermédiaires.

Définissons d[i][j][k] comme la longueur du plus court chemin de i à j n'utilisant que les sommets {1, 2, ..., k} comme intermédiaires.

**Cas de base** : d[i][j][0] = w(i,j) si l'arête existe, ∞ sinon, et d[i][i][0] = 0.

**Récurrence** :
$$d[i][j][k] = \min(d[i][j][k-1], d[i][k][k-1] + d[k][j][k-1])$$

Soit le plus court chemin n'utilise pas le sommet k (premier terme), soit il le traverse (second terme : aller de i à k puis de k à j).

```
FLOYD-WARSHALL(W):
    soit dist une matrice |V| × |V| initialisée avec W
    pour v de 1 à |V|: dist[v][v] ← 0
    
    pour k de 1 à |V|:
        pour i de 1 à |V|:
            pour j de 1 à |V|:
                dist[i][j] ← min(dist[i][j], dist[i][k] + dist[k][j])
    
    retourner dist
```

**Remarque critique** : L'ordre des boucles doit être **k-i-j** (k en boucle externe). Les autres ordres ne donnent pas de résultats corrects.

### Preuve de correction par sous-structure optimale

**Théorème** : Après la phase k, dist[i][j] contient la longueur du plus court chemin de i à j n'utilisant que {1,...,k} comme intermédiaires.

**Preuve par induction** : Le cas de base (k=0) correspond aux arêtes directes. Pour le pas inductif, supposons la propriété vraie pour k-1. Le plus court chemin de i à j utilisant {1,...,k} soit n'utilise pas k (donc égal à dist[i][j][k-1] par hypothèse), soit utilise k exactement une fois (pas de cycles négatifs). Dans ce cas, il se décompose en i → k → j où les deux sous-chemins n'utilisent que {1,...,k-1}, donc leur somme est dist[i][k][k-1] + dist[k][j][k-1]. La formule de récurrence prend le minimum des deux cas. ∎

La complexité est **O(V³)** en temps et **O(V²)** en espace (une seule matrice suffit car les mises à jour ne dégradent jamais les chemins existants). La détection de cycles négatifs s'effectue en vérifiant si dist[v][v] < 0 pour un sommet v.

---

## A* accélère la recherche grâce aux heuristiques

### Genèse au Stanford Research Institute

A* fut créé en 1968 par Peter Hart, Nils Nilsson et Bertram Raphael dans le cadre du projet Shakey, premier robot mobile capable de planification autonome. L'article fondateur "A Formal Basis for the Heuristic Determination of Minimum Cost Paths" a accumulé près de **7000 citations**. Le nom "A*" (avec l'astérisque de la notation de Kleene) indique l'optimalité de l'algorithme.

### La fonction d'évaluation f(n) = g(n) + h(n)

A* est une recherche best-first qui sélectionne les nœuds minimisant f(n) = g(n) + h(n), où **g(n)** est le coût réel depuis la source et **h(n)** est l'estimation heuristique vers la destination. Contrairement à Dijkstra (h ≡ 0) qui explore uniformément, A* focalise la recherche vers l'objectif.

Une heuristique h est **admissible** si elle ne surestime jamais : h(n) ≤ h*(n) où h*(n) est le vrai coût optimal. Elle est **consistante** (ou monotone) si pour tout nœud n et successeur n' : h(n) ≤ c(n, n') + h(n'). Toute heuristique consistante est admissible (preuve par induction depuis l'objectif).

### Preuve d'optimalité avec heuristique admissible

**Théorème** : Si h est admissible, A* retourne un chemin optimal.

**Preuve par contradiction** : Supposons qu'A* termine avec un but G₂ sous-optimal, donc f(G₂) = g(G₂) > C* (coût optimal, car h(G₂) = 0 pour un but). Soit n un nœud non encore exploré sur un chemin optimal vers le but G.

Pour ce nœud n sur le chemin optimal :
$$f(n) = g(n) + h(n) ≤ g(n) + h^*(n) = g^*(n) + h^*(n) = C^*$$

Puisque h est admissible, h(n) ≤ h*(n). Donc f(n) ≤ C* < f(G₂). Or A* sélectionne toujours le nœud de plus petit f, donc n aurait été sélectionné avant G₂. **Contradiction**. ∎

### La consistance garantit l'expansion unique

**Théorème** : Si h est consistante, les valeurs f le long de tout chemin sont non-décroissantes.

**Preuve** : Pour un nœud n et son successeur n' :
$$f(n') = g(n') + h(n') = g(n) + c(n,n') + h(n') ≥ g(n) + h(n) = f(n)$$

La dernière inégalité utilise la consistance : h(n) ≤ c(n,n') + h(n').

**Corollaire** : Avec une heuristique consistante, quand A* expande un nœud, le chemin optimal vers ce nœud a déjà été trouvé. Aucun nœud n'est ré-expansé.

### Heuristiques classiques et applications

La **distance de Manhattan** h(n) = |n_x - but_x| + |n_y - but_y| est admissible pour les grilles à 4 directions. La **distance euclidienne** est admissible pour tout mouvement (distance minimale physiquement possible). La **distance de Chebyshev** max(|Δx|, |Δy|) convient aux mouvements à 8 directions.

A* est omniprésent en **jeux vidéo** (pathfinding des unités dans StarCraft, Age of Empires), en **robotique** (planification de trajectoire), et en **résolution de puzzles** (8-puzzle, 15-puzzle). Les systèmes GPS modernes combinent A* avec des techniques de prétraitement comme les **Contraction Hierarchies** pour atteindre des temps de réponse de quelques millisecondes sur des graphes de millions de nœuds.

---

## Les arbres couvrants minimaux et la propriété de la coupe

### Définitions et conditions d'unicité

Un **arbre couvrant** d'un graphe connexe G = (V, E) est un sous-graphe T ⊆ E qui est connexe, acyclique et contient tous les sommets. Tout arbre couvrant a exactement **V-1 arêtes**. L'**arbre couvrant minimal** (MST) minimise la somme des poids des arêtes.

**Théorème d'unicité** : Si tous les poids sont distincts, le MST est unique.

**Preuve** : Supposons deux MST distincts A et B. Soit e₁ l'arête de poids minimal appartenant à exactement un des deux (disons A). Ajouter e₁ à B crée un cycle C contenant e₁. Ce cycle doit contenir une arête e₂ ∈ B \ A (sinon A contiendrait un cycle). Par choix de e₁ comme minimum, w(e₂) > w(e₁). Remplacer e₂ par e₁ dans B donne un arbre de poids inférieur. **Contradiction**. ∎

### Le lemme de la coupe justifie l'approche gloutonne

**Propriété de la coupe** : Pour toute coupe (S, V-S) de G, si e est l'arête de poids minimal traversant la coupe, alors e appartient à un MST.

**Preuve par contradiction** : Soit T* un MST ne contenant pas e = (u,v) avec u ∈ S et v ∈ V-S. Ajouter e à T* crée un cycle C. Ce cycle doit traverser la coupe ailleurs (chemin de u à v dans T* passe de S à V-S). Soit e' = (x,y) cette autre arête traversante.

Par hypothèse, w(e) < w(e'). Construisons T' = T* ∪ {e} \ {e'}. T' est connexe (tout chemin utilisant e' peut emprunter e), a V-1 arêtes, et est acyclique (supprimer e' brise l'unique cycle). Donc T' est un arbre couvrant de poids w(T') = w(T*) - w(e') + w(e) < w(T*). **Contradiction** avec T* minimal. ∎

Cette propriété garantit que choisir l'arête minimale traversant **n'importe quelle coupe** est sûr.

---

## Prim fait croître l'arbre depuis un sommet racine

### L'algorithme glouton vertex-centric

L'algorithme de Prim (redécouvert indépendamment par Jarník en 1930, Prim en 1957 et Dijkstra en 1959) maintient un arbre T et ajoute itérativement l'arête de poids minimal reliant T au reste du graphe.

```
PRIM(G, w, r):
    pour chaque v ∈ V: clé[v] ← ∞, parent[v] ← NIL, dansMST[v] ← FAUX
    clé[r] ← 0
    Q ← TAS-MIN(V)    // indexé par clé[v]
    
    tant que Q ≠ ∅:
        u ← EXTRAIRE-MIN(Q)
        dansMST[u] ← VRAI
        pour chaque v ∈ Adj[u]:
            si dansMST[v] = FAUX et w(u,v) < clé[v]:
                parent[v] ← u
                clé[v] ← w(u,v)
                DIMINUER-CLÉ(Q, v, clé[v])
    
    retourner {(parent[v], v) : v ∈ V - {r}}
```

### Preuve de correction via la propriété de la coupe

**Invariant** : À chaque itération, l'arbre partiel F est contenu dans un MST.

**Base** : F = ∅ est trivialement contenu dans tout MST.

**Hérédité** : Soit S l'ensemble des sommets déjà dans F. L'arête f choisie par Prim est la minimale traversant (S, V-S). Par la propriété de la coupe, f appartient à un MST. Si f ∈ T* (le MST contenant F), l'invariant reste vrai. Sinon, construisons T' = T* ∪ {f} \ {e'} où e' est l'autre arête traversant la coupe dans le cycle créé. Par minimalité de f : w(f) ≤ w(e'), donc T' est aussi un MST contenant F ∪ {f}. ∎

La complexité est **O(E log V)** avec un tas binaire, ou **O(E + V log V)** avec un tas de Fibonacci.

---

## Kruskal trie les arêtes et utilise Union-Find

### L'approche edge-centric avec détection de cycles

L'algorithme de Kruskal (1956) trie toutes les arêtes par poids croissant et les ajoute une par une si elles ne créent pas de cycle (c'est-à-dire si elles relient deux composantes distinctes).

```
KRUSKAL(G, w):
    A ← ∅
    pour chaque v ∈ V: CRÉER-ENSEMBLE(v)
    trier E par w croissant
    
    pour chaque (u, v) ∈ E (ordre trié):
        si TROUVER(u) ≠ TROUVER(v):
            A ← A ∪ {(u, v)}
            UNION(u, v)
            si |A| = |V| - 1: break
    
    retourner A
```

### Structure Union-Find avec optimisations

La structure **Union-Find** (ou Disjoint Set Union) supporte trois opérations : CRÉER-ENSEMBLE, TROUVER (retourne le représentant d'un ensemble), et UNION (fusionne deux ensembles).

**Union par rang** : Attacher l'arbre le moins profond sous la racine du plus profond.

**Compression de chemin** : Dans TROUVER, faire pointer directement chaque nœud traversé vers la racine.

```
TROUVER(x):
    si parent[x] ≠ x:
        parent[x] ← TROUVER(parent[x])    // Compression
    retourner parent[x]

UNION(x, y):
    rx ← TROUVER(x), ry ← TROUVER(y)
    si rx ≠ ry:
        si rang[rx] < rang[ry]: parent[rx] ← ry
        sinon si rang[rx] > rang[ry]: parent[ry] ← rx
        sinon: parent[ry] ← rx, rang[rx] ← rang[rx] + 1
```

**Théorème (Tarjan, 1975)** : Toute séquence de m opérations Union-Find sur n éléments avec union par rang et compression de chemin s'exécute en **O(m·α(n))**, où α est la fonction inverse d'Ackermann.

La fonction d'Ackermann croît extraordinairement vite : A(4) dépasse une tour de 2 de hauteur astronomique. Son inverse α(n) ≤ 4 pour tout n < 10^600, donc **α(n) est essentiellement constant** en pratique.

### Complexité de Kruskal

Le tri des arêtes domine : **O(E log E) = O(E log V)** (car E ≤ V², donc log E ≤ 2 log V). Les opérations Union-Find totalisent O(E·α(V)) ≈ O(E). Si les arêtes sont pré-triées, la complexité tombe à O(E·α(V)).

---

## Applications réelles des algorithmes de graphes

### Navigation et systèmes GPS

Google Maps et Waze utilisent des versions sophistiquées de Dijkstra et A* avec d'importants prétraitements. Les **Contraction Hierarchies** réduisent les temps de requête de plusieurs ordres de grandeur en contractant les nœuds peu importants lors d'une phase de prétraitement. Sur un réseau routier de **3.5 millions de nœuds**, une requête s'exécute en **18 millisecondes** au lieu de plusieurs secondes avec Dijkstra pur.

### Réseaux sociaux et degrés de séparation

LinkedIn calcule les connexions de 1er, 2e et 3e degré via **BFS bidirectionnel**. Facebook utilise des approximations basées sur des arbres couvrants (algorithme Atlas) pour gérer des graphes de **centaines de millions** de nœuds.

### Pathfinding dans les jeux vidéo

StarCraft (1998) utilisait A* sur des grilles de tuiles avec découpage en régions. Age of Empires II combine trois algorithmes : mip-mapping pour la longue distance, A* pour la moyenne distance, et génération de polygones convexes pour les combats. StarCraft II emploie des **champs de flux** (flow fields) pour coordonner les mouvements de groupes.

### Infrastructure réseau

Le protocole **OSPF** (Open Shortest Path First) utilise Dijkstra pour calculer les routes optimales dans les réseaux d'entreprise. Chaque routeur maintient une base de données topologique complète et calcule un arbre des plus courts chemins avec lui-même comme racine. Le protocole **RIP** (Routing Information Protocol) implémente une version distribuée de Bellman-Ford.

### Gestionnaires de dépendances logicielles

Maven utilise **DFS** pour résoudre les dépendances avec la règle "nearest definition wins". npm (version 7+) emploie l'**Arborist** qui construit un graphe logique sur un arbre physique avec déduplication maximale. pip utilise désormais **PubGrub**, un solveur SAT avec backtracking et apprentissage de clauses.

Les MST trouvent des applications en conception de réseaux de télécommunications (câblage optimal), clustering (découpage hiérarchique), et comme base pour des algorithmes d'approximation du voyageur de commerce (garantie 2-approximation).

---

## Tableau récapitulatif des complexités

| Algorithme | Temps | Espace | Contraintes |
|------------|-------|--------|-------------|
| BFS | O(V+E) | O(V) | Non pondéré |
| DFS | O(V+E) | O(V) | — |
| Dijkstra (tas binaire) | O((V+E) log V) | O(V) | Poids ≥ 0 |
| Dijkstra (Fibonacci) | O(E + V log V) | O(V) | Poids ≥ 0 |
| Bellman-Ford | O(V·E) | O(V) | Poids quelconques |
| Floyd-Warshall | O(V³) | O(V²) | All-pairs |
| A* | O(b^d) pire cas | O(b^d) | Heuristique |
| Prim (tas binaire) | O(E log V) | O(V) | Non-orienté |
| Kruskal | O(E log V) | O(V) | Non-orienté |

---

## Conclusion : choisir l'algorithme adapté

La sélection d'un algorithme de graphe dépend de trois critères principaux. Premièrement, la **nature des poids** : les poids négatifs excluent Dijkstra au profit de Bellman-Ford. Deuxièmement, le **type de requête** : source unique (Dijkstra/Bellman-Ford) versus tous les couples (Floyd-Warshall/Johnson). Troisièmement, la **densité du graphe** : les graphes creux favorisent les structures par listes d'adjacence et les algorithmes en O(E log V), tandis que les graphes denses tolèrent mieux Floyd-Warshall en O(V³).

Les preuves présentées révèlent des structures mathématiques élégantes. L'invariant de boucle de Dijkstra repose sur l'absence de poids négatifs pour garantir que les distances finalisées sont optimales. La propriété de la coupe unifie Prim et Kruskal en justifiant leurs choix gloutons. L'admissibilité de l'heuristique dans A* garantit l'optimalité tout en permettant une exploration drastiquement réduite. Ces fondements théoriques, établis entre 1956 et 1968, restent au cœur des systèmes informatiques modernes, des protocoles de routage Internet aux moteurs de navigation et aux intelligences artificielles de jeux vidéo.