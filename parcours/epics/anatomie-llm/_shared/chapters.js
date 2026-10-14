/** Source éditoriale. Le script generate-llm-anatomy.js produit le HTML statique. */
export const chapters = [
  {
    id: '01-un-token', section: 'Du texte aux représentations', title: 'Une réponse.\nUn token à la fois.',
    short: 'Suivez ce token', label: 'Le commencement', experiment: 'generation',
    lead: 'Un LLM est un grand modèle de langage. Le modèle autorégressif étudié ici complète un texte un token à la fois : une unité, parfois un mot ou un morceau de mot.',
    body: `<p>Le <strong>prompt</strong> est le texte de départ. Le <strong>contexte</strong> est tout le texte disponible pour continuer : le prompt, puis les tokens déjà ajoutés. Un modèle de langage calcule une probabilité pour chaque token possible du vocabulaire. La stratégie de <strong>décodage</strong> en choisit un, l’ajoute au contexte, puis recommence jusqu’à un signal de fin ou une limite.</p>
<p><strong>Exemple :</strong> après « le chat », un token possible est « dort ». Une fois choisi, le contexte devient « le chat dort » ; le calcul suivant propose la suite de ce nouveau texte. Le modèle ne produit donc pas une phrase complète en une seule décision.</p>
<p><strong>Notre instrument : Luciole.</strong> C’est un mini-Transformer entraîné pour ce cours sur un petit ensemble de phrases, appelé corpus. Ses calculs sont réels, ses capacités limitées. Les <strong>poids</strong> sont les nombres ajustés pendant son entraînement : ils restent fixes lorsque vous générez du texte. La prochaine étape présente ce modèle et ses limites mesurées.</p>
<p><strong>Deux gestes que nous allons découvrir :</strong> l’<dfn>attention</dfn> fait circuler l’information entre les tokens ; le <dfn>MLP</dfn> (<em>Multi-Layer Perceptron</em>, un petit réseau de neurones) transforme ensuite les nombres de chaque position. Il reçoit ainsi une information déjà enrichie par le contexte. Pour commencer, retenez simplement : mélanger, puis transformer.</p>
<p><strong>Pour prendre vos repères :</strong> un vecteur est une liste de nombres ; une matrice, un tableau de nombres ; une probabilité, une valeur entre 0 et 1. Des étapes intermédiaires introduisent ces notions avant de les combiner. Le parcours <a href="../../../../../index.html#/parcours/deep-learning-intro" target="_top">Deep Learning pour l’impatient</a> offre aussi une première exploration. Comptez environ 110 minutes ici, à votre rythme.</p>`,
    formula: 'contexte → probabilités → choix → nouveau contexte ↻',
    instruction: 'Cliquez sur « + Un token » pour compléter le texte affiché. Recommencez, puis essayez « le chat ». Les onglets sous le texte sont une exploration facultative.',
    takeaway: 'À chaque tour, le modèle calcule des scores à partir du contexte ; le décodage choisit le token à ajouter.',
    caveat: 'Un texte plausible n’est pas nécessairement vrai. La probabilité linguistique n’est pas une mesure de vérité.',
    question: 'Que reçoit le modèle après avoir généré un token ?',
    choices: ['Uniquement ce nouveau token, sans aucun passé', 'Le contexte enrichi du token choisi', 'De nouveaux poids entraînés sur sa réponse'],
    answer: 1, explanation: 'Le contexte grandit. Un cache peut éviter de recalculer certaines représentations, mais les poids ne changent pas pendant cette inférence.',
    refs: ['transformer'], notes: 'Accroche : une réponse, plusieurs décisions. Manipulation : trois tokens. Transition : que représente exactement un token ?',
  },
  {
    id: '01b-luciole', section: 'Du texte aux représentations', title: 'Luciole : petit modèle,\nvrais calculs.',
    short: 'La fiche de Luciole', label: 'Notre instrument, ses limites', experiment: 'modelCard',
    lead: 'Luciole est le petit modèle du cours. Il a appris sur 1 512 phrases ; ses calculs restent assez petits pour être inspectés.',
    body: `<p>Luciole est un petit Transformer créé pour ce parcours. Il a appris à continuer des phrases à partir d’exemples. Il possède <strong>38 720 paramètres</strong> : autant de nombres ajustés pendant l’entraînement, plutôt qu’une liste de réponses écrites à la main. Il accepte au plus 32 tokens à la fois, marqueur de début compris.</p>
<p>Son <strong>corpus</strong>, l’ensemble des phrases utilisées pour apprendre, associe des phrases écrites pour le cours et 40 phrases naturelles françaises, anglaises et espagnoles de Tatoeba, sous licence CC0. Les identifiants et les sources sont publiés. Ces quelques phrases ne suffisent pas à faire de Luciole un assistant multilingue.</p>
<p><strong>Lire l’historique :</strong> la perte mesure l’erreur de prédiction ; plus elle est basse sur un même lot, mieux le modèle en prédit les tokens. Le curseur relit des mesures enregistrées. Il ne lance pas d’entraînement et ne change pas les poids utilisés dans les autres expériences.</p>
<p>Deux lots de 264 phrases synthétiques sont réservés : validation pendant le suivi, test après l’entraînement. Ils partagent les mots et les patrons, mais pas certaines combinaisons. On mesure un accord simple et la restitution d’un objet dans deux boîtes, y compris les erreurs. La présence de trois langues dans le corpus n’est pas une preuve de compétence multilingue.</p>
<p>Luciole n’a ni apprentissage conversationnel, ni recherche Web, ni entraînement à suivre des consignes. Son tokenizer lexical est expliqué ci-dessous ; les mots hors vocabulaire sont refusés. Les autres tokeniseurs étudiés ensuite restent indépendants de ses poids.</p>
<p><strong>Où lire son code ?</strong> Dans <a href="../17-sources/code.html#model" target="_blank" rel="noopener noreferrer">la lecture du code intégrée à Playlab42 ↗</a>. Commencez par <code>model.js</code> : <code>tokenize</code> transforme le texte en IDs, <code>loadWeights</code> charge les nombres appris, <code>forward</code> calcule les scores. Les opérations détaillées sont dans <code>tensor.js</code> ; le choix du prochain token est dans <code>math.js</code>. Des extraits facultatifs relieront ces fonctions aux explications du cours.</p>
<details><summary>Pour aller plus loin · architecture et entraînement</summary><p>Luciole possède deux blocs, quatre têtes d’attention par bloc et 32 nombres par représentation. Il est causal : chaque position ne consulte que les précédentes et elle-même. Ses paramètres, initialisés pseudo-aléatoirement, ont été ajustés pendant 12 000 mises à jour. La rétropropagation calcule les gradients, puis l’optimiseur Adam ajuste les poids. La graine 42 permet de reproduire le processus. Ces mécanismes seront détaillés dans la suite du parcours.</p></details>`,
    formula: 'phrases → prédictions → erreur → gradients → poids ajustés ; puis poids fixes pour générer',
    instruction: 'Déplacez le curseur de l’historique, comparez une prédiction avant/après, puis explorez les échecs du test. Ce sont des mesures enregistrées, pas un entraînement lancé dans votre navigateur.',
    takeaway: 'Luciole apprend réellement, mais sur un corpus minuscule. Observer son mécanisme ne démontre pas les capacités d’un grand assistant.',
    caveat: 'Les tests vérifient des recombinaisons synthétiques, pas une compréhension générale. Sur les boîtes, Luciole atteint 41,7 % contre 50 % pour la référence simple : cet échec reste visible.',
    question: 'Qu’est-ce qui a été écrit pour l’exemple, plutôt qu’appris par l’optimisation ?',
    choices: ['Les réponses sous forme de règles if/else', 'Les patrons des phrases synthétiques', 'Chaque valeur des 38 720 paramètres'],
    answer: 1, explanation: 'Les patrons sont préparés pour le cours et complétés par des phrases CC0. Les paramètres sont ensuite ajustés numériquement ; aucune règle de réponse n’est exécutée à l’inférence.',
    refs: ['transformer', 'rmsnorm'], notes: 'Ouvrir le corpus. Insister sur la différence entre mémorisation, mécanisme réel et capacités de production.',
  },
  {
    id: '02-tokenisation', section: 'Du texte aux représentations', title: 'Les mots ne sont\npas les tokens.',
    short: 'La tokenisation', label: 'Le découpage', experiment: 'tokenizer',
    lead: 'Le tokenizer découpe le texte en unités et leur attribue des numéros. Un même texte peut être découpé différemment selon le tokenizer.',
    body: `<p>Un <dfn>tokenizer</dfn> transforme le texte en identifiants. Les systèmes courants utilisent souvent des sous-mots : un token peut contenir un mot, un morceau de mot, un espace ou des octets. Un accent ou un emoji ne correspond pas forcément à une unité.</p>
<p>Le <dfn>BPE</dfn> apprend des fusions de paires fréquentes <strong>pendant la construction du tokenizer</strong>. Ensuite, il applique ces règles fixes au texte. Le petit curseur rejoue cette construction sur les 32 phrases originales du cours. La comparaison séparée utilise les <strong>vrais tokenizers de GPT-2, BERT et T5</strong> : BPE sur octets, WordPiece et Unigram. Aucun de ces tokenizers ne réapprend ses règles pendant une génération.</p>
<p>Luciole utilise un autre choix, volontairement lisible : il normalise l’écriture Unicode (NFC), passe en minuscules, regroupe les lettres ou chiffres et isole la ponctuation. Les espaces disparaissent. Les accents restent dans les mots ; les apostrophes et autres signes deviennent des unités séparées. Son vocabulaire de 333 entrées vient uniquement du lot d’apprentissage, et tout mot absent est refusé. La reconstruction ne conserve ni la casse ni les espaces d’origine.</p>
<p>Dans Luciole, &lt;bos&gt; ouvre la séquence et &lt;eos&gt; marque sa fin. Ces conventions varient selon les modèles. Les identifiants sont des numéros d’entrée du vocabulaire : 42 n’est pas « deux fois plus signifiant » que 21. Un ID n’a de sens qu’avec son vocabulaire.</p>
<p class="anecdote"><strong>Un détour historique :</strong> en 2016, Sennrich et ses collègues ont popularisé les sous-mots BPE pour traduire des mots rares. Décomposer un mot aide à le représenter avec un vocabulaire fini ; cela ne garantit pas que le modèle saura l’utiliser correctement.</p>`,
    formula: 'texte → unités → identifiants entiers',
    instruction: 'Commencez par « le chat dort ». Comparez ensuite français et anglais, puis un emoji : les tokeniseurs publics et celui de Luciole n’ont pas le même vocabulaire.',
    takeaway: 'Le nombre de tokens dépend du texte et du tokenizer. Il n’existe pas de taxe universelle du français.',
    caveat: 'Ces tokeniseurs sont précis et identifiés, mais ne comptent pas automatiquement les marqueurs et outils d’un service de chat. Le BPE pédagogique reste une expérience distincte.',
    question: 'Peut-on déduire le nombre de tokens à partir du seul nombre de mots ?',
    choices: ['Oui, un mot est toujours un token', 'Non, il faut connaître le tokenizer', 'Oui, il suffit de compter les espaces'],
    answer: 1, explanation: 'Le vocabulaire, les fusions, la normalisation et la pré-tokenisation font partie du comptage.',
    refs: ['bpe', 'tokenization'], notes: 'Accroche : un mot ne vaut pas une unité. Manipulation : FR, EN, emoji. Transition : le texte réellement envoyé est-il celui affiché ?',
  },
  {
    id: '02b-cas-reels', section: 'Du texte aux représentations', title: 'Du code, du français.\nDes comptes différents.',
    short: 'Cas réels de tokenisation', label: 'Des entrées du quotidien', experiment: 'tokenizerCases',
    lead: 'Une demande de support, une fonction JavaScript, un message structuré : comparons des textes que l’on envoie vraiment.',
    body: `<p>La comparaison utilise les définitions publiques originales de GPT-2, BERT uncased et T5 small, pas des découpages inventés. Vous pouvez changer chaque texte et examiner les pièces, leurs identifiants et la reconstruction obtenue. Aucun poids de ces modèles n’est chargé : <strong>tokeniser n’est pas générer une réponse</strong>.</p>
<p>BERT uncased met notamment en minuscules et retire les accents : « ÉTÉ » peut revenir sous la forme « ete ». GPT-2 travaille sur des unités issues des octets. T5 applique ses propres règles de normalisation. Dans les pièces affichées, Ġ représente notamment un espace encodé, ## une continuation WordPiece, et ▁ un marqueur d’espace de SentencePiece. Leur aspect à l’écran ne décrit pas une pensée du modèle.</p>
<p>Un nombre de tokens plus petit ne prouve pas qu’un modèle comprend mieux. Et ces comptes concernent uniquement le texte saisi, sans ajout automatique de marqueurs spéciaux. Le coût d’un appel réel dépend aussi du modèle, du template, des outils et de la sortie générée.</p>`,
    formula: 'même texte + vocabulaire différent → pièces et identifiants différents',
    instruction: 'Choisissez « Comparer les quatre », puis un exemple de texte. Changez un accent, un espace ou un nom de variable et comparez les découpages et le texte reconstruit.',
    takeaway: 'Le tokenizer fait partie du modèle : son vocabulaire, ses règles et ses identifiants ne sont pas interchangeables.',
    caveat: 'GPT-2, BERT et T5 sont des cas publics documentés, pas les tokeniseurs universels des assistants actuels. Aucun appel à ces modèles n’est effectué.',
    question: 'Pourquoi « ÉTÉ » peut-il être reconstruit en « ete » avec BERT uncased ?',
    choices: ['Le modèle a traduit le texte', 'Le tokenizer normalise la casse et les accents', 'Les poids ont été réentraînés'],
    answer: 1, explanation: 'La normalisation fait partie de la tokenisation. Il faut distinguer découpage réversible et transformation de l’entrée.',
    refs: ['tokenization'], notes: 'Manipulation : support, code et JSON. Comparer les trois vrais découpages, puis leurs reconstructions.',
  },
  {
    id: '03-prompt', section: 'Du texte aux représentations', title: 'La conversation\nsous la conversation.',
    short: 'Le template caché', label: 'Les coulisses', experiment: 'prompt',
    lead: 'Le modèle reçoit aussi qui parle et dans quel ordre. Un format de conversation transforme les messages en une seule suite de tokens.',
    body: `<p>Le <strong>chat template</strong> est le gabarit qui assemble la conversation : instructions du système, messages de l’utilisateur et réponses de l’assistant. Il ajoute des marqueurs de rôle, des séparateurs et parfois un début de réponse. Cette conversion en une suite ordonnée de tokens s’appelle la sérialisation. Les formats varient selon les modèles.</p>
<p>Un agent ajoute souvent des descriptions d’outils, leurs arguments et leurs résultats. Ces contenus peuvent consommer une part importante du contexte. Ils ne deviennent pas pour autant des instructions fiables : le résultat d’un outil peut contenir du texte hostile.</p>
<p><strong>Qui exécute un outil ?</strong> Le modèle peut produire une demande structurée. Le programme qui l’entoure décide de l’exécuter, récupère le résultat, puis le replace dans le contexte pour un nouveau calcul. Générer les caractères d’un appel n’exécute pas cet appel à lui seul.</p>
<p>L’échange ci-dessous est <strong>inventé pour le cours</strong>. Ses marqueurs sont illustratifs. Aucun raisonnement interne caché n’est montré ; un raisonnement affiché ne serait pas non plus une radiographie exhaustive du calcul.</p>`,
    formula: 'messages + rôles + outils + template = entrée sérialisée',
    instruction: 'Activez les rayons X, puis ajoutez le résultat de l’outil. Distinguez contenu visible et structure ajoutée.',
    takeaway: 'Le prompt est une structure sérialisée, pas seulement la dernière question de l’utilisateur.',
    caveat: 'L’ordre et les marqueurs dépendent du modèle. Luciole n’utilise pas ce template : il reçoit des tokens lexicaux et n’a pas appris à converser ni à appeler des outils.',
    question: 'Le résultat d’un outil est-il automatiquement une instruction de confiance ?',
    choices: ['Oui, puisqu’il vient d’un programme', 'Non, il peut contenir des données non fiables', 'Oui, si le texte est long'],
    answer: 1, explanation: 'L’origine outil ne garantit pas la confiance du contenu. Données, instructions et autorisations doivent rester distinctes.',
    refs: ['templates'], notes: 'Accroche : les coulisses du chat. Manipulation : rayons X et outil. Transition : tout cela devient des nombres.',
  },
  {
    id: '03b-nombres', section: 'Du texte aux représentations', title: 'Un nombre.\nUne liste. Un tableau.',
    short: 'Lire vecteurs et matrices', label: 'Les repères avant les calculs', experiment: 'numbers',
    lead: 'Avant les grands mots, trois objets simples : un nombre, une liste de nombres et un tableau de listes.',
    body: `<p>Un <dfn>vecteur</dfn> est une liste ordonnée de nombres. Chaque emplacement est une coordonnée, aussi appelée dimension. [0,4 ; −0,2 ; 0,8] contient trois coordonnées. Une valeur négative n’est pas mauvaise, et une grande valeur n’est pas automatiquement importante.</p>
<p>Une <dfn>matrice</dfn> range ces listes en lignes. Si trois tokens possèdent chacun trois nombres, on obtient une matrice 3 × 3. Dans Luciole, chaque token possède 32 nombres : pour n tokens, la forme est n × 32. Les mots « dimension » et « forme » décrivent donc aussi la taille des données, pas leur signification.</p>
<p><strong>Transformer une liste :</strong> une multiplication par une matrice fabrique de nouvelles coordonnées en pondérant puis en additionnant les anciennes. Par exemple, 2 × 0,4 + 3 × (−0,2) = 0,2. On répète ce calcul avec d’autres coefficients pour obtenir les autres coordonnées de sortie. C’est le principe des « projections » que nous rencontrerons dans l’attention.</p>
<p>Le tableau manipulé ici est inventé pour apprendre la notation. Les vraies représentations de Luciole arrivent à l’étape suivante. Leurs nombres ne sont ni des probabilités ni des colonnes portant chacune un concept humain.</p>`,
    formula: 'n lignes de d nombres = une matrice n × d',
    instruction: 'Choisissez une ligne du tableau, puis changez un de ses nombres. Retrouvez exactement cette valeur dans le vecteur et le graphique.',
    takeaway: 'Ici, une ligne représente une position de token. La forme de la matrice indique le nombre de positions et de coordonnées.',
    caveat: 'Les trois nombres de cette étape sont inventés pour apprendre la notation. Les vrais embeddings de Luciole arrivent à l’étape suivante.',
    question: 'Que signifie « 9 × 32 » pour les représentations de notre séquence ?',
    choices: ['9 tokens possédant chacun 32 nombres', '9 probabilités dont la somme vaut 32', '32 réponses de 9 mots'],
    answer: 0, explanation: 'Chaque ligne correspond à une position de token et chaque colonne à une coordonnée.',
    refs: ['transformer'], notes: 'Faire lire une ligne avant de montrer un espace. Expliquer le signe et la forme, sans attribuer de sens aux coordonnées.',
  },
  {
    id: '04-embeddings', section: 'Du texte aux représentations', title: 'Un identifiant entre.\nUn vecteur apparaît.',
    short: 'Les embeddings', label: 'L’espace des représentations', experiment: 'embeddings',
    lead: 'Le modèle n’effectue pas ses calculs sur des mots. Il manipule des coordonnées apprises.',
    body: `<p>La table d’<dfn>embeddings</dfn> associe à chaque token un vecteur de dimension fixe. C’est d’abord une lecture de ligne dans une matrice apprise. Luciole utilise 32 dimensions ; un modèle de production en utilise souvent des milliers.</p>
<p><strong>Trois moments à distinguer :</strong> le même ID lit toujours la même ligne d’embedding. Luciole y ajoute ensuite le vecteur de sa position. Les blocs produisent enfin des <strong>représentations contextualisées</strong>, dépendantes des tokens accessibles. « chat » part donc du même embedding dans deux phrases, mais son état peut évoluer différemment. Notre petit corpus ne suffit pas à démontrer une compréhension générale des ambiguïtés.</p>
<p>La similarité cosinus compare des directions à partir des 32 coordonnées. L’atlas 3D permet d’en choisir trois et de faire tourner la vue. Les vingt-neuf autres sont cachées : deux points proches à l’écran ne prouvent ni synonymie ni proximité dans l’espace complet. Les coordonnées viennent des vrais poids de Luciole, pas d’une carte inventée.</p>
<details><summary>Facultatif · notation de la table</summary><p>E ∈ ℝᵛˣᵈ : v tokens dans le vocabulaire, d nombres par token. L’embedding du token d’identifiant i est la ligne i de E, pas une multiplication du numéro i par un sens.</p></details>`,
    formula: 'identifiant du token → ligne de la table apprise → 32 nombres dans Luciole',
    instruction: 'Choisissez deux tokens, puis trois coordonnées pour les axes X, Y et Z. Tournez la vue : le dessin change, mais la similarité sur les 32 nombres reste identique.',
    takeaway: 'Un embedding est une représentation apprise, pas un dictionnaire de concepts lisibles dimension par dimension.',
    caveat: 'Nos voisins sont ceux d’un minuscule corpus. N’en déduisez pas une géographie universelle du langage.',
    question: 'Une dimension d’embedding signifie-t-elle nécessairement « masculin », « ville » ou « positif » ?',
    choices: ['Oui, les dimensions ont des noms universels', 'Non, les représentations sont généralement distribuées', 'Oui, si la valeur est positive'],
    answer: 1, explanation: 'L’information peut être distribuée entre de nombreuses directions. Une interprétation exige des observations et des expériences supplémentaires.',
    refs: ['transformer'], notes: 'Accroche : un mot devient une ligne. Manipulation : paris et france. Transition : comment ces lignes se transforment-elles ?',
  },
  {
    id: '05-transformer', section: 'À l’intérieur du Transformer', title: 'Une architecture.\nDes blocs répétés.',
    short: 'La carte du modèle', label: 'L’anatomie', experiment: 'architecture',
    lead: 'Le Transformer alterne deux gestes : faire circuler l’information, puis transformer chaque représentation.',
    body: `<p>L’<dfn>attention</dfn> combine l’information de plusieurs positions. Le <dfn>MLP</dfn>, petit réseau de neurones, transforme ensuite chaque position, avec les mêmes poids pour tous les tokens. Pensez à deux gestes : <strong>mélanger entre les tokens</strong>, puis <strong>transformer chaque liste séparément</strong>. Ce sont des calculs, pas des intentions. Empiler ces blocs permet de construire des représentations plus élaborées.</p>
<p>Les <strong>connexions résiduelles</strong> ajoutent le résultat d’une transformation à son entrée. Elles offrent un chemin direct à l’information et aux gradients. La normalisation contrôle l’échelle des activations ; elle ne convertit pas les valeurs en probabilités.</p>
<p>Luciole utilise deux blocs, quatre têtes et un MLP dense 32 → 64 → 32. « Dense » signifie que ce réseau entier est utilisé pour chaque token, sans routeur d’experts. Les positions sont des vecteurs appris, pas RoPE.</p>
<p class="anecdote"><strong>2017 : une machine à traduire.</strong> L’article fondateur du Transformer présentait un encodeur et un décodeur pour la traduction. Ici, nous suivons un décodeur causal : une branche de cette famille, adaptée à la continuation de texte. De nombreux modèles actuels changent la normalisation, le MLP ou l’attention ; certains combinent même d’autres types de couches.</p>
<details><summary>Facultatif · noms et ordre exact des opérations</summary><p>Luciole est pré-normalisé : RMSNorm sans gain appris avant l’attention et le MLP ; ReLU remplace les valeurs négatives par zéro entre les deux projections du MLP. Les résidus ajoutent les sorties à leurs entrées. x ← x + Attention(Norm(x)), puis x ← x + MLP(Norm(x)). Ce n’est pas le plan unique de tous les LLM.</p></details>`,
    formula: 'représentations → attention (mélanger) → MLP (transformer) → bloc suivant',
    instruction: 'Ouvrez chaque étape dans l’ordre. « n × 32 » signifie : n tokens, chacun décrit par 32 nombres. Le bloc mélange ces informations puis les transforme.',
    takeaway: 'Attention, MLP, résidus et normalisation jouent des rôles différents et complémentaires.',
    caveat: 'L’image « des couches qui pensent de plus en plus » est une métaphore, pas une description mesurée.',
    question: 'Quelle opération mélange directement les informations de plusieurs positions ?',
    choices: ['Le MLP positionnel', 'L’attention', 'La lecture d’un embedding initial'],
    answer: 1, explanation: 'L’attention calcule une combinaison des valeurs d’autres positions. Le MLP standard agit séparément sur chaque ligne.',
    refs: ['transformer', 'rmsnorm'], notes: 'Accroche : une carte avant la visite. Faire distinguer attention et MLP. Transition : comment calculer un mélange ?',
  },
  {
    id: '06b-tetes', section: 'À l’intérieur du Transformer', title: 'Une tête.\nUn mélange de nombres.',
    short: 'Une tête pas à pas', label: 'Avant la matrice d’attention', experiment: 'heads',
    lead: 'Une tête n’est ni un mot, ni un neurone, ni un petit assistant. C’est un calcul d’attention parmi plusieurs.',
    body: `<h3>À quoi servent ces trois lettres ?</h3><p>Dans « le chat dort », regardons la position « chat ». Nous voulons enrichir sa représentation avec les informations des positions qu’elle peut consulter : « le » et elle-même. <strong>Q et K calculent dans quelles proportions mélanger ; V fournit les nombres à mélanger.</strong></p>
<p>Chaque token produit les trois listes Q, K et V. Ce ne sont pas trois sortes de mots. On obtient ces listes en multipliant sa représentation par trois matrices différentes, apprises pendant l’entraînement. Séparer les projections permet de choisir <em>comment comparer</em> sans imposer de transporter exactement les mêmes coordonnées comme contenu.</p>
<h3>Suivre une seule position</h3><p>Le Q de « chat » est comparé au K de chaque position : on multiplie les coordonnées correspondantes, puis on additionne. C’est le <strong>produit scalaire</strong>. On divise ensuite par la racine du nombre de coordonnées de la tête, pour contrôler l’échelle des scores. Le masque causal interdit « dort », situé après « chat ». <strong>Softmax</strong> transforme les scores autorisés en proportions positives totalisant 100 %. Ces proportions servent à additionner les V pondérés.</p>
<h3>Et les autres têtes ?</h3><p>Dans Luciole, chaque bloc possède quatre têtes de 8 coordonnées. Chacune calcule son mélange avec ses projections ; leurs sorties sont mises bout à bout, puis projetées vers 32 coordonnées. L’ajout résiduel conserve aussi l’entrée. Les têtes ne sont pas des spécialistes humains avec un rôle garanti.</p>
<p>Les schémas ci-dessous utilisent les nombres <strong>inventés</strong> du premier mode de l’expérience. Le mode « Vraie trace Luciole » montre ensuite les tenseurs du modèle, avec &lt;bos&gt;. Les matrices de poids restent fixes dans les deux cas.</p>`,
    formula: 'projections Q/K/V → scores → masque → softmax → somme des V → têtes réunies → projection',
    instruction: 'Gardez « chat », avancez par « Étape suivante », puis changez sa première coordonnée. À l’étape du masque, vérifiez que « dort » est interdit. Sélectionnez ensuite « Vraie trace Luciole ».',
    takeaway: 'Une tête est une façon apprise de mélanger des informations. Plusieurs têtes réalisent plusieurs mélanges en parallèle.',
    caveat: 'Le petit calcul est inventé ; le mode Luciole lit ses vrais tenseurs sans changer les poids. L’attention mélange des informations, le MLP transforme séparément chaque position ; aucune tête n’a de rôle humain garanti.',
    question: 'À la position « chat » dans « le chat dort », quels V peuvent contribuer au mélange causal ?',
    choices: ['Seulement V de « dort », pour trouver la réponse', 'V de « le » et de « chat », mais pas du futur « dort »', 'Tous les V si leur score est positif'],
    answer: 1, explanation: 'Le masque interdit le futur avant softmax. Dans la vraie trace Luciole, V de <bos> est aussi autorisé. Le mélange transforme la représentation ; il ne tire pas encore un prochain token.',
    refs: ['transformer'], notes: 'Faire lire Q/K/V puis une somme pondérée. Montrer le futur interdit sur chat avant de passer à la vraie trace et à la carte.',
  },
  {
    id: '07-attention', section: 'À l’intérieur du Transformer', title: 'Chaque token\ninterroge son passé.',
    short: 'L’attention causale', label: 'La circulation', experiment: 'attention',
    lead: 'Chaque ligne de la grille indique comment un token mélange les informations accessibles. Les positions futures sont masquées.',
    body: `<p>Retrouvons le calcul pas à pas sous forme de grille. Une <strong>ligne</strong> est le token qui consulte ; une <strong>colonne</strong>, le token consulté. Une case donne le poids utilisé pour mélanger son V. Les projections Q et K fixent les scores, le masque interdit le futur, softmax donne les poids, puis la tête combine les V.</p>
<p>Le <strong>masque causal</strong> interdit de regarder les positions futures. À l’entraînement, on peut calculer plusieurs prédictions en parallèle tout en respectant cette contrainte. À l’inférence autorégressive, les nouvelles positions arrivent successivement.</p>
<p><strong>Pourquoi la diagonale est-elle autorisée ?</strong> La représentation de « chat » utilise déjà « chat » pour prédire le token <em>suivant</em>. Consulter sa propre position est donc permis. Chaque ligne a sa propre distribution totalisant 100 % ; les colonnes n’ont pas cette contrainte.</p>
<p>La grille montre les véritables poids d’attention de Luciole. Changez de tête pour voir un autre mélange du même texte, puis de bloc pour voir une autre étape. Deux blocs sont successifs ; quatre têtes sont parallèles dans chacun. Une case intense n’est pas une explication exhaustive de la décision finale.</p>
<details><summary>Facultatif · notation mathématique</summary><p>Attention(Q,K,V) = softmax(QKᵀ / √dₖ + masque) V. Le produit scalaire dépend des directions et des longueurs, pas seulement de l’angle. dₖ = 8 coordonnées par tête dans Luciole. Les scores futurs sont exclus avant softmax ; leurs poids sont nuls.</p></details>`,
    formula: 'ligne = token qui consulte · colonne = token consulté · × = futur interdit',
    instruction: 'Choisissez « le chat » puis la ligne « le » : « chat » reste dans le futur. Observez la dernière ligne, puis une autre tête et un autre bloc.',
    takeaway: 'L’attention est une opération de mélange pondéré, contrainte par le masque causal.',
    caveat: '« Causal » signifie ici que le futur est masqué. Une grande valeur d’attention ne prouve pas, à elle seule, qu’un token a causé la réponse finale.',
    question: 'Pourquoi les cases au-dessus de la diagonale sont-elles masquées ?',
    choices: ['Pour économiser les couleurs', 'Pour empêcher la fuite d’information depuis le futur', 'Parce que les tokens futurs valent zéro'],
    answer: 1, explanation: 'La cible ne doit pas être visible dans l’entrée utilisée pour la prédire.',
    refs: ['transformer'], notes: 'Accroche : le futur est fermé. Manipulation : ligne le puis dernière ligne. Transition : Q et K sont connus, comment ajouter l’ordre ?',
  },
  {
    id: '06-position', section: 'À l’intérieur du Transformer', title: 'L’ordre fait\nla différence.',
    short: 'Position et RoPE', label: 'La géométrie de l’ordre', experiment: 'rope',
    lead: '« Le chien mord le chat » n’est pas « Le chat mord le chien ». Il faut coder la position.',
    body: `<p>Vous avez maintenant manipulé Q et K. Revenons à l’ordre : Luciole ajoute un <strong>vecteur de position appris</strong> à chaque embedding, avant les blocs. Le token « chat » peut ainsi commencer avec une liste différente selon sa position. La position n’est ni une connaissance nouvelle ni un mot ajouté au prompt.</p>
<p>D’autres modèles utilisent <dfn>RoPE</dfn> : au lieu de cette addition, des rotations par paires de coordonnées sont appliquées aux requêtes Q et aux clés K. Le cadran ci-dessous est une illustration de cette <strong>variante, absente de Luciole</strong>. Une paire de nombres devient une flèche ; sa rotation encode une position. Ce n’est pas une flèche de pensée.</p>
<p>Dans le cadran, les contenus Q et K sont maintenus fixes : les faire tourner ensemble conserve leur produit scalaire ; changer leur écart peut le modifier. Dans un modèle complet, déplacer du texte peut aussi changer son contexte et ses représentations. Cette propriété du cadran ne signifie donc pas que toute la sortie reste identique.</p>
<p>RoPE emploie plusieurs fréquences pour représenter différentes échelles de distance. Il ne garantit pas une mémoire infinie ni une utilisation fiable de tout long contexte : architecture, entraînement et évaluations restent déterminants.</p>
<details><summary>Facultatif · pourquoi une rotation commune ne change rien</summary><p>Dans une paire, ⟨R(m)q, R(n)k⟩ = ⟨q, R(n − m)k⟩. Une rotation conserve le produit scalaire. Agrandir la fenêtre autorisée ne garantit pas une extrapolation fiable hors des positions rencontrées.</p></details>`,
    formula: 'Luciole : embedding + position apprise · variante RoPE : rotation de Q et K',
    instruction: 'Déplacez ensemble les deux positions avec « Position m ». Le score reste stable. Changez ensuite l’écart : le score peut varier. Ce cadran ne décrit pas Luciole.',
    takeaway: 'L’ordre doit être représenté. Luciole emploie des positions apprises ; RoPE est un autre choix, pas une mémoire infinie.',
    caveat: 'Les cadrans ne représentent qu’une paire de dimensions inventée. Luciole n’utilise pas RoPE : ses positions sont des vecteurs appris ajoutés aux embeddings.',
    question: 'Comment Luciole représente-t-il la position avant ses blocs ?',
    choices: ['En ajoutant un vecteur de position appris', 'En faisant tourner Q et K avec RoPE', 'En réentraînant les poids à chaque token'],
    answer: 0, explanation: 'Le cadran explore une variante moderne indépendante. Les poids de positions de Luciole sont appris avant publication puis restent fixes.',
    refs: ['rope', 'transformer'], notes: 'Seulement après Q/K/V. Distinguer position apprise réelle et RoPE illustratif. Transition : attention mélange, MLP transforme.',
  },
  {
    id: '08-experts', section: 'À l’intérieur du Transformer', title: 'Beaucoup d’experts.\nPeu au travail.',
    short: 'MLP et MoE', label: 'La transformation', experiment: 'moe',
    lead: 'Le modèle peut stocker beaucoup de paramètres sans tous les activer pour chaque token.',
    body: `<p>Reprenons la différence : <strong>l’attention mélange plusieurs positions ; le MLP transforme une position à la fois</strong>, avec les mêmes poids à chaque position. Le MLP de Luciole est dense : il transforme 32 nombres en 64, applique ReLU, puis revient à 32. Il traite un vecteur déjà contextualisé par l’attention, sans consulter directement une autre ligne.</p>
<p>Un <dfn>MoE</dfn> remplace certains MLP par plusieurs réseaux appelés experts et un routeur. Pour chaque position, celui-ci attribue des scores puis sélectionne un sous-ensemble, souvent les k meilleurs : c’est le top-k. Les sorties choisies sont pondérées et combinées. Il s’agit d’un choix <strong>à l’intérieur d’une couche</strong>, pas d’un choix entre plusieurs assistants complets.</p>
<p>L’animation montre uniquement un routage <strong>inventé</strong>. Luciole n’a ni experts ni routeur. Un « expert » est un réseau de neurones, pas un spécialiste humain ni une source de savoir identifiée. Les paramètres actifs influencent le calcul ; tous les paramètres influencent le stockage.</p>
<p class="anecdote"><strong>Un cas réel :</strong> le rapport DeepSeek-V3 annonce 671 milliards de paramètres au total, dont 37 milliards activés par token. Ces deux nombres répondent à des questions différentes : quelle capacité est stockée, et quelle partie participe au calcul d’un token ? Ils ne donnent pas à eux seuls la mémoire ni la latence d’un service.</p>
<details><summary>Facultatif · combinaison des sorties et coûts</summary><p>sortie = Σ poids_routeur(expert) × expert(x). Les poids des experts sélectionnés sont ici renormalisés. Communication, équilibrage et capacité des experts ajoutent des coûts, non représentés par ce petit routage.</p></details>`,
    formula: 'Luciole : MLP dense entier · variante MoE : quelques réseaux sélectionnés',
    instruction: 'Passez de un à trois experts actifs. Observez les routes et le budget actif, sans modifier le nombre total d’experts.',
    takeaway: 'Paramètres totaux, paramètres actifs et coût réel sont trois quantités distinctes.',
    caveat: 'Le routage montré est synthétique, déterministe et sans étiquette sémantique. Luciole est un modèle dense.',
    question: 'Activer deux experts sur huit divise-t-il forcément toute la mémoire du modèle par quatre ?',
    choices: ['Oui, les autres experts disparaissent', 'Non, les poids des autres experts doivent encore être stockés ou chargés', 'Oui, quel que soit le matériel'],
    answer: 1, explanation: 'Le calcul activé est réduit, mais les poids totaux et les coûts de déplacement ne disparaissent pas.',
    refs: ['switch', 'v3'], notes: 'Accroche : actif ne signifie pas stocké. Manipulation : top-k. Transition : quand une prédiction devient-elle visible ?',
  },
  {
    id: '09b-scores', section: 'Du calcul à la réponse', title: 'Un score n’est pas\nune probabilité.',
    short: 'Des scores aux probabilités', label: 'Avant le tirage', experiment: 'scores',
    lead: '−2, 0, 3 : ces nombres peuvent être des scores. Ce ne sont pas encore des chances de choisir un token.',
    body: `<p>La sortie du modèle attribue un score, appelé logit, à chaque token du vocabulaire. Ces scores peuvent être négatifs et leur somme n’a pas de valeur particulière. Ce sont leurs écarts qui comptent : un candidat au score plus grand reçoit davantage de probabilité après conversion.</p>
<p>Le <dfn>softmax</dfn> transforme les scores en nombres positifs dont la somme vaut 1. Il amplifie les écarts par une exponentielle puis divise par le total. Dans cette étape, trois scores choisis à la main permettent de voir cette transformation, sans confondre ce petit exemple avec la sortie d’un modèle entraîné.</p>
<p><strong>Un repère numérique :</strong> les scores [0 ; 0 ; 0] donnent environ [33,3 % ; 33,3 % ; 33,3 %]. [1 ; 1 ; 1] donne exactement les mêmes probabilités : ajouter une constante à tous les scores ne change pas leurs écarts. Dans Luciole, la sortie contient 333 scores, un par entrée du vocabulaire.</p>
<p>Une distribution n’est toujours pas un choix. On peut prendre son maximum ou tirer un candidat au hasard selon les probabilités obtenues. L’étape « Le tirage » applique ces stratégies à cinq candidats fictifs pour rendre leurs effets visibles ; le laboratoire les utilise avec les vrais scores de Luciole. Une probabilité élevée n’est pas une garantie de vérité.</p>
<details><summary>Facultatif · formule softmax</summary><p>probabilité(i) = exp(scoreᵢ) / somme des exp(scores). On retire en pratique le score maximal avant l’exponentielle pour stabiliser le calcul, sans changer le résultat.</p></details>`,
    formula: 'scores libres → softmax → probabilités qui totalisent 100 %',
    instruction: 'Changez les trois scores. Rendez-les égaux, puis augmentez-en un seul : les probabilités changent mais leur somme reste égale à 1.',
    takeaway: 'Scores, probabilités et choix sont trois étapes distinctes. Une probabilité n’est pas un certificat de vérité.',
    caveat: 'Ces trois candidats et leurs scores sont une expérience de calcul, pas une prédiction attribuée à Luciole ou à un service commercial.',
    question: 'Si les trois scores sont égaux, quelles probabilités softmax obtient-on ?',
    choices: ['100 % pour le premier', 'Un tiers pour chacun', 'Cela dépend de la somme des scores'],
    answer: 1, explanation: 'Des scores identiques ont les mêmes exponentielles ; chacun reçoit donc un tiers du total.',
    refs: ['transformer', 'nucleus'], notes: 'Séparer le score de la probabilité avant d’introduire température, filtres et tirage.',
  },
  {
    id: '09-logit-lens', section: 'Du calcul à la réponse', title: 'Une prédiction\nse dessine.',
    short: 'La logit lens', label: 'Les représentations intermédiaires', experiment: 'lens',
    lead: 'Peut-on regarder la sortie avant la sortie ? Oui, à condition de savoir ce que l’on mesure.',
    body: `<p>À la fin du modèle, une transformation convertit la représentation du dernier token en scores pour les tokens suivants possibles : c’est la <strong>projection de sortie</strong>. La <dfn>logit lens</dfn> réutilise cette transformation plus tôt, sur les représentations intermédiaires. Elle permet de comparer les candidats visibles au fil des couches.</p>
<p>La projection donne des logits ; softmax permet de les lire comme une distribution sur le vocabulaire. Les couches intermédiaires n’ont pas été entraînées à produire directement la réponse avec cette projection. Une lecture changeante n’est donc pas un dysfonctionnement. La <em>tuned lens</em> apprend des transformations adaptées aux couches pour améliorer cette lecture ; elle n’est pas implémentée dans Luciole.</p>
<p>Ici, la même tête de sortie et RMSNorm lisent l’état initial puis les deux blocs de Luciole. Les barres sont calculées à partir de ses vrais tenseurs. Le chemin n’est pas nécessairement monotone vers le bon token.</p>
<details><summary>Facultatif · calcul de la sonde</summary><p>lecture intermédiaire = softmax(Norm(x_couche) W_sortie). Ce sont des lectures calculées, pas des décisions déjà prises par chaque couche.</p></details>`,
    formula: 'représentation intermédiaire → même projection de sortie → candidats visibles',
    instruction: 'Gardez « le chat » et parcourez les profondeurs 0, 1 et 2 : plusieurs suites restent visibles. Comparez ensuite avec la capitale de la France, où un candidat domine.',
    takeaway: 'Une sonde est un instrument de lecture, pas un accès direct aux intentions du modèle.',
    caveat: 'Avec seulement deux blocs et un corpus mémorisable, cette démonstration ne mesure pas une émergence générale du raisonnement.',
    question: 'Une mauvaise prédiction intermédiaire prouve-t-elle que la couche ne sert à rien ?',
    choices: ['Oui', 'Non, elle n’est pas nécessairement entraînée pour cette lecture directe', 'Oui, si sa probabilité est faible'],
    answer: 1, explanation: 'Une représentation peut être utile aux couches suivantes sans être directement lisible avec la tête finale.',
    refs: ['lens'], notes: 'Accroche : une radiographie imparfaite. Manipulation : couche 0, 1, 2. Transition : une distribution n’est pas encore un choix.',
  },
  {
    id: '10-tirage', section: 'Du calcul à la réponse', title: 'Prédire n’est\npas choisir.',
    short: 'Le tirage', label: 'Le décodage', experiment: 'sampling',
    lead: 'Une même distribution peut conduire à plusieurs choix. Cinq candidats fictifs permettent de voir précisément ce que changent la température, les filtres et le hasard.',
    body: `<p><strong>Notre exemple :</strong> « Pour le dessert, je prendrai… ». Nous attribuons volontairement 40 % à « un gâteau », 30 % à « une glace », 20 % à « un fruit », 8 % à « un café » et 2 % à « autre chose ». Ces choix et probabilités sont <strong>inventés</strong> : ce ne sont ni une prédiction de Luciole, ni les tokens d’un tokenizer réel. Un vrai modèle applique les mêmes opérations aux scores de son vocabulaire.</p>
<h3>1 · Régler la concentration</h3><p>Pour une température T positive, on divise les scores par T avant softmax. Une température plus basse favorise davantage les meilleurs scores ; une température plus haute rapproche les probabilités. Si les scores sont tous égaux, la température ne les départage pas. À T = 0, cette interface choisit directement le premier maximum : un choix à 100 % ne signifie pas que sa probabilité initiale était de 100 %.</p>
<h3>2 · Réduire les candidats</h3><p><strong>Top-k</strong> garde les k meilleurs candidats. <strong>Min-p</strong> retire ceux dont la probabilité est trop faible par rapport au favori : avec un favori à 40 % et min-p = 0,1, le seuil est 4 %. <strong>Top-p</strong> garde ensuite les meilleurs candidats jusqu’à couvrir la fraction demandée de la masse restante. Ici, l’ordre est top-k, puis min-p, puis top-p ; d’autres logiciels peuvent employer un autre ordre.</p>
<p>Avec la situation initiale, température 1, top-k = 5, min-p = 0 et top-p = 0,8, les trois premiers choix sont gardés : 40 + 30 + 20 = 90 %. On les <strong>renormalise</strong> en divisant par 0,9 : environ 44,4 %, 33,3 % et 22,2 %. Les deux autres restent visibles à 0 % pour comprendre leur exclusion.</p>
<h3>3 · Tirer, puis observer</h3><p>Un tirage choisit un seul candidat ; cent tirages donnent des fréquences qui peuvent différer des probabilités. Ici, chaque essai utilise la <strong>même distribution</strong>, sans ajouter de texte. Lors d’une vraie génération, chaque token ajouté change le contexte et déclenche une nouvelle prédiction. La graine 42 permet de reproduire nos tirages.</p>`,
    formula: 'scores → température et softmax → top-k → min-p → top-p → renormalisation → tirage',
    instruction: 'Gardez « Plusieurs choix plausibles ». Modifiez un réglage à la fois, tirez une fois puis ajoutez 100 tirages. Comparez ensuite avec « Un favori dominant » et « Égalité entre les choix ».',
    takeaway: 'Les réglages de décodage changent les choix, pas les connaissances ni les poids du modèle.',
    caveat: 'Les cinq choix et leurs probabilités sont inventés pour isoler le décodage. Aucun modèle n’est chargé. Une température basse ne garantit pas une réponse vraie.',
    question: 'Que fait la température aux poids appris du modèle ?',
    choices: ['Elle les réentraîne', 'Elle ne les change pas', 'Elle supprime les couches incertaines'],
    answer: 1, explanation: 'La température agit après le calcul des logits. Elle ne modifie pas les paramètres appris.',
    refs: ['nucleus', 'decoding'], notes: 'Accroche : score puis décision. Manipulation : température nulle et top-p. Transition : peut-on dépenser plus de calcul pour mieux réussir ?',
  },
  {
    id: '11-effort', section: 'Du calcul à la réponse', title: 'Plus de calcul.\nPas de garantie.',
    short: 'L’effort de raisonnement', label: 'Le budget à l’inférence', experiment: 'effort',
    lead: 'Décomposer, chercher, vérifier : le temps de calcul peut devenir une ressource de résolution.',
    body: `<p>Un modèle de raisonnement autorégressif génère lui aussi des tokens. Son entraînement peut favoriser des étapes de résolution, et son utilisation autoriser une trajectoire plus longue, plusieurs essais ou une recherche. Le bénéfice dépend du modèle, de la tâche et de la stratégie ; ajouter du calcul ne garantit pas la réussite.</p>
<p><strong>Un exemple documenté :</strong> DeepSeek-R1 décrit un entraînement par récompenses sur des tâches notamment vérifiables, comme les mathématiques et le code. Cela illustre le lien entre apprentissage et calcul à l’inférence, pas une recette universelle. Un test de programme ou une égalité mathématique offre un retour plus précis qu’un simple jugement « cette réponse paraît bonne ».</p>
<p>Pour isoler cette idée sans inventer de benchmark, notre expérience résout une équation entière par <strong>recherche exhaustive bornée</strong>. Plus de budget permet de tester plus de candidats. Le vérificateur contrôle exactement l’égalité.</p>
<p>Ce n’est pas une simulation du raisonnement interne d’un LLM : c’est une analogie calculable. Un modèle peut produire une longue justification fausse. Une procédure de vérification fiable change profondément le problème.</p>`,
    formula: 'budget de recherche + vérificateur ≠ connaissance nouvelle garantie',
    instruction: 'Augmentez le nombre d’essais pour résoudre 7x + 3 = 94. Le résultat doit être vérifié, pas seulement proposé.',
    takeaway: 'Le calcul supplémentaire aide certaines stratégies ; sa valeur dépend notamment de la possibilité de vérifier.',
    caveat: 'Aucun score de modèle commercial n’est attribué à cette expérience. La longueur d’une réponse n’est pas un certificat de raisonnement.',
    question: 'Qu’est-ce qui rend cette expérience particulièrement facile à vérifier ?',
    choices: ['La longueur du texte produit', 'On peut substituer x dans une équation exacte', 'La confiance affichée par le modèle'],
    answer: 1, explanation: 'Un vérificateur externe teste l’égalité. Beaucoup de tâches ouvertes n’offrent pas un critère aussi simple.',
    refs: ['test-time', 'r1'], notes: 'Accroche : chercher n’est pas savoir. Manipulation : budgets 5 puis 20. Transition : ce calcul utilise aussi de la mémoire.',
  },
  {
    id: '12-memoire', section: 'Mémoire, performance et apprentissage', title: 'Le contexte grandit.\nLa mémoire aussi.',
    short: 'Le KV cache', label: 'Le stockage à l’inférence', experiment: 'memory',
    lead: 'Les poids ne sont pas la seule chose à faire tenir en mémoire.',
    body: `<h3>Pourquoi refaire un calcul déjà fait ?</h3><p>Après avoir traité « &lt;bos&gt; le chat », ajoutons « dort ». Avec le <strong>masque causal</strong>, les anciennes positions ne peuvent pas consulter ce nouveau token. Leurs représentations restent donc inchangées, dans chaque couche, si le préfixe, les positions et les paramètres restent les mêmes.</p>
<p>Le <dfn>KV cache</dfn> exploite cette propriété : il conserve les clés K et les valeurs V du passé. Le <strong>prefill</strong> traite le prompt et remplit ce cache. Puis chaque pas de décodage traite le token qui vient d’être choisi, ajoute ses K/V et calcule les scores du token suivant.</p>
<h3>Pourquoi K et V, mais pas Q ?</h3><p>La nouvelle position a besoin de son <strong>nouveau Q</strong> pour comparer toutes les clés accessibles, puis mélanger leurs valeurs. Les anciennes requêtes ont déjà servi à calculer les anciennes représentations : elles ne sont pas nécessaires à ce nouveau mélange. Les poids d’attention, eux, dépendent du nouveau Q et doivent être recalculés.</p>
<p>Retenez trois objets distincts : les <strong>paramètres appris</strong> sont fixes ; les <strong>K/V en cache</strong> sont des données temporaires liées au contexte ; les <strong>poids d’attention</strong> sont les proportions calculées pour la requête actuelle. Le cache ne remplace ni l’attention, ni le MLP, ni la prédiction. Modifier un préfixe invalide les entrées qui en dépendent.</p>
<h3>Ce que l’expérience permet de vérifier</h3><p><strong>Luciole n’a pas de cache.</strong> Il recalcule le contexte complet. La frise illustre la réutilisation possible et impose la suite « dort . ». Le bouton de vérification compare ses vrais K/V sur deux préfixes successifs : leur égalité montre pourquoi un cache fonctionnerait, sans mesurer un gain de vitesse.</p>
<details><summary>Aller plus loin · mémoire, GQA et limites</summary><p>Un cache K/V standard non compressé occupe environ : 2 × couches × têtes_KV × dimension_tête × tokens × séquences × octets. Le 2 correspond à K et V. Avec 2 couches, 4 têtes, 8 coordonnées, 10 tokens, une séquence et 4 octets par nombre, cela ferait 5 120 octets, hors autres allocations.</p><p>GQA fait partager des têtes K/V à plusieurs têtes Q ; MQA n’en garde qu’une. Ce sont des choix d’architecture et d’entraînement, pas un bouton gratuit sur n’importe quel modèle. Fenêtres glissantes et caches compressés changent encore le stockage effectif.</p><p>Le cache évite de refaire les positions passées, mais l’attention dense de la nouvelle position doit encore consulter leurs K/V. Son travail grandit donc avec la longueur du contexte. Les curseurs décrivent un modèle hypothétique de 8 milliards de paramètres ; ils ne dimensionnent pas un service de production.</p></details>`,
    formula: 'prefill : calculer le prompt · t : réutiliser le passé + calculer le nouveau · t + 1 : recommencer',
    instruction: 'Passez du prefill à t puis à t + 1. Repérez les K/V réutilisés dans chaque couche. Vérifiez ensuite les vraies projections de Luciole, recalculées sans cache.',
    takeaway: 'La mémoire d’inférence dépend à la fois du modèle, du contexte, du parallélisme et de la précision.',
    caveat: 'Animation conceptuelle : Luciole recalcule tout le contexte, sans cache. Les nombres de positions ne sont pas des mesures de vitesse. La formule optionnelle n’est pas un dimensionnement de production.',
    question: 'À t + 1, que peut réutiliser un modèle causal avec cache si le préfixe ne change pas ?',
    choices: ['Les poids d’attention de la requête précédente', 'Les K et V du passé, dans chaque couche', 'Une réponse stockée qui remplace tous les calculs'],
    answer: 1, explanation: 'Les anciennes projections K/V sont identiques pour un préfixe inchangé. Les nouveaux Q/K/V, les poids d’attention, le mélange et la prédiction restent à calculer. Aucun apprentissage ne se produit.',
    refs: ['cache', 'gqa', 'transformer'], notes: 'Faire dire ce qui est réutilisé et ce qui reste à calculer. Distinguer token traité et token prédit, puis trace conceptuelle avec cache et vérification réelle sans cache.',
  },
  {
    id: '13-performance', section: 'Mémoire, performance et apprentissage', title: 'Calculer vite.\nLire assez vite.',
    short: 'Le coût de génération', label: 'Les limites matérielles', experiment: 'roofline',
    lead: 'Un GPU peut disposer de beaucoup de puissance et attendre malgré tout ses données.',
    body: `<p>Le <strong>prefill</strong> traite plusieurs positions du prompt. Le <strong>décodage</strong> produit ensuite un token par séquence et par itération. À petit batch, relire les poids peut coûter davantage que les multiplications elles-mêmes.</p>
<p>Le <strong>batch</strong> est le nombre de séquences traitées ensemble. Le <strong>débit</strong> compte les tokens produits par seconde pour l’ensemble ; la <strong>latence</strong> est le temps d’attente pour une séquence. Le modèle roofline compare le nombre d’opérations par octet lu à deux limites : la vitesse de calcul et celle de lecture de la mémoire. Regrouper plusieurs séquences permet de réutiliser les mêmes poids.</p>
<p>Deux attentes sont perceptibles : le <strong>temps avant le premier token</strong> comprend notamment la file d’attente et le traitement du prompt ; le <strong>temps entre les tokens</strong> détermine ensuite le rythme d’affichage. Un service peut produire beaucoup de tokens au total tout en faisant attendre une personne.</p>
<p><strong>Une optimisation majeure : FlashAttention.</strong> Elle organise l’attention dense pour réduire les échanges avec la mémoire GPU et éviter de stocker toute la matrice intermédiaire. Elle conserve le calcul d’attention exact, aux arrondis numériques près. Elle ne remplace pas le KV cache et ne supprime pas le nombre quadratique de comparaisons du prefill dense.</p>
<p>Notre estimation concerne un grand modèle dense hypothétique, pas Luciole. Elle ignore notamment l’attention, le cache et les communications. Luciole recalcule tout le contexte sans cache dans le navigateur. Les deux temps donnent une <strong>borne idéale</strong>, jamais une mesure de sa latence.</p>
<details><summary>Facultatif · modèle de coût simplifié</summary><p>On compte environ 2P opérations par token et une lecture complète des poids par pas. t ≥ max(2P × batch / FLOP·s⁻¹, P × octets_poids / octets·s⁻¹). P désigne le nombre de paramètres. Le débit total ne donne pas le temps d’attente individuel.</p></details>`,
    formula: 'temps idéal ≥ le plus lent des deux : calculer / lire les poids',
    instruction: 'Augmentez le batch et observez le changement de régime. Distinguez débit total et latence par séquence.',
    takeaway: 'Le goulot d’étranglement dépend de la charge et du matériel. « Toujours limité par la mémoire » est trop général.',
    caveat: 'GPU illustratif : 600 TFLOP/s et 3 To/s, sans constructeur associé. Aucune promesse de performance réelle.',
    question: 'Augmenter le batch réduit-il nécessairement la latence d’une requête individuelle ?',
    choices: ['Oui, dans tous les cas', 'Non, le débit peut augmenter sans réduire sa latence', 'Oui, parce que le modèle devient plus petit'],
    answer: 1, explanation: 'Le batching amortit des lectures et améliore le débit, mais ajoute aussi du calcul et éventuellement de l’attente.',
    refs: ['roofline', 'flash'], notes: 'Accroche : calcul et lecture font la course. Manipulation : batch 1 puis 512. Transition : d’où viennent les poids ?',
  },
  {
    id: '14-apprentissage', section: 'Mémoire, performance et apprentissage', title: 'Les poids ont\nune histoire.',
    short: 'L’apprentissage', label: 'Avant l’inférence', experiment: 'training',
    lead: 'Le prompt conditionne un calcul. L’entraînement, lui, modifie les paramètres qui le réalisent.',
    body: `<p>Le préentraînement ajuste les poids pour mieux prédire des tokens sur un corpus. Une fonction de perte mesure l’erreur ; la rétropropagation calcule les gradients ; un optimiseur met à jour les paramètres.</p>
<p>Pour apprendre sur « le chat dort », les entrées sont « &lt;bos&gt; le chat dort » et les cibles « le chat dort &lt;eos&gt; ». Après &lt;bos&gt;, le modèle doit prédire « le » ; après « le », « chat » ; après « chat », « dort » ; après « dort », la fin. L’entrée et les cibles sont donc décalées d’un token. Le masque causal empêche chaque position de consulter les suivantes, même lorsque plusieurs prédictions sont calculées en parallèle.</p>
<p><strong>À l’entraînement</strong>, les préfixes viennent ici du texte du corpus. <strong>Pendant la génération</strong>, ils incluent les tokens choisis par le modèle : une erreur peut donc modifier les prédictions suivantes. La perte récompense la probabilité donnée à la cible du corpus ; elle ne teste pas directement la vérité de toute phrase produite.</p>
<p>Le post-entraînement peut apprendre à suivre des instructions, utiliser des préférences entre réponses ou des récompenses vérifiables. InstructGPT décrit un exemple avec retours humains et apprentissage par renforcement ; DPO optimise directement un objectif à partir de paires préférées/rejetées. Ce sont des recettes distinctes, pas des étapes obligatoires que tous les modèles suivraient.</p>
<p>Les courbes proviennent du préentraînement réel de Luciole : 12 000 mises à jour, 1 512 phrases d’apprentissage, graine 42. Elles suivent des exemples fixes d’apprentissage et de validation. Le curseur permet de relire des prédictions enregistrées ; il ne modifie aucun poids. La fiche Luciole expose aussi le test final, réservé jusqu’à la fin de ce calcul.</p>
<p>Une baisse de perte signifie moins d’erreur sur l’objectif mesuré, pas une compétence universelle. Les phrases Tatoeba enrichissent les langues rencontrées ; les tests synthétiques vérifient seulement certaines recombinaisons. Les échecs sur les boîtes restent visibles.</p>
<details><summary>Facultatif · une mise à jour simplifiée</summary><p>poids ← poids − taux_apprentissage × gradient. Ce schéma décrit une descente de gradient simple ; Luciole a été entraîné avec Adam, qui utilise aussi des moyennes des gradients et de leurs carrés. Aucun de ces ajustements ne s’exécute quand vous déplacez le curseur.</p></details>`,
    formula: 'corpus → erreur de prédiction → gradients → ajuster les poids avant publication',
    instruction: 'Parcourez les phases, puis inspectez la courbe de Luciole. Distinguez la mesure observée des étapes qu’il n’a pas suivies.',
    takeaway: 'Préentraînement, post-entraînement et inférence sont des processus distincts.',
    caveat: 'Luciole a uniquement appris la prédiction du token suivant. Il n’a reçu ni instruction tuning ni entraînement par préférences.',
    question: 'Une perte d’entraînement très basse prouve-t-elle une bonne généralisation ?',
    choices: ['Oui, c’est suffisant', 'Non, il faut évaluer sur des données et tâches distinctes', 'Oui, si le graphe est régulier'],
    answer: 1, explanation: 'Un modèle peut mémoriser les exemples. Une évaluation indépendante est nécessaire pour étudier sa généralisation.',
    refs: ['transformer', 'instruct', 'dpo'], notes: 'Accroche : les paramètres ont appris avant le chat. Manipulation : courbe et phases. Transition : assemblons tous les organes.',
  },
  {
    id: '15-laboratoire', section: 'Tout assembler', title: 'La machine,\nà livre ouvert.',
    short: 'Le laboratoire', label: 'Tout se rejoint', experiment: 'laboratory',
    lead: 'Un contexte entre, un token sort. Les nombres affichés viennent du calcul réel de Luciole : vous pouvez maintenant relier chaque vue à une opération.',
    body: `<p>Le laboratoire réunit le tokenizer lexical, les embeddings, les positions apprises, les deux blocs d’attention et MLP, la normalisation, la projection et le tirage. Les paramètres chargés sont les poids réellement entraînés et publiés.</p>
<p>Choisissez un exemple ou composez un prompt avec le vocabulaire disponible. La fenêtre est limitée à 32 tokens, marqueur de début compris. Un mot inconnu est signalé, pas silencieusement remplacé. « Revenir » permet d’inspecter l’état précédent ; « Réinitialiser » restaure le prompt et la graine.</p>
<p>Les vues attention, représentation et candidats correspondent toutes au <strong>même passage avant</strong>. Le calcul est entièrement local. Pour garder le code lisible, Luciole recalcule le contexte et n’implémente pas de KV cache.</p>
<p><strong>Une enquête simple :</strong> changez seulement « france » en « belgique », en gardant les réglages fixes. Comparez d’abord les tokens d’entrée, puis la dernière ligne d’attention et les candidats. Vous observez l’effet de cette modification sur ce modèle ; deux exemples ne suffisent pas à démontrer une connaissance générale des capitales.</p>`,
    formula: 'tokeniser → représenter → contextualiser → projeter → échantillonner',
    instruction: 'Générez « paris » à partir de « la capitale de la france est », puis essayez la Belgique. Comparez couches, têtes et probabilités.',
    takeaway: 'Les mécanismes sont inspectables. La qualité des réponses dépend aussi des données, de l’échelle et de l’entraînement.',
    caveat: 'Luciole est un modèle pédagogique, pas un assistant. Pas de RoPE, MoE, GQA ou KV cache dans ce mini-modèle ; ces variantes sont étudiées séparément.',
    question: 'Les probabilités montrées dans le laboratoire sont-elles prédéfinies pour chaque phrase ?',
    choices: ['Oui, c’est une vidéo interactive', 'Non, elles résultent du calcul avec les poids publiés', 'Elles viennent d’une API distante'],
    answer: 1, explanation: 'Le graphe numérique est exécuté localement. Les mêmes opérations servent à son entraînement et à son inférence.',
    refs: ['transformer', 'rmsnorm'], notes: 'Accroche : dézoomer sans perdre les détails. Manipulation : France, Belgique, température. Transition : qu’avons-nous réellement établi ?',
  },
  {
    id: '16-synthese', section: 'Tout assembler', title: 'Comprendre.\nSans surinterpréter.',
    short: 'La synthèse', label: 'Ce qui reste', experiment: 'synthesis',
    lead: 'Une bonne anatomie montre autant les frontières de notre connaissance que les organes de la machine.',
    body: `    <p><strong>Établi :</strong> nous pouvons décrire les opérations, inspecter les tenseurs, reproduire une génération et estimer ses coûts sous des hypothèses données. Le modèle prédit des tokens à partir de paramètres appris.</p>
<p><strong>À interpréter avec prudence :</strong> le rôle d’une tête, une direction d’embedding, une lecture intermédiaire. Ces indices peuvent guider des expériences, mais ne remplacent pas des interventions causales.</p>
<p>Pour aller au-delà d’une image, formulez une hypothèse, modifiez une variable et mesurez son effet, puis répétez sur plusieurs cas. Une carte colorée suggère une piste ; une intervention contrôlée fournit une preuve plus directe du rôle de ce que l’on a changé.</p>
<p><strong>Non démontré par ce parcours :</strong> une compréhension humaine, une intention, une conscience ou une garantie de vérité. Ni la fluidité d’une réponse, ni la beauté d’une carte ne suffisent à les établir.</p>`,
    formula: 'observation ≠ interprétation ≠ preuve causale',
    instruction: 'Classez les affirmations. Expliquez votre choix avant de lire la correction.',
    takeaway: 'Un bon modèle mental permet de prévoir, de vérifier et de reconnaître ce qu’on ne sait pas.',
    caveat: 'Les défis sont formatifs et locaux. La progression du viewer indique les pages visitées, pas une certification de compétence.',
    question: 'Quelle affirmation est soutenue par les expériences du parcours ?',
    choices: ['Une carte d’attention révèle toutes les causes d’une réponse', 'On peut reproduire des calculs et des tirages avec des paramètres fixés', 'Un texte sûr de lui est probablement vrai'],
    answer: 1, explanation: 'La reproductibilité porte sur des opérations définies et leurs entrées. Elle ne transforme pas une interprétation en vérité universelle.',
    refs: ['transformer', 'lens'], notes: 'Accroche : établi, interprété, inconnu. Manipulation : classement collectif. Conclusion : revenir au laboratoire avec une nouvelle hypothèse.',
  },
  {
    id: '16b-transformer-explainer', section: 'Tout assembler', title: 'Changer d’échelle.\nTout retrouver.',
    short: 'Transformer Explainer · GPT-2', label: 'Le grand final', experiment: 'transformerExplainer',
    lead: 'Après Luciole, retrouvez le même enchaînement dans le véritable Transformer Explainer, adapté en français pour Playlab42.',
    body: `<p>Cette dernière expérience est une adaptation du projet <strong>Transformer Explainer</strong>, et non une nouvelle vue de Luciole. Elle utilise GPT-2, son propre tokenizer, ses poids et ses activations. Les identifiants et les dimensions de Luciole ne doivent pas être transférés à ce modèle.</p>
<p>Le principe reste familier : découper un prompt, lire les embeddings, faire circuler l’information dans l’attention, transformer les représentations et choisir un token dans la distribution de sortie. Parcourez la vue d’ensemble, puis ouvrez un mécanisme pour retrouver les notions étudiées séparément.</p>
<p><strong>Un repère historique :</strong> GPT-2 date de 2019. Ce final permet d’observer les mécanismes à une autre échelle ; il ne représente pas les capacités des assistants actuels.</p>
<p><strong>Traduire une interface n’est pas entraîner un modèle.</strong> Les commandes et explications sont adaptées en français, mais GPT-2 reste le modèle d’origine, principalement entraîné sur de l’anglais. Commencez avec les prompts anglais proposés ; une suite française peut être moins fiable.</p>
<p>Le modèle est beaucoup plus volumineux que Luciole : son chargement est volontaire et séparé du parcours léger. Le navigateur calcule les prédictions ; les contraintes et ressources nécessaires sont indiquées avant le lancement. Une erreur de chargement n’est jamais remplacée par des résultats inventés.</p>`,
    formula: 'mêmes principes · autre tokenizer · autres poids · autre échelle',
    instruction: 'Ce final est facultatif : prévoyez 657 Mo à charger, plusieurs Go de mémoire et HTTPS ou localhost. Ouvrez le laboratoire dans un nouvel onglet, puis cliquez sur « Charger GPT-2 ». Une fois prêt, masquez les informations ou passez en plein écran. Commencez avec un exemple anglais.',
    takeaway: 'Le modèle change, mais les mécanismes deviennent reconnaissables. L’échelle n’efface ni les limites des données ni celles de l’interprétation.',
    caveat: 'GPT-2 et Luciole sont deux modèles indépendants. Le chargement du final est plus lourd ; ni son interface française ni une génération plausible ne garantissent une réponse correcte.',
    question: 'Traduire Transformer Explainer en français modifie-t-il les poids de GPT-2 ?',
    choices: ['Oui, le modèle apprend la langue des boutons', 'Non, seules l’interface et les explications changent', 'Oui, à chaque nouveau prompt'],
    answer: 1, explanation: 'La langue de l’interface est distincte du corpus et des paramètres appris. GPT-2 reste inchangé ; l’inférence ne le réentraîne pas.',
    refs: ['transformer-explainer', 'gpt2'],
    notes: 'Prévoir le chargement avant une présentation. Relier la vue globale aux étapes précédentes. Ne pas comparer directement les IDs de GPT-2 et ceux de Luciole.',
  },
];

export const chapterTerms = {
  generation: ['token', 'prompt', 'contexte', 'poids', 'mlp', 'eos'],
  modelCard: ['corpus', 'poids', 'perte', 'adam', 'gradient', 'généralisation', 'validation', 'test'],
  tokenizer: ['tokenizer', 'vocabulaire', 'nfc', 'bpe', 'unicode', 'bos', 'eos'],
  tokenizerCases: ['tokenizer', 'wordpiece', 'unigram', 'unicode', 'utf-8'],
  prompt: ['prompt', 'contexte', 'chat template', 'token'],
  numbers: ['vecteur', 'dimension', 'matrice'],
  embeddings: ['embeddings', 'vecteur', 'dimension', 'similarité cosinus'],
  architecture: ['bloc', 'tête', 'q/k/v', 'rmsnorm', 'concaténation', 'résidu', 'mlp', 'relu'],
  rope: ['rope', 'q/k/v', 'produit scalaire', 'dimension'],
  heads: ['tête', 'q/k/v', 'projection', 'produit scalaire', 'masque causal', 'softmax', 'concaténation', 'résidu'],
  attention: ['tête', 'attention', 'q/k/v', 'masque causal', 'softmax', 'poids d’attention'],
  moe: ['mlp', 'moe', 'routeur', 'top-k', 'poids'],
  lens: ['logit lens', 'logits', 'projection', 'rmsnorm', 'softmax'],
  scores: ['logits', 'softmax', 'décodage'],
  sampling: ['logits', 'température', 'top-k', 'top-p', 'min-p', 'graine'],
  effort: ['inférence', 'vérificateur', 'généralisation'],
  memory: ['kv cache', 'prefill', 'décodage', 'q/k/v', 'poids d’attention', 'mha', 'gqa', 'mqa', 'quantification'],
  roofline: ['prefill', 'décodage', 'batch', 'flop', 'bande passante', 'latence'],
  training: ['poids', 'perte', 'nats', 'gradient', 'rétropropagation', 'généralisation', 'validation', 'test'],
  laboratory: ['passage avant', 'bloc', 'tête', 'q/k/v', 'décodage', 'graine'],
  synthesis: ['inférence', 'tête', 'causalité', 'généralisation'],
  transformerExplainer: ['tokenizer', 'embeddings', 'attention', 'logits', 'température', 'inférence'],
};

export const references = {
  cache: { title: 'Hugging Face — Comprendre le cache K/V', url: 'https://huggingface.co/docs/transformers/cache_explanation', note: 'Réutilisation causale, nouvelles requêtes et ajout des K/V couche par couche. Documentation consultée le 14 octobre 2026.' },
  flash: { title: 'FlashAttention — Dao et al., 2022', url: 'https://arxiv.org/abs/2205.14135', note: 'Attention exacte organisée pour réduire les transferts mémoire ; distincte du KV cache.' },
  dpo: { title: 'Direct Preference Optimization — Rafailov et al., 2023', url: 'https://arxiv.org/abs/2305.18290', note: 'Un objectif direct sur des préférences entre réponses, distinct du pipeline RLHF présenté par InstructGPT.' },
  r1: { title: 'DeepSeek-R1 — DeepSeek-AI, 2025', url: 'https://arxiv.org/abs/2501.12948', note: 'Exemple documenté d’entraînement au raisonnement par renforcement ; ne décrit pas le fonctionnement interne de tous les modèles.' },
  v3: { title: 'DeepSeek-V3 Technical Report — DeepSeek-AI, 2024', url: 'https://arxiv.org/abs/2412.19437', note: 'Exemple de MoE : 671 milliards de paramètres totaux, 37 milliards activés par token selon le rapport.' },
  decoding: { title: 'Playlab42 — Code du décodage partagé avec Luciole', url: '../17-sources/code.html#math', note: 'Température, top-k optionnel, min-p, top-p et renormalisation. L’expérience utilise des scores inventés ; le laboratoire utilise les scores de Luciole.' },
  'transformer-explainer': { title: 'Transformer Explainer — Polo Club, Georgia Tech', url: 'https://poloclub.github.io/transformer-explainer/', note: 'Véritable fork adapté en français, licence MIT et provenance conservées. GPT-2 facultatif, chargé après consentement sur HTTPS ou localhost.' },
  transformer: { title: 'Attention Is All You Need — Vaswani et al., 2017', url: 'https://arxiv.org/abs/1706.03762', note: 'Architecture, attention mise à l’échelle, têtes multiples et entraînement.' },
  gpt2: { title: 'Language Models are Unsupervised Multitask Learners — Radford et al., 2019', url: 'https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf', note: 'Modélisation autorégressive et architecture GPT-2.' },
  bpe: { title: 'Neural Machine Translation of Rare Words with Subword Units — Sennrich et al., 2016', url: 'https://arxiv.org/abs/1508.07909', note: 'BPE et sous-mots ; notre démonstration simplifie le pipeline.' },
  tokenization: { title: 'Hugging Face — Tokenizer summary', url: 'https://huggingface.co/docs/transformers/tokenizer_summary', note: 'Différences entre familles de tokenizers.' },
  templates: { title: 'Hugging Face — Chat templates', url: 'https://huggingface.co/docs/transformers/chat_templating', note: 'Sérialisation des conversations et marqueurs de rôle.' },
  rmsnorm: { title: 'Root Mean Square Layer Normalization — Zhang et Sennrich, 2019', url: 'https://arxiv.org/abs/1910.07467', note: 'Principe RMSNorm ; Luciole omet volontairement le gain appris.' },
  rope: { title: 'RoFormer — Su et al., 2021', url: 'https://arxiv.org/abs/2104.09864', note: 'Rotary Position Embedding.' },
  switch: { title: 'Switch Transformers — Fedus et al., 2021', url: 'https://arxiv.org/abs/2101.03961', note: 'Routage et calcul parcimonieux ; ne décrit pas notre routeur synthétique.' },
  lens: { title: 'Eliciting Latent Predictions from Transformers with the Tuned Lens — Belrose et al., 2023', url: 'https://arxiv.org/abs/2303.08112', note: 'Lecture des représentations et limites de la logit lens.' },
  nucleus: { title: 'The Curious Case of Neural Text Degeneration — Holtzman et al., 2019', url: 'https://arxiv.org/abs/1904.09751', note: 'Échantillonnage par noyau top-p.' },
  'test-time': { title: 'Scaling LLM Test-Time Compute Optimally — Snell et al., 2024', url: 'https://arxiv.org/abs/2408.03314', note: 'Budget de calcul à l’inférence ; aucun benchmark repris dans le cours.' },
  gqa: { title: 'GQA: Training Generalized Multi-Query Transformer Models — Ainslie et al., 2023', url: 'https://arxiv.org/abs/2305.13245', note: 'Partage des têtes K/V et compromis de l’attention.' },
  roofline: { title: 'Roofline: An Insightful Visual Performance Model — Williams et al., 2009', url: 'https://doi.org/10.1145/1498765.1498785', note: 'Modèle de performance calcul/bande passante.' },
  instruct: { title: 'Training language models to follow instructions with human feedback — Ouyang et al., 2022', url: 'https://arxiv.org/abs/2203.02155', note: 'Exemple de post-entraînement, pas un pipeline universel.' },
};
