/**
 * Source éditoriale. Le script generate-llm-anatomy.js produit le HTML statique.
 *
 * Gabarit de chaque étape, pour rester lisible par un public néophyte comme averti :
 * - « lead » pose la question de l'étape en une ou deux phrases ;
 * - le corps suit l'ordre intuition → mécanisme → exemple chiffré → « Dans Luciole » ;
 * - les précisions techniques vont dans un volet « Pour les avertis » replié ;
 * - les limites sont regroupées dans « caveat » plutôt que répétées à chaque paragraphe.
 * L'ordre du tableau fixe l'ordre de lecture ; les identifiants restent stables.
 */
export const chapters = [
  {
    id: '01-un-token', section: 'Du texte aux nombres', title: 'Une réponse.\nUn token à la fois.',
    short: 'Suivez ce token', label: 'Le commencement', experiment: 'generation',
    lead: 'Un assistant ne rédige pas sa réponse d’un seul geste. Il prédit un petit morceau de texte, l’ajoute, puis recommence. Tout ce parcours suit ce morceau : le token.',
    body: `<h3>L’idée en une phrase</h3>
<p>Un <strong>LLM</strong> (<em>Large Language Model</em>, grand modèle de langage) répond sans cesse à la même question : <strong>« quel morceau de texte vient ensuite ? »</strong> Ce morceau s’appelle un <dfn>token</dfn> : souvent un mot, parfois un morceau de mot ou un signe de ponctuation. L’image la plus proche est la suggestion de mot du clavier d’un téléphone, avec un modèle beaucoup plus riche qui tient compte de tout le texte précédent.</p>
<h3>La boucle de génération</h3>
<p>On part d’un <dfn>prompt</dfn>, le texte de départ. Le modèle attribue un score à chaque token qu’il connaît, puis une règle de <dfn>décodage</dfn> en choisit un. Ce token est ajouté au texte, qui forme le nouveau <dfn>contexte</dfn>, et tout recommence. La boucle s’arrête quand le modèle choisit un marqueur de fin, noté &lt;eos&gt;, ou quand une limite de longueur est atteinte.</p>
<p><strong>Exemple :</strong> après « le chat », le modèle peut proposer « dort ». Le contexte devient « le chat dort » et le calcul suivant porte sur ce nouveau texte. Une réponse de cent tokens, ce sont donc cent décisions successives, chacune prise sans connaître les suivantes.</p>
<h3>Ce qui change, ce qui ne change pas</h3>
<p>Les <dfn>poids</dfn> sont les nombres réglés pendant l’entraînement : des milliards dans un grand modèle. Ils contiennent tout ce que le modèle a appris et <strong>restent fixes pendant qu’il vous répond</strong>. Seul le contexte grandit. Un modèle ne retient donc pas une conversation en modifiant ses poids : elle fait partie de son entrée à chaque tour.</p>
<h3>Notre instrument : Luciole</h3>
<p>Pour ouvrir la machine, nous utilisons <strong>Luciole</strong>, un mini-modèle entraîné pour ce cours. Ses calculs sont réels et s’exécutent dans votre navigateur ; ses capacités sont celles d’un modèle minuscule. L’étape suivante le présente.</p>
<h3>La carte du voyage</h3>
<ol class="course-map">
<li><strong>Du texte aux nombres :</strong> découper le texte en tokens, puis remplacer chaque token par une liste de nombres.</li>
<li><strong>À l’intérieur du Transformer :</strong> répéter deux gestes. L’<dfn>attention</dfn> fait circuler l’information entre les tokens ; le <dfn>MLP</dfn> (<em>Multi-Layer Perceptron</em>, un petit réseau de neurones) transforme ensuite les nombres de chaque token. Mélanger, puis transformer.</li>
<li><strong>Du calcul à la réponse :</strong> convertir des scores en probabilités, choisir, puis comprendre ce qu’un assistant ajoute autour.</li>
<li><strong>Mémoire, coûts et apprentissage :</strong> ce qu’il faut stocker, ce qui ralentit, d’où viennent les poids.</li>
<li><strong>Tout assembler :</strong> un laboratoire complet, une sonde à l’intérieur, puis un modèle public 3 200 fois plus grand.</li>
</ol>
<p class="anecdote"><strong>Aucun prérequis mathématique.</strong> Vecteurs et matrices sont introduits pas à pas à l’étape 5. Pour découvrir d’abord les réseaux de neurones, voir <a href="../../../../../index.html#/parcours/deep-learning-intro" target="_top">Deep Learning pour l’impatient</a>. Comptez environ 110 minutes, à votre rythme.</p>`,
    formula: 'contexte → scores → choix d’un token → contexte allongé ↻',
    instruction: 'Cliquez sur « + Un token » : Luciole complète « la capitale de la france est ». Cliquez encore pour voir la suite, puis sur « ← Revenir ». Choisissez ensuite « le chat » dans « Prompt d’exemple » et recommencez. Les onglets sous le texte sont facultatifs à ce stade.',
    takeaway: 'Un LLM produit une réponse token par token : à chaque tour, il calcule des scores à partir du contexte, un token est choisi puis ajouté au contexte.',
    caveat: 'Un texte plausible n’est pas forcément vrai : le modèle prédit ce qui est probable dans la continuité de ses données, pas ce qui est exact.',
    question: 'Que reçoit le modèle après avoir généré un token ?',
    choices: ['Uniquement ce nouveau token, sans aucun passé', 'Le contexte enrichi du token choisi', 'De nouveaux poids entraînés sur sa réponse'],
    answer: 1, explanation: 'Le contexte grandit d’un token à chaque tour ; les poids, eux, ne changent pas pendant la génération.',
    refs: ['transformer'], notes: 'Accroche : une réponse, ce sont plusieurs décisions. Manipulation : trois tokens, puis « le chat ». Transition : qu’est-ce qu’un token, concrètement ?',
  },
  {
    id: '01b-luciole', section: 'Du texte aux nombres', title: 'Luciole : petit modèle,\nvrais calculs.',
    short: 'La fiche de Luciole', label: 'Notre instrument, ses limites', experiment: 'modelCard',
    lead: 'Un modèle assez petit pour être ouvert en entier : 38 720 nombres appris, deux blocs, 333 tokens de vocabulaire. Voici ce qu’il sait faire, et ce qu’il ne sait pas faire.',
    body: `<h3>Pourquoi un si petit modèle ?</h3>
<p>Un LLM de production contient des milliards de <dfn>poids</dfn> : impossible d’en afficher les calculs. <strong>Luciole</strong> en a <strong>38 720</strong>. C’est assez pour apprendre quelque chose de réel, et assez peu pour inspecter chaque nombre dans votre navigateur. Le mécanisme est celui des grands modèles ; l’échelle, non.</p>
<h3>Ce qu’il a appris</h3>
<p>Luciole a lu 1 512 phrases courtes : des phrases écrites pour le cours, comme « la capitale de la france est paris . » ou « le chat dort sur le tapis . », et 40 phrases réelles en français, anglais et espagnol issues de Tatoeba, sous licence libre CC0. Cet ensemble de textes s’appelle le <dfn>corpus</dfn>.</p>
<p>Personne n’a écrit de règle du type « si capitale, alors paris ». Les poids, d’abord tirés au hasard, ont été ajustés automatiquement 12 000 fois pour mieux prédire le token suivant de ces phrases. C’est tout ce que « apprendre » veut dire ici.</p>
<h3>Ce qu’il ne sait pas faire</h3>
<p>Il ne connaît que 333 tokens : un mot absent du corpus est refusé. Il n’a jamais appris à converser, à suivre des consignes ni à chercher sur le Web, et il lit au plus 32 tokens à la fois. Ses capacités sont modestes : quand on lui dit « la boîte rouge contient un chat . la boîte bleue contient un chien . » puis qu’on demande ce qu’il y a dans l’une des boîtes, il répond juste dans 41,7 % des cas, moins bien que la règle naïve « citer le dernier animal » (50 %).</p>
<h3>Comment savoir s’il a appris, et pas seulement mémorisé ?</h3>
<p>On met des phrases de côté <em>avant</em> l’entraînement : 264 pour la <dfn>validation</dfn>, qui suit les progrès, et 264 pour le <dfn>test</dfn>, mesuré une seule fois à la fin. Elles combinent des mots connus d’une façon que Luciole n’a jamais vue. Le curseur ci-dessous relit l’historique enregistré de cet entraînement : rien ne s’entraîne dans votre navigateur.</p>
<details><summary>Pour les avertis · architecture, entraînement et code</summary><p>Décodeur causal à 2 blocs pré-normalisés (RMSNorm sans gain appris), 4 têtes de 8 dimensions par bloc, d = 32, positions apprises, MLP ReLU 32 → 64 → 32, sans biais, fenêtre de 32 tokens, tokenizer lexical fermé de 333 entrées. Entraînement : 12 000 mises à jour Adam, clipping élémentaire ±1, taux 0,0025 → 0,00025, graine 42, entropie croisée en nats/token, sans sélection de checkpoint.</p><p>Le code se lit dans <a href="../17-sources/code.html#model" target="_blank" rel="noopener noreferrer">la lecture du code intégrée à Playlab42 ↗</a>. Dans <code>model.js</code>, <code>tokenize</code> transforme le texte en IDs, <code>loadWeights</code> charge les nombres appris et <code>forward</code> calcule les scores. Les opérations sont dans <code>tensor.js</code>, le choix du prochain token dans <code>math.js</code>.</p></details>`,
    formula: 'phrases → prédictions → erreur → ajustement des poids, avant publication · puis poids figés pour générer',
    instruction: 'Déplacez le curseur de l’historique et observez la prédiction de l’exemple suivi s’améliorer. Explorez ensuite les résultats du test, échecs compris. Ce sont des mesures enregistrées : rien n’est entraîné dans votre navigateur.',
    takeaway: 'Luciole apprend réellement, mais sur un corpus minuscule : il montre le mécanisme d’un LLM, pas ses capacités.',
    caveat: 'Les tests portent sur deux tâches synthétiques, pas sur une compréhension générale. Sur les boîtes, Luciole fait moins bien qu’une règle naïve (41,7 % contre 50 %). Trois langues dans le corpus ne font pas un modèle multilingue.',
    question: 'Qu’est-ce qui a été écrit à la main, plutôt qu’appris par l’entraînement ?',
    choices: ['Les réponses, sous forme de règles if/else', 'Les modèles de phrases du corpus synthétique', 'Chaque valeur des 38 720 paramètres'],
    answer: 1, explanation: 'Les phrases d’exemple ont été préparées pour le cours. Les paramètres, eux, ont été ajustés numériquement ; aucune règle de réponse n’est exécutée quand Luciole génère.',
    refs: ['transformer', 'rmsnorm'], notes: 'Ouvrir le corpus. Insister sur trois choses distinctes : ce qui est écrit (les phrases), ce qui est appris (les poids), ce qui est mesuré (le test). Transition : comment le texte devient-il des tokens ?',
  },
  {
    id: '02-tokenisation', section: 'Du texte aux nombres', title: 'Les mots ne sont\npas les tokens.',
    short: 'La tokenisation', label: 'Le découpage', experiment: 'tokenizer',
    lead: 'Un modèle ne lit pas des lettres ni des mots : il lit des numéros. Le tokenizer découpe le texte en morceaux connus et remplace chacun par son numéro.',
    body: `<h3>L’idée</h3>
<p>Un réseau de neurones ne calcule qu’avec des nombres. Le <dfn>tokenizer</dfn> est l’étape qui fait le pont : il découpe le texte en morceaux, puis remplace chaque morceau par son numéro dans une liste fixe, le <dfn>vocabulaire</dfn>. « le chat dort » peut ainsi devenir une liste comme [12, 47, 103].</p>
<h3>Pourquoi des morceaux de mots ?</h3>
<p>Un vocabulaire de mots entiers devrait contenir toutes les conjugaisons, tous les noms propres, toutes les fautes de frappe : il serait gigantesque et rencontrerait sans cesse des mots inconnus. Un vocabulaire de lettres serait minuscule, mais les textes deviendraient très longs. Les tokenizers modernes choisissent le milieu : les mots fréquents restent entiers, les mots rares sont découpés en <strong>sous-mots</strong>. « anticonstitutionnellement » peut ainsi devenir quatre ou cinq morceaux.</p>
<p>La méthode la plus répandue, le <dfn>BPE</dfn> (<em>Byte Pair Encoding</em>), construit ce vocabulaire <strong>une fois pour toutes</strong>, avant l’entraînement du modèle : elle part des caractères et fusionne pas à pas les paires les plus fréquentes du corpus. Le curseur de l’expérience rejoue ces fusions sur les phrases du cours. Ensuite, le tokenizer applique ses règles figées, sans plus rien apprendre.</p>
<h3>Dans Luciole</h3>
<p>Luciole utilise un tokenizer volontairement simple : il met le texte en minuscules, garde les mots entiers, isole chaque signe de ponctuation et ignore les espaces. Son vocabulaire de 333 entrées ne contient que les mots de son corpus ; tout autre mot est refusé. Deux marqueurs spéciaux complètent la liste : &lt;bos&gt; ouvre la séquence, &lt;eos&gt; la termine.</p>
<p><strong>Attention au piège :</strong> un numéro n’est qu’une adresse dans le vocabulaire. Le token 42 n’est pas « deux fois plus » que le token 21, et le même numéro désigne des morceaux différents d’un tokenizer à l’autre.</p>
<p class="anecdote"><strong>Un détour historique :</strong> en 2016, Sennrich et ses collègues ont popularisé les sous-mots BPE pour traduire des mots rares. L’idée venait d’un algorithme de compression de données de 1994.</p>
<details><summary>Pour les avertis · ce que fait vraiment un tokenizer</summary><p>Un tokenizer complet enchaîne normalisation (Unicode <dfn>NFC</dfn>, casse, accents), pré-tokenisation (espaces, ponctuation, chiffres), application du modèle de sous-mots et ajout éventuel de tokens spéciaux. Le tokenizer de Luciole applique NFC et la mise en minuscules, conserve les accents et regroupe lettres et chiffres contigus ; la reconstruction ne restitue ni la casse ni les espaces. GPT-2 applique le BPE sur des octets, ce qui lui évite tout token inconnu.</p></details>`,
    formula: 'texte → morceaux du vocabulaire → numéros (IDs)',
    instruction: 'Commencez par « le chat dort » avec Luciole, puis comparez les tokenizers publics sur une phrase française, une phrase anglaise et un emoji. Déplacez enfin le curseur des fusions BPE pour voir des sous-mots se former.',
    takeaway: 'Le nombre de tokens dépend du texte et du tokenizer. Un mot peut valoir un token, plusieurs, ou être refusé.',
    caveat: 'Les tokenizers publics comptent ici le seul texte saisi, sans les marqueurs qu’un service de chat ajoute. Le BPE du curseur est appris sur les phrases du cours : c’est une démonstration, pas le vocabulaire d’un modèle réel.',
    question: 'Peut-on déduire le nombre de tokens à partir du seul nombre de mots ?',
    choices: ['Oui, un mot est toujours un token', 'Non, il faut connaître le tokenizer', 'Oui, il suffit de compter les espaces'],
    answer: 1, explanation: 'Le vocabulaire, les fusions apprises et la normalisation déterminent le découpage. Le même texte donne des comptes différents selon le tokenizer.',
    refs: ['bpe', 'tokenization'], notes: 'Accroche : un mot ne vaut pas un token. Manipulation : FR, EN, emoji, puis fusions BPE. Transition : et sur des textes du quotidien ?',
  },
  {
    id: '02b-cas-reels', section: 'Du texte aux nombres', title: 'Du code, du français.\nDes comptes différents.',
    short: 'Cas réels de tokenisation', label: 'Des entrées du quotidien', experiment: 'tokenizerCases',
    lead: 'Une demande au support, une fonction JavaScript, un message JSON : comparons quatre vrais tokenizers sur des textes que l’on envoie vraiment.',
    body: `<h3>Pourquoi c’est important</h3>
<p>Le nombre de tokens détermine la place occupée dans le contexte, souvent le prix d’un appel et une partie du temps de calcul. Or ce nombre dépend du tokenizer : un même texte peut coûter deux fois plus de tokens avec l’un qu’avec l’autre, notamment pour une langue ou un format peu présents dans les données qui ont servi à construire son vocabulaire.</p>
<h3>Quatre façons de découper</h3>
<p>L’expérience charge les définitions publiques originales de trois tokenizers connus, à côté de celui de Luciole :</p>
<ul>
<li><strong>GPT-2</strong> (BPE sur octets) : tout texte est découpable, emojis compris. Le symbole Ġ affiché dans les morceaux signale une espace devant le mot.</li>
<li><strong>BERT uncased</strong> (<dfn>WordPiece</dfn>) : met tout en minuscules et retire les accents. Le préfixe ## signale la suite d’un mot.</li>
<li><strong>T5 small</strong> (<dfn>Unigram</dfn>) : le symbole ▁ marque le début d’un mot.</li>
<li><strong>Luciole</strong> : mots entiers de son corpus, sinon refus.</li>
</ul>
<h3>Découper n’est pas toujours réversible</h3>
<p>Avec BERT uncased, « ÉTÉ » revient sous la forme « ete » : la casse et les accents ont été perdus <em>avant</em> le découpage. C’est la normalisation, une étape du tokenizer. L’expérience affiche le texte reconstruit pour rendre ces pertes visibles.</p>
<p>Aucun de ces modèles n’est exécuté ici : on ne charge que leurs tokenizers. <strong>Tokeniser n’est pas générer.</strong></p>
<details><summary>Pour les avertis · ce que ces comptes n’incluent pas</summary><p>Les comptes portent sur le texte saisi, sans tokens spéciaux ajoutés automatiquement. Le coût réel d’un appel inclut aussi le chat template, les descriptions d’outils et la sortie générée. Un compte plus faible ne signifie pas qu’un modèle « comprend mieux » un texte : il traduit surtout la composition des données utilisées pour construire le vocabulaire. Pour mesurer un vrai service, il faut son propre tokenizer.</p></details>`,
    formula: 'même texte + vocabulaire différent → morceaux, numéros et comptes différents',
    instruction: 'Choisissez « Comparer les quatre tokenizers », puis un exemple de texte. Modifiez un accent, une espace ou un nom de variable : comparez les découpages, les comptes et le texte reconstruit.',
    takeaway: 'Le tokenizer fait partie du modèle : son vocabulaire et ses numéros ne sont pas interchangeables d’un modèle à l’autre.',
    caveat: 'GPT-2, BERT et T5 sont des tokenizers publics et documentés, pas ceux des assistants actuels. Seuls leurs tokenizers sont chargés ; aucun de ces modèles n’est exécuté.',
    question: 'Pourquoi « ÉTÉ » peut-il être reconstruit en « ete » avec BERT uncased ?',
    choices: ['Le modèle a traduit le texte', 'Le tokenizer normalise la casse et les accents', 'Les poids ont été réentraînés'],
    answer: 1, explanation: 'La normalisation fait partie de la tokenisation : l’information perdue à cette étape n’atteint jamais le modèle.',
    refs: ['tokenization'], notes: 'Manipulation : support, code et JSON. Comparer les découpages, puis les reconstructions. Transition : un token est un numéro ; comment en faire des nombres utiles ?',
  },
  {
    id: '03b-nombres', section: 'Du texte aux nombres', title: 'Un nombre.\nUne liste. Un tableau.',
    short: 'Lire vecteurs et matrices', label: 'Les repères avant les calculs', experiment: 'numbers',
    lead: 'Tout ce qui suit manipule trois objets simples : une liste de nombres, un tableau de listes, et une façon de transformer une liste en une autre.',
    body: `<h3>Une liste de nombres : le vecteur</h3>
<p>Un <dfn>vecteur</dfn> est une liste ordonnée de nombres, par exemple [0,4 ; −0,2 ; 0,8]. Chaque case est une coordonnée ; le nombre de cases est sa <dfn>dimension</dfn>, ici 3. Dans un LLM, chaque token est représenté par un vecteur : 32 nombres dans Luciole, plusieurs milliers dans un grand modèle.</p>
<p>Une analogie utile : une fiche de description. Les cases d’une fiche « couleur, taille, poids » décrivent un objet ; les cases d’un vecteur de token décrivent ce token. La différence est que <strong>personne n’a nommé les cases</strong> : leur rôle émerge de l’entraînement et n’a, en général, pas de sens humain simple.</p>
<h3>Un tableau de listes : la matrice</h3>
<p>Une <dfn>matrice</dfn> range plusieurs vecteurs en lignes. Pour une phrase de 3 tokens décrits par 3 nombres chacun, on obtient un tableau 3 × 3. Dans Luciole, pour n tokens, la forme est <strong>n × 32</strong> : une ligne par token, une colonne par coordonnée. La forme indique la taille des données, pas leur signification.</p>
<h3>Transformer une liste : la somme pondérée</h3>
<p>L’opération de base d’un réseau de neurones consiste à fabriquer un nouveau nombre en multipliant chaque coordonnée par un coefficient, puis en additionnant. Avec les coordonnées [2 ; 3] et les coefficients [0,4 ; −0,2] : 2 × 0,4 + 3 × (−0,2) = 0,2. Répéter ce calcul avec d’autres coefficients donne les autres coordonnées de sortie. Ranger tous ces coefficients dans une matrice, c’est faire une <strong>multiplication par une matrice</strong>, aussi appelée <dfn>projection</dfn>. Les coefficients sont les fameux poids appris.</p>
<p>Le tableau de l’expérience est inventé pour apprendre à lire la notation. Les vrais vecteurs de Luciole arrivent à l’étape suivante.</p>`,
    formula: 'vecteur = une liste · matrice n × d = n listes de d nombres · projection = sommes pondérées',
    instruction: 'Choisissez un token dans « Token observé », puis changez une de ses coordonnées. Retrouvez cette valeur dans le vecteur, dans la ligne du tableau et dans le graphique.',
    takeaway: 'Une ligne de la matrice décrit un token ; sa forme n × d donne le nombre de tokens et de coordonnées. Une projection fabrique de nouvelles coordonnées par sommes pondérées.',
    caveat: 'Les trois nombres par token de cette étape sont inventés pour apprendre la notation. Une valeur négative n’est pas « mauvaise » et une grande valeur n’est pas forcément importante.',
    question: 'Que signifie « 9 × 32 » pour les représentations de notre séquence ?',
    choices: ['9 tokens possédant chacun 32 nombres', '9 probabilités dont la somme vaut 32', '32 réponses de 9 mots'],
    answer: 0, explanation: 'Chaque ligne correspond à un token, chaque colonne à une coordonnée.',
    refs: ['transformer'], notes: 'Faire lire une ligne avant de parler d’espace. Faire calculer la somme pondérée à voix haute. Transition : d’où viennent les 32 nombres d’un vrai token ?',
  },
  {
    id: '04-embeddings', section: 'Du texte aux nombres', title: 'Un identifiant entre.\nUn vecteur apparaît.',
    short: 'Les embeddings', label: 'L’espace des représentations', experiment: 'embeddings',
    lead: 'Un numéro de token ne dit rien du mot. Le modèle le remplace donc par une liste de nombres apprise, son embedding, où des tokens employés de façon similaire finissent par se ressembler.',
    body: `<h3>L’idée : une grande table de correspondance</h3>
<p>La table d’<dfn>embeddings</dfn> est une matrice qui contient une ligne par token du vocabulaire. Pour le token numéro 47, le modèle lit simplement la ligne 47 : 32 nombres dans Luciole, souvent plusieurs milliers dans un grand modèle. Aucun calcul, aucun dictionnaire : une lecture de ligne.</p>
<h3>D’où viennent ces nombres ?</h3>
<p>Au départ, ils sont tirés au hasard. Pendant l’entraînement, ils sont ajustés comme tous les autres poids, pour aider à prédire le token suivant. Résultat : des tokens qui apparaissent dans des contextes semblables, comme « paris » et « berne » après « la capitale de … est », tendent à recevoir des vecteurs proches. Personne ne l’a imposé : c’est un effet de l’objectif d’apprentissage.</p>
<h3>Mesurer une ressemblance</h3>
<p>Pour comparer deux vecteurs, on utilise souvent la <dfn>similarité cosinus</dfn> : 1 si les deux listes pointent dans la même direction, 0 si elles sont sans rapport, −1 si elles sont opposées. Elle se calcule sur les 32 coordonnées. L’atlas 3D n’en montre que trois à la fois : deux points proches à l’écran peuvent être éloignés dans l’espace complet.</p>
<h3>Le même mot, trois moments</h3>
<p>Dans Luciole, un token traverse trois états. <strong>1.</strong> Son embedding, toujours identique pour le même token. <strong>2.</strong> Cet embedding plus un vecteur de position, qui indique où il se trouve dans la phrase. <strong>3.</strong> Après les blocs du Transformer, une représentation <strong>contextualisée</strong>, enrichie par les tokens voisins. « chat » part du même vecteur dans toutes les phrases, mais n’en sort pas avec le même.</p>
<details><summary>Pour les avertis · notation et limites de lecture</summary><p>E ∈ ℝ<sup>v×d</sup>, avec v tokens dans le vocabulaire et d coordonnées par token. L’embedding du token i est la ligne i de E, ce qui équivaut à multiplier un vecteur « one-hot » par E. Les coordonnées ne sont pas des concepts nommés : l’information est distribuée entre de nombreuses directions. Les axes de l’atlas sont trois coordonnées brutes, pas une PCA.</p></details>`,
    formula: 'ID du token → ligne de la table apprise → 32 nombres dans Luciole',
    instruction: 'Comparez « paris » et « france », puis choisissez d’autres tokens. Changez les coordonnées affichées sur les axes X, Y et Z et tournez la vue : le dessin change, mais la similarité calculée sur les 32 nombres reste la même.',
    takeaway: 'Un embedding est une représentation apprise : une ligne de table, ajustée pendant l’entraînement, pas un dictionnaire de concepts lisibles case par case.',
    caveat: 'Les voisins affichés sont ceux d’un corpus minuscule. Une vue en trois coordonnées sur trente-deux peut rapprocher des points éloignés : n’en déduisez pas une carte universelle du sens.',
    question: 'Une coordonnée d’embedding signifie-t-elle nécessairement « masculin », « ville » ou « positif » ?',
    choices: ['Oui, les coordonnées ont des noms universels', 'Non, l’information est généralement distribuée entre de nombreuses coordonnées', 'Oui, si la valeur est positive'],
    answer: 1, explanation: 'Personne ne nomme les coordonnées ; leur rôle émerge de l’entraînement et se répartit sur de nombreuses directions. L’interpréter demande des expériences dédiées.',
    refs: ['transformer'], notes: 'Accroche : un mot devient une ligne. Manipulation : paris, france, puis berne. Transition : comment ces lignes se parlent-elles ?',
  },
  {
    id: '05-transformer', section: 'À l’intérieur du Transformer', title: 'Une architecture.\nDes blocs répétés.',
    short: 'La carte du modèle', label: 'L’anatomie', experiment: 'architecture',
    lead: 'Un Transformer empile des blocs identiques dans leur forme. Chaque bloc fait deux gestes : laisser les tokens échanger de l’information, puis retravailler chaque token séparément.',
    body: `<h3>Pourquoi deux gestes ?</h3>
<p>Après l’étape des embeddings, chaque token est décrit par ses 32 nombres, mais il ne sait rien de ses voisins : « chat » a le même vecteur dans « le chat dort » et dans « le chat noir ». Il faut donc <strong>faire circuler l’information entre les tokens</strong>. C’est le rôle de l’<dfn>attention</dfn>. Ensuite, chaque token doit <strong>exploiter</strong> ce qu’il a reçu : c’est le rôle du <dfn>MLP</dfn>, qui retravaille chaque vecteur séparément, avec les mêmes poids pour tous les tokens.</p>
<p>Une image : une réunion. Pendant l’attention, chacun écoute les autres et prend des notes ; pendant le MLP, chacun relit ses notes seul et les met au propre. Puis la réunion recommence au bloc suivant, avec des notes plus riches.</p>
<h3>Deux pièces qui stabilisent l’ensemble</h3>
<p>La <strong>connexion résiduelle</strong> ajoute le résultat de chaque geste au vecteur d’entrée, au lieu de le remplacer : le token conserve ce qu’il savait et y ajoute du nouveau. On parle souvent de « flux résiduel » : un vecteur par token, que chaque sous-bloc lit puis enrichit. La <dfn>normalisation</dfn> remet les nombres à une échelle comparable avant chaque geste, pour que les calculs restent stables.</p>
<h3>Dans Luciole</h3>
<p>Deux blocs se suivent. Chacun contient une attention à quatre têtes et un MLP qui passe de 32 à 64 nombres, puis revient à 32. À la sortie, une dernière projection convertit le vecteur du dernier token en un score pour chacun des 333 tokens du vocabulaire. Les grands modèles répètent le même schéma des dizaines de fois, avec des vecteurs bien plus longs.</p>
<p class="anecdote"><strong>2017 : une machine à traduire.</strong> L’article fondateur du Transformer décrivait un encodeur et un décodeur pour la traduction. Les LLM actuels utilisent surtout la moitié « décodeur », qui prédit le token suivant.</p>
<details><summary>Pour les avertis · l’ordre exact des opérations</summary><p>Luciole est pré-normalisé : x ← x + Attention(RMSNorm(x)), puis x ← x + MLP(RMSNorm(x)), avec RMSNorm sans gain appris et ReLU entre les deux projections du MLP. La sortie applique RMSNorm puis la matrice de sortie. Les résidus offrent aussi un chemin direct aux gradients pendant l’entraînement. Les modèles récents varient : SwiGLU au lieu de ReLU, RoPE au lieu de positions apprises, MoE au lieu d’un MLP dense, voire couches non-attentionnelles dans les architectures hybrides.</p></details>`,
    formula: 'embeddings + positions → [ attention (mélanger) → MLP (transformer) ] × 2 → scores',
    instruction: 'Cliquez sur chaque étape de la carte, dans l’ordre. « n × 32 » signifie : n tokens, chacun décrit par 32 nombres. Repérez l’étape qui mélange les tokens et celle qui les transforme un par un.',
    takeaway: 'L’attention fait échanger les tokens, le MLP retravaille chaque token, les résidus conservent l’acquis et la normalisation stabilise l’échelle.',
    caveat: 'L’image de la réunion est une métaphore : il n’y a ni intention ni prise de notes, seulement des sommes pondérées. Tous les LLM ne suivent pas exactement ce plan.',
    question: 'Quelle opération mélange directement les informations de plusieurs positions ?',
    choices: ['Le MLP', 'L’attention', 'La lecture d’un embedding'],
    answer: 1, explanation: 'L’attention combine les informations de plusieurs positions. Le MLP agit séparément sur chaque ligne.',
    refs: ['transformer', 'rmsnorm'], notes: 'Accroche : une carte avant la visite. Faire distinguer attention et MLP avec la métaphore de la réunion, puis la nuancer. Transition : comment calcule-t-on un mélange ?',
  },
  {
    id: '06b-tetes', section: 'À l’intérieur du Transformer', title: 'Une tête.\nUn mélange de nombres.',
    short: 'Une tête pas à pas', label: 'Avant la matrice d’attention', experiment: 'heads',
    lead: 'Comment un token décide-t-il quels voisins écouter ? Chaque token pose une question, affiche une étiquette et propose un contenu : Q, K et V.',
    body: `<h3>Le problème à résoudre</h3>
<p>Dans « le chat dort », la position « chat » voudrait récupérer de l’information utile chez les tokens précédents. Mais lesquels, et dans quelle proportion ? L’attention répond par un calcul en quatre temps, réalisé par une <dfn>tête</dfn> d’attention.</p>
<h3>Q, K, V : une question, une étiquette, un contenu</h3>
<p>Chaque token fabrique trois vecteurs à partir du sien, par trois projections apprises :</p>
<ul>
<li><strong>Q</strong> (<em>query</em>, requête) : ce que ce token cherche ;</li>
<li><strong>K</strong> (<em>key</em>, clé) : l’étiquette qu’il présente aux autres ;</li>
<li><strong>V</strong> (<em>value</em>, valeur) : le contenu qu’il transmettra s’il est écouté.</li>
</ul>
<p>Pensez à une bibliothèque : votre question (Q) est comparée aux étiquettes des livres (K), et vous repartez avec un mélange de leurs contenus (V), surtout de ceux dont l’étiquette correspond le mieux. <strong>Q et K décident des proportions ; V fournit ce que l’on mélange.</strong> Ces rôles ne sont pas programmés : ils émergent parce que les trois projections ont été entraînées ensemble.</p>
<h3>Le calcul, pour la position « chat »</h3>
<ol>
<li><strong>Comparer :</strong> le Q de « chat » est comparé au K de chaque position par un <dfn>produit scalaire</dfn> (multiplier les coordonnées deux à deux, puis additionner). Plus le résultat est grand, plus l’étiquette correspond.</li>
<li><strong>Interdire le futur :</strong> le <dfn>masque causal</dfn> retire « dort », qui vient après « chat ». Un token ne peut consulter que lui-même et ce qui le précède.</li>
<li><strong>Convertir en proportions :</strong> <dfn>softmax</dfn> transforme les scores restants en parts positives qui totalisent 100 %.</li>
<li><strong>Mélanger :</strong> on additionne les V, chacun multiplié par sa part. Le résultat est un nouveau vecteur pour « chat », enrichi par son contexte.</li>
</ol>
<h3>Plusieurs têtes en parallèle</h3>
<p>Une seule tête produit un seul mélange. Le modèle en utilise plusieurs, chacune avec ses propres projections, donc ses propres critères de comparaison. Dans Luciole, chaque bloc a quatre têtes de 8 coordonnées. Leurs résultats sont mis bout à bout (4 × 8 = 32), puis une dernière projection les combine.</p>
<p>Les schémas ci-dessous utilisent les nombres <strong>inventés</strong> du « Petit exemple inventé » de l’expérience. Le mode « Vraie trace Luciole » montre ensuite les vrais calculs du modèle, où &lt;bos&gt; fait aussi partie des positions consultables.</p>
<details><summary>Pour les avertis · mise à l’échelle et paramètres</summary><p>Les scores sont divisés par √d<sub>k</sub> (ici √8) avant softmax : sans cela, le produit scalaire grandit avec la dimension et softmax deviendrait presque toujours tranchant. W<sub>Q</sub>, W<sub>K</sub>, W<sub>V</sub> et la projection de sortie W<sub>O</sub> sont des paramètres fixes à l’inférence ; Q, K, V et les poids d’attention dépendent du texte. Séparer K et V permet de comparer sur certaines coordonnées tout en transportant un contenu différent.</p></details>`,
    formula: 'Q·K → scores → masque → softmax → somme des V pondérés → têtes réunies → projection',
    instruction: 'Gardez « chat » dans « Token qui consulte les autres » et avancez avec « Étape suivante ». Changez sa première coordonnée et observez les proportions bouger. À l’étape du masque, vérifiez que « dort » est interdit. Choisissez enfin « Vraie trace Luciole » dans « Calcul observé ».',
    takeaway: 'Une tête compare les requêtes aux clés pour obtenir des proportions, puis mélange les valeurs. Plusieurs têtes réalisent plusieurs mélanges en parallèle.',
    caveat: 'Le petit exemple est inventé ; la vraie trace lit les calculs de Luciole sans modifier ses poids. L’image de la bibliothèque aide à retenir les rôles, mais aucune tête n’a de rôle humain garanti.',
    question: 'À la position « chat » dans « le chat dort », quels V peuvent contribuer au mélange ?',
    choices: ['Seulement le V de « dort », pour trouver la réponse', 'Les V de « le » et de « chat », mais pas celui de « dort »', 'Tous les V dont le score est positif'],
    answer: 1, explanation: 'Le masque interdit le futur avant softmax. Dans la vraie trace de Luciole, le V de <bos> est aussi autorisé. Le mélange produit un vecteur, pas encore un prochain token.',
    refs: ['transformer'], notes: 'Faire raconter Q/K/V avec la bibliothèque, puis lire le calcul [0,5 ; 1]. Montrer le futur interdit avant de passer à la vraie trace. Transition : voyons toutes les lignes à la fois.',
  },
  {
    id: '07-attention', section: 'À l’intérieur du Transformer', title: 'Chaque token\ninterroge son passé.',
    short: 'L’attention causale', label: 'La circulation', experiment: 'attention',
    lead: 'L’étape précédente suivait un seul token. Ici, on regarde tous les tokens à la fois, sous forme de grille : qui écoute qui, et dans quelle proportion.',
    body: `<h3>Lire la grille</h3>
<p>Chaque <strong>ligne</strong> est un token qui consulte ; chaque <strong>colonne</strong>, un token consulté. La case à l’intersection donne la part du V de la colonne dans le mélange de la ligne : ce sont les <dfn>poids d’attention</dfn>. Chaque ligne totalise 100 %, puisque c’est un partage ; les colonnes n’ont pas cette contrainte.</p>
<h3>Pourquoi un triangle ?</h3>
<p>Les cases au-dessus de la diagonale sont vides : c’est le <dfn>masque causal</dfn>. Un token ne voit que lui-même et ce qui le précède. La raison vient de l’entraînement : le modèle apprend à prédire le token suivant, il ne doit donc pas pouvoir le lire. Grâce à ce masque, une seule phrase fournit autant d’exercices que de positions, tous calculés en parallèle.</p>
<p><strong>Et la diagonale ?</strong> Elle est autorisée. La position « chat » sert à prédire ce qui vient <em>après</em> « chat » ; se consulter elle-même ne révèle donc rien du futur.</p>
<h3>Ce que montre l’expérience</h3>
<p>La grille affiche les vrais poids d’attention de Luciole. Changez de tête : même texte, autre mélange, car chaque tête a ses propres projections. Changez de bloc : le bloc 2 travaille sur des vecteurs déjà enrichis par le bloc 1. Si une tête place une grande part de son attention sur &lt;bos&gt;, ce n’est pas un défaut : dans les grands modèles aussi, le premier token sert souvent de « point de repos » quand aucun autre n’apporte d’information utile.</p>
<details><summary>Pour les avertis · la formule complète</summary><p>Attention(Q, K, V) = softmax(QK<sup>ᵀ</sup> / √d<sub>k</sub> + M) V, où M vaut −∞ au-dessus de la diagonale et 0 ailleurs ; d<sub>k</sub> = 8 dans Luciole. Le produit scalaire dépend des directions et des longueurs des vecteurs. Un poids élevé indique où l’information a été lue, pas qu’elle a causé la prédiction finale : la valeur V lue peut être petite, et la suite du réseau peut l’ignorer.</p></details>`,
    formula: 'ligne = token qui consulte · colonne = token consulté · case vide = futur interdit',
    instruction: 'Placez « Position requête » sur 0, puis avancez ligne par ligne : chaque token voit un peu plus de passé. Observez la dernière ligne, puis changez de tête et de bloc. Essayez aussi le contexte « le chat ».',
    takeaway: 'L’attention est un mélange pondéré : chaque ligne répartit 100 % entre le token lui-même et ses prédécesseurs, jamais ses successeurs.',
    caveat: '« Causal » désigne ici le masque du futur, pas une relation de cause à effet. Une case intense ne prouve pas, à elle seule, qu’un token a causé la réponse finale.',
    question: 'Pourquoi les cases au-dessus de la diagonale sont-elles masquées ?',
    choices: ['Pour économiser les couleurs', 'Pour empêcher de lire le token que l’on doit prédire', 'Parce que les tokens futurs valent zéro'],
    answer: 1, explanation: 'À l’entraînement, la cible de chaque position est le token suivant : elle ne doit pas être visible dans l’entrée qui sert à la prédire.',
    refs: ['transformer'], notes: 'Accroche : le futur est fermé. Manipulation : première ligne, dernière ligne, autre tête. Transition : le masque connaît l’ordre, mais comment le modèle sait-il où se trouve chaque token ?',
  },
  {
    id: '06-position', section: 'À l’intérieur du Transformer', title: 'L’ordre fait\nla différence.',
    short: 'Position et RoPE', label: 'La géométrie de l’ordre', experiment: 'rope',
    lead: '« Le chien mord le chat » et « le chat mord le chien » contiennent les mêmes tokens. Sans information de position, l’attention aurait bien du mal à les distinguer.',
    body: `<h3>Le problème</h3>
<p>Le produit scalaire entre Q et K ne dépend que du contenu des vecteurs, pas de leur place. Sans information de position, « mord » comparerait « chien » de la même façon, que ce mot soit juste avant lui ou cinq tokens plus tôt. Le masque causal donne un indice indirect, puisque chaque token voit un passé de longueur différente, mais presque tous les modèles injectent la position explicitement dans les nombres.</p>
<h3>Solution 1 : ajouter un vecteur de position (Luciole)</h3>
<p>Luciole possède une seconde table apprise, avec une ligne par position de 0 à 31. Avant les blocs, il <strong>additionne</strong> l’embedding du token et le vecteur de sa position. « chat » en position 2 et « chat » en position 4 entrent donc avec des vecteurs différents. C’est la méthode des premiers GPT. Sa limite : le modèle ne connaît que les positions vues à l’entraînement.</p>
<h3>Solution 2 : tourner Q et K (RoPE)</h3>
<p>La plupart des LLM ouverts récents utilisent <dfn>RoPE</dfn> (<em>Rotary Position Embedding</em>). L’idée : regrouper les coordonnées de Q et de K par paires, voir chaque paire comme une flèche, et la <strong>faire tourner d’un angle proportionnel à la position</strong>. Quand on compare deux flèches tournées, seul compte l’écart d’angle entre elles, donc l’<strong>écart de position</strong> entre les deux tokens. Le score dépend ainsi de la distance relative, « trois tokens plus tôt », plutôt que de la position absolue.</p>
<p>Le cadran de l’expérience illustre cette propriété sur une seule paire de nombres inventés. <strong>Luciole n’utilise pas RoPE</strong> : c’est une variante présentée pour comprendre les modèles actuels.</p>
<details><summary>Pour les avertis · la propriété en une ligne</summary><p>Pour une paire de coordonnées, ⟨R(m)q, R(n)k⟩ = ⟨q, R(n − m)k⟩ : le score ne dépend que de n − m. RoPE applique plusieurs fréquences de rotation selon les paires, pour représenter des distances courtes et longues. Il ne garantit pas une utilisation fiable de contextes plus longs que ceux de l’entraînement : des techniques d’extension existent, avec leurs propres limites.</p></details>`,
    formula: 'Luciole : embedding + vecteur de position appris · RoPE : rotation de Q et K selon la position',
    instruction: 'Déplacez « Position m » : les deux flèches tournent ensemble et le score ne change pas. Modifiez ensuite « Écart n − m » : le score varie. Ce cadran illustre RoPE, pas Luciole.',
    takeaway: 'Sans information de position, l’attention distingue mal l’ordre des mots. Luciole ajoute des positions apprises ; RoPE fait dépendre le score de la distance entre tokens.',
    caveat: 'Le cadran ne montre qu’une paire de coordonnées inventée. Dans un modèle complet, déplacer un texte change aussi son contexte : le score d’une paire peut rester stable sans que toute la sortie le soit.',
    question: 'Comment Luciole représente-t-il la position avant ses blocs ?',
    choices: ['En ajoutant un vecteur de position appris', 'En faisant tourner Q et K avec RoPE', 'En réentraînant les poids à chaque token'],
    answer: 0, explanation: 'Luciole additionne un vecteur de position appris à chaque embedding. Le cadran explore RoPE, une variante utilisée par de nombreux modèles récents.',
    refs: ['rope', 'transformer'], notes: 'Partir de « le chien mord le chat ». Distinguer position apprise (Luciole) et RoPE (illustré). Transition : après l’attention, que fait le MLP ?',
  },
  {
    id: '08-experts', section: 'À l’intérieur du Transformer', title: 'Beaucoup d’experts.\nPeu au travail.',
    short: 'MLP et MoE', label: 'La transformation', experiment: 'moe',
    lead: 'Après l’attention vient le MLP, qui contient la majorité des poids d’un modèle. Les grands modèles récents le découpent souvent en « experts », dont seuls quelques-uns travaillent pour chaque token.',
    body: `<h3>Le MLP : retravailler chaque token</h3>
<p>L’attention a rassemblé de l’information de contexte dans le vecteur de chaque token. Le <dfn>MLP</dfn> la transforme ensuite, <strong>token par token</strong>, sans regarder les voisins. Il agrandit d’abord le vecteur (32 → 64 nombres dans Luciole), applique une fonction non linéaire, <dfn>ReLU</dfn>, qui remplace les nombres négatifs par zéro, puis revient à la taille d’origine (64 → 32).</p>
<p><strong>À quoi ça sert ?</strong> Sans cette étape non linéaire, empiler des projections reviendrait à une seule grande projection. Le MLP permet des combinaisons du type « si telle configuration est présente, ajouter telle information ». Des travaux d’interprétabilité suggèrent qu’une bonne part des associations apprises, comme « capitale de la france → paris », est stockée dans ces couches. Dans un Transformer classique, les MLP représentent environ deux tiers des paramètres des blocs.</p>
<h3>Le MoE : beaucoup de MLP, peu actifs</h3>
<p>Un <dfn>MoE</dfn> (<em>Mixture of Experts</em>) remplace le MLP unique par plusieurs MLP, appelés <strong>experts</strong>, et un petit <dfn>routeur</dfn>. Pour chaque token, le routeur note les experts et n’active que les meilleurs, par exemple 2 sur 8. Leurs sorties sont combinées selon ces notes. On obtient un modèle qui <strong>stocke</strong> beaucoup de paramètres mais n’en <strong>calcule</strong> qu’une partie par token.</p>
<p>Le mot « expert » est trompeur : ce n’est ni un spécialiste humain ni un domaine identifié, mais un réseau dont la spécialisation, quand elle existe, émerge de l’entraînement. Le choix se fait <strong>à l’intérieur d’une couche, pour chaque token</strong>, pas entre plusieurs assistants complets.</p>
<p class="anecdote"><strong>Un cas réel :</strong> le rapport DeepSeek-V3 annonce 671 milliards de paramètres au total, dont 37 milliards activés par token. Le premier nombre dit ce qu’il faut stocker, le second ce qu’il faut calculer pour un token.</p>
<p>L’expérience montre un routage <strong>inventé</strong>. Luciole a un MLP dense unique, sans experts ni routeur.</p>
<details><summary>Pour les avertis · combinaison et coûts cachés</summary><p>sortie = Σ<sub>e ∈ top-k</sub> g<sub>e</sub>(x) · Expert<sub>e</sub>(x), avec des notes g renormalisées sur les experts retenus. En pratique, l’équilibrage de charge entre experts, la capacité par expert et la communication entre GPU ajoutent des coûts absents de cette illustration. Les MLP modernes utilisent souvent une porte (SwiGLU) plutôt que ReLU.</p></details>`,
    formula: 'MLP : agrandir → ReLU → réduire · MoE : routeur → quelques experts → combinaison',
    instruction: 'Choisissez un token dans « Token routé », puis faites varier « Experts actifs par token » de 1 à 3. Observez quels experts travaillent et la part du modèle réellement calculée ; le nombre total d’experts ne change pas.',
    takeaway: 'Le MLP transforme chaque token séparément et contient l’essentiel des poids. Un MoE distingue paramètres stockés et paramètres actifs par token.',
    caveat: 'Le routage montré est synthétique et ses experts n’ont pas de spécialité. Luciole est un modèle dense. Paramètres actifs, mémoire et vitesse réelle restent trois quantités distinctes.',
    question: 'Activer deux experts sur huit divise-t-il forcément la mémoire du modèle par quatre ?',
    choices: ['Oui, les autres experts disparaissent', 'Non, les poids de tous les experts doivent rester stockés', 'Oui, quel que soit le matériel'],
    answer: 1, explanation: 'Le calcul par token est réduit, mais chaque expert peut être choisi pour un autre token : tous les poids doivent rester disponibles.',
    refs: ['ffn-memories', 'switch', 'v3'], notes: 'Accroche : actif ne signifie pas stocké. Manipulation : 1, 2 puis 3 experts. Transition : les blocs sont finis ; comment obtient-on un choix de token ?',
  },
  {
    id: '09b-scores', section: 'Du calcul à la réponse', title: 'Un score n’est pas\nune probabilité.',
    short: 'Des scores aux probabilités', label: 'Avant le tirage', experiment: 'scores',
    lead: 'À la sortie des blocs, le modèle produit un score par token du vocabulaire. Ces scores peuvent être négatifs et ne totalisent rien de particulier : il faut les convertir en probabilités.',
    body: `<h3>Des scores bruts : les logits</h3>
<p>Une dernière projection transforme le vecteur du dernier token en une liste de scores, un par entrée du vocabulaire : 333 pour Luciole, des dizaines de milliers pour un grand modèle. Ces scores s’appellent des <dfn>logits</dfn>. Seuls leurs <strong>écarts</strong> comptent : un logit de 3 face à 0 signifie « nettement plus probable », quelle que soit la valeur absolue.</p>
<h3>La conversion : softmax</h3>
<p><dfn>Softmax</dfn> fait deux choses : il rend chaque score positif en prenant son exponentielle, puis divise par le total pour que tout fasse 100 %. L’exponentielle <strong>amplifie les écarts</strong> : un point de score en plus multiplie la probabilité relative par environ 2,7.</p>
<p><strong>Exemple chiffré :</strong> les scores [−2 ; 0 ; 3] donnent environ [0,6 % ; 4,7 % ; 94,7 %]. Les scores [0 ; 0 ; 0] donnent un tiers chacun, tout comme [5 ; 5 ; 5] : ajouter la même constante à tous les scores ne change rien.</p>
<h3>Une probabilité n’est pas encore un choix</h3>
<p>Le modèle fournit une distribution ; il reste à choisir un token. On peut prendre le plus probable ou tirer au hasard selon ces probabilités. C’est l’objet de l’étape suivante. Notez aussi qu’une probabilité élevée exprime ce qui est fréquent dans la continuité des données d’entraînement, pas une garantie de vérité.</p>
<details><summary>Pour les avertis · formule et stabilité numérique</summary><p>p<sub>i</sub> = exp(z<sub>i</sub>) / Σ<sub>j</sub> exp(z<sub>j</sub>). En pratique, on soustrait max(z) avant l’exponentielle pour éviter les débordements, sans changer le résultat. Le logarithme de p<sub>i</sub> sert directement de perte à l’entraînement (entropie croisée).</p></details>`,
    formula: 'logits (scores libres) → softmax → probabilités qui totalisent 100 %',
    instruction: 'Modifiez les trois scores. Rendez-les égaux, puis augmentez-en un seul d’un point : sa probabilité grimpe vite, mais le total reste 100 %.',
    takeaway: 'Logits, probabilités et choix sont trois étapes distinctes. Softmax convertit des scores en probabilités en amplifiant leurs écarts.',
    caveat: 'Les trois scores de cette étape sont choisis à la main pour isoler le calcul ; ce n’est pas une sortie de Luciole. Une probabilité élevée n’est pas un certificat de vérité.',
    question: 'Si les trois scores sont égaux, quelles probabilités softmax donne-t-il ?',
    choices: ['100 % pour le premier', 'Un tiers pour chacun', 'Cela dépend de la valeur des scores'],
    answer: 1, explanation: 'Des scores identiques ont la même exponentielle ; chacun reçoit donc un tiers, quelle que soit leur valeur commune.',
    refs: ['transformer', 'nucleus'], notes: 'Faire deviner l’effet de +1 sur un score avant de le montrer. Séparer score, probabilité et choix avant le tirage.',
  },
  {
    id: '10-tirage', section: 'Du calcul à la réponse', title: 'Prédire n’est\npas choisir.',
    short: 'Le tirage', label: 'Le décodage', experiment: 'sampling',
    lead: 'Le modèle a produit des probabilités. Il reste à choisir un token. La température et les filtres règlent ce choix, sans rien changer à ce que le modèle sait.',
    body: `<h3>Pourquoi ne pas toujours prendre le favori ?</h3>
<p>Choisir systématiquement le token le plus probable donne des textes sûrs mais souvent répétitifs et plats. Tirer au hasard selon les probabilités apporte de la variété, mais risque de choisir des candidats très improbables. Les réglages de <dfn>décodage</dfn> cherchent un compromis entre ces deux extrêmes.</p>
<p><strong>Notre exemple :</strong> « Pour le dessert, je prendrai… ». Nous attribuons volontairement 40 % à « un gâteau », 30 % à « une glace », 20 % à « un fruit », 8 % à « un café » et 2 % à « autre chose ». Ces candidats et probabilités sont <strong>inventés</strong> pour rendre chaque réglage lisible ; un vrai modèle applique les mêmes opérations à tout son vocabulaire.</p>
<h3>1 · La température : régler la concentration</h3>
<p>On divise les scores par la <dfn>température</dfn> T avant softmax. <strong>T &lt; 1</strong> creuse les écarts : le favori devient encore plus favori. <strong>T &gt; 1</strong> les aplatit : les outsiders gagnent des chances. <strong>T = 0</strong> revient à toujours prendre le favori ; un choix à 100 % ne signifie alors pas que le modèle était certain.</p>
<h3>2 · Les filtres : écarter les candidats improbables</h3>
<ul>
<li><dfn>Top-k</dfn> garde les k meilleurs candidats.</li>
<li><dfn>Min-p</dfn> retire ceux qui sont trop faibles par rapport au favori : avec un favori à 40 % et min-p = 0,1, le seuil est 4 %, et « autre chose » (2 %) est écarté.</li>
<li><dfn>Top-p</dfn> garde les meilleurs candidats jusqu’à atteindre la part demandée de la probabilité totale.</li>
</ul>
<p>Les survivants sont <strong>renormalisés</strong> pour totaliser à nouveau 100 %. Avec top-p = 0,8 : « gâteau », « glace » et « fruit » atteignent 90 % et sont gardés ; divisés par 0,9, ils valent environ 44,4 %, 33,3 % et 22,2 %. Les candidats écartés restent visibles à 0 %.</p>
<h3>3 · Tirer, puis observer</h3>
<p>Un tirage choisit un seul candidat ; cent tirages donnent des fréquences proches des probabilités, sans les égaler exactement. Ici, chaque tirage repart de la même distribution. Dans une vraie génération, chaque token choisi modifie le contexte et donc les probabilités suivantes. La <dfn>graine</dfn> 42 rend les tirages reproductibles.</p>
<details><summary>Pour les avertis · ordre des filtres et ex aequo</summary><p>Cette interface applique la température, puis top-k, min-p et top-p, avant renormalisation ; d’autres bibliothèques choisissent un autre ordre, ce qui peut changer le résultat. À T = 0 ou à la frontière de top-k, les ex aequo sont départagés dans l’ordre d’affichage. Min-p est décrit par Nguyen et al. (2024) ; top-p par Holtzman et al. (2019).</p></details>`,
    formula: 'scores ÷ T → softmax → top-k → min-p → top-p → renormalisation → tirage',
    instruction: 'Gardez « Plusieurs choix plausibles ». Modifiez un seul réglage à la fois, cliquez sur « Tirer une fois », puis sur « Ajouter 100 tirages ». Comparez ensuite avec « Un favori dominant » et « Égalité entre les choix ».',
    takeaway: 'Les réglages de décodage changent la façon de choisir, pas les connaissances ni les poids du modèle.',
    caveat: 'Les cinq candidats et leurs probabilités sont inventés pour isoler le décodage ; aucun modèle n’est chargé. Une température basse rend la sortie plus prévisible, pas plus vraie.',
    question: 'Que fait la température aux poids appris du modèle ?',
    choices: ['Elle les réentraîne', 'Elle ne les change pas', 'Elle supprime les couches incertaines'],
    answer: 1, explanation: 'La température agit sur les logits, après le calcul du modèle. Les paramètres appris ne bougent pas.',
    refs: ['nucleus', 'minp', 'decoding'], notes: 'Accroche : calculer puis décider. Manipulation : T = 0, T = 1,5, puis top-p. Transition : dans un vrai chat, que reçoit le modèle en plus de votre message ?',
  },
  {
    id: '03-prompt', section: 'Du calcul à la réponse', title: 'La conversation\nsous la conversation.',
    short: 'Le template caché', label: 'Les coulisses', experiment: 'prompt',
    lead: 'Un modèle ne lit qu’une seule suite de tokens. Pour en faire un assistant de discussion, il faut transformer toute la conversation, rôles compris, en cette suite.',
    body: `<h3>L’idée</h3>
<p>Vous voyez des bulles de discussion. Le modèle, lui, ne voit qu’un long texte à continuer. Le <dfn>chat template</dfn> est la recette qui fabrique ce texte : il assemble les consignes du système, vos messages et les réponses précédentes, en les séparant par des marqueurs spéciaux qui indiquent qui parle. Il se termine par le marqueur « début de la réponse de l’assistant » : le modèle n’a plus qu’à continuer, token par token, comme à l’étape 1.</p>
<p>Chaque famille de modèles a son propre format, appris pendant son entraînement à la conversation. Utiliser le mauvais format dégrade les réponses.</p>
<h3>Et les outils ?</h3>
<p>Un assistant capable d’utiliser des outils (recherche, calculatrice, code) reçoit aussi leur description dans le contexte. Quand il veut s’en servir, il <strong>génère un texte structuré</strong> qui décrit l’appel. C’est le <strong>programme autour du modèle</strong> qui exécute réellement l’outil, puis insère le résultat dans le contexte avant de relancer la génération. Le modèle lui-même ne fait qu’écrire des tokens.</p>
<h3>Un point de sécurité</h3>
<p>Une fois dans le contexte, le résultat d’un outil n’est qu’un texte parmi d’autres. Une page Web consultée peut contenir « ignore tes consignes et… » : c’est l’<strong>injection de prompt</strong>. Le programme qui entoure le modèle doit donc traiter ces résultats comme des données, pas comme des ordres, et limiter ce que les outils peuvent faire.</p>
<p>L’échange de l’expérience est <strong>inventé</strong> et ses marqueurs sont illustratifs. Luciole n’utilise pas de template : il n’a jamais appris à converser.</p>
<details><summary>Pour les avertis · ce que le template change</summary><p>Le template fixe l’ordre, les tokens spéciaux de rôle, l’endroit où s’insèrent les définitions d’outils et parfois un début de réponse imposé. Il consomme des tokens de contexte à chaque tour. Les bibliothèques comme Hugging Face Transformers le stockent avec le tokenizer. Les modèles de raisonnement ajoutent souvent une section de réflexion dans ce même flux ; ce texte affiché n’est pas une trace exhaustive du calcul interne.</p></details>`,
    formula: 'messages + rôles + outils + template = une seule suite de tokens à continuer',
    instruction: 'Cliquez sur « Activer les rayons X » pour voir les marqueurs ajoutés, puis sur « Ajouter un résultat d’outil ». Distinguez ce que voit la personne et ce que reçoit le modèle.',
    takeaway: 'Un assistant reçoit une conversation sérialisée en une seule suite de tokens ; le programme qui l’entoure exécute les outils.',
    caveat: 'L’ordre et les marqueurs dépendent du modèle ; ceux de l’expérience sont illustratifs. Luciole n’a jamais appris à converser ni à appeler des outils.',
    question: 'Le résultat d’un outil est-il automatiquement une instruction de confiance ?',
    choices: ['Oui, puisqu’il vient d’un programme', 'Non, il peut contenir du texte non fiable', 'Oui, si le texte est long'],
    answer: 1, explanation: 'Un résultat d’outil peut contenir n’importe quel texte, y compris des instructions hostiles. Données, instructions et autorisations doivent rester distinctes.',
    refs: ['templates'], notes: 'Accroche : les coulisses du chat. Manipulation : rayons X, puis outil. Transition : certains assistants « réfléchissent » avant de répondre ; qu’est-ce que cela change ?',
  },
  {
    id: '11-effort', section: 'Du calcul à la réponse', title: 'Plus de calcul.\nPas de garantie.',
    short: 'L’effort de raisonnement', label: 'Le budget à l’inférence', experiment: 'effort',
    lead: 'Certains modèles écrivent un long raisonnement avant de répondre. Dépenser plus de calcul au moment de répondre peut aider, surtout quand une réponse peut être vérifiée.',
    body: `<h3>Réfléchir, c’est encore générer des tokens</h3>
<p>Un « modèle de raisonnement » n’a pas d’organe supplémentaire : il génère toujours des tokens, un à la fois. La différence vient de son entraînement, qui l’a habitué à écrire des étapes intermédiaires avant la réponse, et du budget qu’on lui accorde : plus de tokens de réflexion, plusieurs essais, ou une recherche parmi plusieurs pistes. Chaque token écrit fait partie du contexte et peut aider à calculer les suivants.</p>
<h3>Pourquoi la vérification change tout</h3>
<p>Ajouter du calcul est surtout utile quand on peut <strong>vérifier</strong> une réponse : un programme passe ou échoue ses tests, une équation est juste ou fausse. On peut alors essayer plusieurs pistes et garder celle qui passe. Sans vérification, une longue justification peut être aussi fausse qu’une courte, simplement plus convaincante.</p>
<p><strong>Un exemple documenté :</strong> DeepSeek-R1 a été entraîné par renforcement sur des tâches vérifiables, comme les mathématiques et le code. Le modèle y apprend à produire des raisonnements plus longs, parce que cela augmente ses chances d’obtenir une réponse validée.</p>
<h3>L’expérience : chercher et vérifier</h3>
<p>Pour isoler l’idée, l’expérience n’utilise aucun LLM. Elle cherche la solution entière de 7x + 3 = 94 en essayant x = 0, 1, 2… Le budget fixe le nombre d’essais ; un <dfn>vérificateur</dfn> contrôle chaque proposition. Avec trop peu d’essais, on ne trouve rien ; avec assez, la solution est trouvée <em>et prouvée</em>. C’est une analogie : un LLM ne raisonne pas par énumération.</p>
<details><summary>Pour les avertis · stratégies de calcul à l’inférence</summary><p>On distingue l’allongement d’une chaîne de raisonnement, l’échantillonnage de plusieurs réponses avec vote majoritaire, la sélection par un vérificateur ou un modèle de récompense, et la recherche arborescente. Snell et al. (2024) montrent que la meilleure stratégie dépend de la difficulté de la question et du modèle. Le texte de réflexion affiché n’est pas une trace fidèle de tout le calcul interne.</p></details>`,
    formula: 'plus de budget + un vérificateur fiable → plus de chances de trouver, pas de garantie sans vérification',
    instruction: 'Avec un budget de 5 candidats, aucune solution n’est trouvée. Augmentez « Budget de candidats à vérifier » jusqu’à ce que la solution de 7x + 3 = 94 soit trouvée et vérifiée.',
    takeaway: 'Plus de calcul à l’inférence aide certaines tâches, surtout quand une réponse peut être vérifiée. La longueur d’un raisonnement ne prouve pas sa justesse.',
    caveat: 'Cette expérience est une analogie déterministe : aucun LLM n’y raisonne et aucun score de modèle commercial n’y est attribué.',
    question: 'Qu’est-ce qui rend cette expérience particulièrement facile à vérifier ?',
    choices: ['La longueur du texte produit', 'On peut remplacer x dans une équation exacte', 'La confiance affichée par le modèle'],
    answer: 1, explanation: 'Un vérificateur externe teste l’égalité. Beaucoup de tâches ouvertes, comme rédiger ou conseiller, n’offrent pas un critère aussi net.',
    refs: ['test-time', 'r1'], notes: 'Accroche : chercher n’est pas savoir. Manipulation : budget 5, puis 14. Transition : générer longtemps coûte de la mémoire ; laquelle ?',
  },
  {
    id: '12-memoire', section: 'Mémoire, coûts et apprentissage', title: 'Le contexte grandit.\nLa mémoire aussi.',
    short: 'Le KV cache', label: 'Le stockage à l’inférence', experiment: 'memory',
    lead: 'Pour générer le token suivant, faut-il tout recalculer depuis le début ? Non : une partie du travail passé peut être gardée en mémoire. C’est le KV cache.',
    body: `<h3>L’observation de départ</h3>
<p>Après avoir traité « &lt;bos&gt; le chat », le modèle ajoute « dort ». Grâce au <dfn>masque causal</dfn>, les anciens tokens ne peuvent pas consulter ce nouveau venu : leurs calculs, dans chaque couche, sont exactement les mêmes qu’avant. Les refaire serait du travail perdu.</p>
<h3>Ce que l’on garde : K et V</h3>
<p>Le nouveau token a besoin de deux choses venant du passé : les <strong>clés K</strong>, pour calculer ses proportions, et les <strong>valeurs V</strong>, pour faire son mélange. Le <dfn>KV cache</dfn> conserve donc les K et V de chaque token déjà traité, dans chaque couche. Les anciens Q, eux, ne servent plus : ils n’étaient utiles qu’aux anciens tokens.</p>
<h3>Deux phases</h3>
<ul>
<li><strong>Le <dfn>prefill</dfn></strong> traite tout le prompt d’un coup, remplit le cache et produit le premier token.</li>
<li><strong>Le <dfn>décodage</dfn></strong> traite ensuite un seul token par pas : il calcule ses Q, K, V, ajoute K et V au cache, compare son Q à toutes les clés stockées et produit le token suivant.</li>
</ul>
<h3>Trois choses à ne pas confondre</h3>
<p>Les <strong>poids appris</strong> sont fixes et identiques pour toutes les conversations. Les <strong>K/V en cache</strong> sont des données temporaires, propres à une conversation. Les <strong>poids d’attention</strong> sont recalculés à chaque pas, car ils dépendent du nouveau Q. Le cache grossit avec le contexte : c’est pourquoi les longues conversations consomment beaucoup de mémoire.</p>
<p><strong>Luciole n’a pas de cache</strong> : il recalcule tout le contexte à chaque token, ce qui garde son code simple. La frise illustre le principe sur une suite imposée ; le bouton de vérification compare les vrais K/V de Luciole sur deux préfixes successifs et montre qu’ils sont identiques, donc réutilisables.</p>
<details><summary>Pour les avertis · taille du cache, GQA et limites</summary><p>Taille ≈ 2 × couches × têtes_KV × dimension_tête × tokens × séquences × octets. Le 2 compte K et V. Pour Luciole avec 10 tokens en float32 : 2 × 2 × 4 × 8 × 10 × 1 × 4 = 5 120 octets. Pour un modèle de 8 milliards de paramètres, le cache d’un long contexte peut atteindre plusieurs Go par séquence.</p><p><dfn>GQA</dfn> fait partager chaque tête K/V par un groupe de têtes Q ; <dfn>MQA</dfn> n’en garde qu’une. Ce sont des choix d’architecture faits avant l’entraînement. La quantification du cache, les fenêtres glissantes et la compression réduisent encore la mémoire. Le cache n’efface pas le coût de l’attention : chaque nouveau token compare toujours son Q à toutes les clés stockées.</p></details>`,
    formula: 'prefill : calculer tout le prompt · chaque pas : réutiliser K/V du passé + calculer le nouveau token',
    instruction: 'Cliquez sur « Passer à t », puis avancez encore d’un pas : repérez les K/V réutilisés et ceux qui sont ajoutés dans chaque couche. Cliquez ensuite sur « Vérifier K/V dans Luciole (sans cache) ». L’estimateur de mémoire est facultatif.',
    takeaway: 'Le KV cache évite de recalculer le passé en gardant ses K et V ; il échange du calcul contre de la mémoire, qui grandit avec le contexte.',
    caveat: 'La frise est conceptuelle : Luciole recalcule tout, sans cache, et ne mesure aucun gain de vitesse. L’estimateur décrit un modèle hypothétique, pas un service réel.',
    question: 'Au pas suivant, que peut réutiliser un modèle avec cache si le début du texte n’a pas changé ?',
    choices: ['Les poids d’attention du pas précédent', 'Les K et V des tokens passés, dans chaque couche', 'Une réponse stockée qui remplace tous les calculs'],
    answer: 1, explanation: 'Les K/V passés sont identiques tant que le préfixe ne change pas. Le nouveau Q, les poids d’attention, le MLP et la prédiction restent à calculer.',
    refs: ['cache', 'gqa', 'transformer'], notes: 'Faire dire ce qui est réutilisé et ce qui reste à calculer. Distinguer token traité et token prédit. Transition : avec ce cache, qu’est-ce qui limite la vitesse ?',
  },
  {
    id: '13-performance', section: 'Mémoire, coûts et apprentissage', title: 'Calculer vite.\nLire assez vite.',
    short: 'Le coût de génération', label: 'Les limites matérielles', experiment: 'roofline',
    lead: 'Un GPU peut calculer des centaines de milliers de milliards d’opérations par seconde, et pourtant attendre ses données. Pendant la génération, c’est souvent la mémoire qui fixe le rythme.',
    body: `<h3>Deux limites qui font la course</h3>
<p>Pour produire un token, le matériel doit <strong>lire</strong> tous les poids du modèle depuis sa mémoire, puis <strong>calculer</strong> avec eux. Chacune de ces deux opérations a une vitesse maximale : la <dfn>bande passante</dfn> mémoire (octets par seconde) et la puissance de calcul (<dfn data-term="flop">FLOP</dfn> par seconde). Le temps réel est au moins celui de la plus lente. C’est l’idée du modèle <dfn>roofline</dfn>.</p>
<h3>Pourquoi le décodage attend la mémoire</h3>
<p>Pendant le décodage, chaque séquence ne produit qu’un token par pas. Pour un seul utilisateur, on lit donc des gigaoctets de poids… pour faire relativement peu de calculs avec. Le GPU attend. L’astuce est le <dfn>batch</dfn> : traiter plusieurs conversations ensemble, pour que <strong>chaque lecture des poids serve à plusieurs tokens</strong>. Le prefill, qui traite tout le prompt d’un coup, profite naturellement de cet effet.</p>
<h3>Débit et latence ne sont pas la même chose</h3>
<p>Le <strong>débit</strong> compte les tokens produits par seconde pour tout le monde. La <dfn>latence</dfn> est ce que ressent une personne : le <strong>temps avant le premier token</strong> (file d’attente et prefill), puis le <strong>temps entre deux tokens</strong> (rythme d’affichage). Un gros batch améliore le débit, mais chaque personne peut attendre davantage.</p>
<p class="anecdote"><strong>Une optimisation célèbre : FlashAttention.</strong> Elle réorganise le calcul de l’attention pour limiter les allers-retours avec la mémoire du GPU, sans changer le résultat. Elle accélère l’attention mais ne remplace pas le KV cache.</p>
<details><summary>Pour les avertis · le modèle de coût simplifié</summary><p>Pour un modèle dense de P paramètres : environ 2P opérations par token, et une lecture complète des poids par pas. t<sub>pas</sub> ≥ max(2P × batch / FLOP·s⁻¹, P × octets_par_poids / octets·s⁻¹). L’estimation ignore l’attention, la lecture du KV cache, les communications et l’ordonnancement. Le point de bascule entre les deux régimes est l’intensité arithmétique : le nombre d’opérations par octet lu.</p></details>`,
    formula: 'temps par pas ≥ max(temps de calcul, temps de lecture des poids)',
    instruction: 'Partez d’un batch de 1, puis augmentez « Batch (séquences) » : repérez le moment où le calcul devient la limite. Comparez débit total et temps par pas.',
    takeaway: 'À petit batch, la génération est limitée par la lecture de la mémoire ; regrouper les requêtes augmente le débit, pas forcément la réactivité pour chacun.',
    caveat: 'GPU illustratif : 600 TFLOP/s et 3 To/s, sans constructeur associé. Le calcul donne une borne idéale pour un modèle hypothétique, pas Luciole ni une mesure réelle.',
    question: 'Augmenter le batch réduit-il nécessairement la latence d’une requête ?',
    choices: ['Oui, dans tous les cas', 'Non, le débit peut augmenter sans réduire sa latence', 'Oui, parce que le modèle devient plus petit'],
    answer: 1, explanation: 'Le batch amortit la lecture des poids et améliore le débit total, mais ajoute du calcul par pas et parfois de l’attente.',
    refs: ['roofline', 'flash'], notes: 'Accroche : calcul et lecture font la course. Manipulation : batch 1 puis 512. Transition : d’où viennent tous ces poids ?',
  },
  {
    id: '14-apprentissage', section: 'Mémoire, coûts et apprentissage', title: 'Les poids ont\nune histoire.',
    short: 'L’apprentissage', label: 'Avant l’inférence', experiment: 'training',
    lead: 'Jusqu’ici, les poids étaient fixes. Ils ont pourtant été réglés un jour, par un processus très simple dans son principe : prédire, mesurer l’erreur, corriger un peu, et recommencer des millions de fois.',
    body: `<h3>L’exercice : deviner le token suivant</h3>
<p>Le préentraînement transforme n’importe quel texte en exercices. Pour « le chat dort », l’entrée est « &lt;bos&gt; le chat dort » et les réponses attendues sont « le chat dort &lt;eos&gt; » : après &lt;bos&gt;, il faut prédire « le » ; après « le », « chat » ; et ainsi de suite. Grâce au masque causal, ces quatre exercices sont calculés en même temps, sans que chaque position puisse voir sa réponse.</p>
<h3>La boucle d’apprentissage</h3>
<ol>
<li><strong>Prédire :</strong> le modèle calcule ses probabilités pour chaque position.</li>
<li><strong>Mesurer :</strong> la <dfn>perte</dfn> est faible si le bon token avait une forte probabilité, élevée sinon.</li>
<li><strong>Attribuer :</strong> la <dfn>rétropropagation</dfn> calcule, pour chaque poids, dans quel sens il faudrait le bouger pour réduire la perte : c’est le <dfn>gradient</dfn>.</li>
<li><strong>Corriger :</strong> un optimiseur déplace chaque poids d’un petit pas dans ce sens.</li>
</ol>
<p>Luciole a répété cette boucle 12 000 fois. Les grands modèles la répètent sur des milliers de milliards de tokens.</p>
<h3>Apprendre ou mémoriser ?</h3>
<p>Une perte basse sur les phrases d’entraînement peut signifier que le modèle les a simplement retenues. Pour mesurer la <dfn>généralisation</dfn>, on suit la perte sur des phrases jamais vues : la <dfn>validation</dfn>. Les deux courbes de l’expérience montrent cet écart.</p>
<h3>Après le préentraînement</h3>
<p>Un modèle préentraîné sait continuer un texte, pas encore tenir une conversation. Le <strong>post-entraînement</strong> lui apprend à suivre des instructions sur des exemples de dialogues, puis à préférer certaines réponses : retours humains et renforcement (InstructGPT), optimisation directe de préférences (DPO), ou récompenses vérifiables (DeepSeek-R1). Luciole n’a suivi aucune de ces étapes.</p>
<details><summary>Pour les avertis · perte, optimiseur et biais d’exposition</summary><p>La perte est l’entropie croisée moyenne en <dfn>nats</dfn>/token : −ln(p<sub>cible</sub>). Une cible prédite à 50 % coûte environ 0,693 nat. La descente de gradient simple fait poids ← poids − taux × gradient ; Luciole utilise Adam, qui adapte ce pas avec des moyennes des gradients et de leurs carrés. À l’entraînement, les préfixes viennent toujours du corpus ; à la génération, ils contiennent les choix du modèle, qui peut donc s’éloigner des situations rencontrées.</p></details>`,
    formula: 'prédire → mesurer la perte → gradients → corriger les poids ↻ · puis poids figés pour générer',
    instruction: 'Cliquez sur chaque phase pour voir ce que Luciole a suivi ou non. Déplacez ensuite le curseur de l’historique : comparez la perte d’apprentissage et celle de validation, et observez une prédiction s’améliorer.',
    takeaway: 'Préentraînement, post-entraînement et inférence sont des processus distincts ; seul l’entraînement modifie les poids.',
    caveat: 'Luciole a uniquement appris la prédiction du token suivant, sans instruction tuning ni préférences. Le curseur relit des mesures enregistrées et ne modifie aucun poids.',
    question: 'Une perte d’entraînement très basse prouve-t-elle une bonne généralisation ?',
    choices: ['Oui, c’est suffisant', 'Non, il faut évaluer sur des données mises de côté', 'Oui, si la courbe est régulière'],
    answer: 1, explanation: 'Un modèle peut mémoriser ses exemples. Seule une évaluation sur des données distinctes renseigne sur sa généralisation.',
    refs: ['transformer', 'instruct', 'dpo'], notes: 'Accroche : les poids ont appris avant le chat. Manipulation : phases, puis courbes. Transition : assemblons toutes les pièces.',
  },
  {
    id: '15-laboratoire', section: 'Tout assembler', title: 'La machine,\nà livre ouvert.',
    short: 'Le laboratoire', label: 'Tout se rejoint', experiment: 'laboratory',
    lead: 'Toutes les pièces sont là : tokenizer, embeddings, positions, deux blocs, scores et tirage. Le laboratoire les montre ensemble, sur un même calcul de Luciole.',
    body: `<h3>Un passage complet</h3>
<p>Quand vous cliquez sur « + Un token », Luciole effectue un <dfn>passage avant</dfn> : découper le prompt, lire les embeddings, ajouter les positions, traverser les deux blocs d’attention et de MLP, normaliser, projeter vers 333 scores, puis tirer un token. Toutes les vues du laboratoire — tokens, vecteurs, blocs, attention, candidats — décrivent <strong>ce même calcul</strong>.</p>
<h3>Retrouver chaque étape du parcours</h3>
<ul>
<li><strong>Tokens :</strong> le découpage de l’étape 3, avec ses numéros.</li>
<li><strong>Vecteurs :</strong> l’embedding plus la position, avant tout échange entre tokens.</li>
<li><strong>Bloc 1, Bloc 2 :</strong> le même token après chaque bloc, enrichi par le contexte.</li>
<li><strong>Couche et tête inspectées :</strong> la grille d’attention de l’étape 9 pour le calcul en cours.</li>
<li><strong>Sortie :</strong> les probabilités avant et après les réglages de décodage.</li>
</ul>
<h3>Mener une petite enquête</h3>
<p>Partez de « la capitale de la france est », puis remplacez seulement « france » par « belgique ». Comparez dans l’ordre : les tokens d’entrée, la dernière ligne d’attention, puis les candidats. Ne changez qu’une chose à la fois, sinon vous ne saurez pas ce qui a produit la différence. La température est réglée par défaut à 0,7 : la génération tire au hasard, avec la graine 42 pour que le résultat soit reproductible.</p>
<p>Vous pouvez composer vos propres prompts avec les mots du corpus, jusqu’à 32 tokens. Un mot inconnu est signalé, jamais remplacé en silence. « ← Revenir » inspecte l’état précédent ; « Réinitialiser » restaure le prompt et la graine.</p>`,
    formula: 'découper → représenter → contextualiser (× 2 blocs) → projeter → choisir',
    instruction: 'Générez la suite de « la capitale de la france est », puis choisissez l’exemple sur la Belgique. Comparez tokens, attention et probabilités. Écrivez ensuite votre propre prompt et cliquez sur « Appliquer le prompt ».',
    takeaway: 'Toutes les vues décrivent un même calcul réel. Les mécanismes sont inspectables ; la qualité des réponses dépend aussi des données, de l’échelle et de l’entraînement.',
    caveat: 'Luciole est un modèle pédagogique, pas un assistant : pas de RoPE, de MoE, de GQA ni de KV cache. Deux exemples ne suffisent pas à démontrer une connaissance générale des capitales.',
    question: 'Les probabilités du laboratoire sont-elles prédéfinies pour chaque phrase ?',
    choices: ['Oui, c’est une vidéo interactive', 'Non, elles résultent du calcul avec les poids publiés', 'Elles viennent d’une API distante'],
    answer: 1, explanation: 'Le calcul s’exécute dans votre navigateur avec les poids appris de Luciole ; aucune réponse n’est écrite à l’avance.',
    refs: ['transformer', 'rmsnorm'], notes: 'Accroche : dézoomer sans perdre les détails. Manipulation : France, Belgique, puis un prompt libre. Transition : peut-on lire la prédiction avant la fin du modèle ?',
  },
  {
    id: '09-logit-lens', section: 'Tout assembler', title: 'Une prédiction\nse dessine.',
    short: 'La logit lens', label: 'Les représentations intermédiaires', experiment: 'lens',
    lead: 'Que « penserait » le modèle s’il devait répondre dès le premier bloc ? La logit lens apporte une réponse approximative, à condition de savoir ce qu’elle mesure.',
    body: `<h3>L’idée</h3>
<p>Normalement, seule la sortie du dernier bloc passe par la projection finale qui produit les scores. La <dfn>logit lens</dfn> applique <strong>cette même projection</strong> plus tôt, à la sortie de chaque bloc, comme si le modèle s’arrêtait là. On obtient une suite de « brouillons » de prédiction, couche après couche.</p>
<p>C’est possible grâce aux connexions résiduelles : chaque bloc ajoute sa contribution au même vecteur, qui garde la même taille et un « langage » assez proche d’une couche à l’autre. Dans de grands modèles, on voit souvent la bonne réponse émerger progressivement au fil des couches.</p>
<h3>Ce qu’il faut garder en tête</h3>
<p>Les couches intermédiaires n’ont jamais été entraînées à être lues ainsi. Un brouillon confus ne veut donc pas dire que la couche est inutile : son vecteur peut contenir une information que seuls les blocs suivants savent exploiter. La logit lens est une <strong>sonde</strong>, un instrument de lecture, pas une fenêtre sur les intentions du modèle.</p>
<h3>Dans Luciole</h3>
<p>Avec deux blocs, on obtient trois lectures : profondeur 0 (embeddings et positions, avant tout bloc), 1 et 2 (la sortie réelle). Sur « le chat », plusieurs suites restent plausibles jusqu’au bout. Sur « la capitale de la france est », un candidat domine plus nettement. Les barres sont calculées à partir des vrais vecteurs de Luciole et indiquent la part des candidats non affichés.</p>
<p class="anecdote"><strong>Un peu d’histoire :</strong> la logit lens a été proposée en 2020 dans un billet de blog signé nostalgebraist, à propos d’un modèle public de 2019. La <em>tuned lens</em> (Belrose et al., 2023) apprend une petite correction par couche pour rendre ces lectures plus fiables ; elle n’est pas implémentée ici.</p>
<details><summary>Pour les avertis · le calcul de la sonde</summary><p>lecture(ℓ) = softmax(RMSNorm(x<sub>ℓ</sub>) · W<sub>sortie</sub>), où x<sub>ℓ</sub> est le flux résiduel après le bloc ℓ. À la profondeur maximale, c’est exactement la sortie du modèle. La trajectoire n’est pas forcément monotone : une couche peut faire baisser la probabilité finale d’un candidat.</p></details>`,
    formula: 'vecteur après le bloc ℓ → même normalisation et projection de sortie → brouillon de prédiction',
    instruction: 'Gardez « le chat » et faites varier « Profondeur · 0 = entrée » de 0 à 2 : plusieurs suites restent visibles. Choisissez ensuite « la capitale de la france est » et comparez.',
    takeaway: 'La logit lens lit les états intermédiaires avec la tête de sortie finale : un instrument utile, mais imparfait, pour voir une prédiction se construire.',
    caveat: 'Avec seulement deux blocs et un corpus minuscule, cette démonstration ne montre pas l’émergence générale d’un raisonnement. Une lecture intermédiaire n’est pas une décision prise par la couche.',
    question: 'Une mauvaise prédiction intermédiaire prouve-t-elle que la couche ne sert à rien ?',
    choices: ['Oui', 'Non, la couche n’a pas été entraînée pour être lue directement', 'Oui, si sa probabilité est faible'],
    answer: 1, explanation: 'Un vecteur intermédiaire peut être très utile aux couches suivantes sans être lisible avec la projection finale.',
    refs: ['logit-lens', 'lens'], notes: 'Accroche : une radiographie imparfaite. Manipulation : profondeur 0, 1, 2 sur deux contextes. Transition : que pouvons-nous vraiment conclure de toutes ces vues ?',
  },
  {
    id: '16-synthese', section: 'Tout assembler', title: 'Comprendre.\nSans surinterpréter.',
    short: 'La synthèse', label: 'Ce qui reste', experiment: 'synthesis',
    lead: 'Vous avez vu chaque pièce de la machine. Reste à trier : qu’est-ce qui est établi, qu’est-ce qui n’est qu’une piste, et qu’est-ce que ce parcours ne démontre pas ?',
    body: `<h3>Le parcours en six phrases</h3>
<ol>
<li>Le texte est découpé en tokens, puis chaque token devient un vecteur appris.</li>
<li>Dans chaque bloc, l’attention fait circuler l’information des tokens précédents ; le MLP transforme chaque token.</li>
<li>À la sortie, des scores deviennent des probabilités, puis une règle de décodage choisit un token.</li>
<li>Ce token est ajouté au contexte et la boucle recommence ; le KV cache évite de refaire le passé.</li>
<li>Les poids ont été réglés avant, en prédisant le token suivant sur un corpus, puis souvent ajustés pour converser.</li>
<li>Pendant la génération, les poids ne changent pas : seul le contexte grandit.</li>
</ol>
<h3>Trois niveaux de certitude</h3>
<p><strong>Établi :</strong> les opérations sont connues et reproductibles. Avec les mêmes poids, le même contexte, les mêmes réglages et la même graine, on obtient le même résultat, et chaque nombre intermédiaire peut être inspecté.</p>
<p><strong>Hypothèse à tester :</strong> le rôle d’une tête, le sens d’une direction d’embedding, une lecture de logit lens. Ces observations suggèrent des pistes. Pour les confirmer, il faut <em>intervenir</em> : modifier un élément, mesurer l’effet, recommencer sur de nombreux cas. Une carte colorée montre une corrélation ; une intervention contrôlée apporte une preuve plus directe.</p>
<p><strong>Non démontré ici :</strong> une compréhension au sens humain, une intention, une conscience ou une garantie de vérité. La fluidité d’une réponse ou la beauté d’une visualisation ne suffisent pas à les établir.</p>`,
    formula: 'observer ≠ interpréter ≠ prouver une cause',
    instruction: 'Classez chaque affirmation : « Établi ici », « Hypothèse à tester » ou « Non démontré ». Formulez votre raison avant de lire la correction.',
    takeaway: 'Un bon modèle mental permet de prévoir, de vérifier, et de reconnaître ce que l’on ne sait pas encore.',
    caveat: 'Les défis sont formatifs et restent dans votre navigateur. La progression indique les pages visitées, pas une compétence certifiée.',
    question: 'Quelle affirmation est soutenue par les expériences du parcours ?',
    choices: ['Une carte d’attention révèle toutes les causes d’une réponse', 'On peut reproduire des calculs et des tirages avec des paramètres fixés', 'Un texte sûr de lui est probablement vrai'],
    answer: 1, explanation: 'La reproductibilité porte sur des opérations définies et leurs entrées. Elle ne transforme pas une interprétation en vérité.',
    refs: ['transformer', 'lens'], notes: 'Accroche : établi, hypothèse, non démontré. Manipulation : classement collectif. Conclusion : revenir au laboratoire avec une hypothèse à tester, puis changer d’échelle au final.',
  },
  {
    id: '16b-transformer-explainer', section: 'Tout assembler', title: 'Changer d’échelle.\nTout retrouver.',
    short: 'Transformer Explainer · GPT-2', label: 'Le grand final', experiment: 'transformerExplainer',
    lead: 'Luciole a 38 720 paramètres ; GPT-2 small en a environ 124 millions. Retrouvez le même enchaînement dans Transformer Explainer, adapté en français pour Playlab42.',
    body: `<h3>Ce que vous allez voir</h3>
<p>Ce final ouvre une adaptation française du projet <strong>Transformer Explainer</strong> (Polo Club, Georgia Tech). Il exécute <strong>GPT-2 small</strong>, un modèle publié en 2019 : 12 blocs au lieu de 2, 12 têtes par bloc au lieu de 4, des vecteurs de 768 nombres au lieu de 32 et un vocabulaire d’environ 50 000 tokens.</p>
<h3>Ce que vous allez reconnaître</h3>
<p>L’enchaînement est le même : découper le prompt avec un tokenizer BPE, lire les embeddings et les positions, calculer Q, K et V, appliquer le masque causal et softmax, passer dans le MLP, projeter vers les scores puis tirer avec une température. Parcourez la vue d’ensemble, puis ouvrez chaque mécanisme pour le relier aux étapes du parcours.</p>
<h3>Avant de commencer</h3>
<ul>
<li><strong>Une autre machine :</strong> GPT-2 a son propre tokenizer et ses propres poids. Les numéros de tokens de Luciole n’ont aucun sens ici.</li>
<li><strong>Un modèle anglophone :</strong> l’interface est traduite, mais GPT-2 a surtout appris sur de l’anglais. Commencez par les exemples anglais proposés.</li>
<li><strong>Un chargement volontaire :</strong> environ 657 Mo à télécharger, plusieurs Go de mémoire, et une page servie en HTTPS ou sur localhost. Rien n’est chargé avant votre clic.</li>
</ul>
<p>GPT-2 date d’avant les assistants de discussion : il continue du texte, sans avoir été entraîné à suivre des consignes. Il montre l’échelle, pas les capacités des modèles actuels. Si le chargement échoue, aucune prédiction n’est inventée à sa place.</p>`,
    formula: 'mêmes mécanismes · autre tokenizer · autres poids · 3 200 fois plus de paramètres',
    instruction: 'Ce final est facultatif. Ouvrez le laboratoire dans un nouvel onglet, puis cliquez sur « Charger GPT-2 ». Une fois le modèle prêt, masquez les informations ou passez en plein écran, et commencez par un exemple anglais.',
    takeaway: 'Le modèle change d’échelle, mais les mécanismes restent reconnaissables. L’échelle n’efface ni les limites des données ni celles de l’interprétation.',
    caveat: 'GPT-2 et Luciole sont deux modèles indépendants. Une interface traduite ou une suite plausible ne garantissent pas une réponse correcte, surtout en français.',
    question: 'Traduire Transformer Explainer en français modifie-t-il les poids de GPT-2 ?',
    choices: ['Oui, le modèle apprend la langue des boutons', 'Non, seules l’interface et les explications changent', 'Oui, à chaque nouveau prompt'],
    answer: 1, explanation: 'La langue de l’interface est indépendante des données et des paramètres appris. GPT-2 reste inchangé, et l’inférence ne le réentraîne pas.',
    refs: ['transformer-explainer', 'gpt2'],
    notes: 'Prévoir le chargement avant une présentation. Faire retrouver à voix haute chaque étape du parcours dans la vue d’ensemble. Ne pas comparer les numéros de tokens de GPT-2 et de Luciole.',
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
  'logit-lens': { title: 'interpreting GPT: the logit lens — nostalgebraist, 2020', url: 'https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens', note: 'Billet d’origine de la logit lens, appliquée à GPT-2.' },
  'ffn-memories': { title: 'Transformer Feed-Forward Layers Are Key-Value Memories — Geva et al., 2021', url: 'https://arxiv.org/abs/2012.14913', note: 'Les couches MLP se comportent comme des mémoires associatives ; résultat d’interprétabilité, pas une règle universelle.' },
  minp: { title: 'Turning Up the Heat: Min-p Sampling for Creative and Coherent LLM Outputs — Nguyen et al., 2024', url: 'https://arxiv.org/abs/2407.01082', note: 'Seuil min-p proportionnel à la probabilité du candidat favori.' },
};
