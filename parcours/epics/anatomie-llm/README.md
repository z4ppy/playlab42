# Anatomie d’un LLM — Suivez ce token

Parcours francophone accessible aux non-spécialistes : 22 étapes, sources,
glossaire, défis formatifs et laboratoire local. Durée autonome indicative :
110 minutes, hors chargement facultatif de GPT-2. Aucune API d'inférence,
aucune collecte des prompts.

## Consulter

Dans le portail : `#/parcours/anatomie-llm/01-un-token`.
Les pages sous `slides/` fonctionnent aussi directement sur un serveur HTTP.
Le paquet Luciole et tokenizers fonctionne sans Internet ; les liens bibliographiques
restent externes et les poids GPT-2 sont optionnels. Il n’y a pas de service worker ni de promesse de cache après
une première visite. Les couleurs proviennent directement du thème Playlab42.
Dans le viewer, l'en-tête du carnet, la barre des étapes et le rappel de
section sont masqués : le plan et le fil d'Ariane existent déjà dans le portail.
Ils restent disponibles en lecture standalone. Le titre compact conserve
le repère numéroté en forme d'atome, y compris sur mobile.

## Ce qui tourne vraiment

**Luciole** est un mini-décodeur causal original, et non un fork de GPT-2.
Il contient 38 720 paramètres : deux blocs, quatre têtes par bloc, une dimension
de 32, des positions apprises, RMSNorm sans gain appris, un MLP ReLU de dimension
64 et une fenêtre de 32 tokens. Les biais sont omis. Le tokenizer est lexical et fermé.
Le modèle n’a ni KV cache, ni MoE, ni RoPE, ni GQA. Le contexte est recalculé.

Le lot d'apprentissage contient 1 512 phrases : les 32 phrases initiales,
40 phrases naturelles Tatoeba sous CC0 et 1 440 phrases issues de patrons
originaux. Deux lots de 264 phrases synthétiques sont réservés à la validation
et au test. Les paires sujet/lieu et les paires non ordonnées d'objets restent
chacune dans un seul lot, toutes variantes comprises.

Tatoeba apporte 16 phrases françaises, 16 anglaises et 8 espagnoles, relues
et choisies dans les exports officiels CC0. `assets/tatoeba.json` conserve les
textes, IDs, liens, licence, date de collecte et empreintes des exports.
Ce n'est ni un échantillon représentatif, ni un corpus aligné de traduction,
ni une mesure de compétence multilingue. Ces 40 phrases servent toutes à apprendre.
Les textes Tatoeba restent CC0 ; les créations du projet sont CC-BY-NC-SA-4.0.

Le tokenizer applique NFC et les minuscules, conserve les accents, regroupe
lettres/chiffres contigus et isole chaque signe de ponctuation. Il ignore les
espaces, ajoute BOS au prompt et refuse les pièces inconnues, sans UNK de repli.
Le vocabulaire de 333 IDs vient uniquement du lot d'apprentissage. EOS est une
cible de fin à l'entraînement, pas un suffixe automatiquement ajouté au prompt.
La reconstruction ne restitue ni casse ni espaces d'origine. Le même découpage
est utilisé dans le script et dans les expériences ; il est inspectable sur
la fiche Luciole et l'étape tokenisation. Les tokeniseurs publics et le BPE
pédagogique restent distincts.

`<eos>` termine normalement une séquence. L'interface conserve le calcul qui
a choisi ce token, sans lancer de prédiction au-delà de la fin. Le bouton
principal devient **Nouvelle génération** : il restaure le prompt et la graine
42, conserve les réglages de décodage et génère le premier nouveau token.
La même relance est proposée après saturation du contexte durant la génération.
Un prompt qui remplit déjà les 32 positions doit être raccourci.
**Revenir** reste disponible pour inspecter le choix précédent.

Dans l'ouverture et le laboratoire, les onglets inspectent un même passage
avant, sans générer de token. Les vues Vecteurs et Blocs nomment le dernier
token observé et expliquent la différence entre son embedding initial et
son état contextualisé. Chaque bloc présente attention, MLP et connexions
résiduelles. Les graphiques de vecteurs placent les valeurs signées autour
de zéro, identifient les coordonnées et proposent leurs valeurs numériques
dans un volet accessible au clavier. Leur échelle est ajustée individuellement.

Luciole permet une distribution légère et inspectable sans binaire ONNX ou GPU.
Il conserve une inférence véritable et les activations intermédiaires, mais pas
les capacités d’un LLM de production. Le laboratoire GPT-2 reste un instrument
distinct, plus lourd, et ne remplace pas les calculs de Luciole.
Le modèle numérique et ses gradients sont testés par différences finies.

Les autres expériences sont explicitement distinctes :

- BPE réel mais pédagogique, appris sur le corpus maison, pas GPT/Llama.
- Conversation, routeur MoE et recherche avec vérificateur : exemples synthétiques.
- RoPE : rotations exactes de deux vecteurs, indépendantes de Luciole.
- Mémoire et roofline : formules et hypothèses visibles, pas benchmarks.
- Embeddings, attention, logit lens, courbe : données de Luciole.
- Tirage : cinq candidats et trois distributions inventés, calcul de décodage
  partagé avec Luciole, sans charger de modèle. Température, top-k, min-p,
  top-p, probabilités avant/après, motifs d'exclusion et tirages cumulés.

## Progression, vocabulaire et cas réels

Cinq étapes complètent le parcours initial : fiche de Luciole et de son
entraînement, cas concrets de tokenisation, lecture des vecteurs et matrices,
une tête d'attention pas à pas, puis scores et probabilités avant le tirage.
Chaque étape dispose de termes expliqués au survol ou au focus et de
définitions lisibles sans infobulles, y compris sans JavaScript.
Les identifiants des anciennes pages restent stables.

La première étape définit MLP et distingue transformation d'une position et
échange entre positions. L'étape `06b-tetes` précède désormais `06-position` :
Q/K/V est expliqué avant RoPE, qui reste une comparaison conceptuelle.
La tête guidée suit sept étapes, depuis les projections apprises jusqu'à la
réunion des têtes et la projection de sortie. Un petit exemple inventé permet
de modifier une coordonnée, puis le choix « Calcul observé » ouvre les vraies
projections et les quatre têtes de Luciole. Les poids ne sont jamais modifiés.

La mémoire commence par prefill, puis deux instants de décodage, avant son
estimateur facultatif. La frise montre les K/V réutilisables couche par couche,
pas des poids d'attention ni un apprentissage. Une vérification réelle compare
les projections passées de Luciole sur deux préfixes successifs : leur égalité
illustre la causalité, sans prétendre que le moteur dispose d'un cache ou
mesurer un gain de vitesse. Il continue de recalculer le contexte complet.

La comparaison charge à la demande les vrais tokeniseurs GPT-2 (BPE sur
octets), BERT uncased (WordPiece) et T5 small (Unigram). Le moteur
`@huggingface/tokenizers@0.2.0` est préparé par le pipeline vendor existant.
Les définitions originales, configurations et licences sont sous
`assets/tokenizers/` ; `provenance.json` indique révisions, URLs, tailles et
empreintes. Les fichiers `tokenizer.json` et `tokenizer_config.json` proviennent
des URLs `https://huggingface.co/<model>/resolve/<revision>/<file>`.
Le script `scripts/prepare-llm-tokenizers.js` recalcule leur inventaire sans
accès réseau ; il ne télécharge ni vocabulaire ni poids pendant le build.

Un seul contrôle « Tokenizer à observer ou comparer » propose Luciole,
GPT-2, BERT, T5 et la comparaison. Le BPE sur les 32 phrases initiales reste
une illustration séparée, pas un cinquième tokenizer de génération.
Le laboratoire GPT-2 s'ouvre uniquement dans le final Transformer Explainer.
Toutes les autres expériences de modèle, y compris la première génération et
le laboratoire libre, identifient directement Luciole sans sélecteur ni lien
GPT-2. Une ancienne préférence GPT-2 y est ignorée. Les comparaisons de
tokenizers conservent les quatre découpages ; BERT et T5 ne chargent jamais de
poids de génération.

Le tokenizer est un choix commun aux comparaisons. Les anciens choix de modèle
sont conservés dans le stockage mais ne pilotent plus les chapitres : Luciole
sert les expériences locales, le final propose uniquement un nouvel onglet
GPT-2. Les préférences passent par le stockage géré du portail
(`preferences.llmChoice`). Ni les prompts ni le consentement au
chargement lourd ne sont conservés. Un stockage indisponible est signalé et
n'empêche pas les commandes en mémoire. Quitter ou réinitialiser une
expérience détruit son montage ; une réponse tardive ne remplace pas le
nouveau choix. La navigation entre slides ne ferme pas l'onglet GPT-2 déjà
ouvert ; on peut y revenir pour poursuivre l'exploration.

Le chargement est local, les tokens spéciaux ne sont pas ajoutés automatiquement,
et les pièces internes, identifiants, comptes et reconstructions sont exposés.
Les normalisations et les unités inconnues restent visibles : BERT et T5 ne
garantissent pas un aller-retour identique. Les cas incluent support client,
JavaScript, JSON, anglais, accents et emojis. Ce ne sont pas des estimations
de facture ou de performance d'un assistant. Aucun identifiant de ces
tokeniseurs n'est transmis aux poids de Luciole.

L'atlas d'embeddings utilise trois coordonnées réelles choisies parmi les
32 de Luciole. La rotation et le zoom d'une projection orthographique SVG
sont accessibles par curseurs ; le nuage accepte aussi le glisser.
Ce n'est ni une PCA ni une carte du sens. Le cosinus et les voisins restent
calculés dans les 32 dimensions, indépendamment de l'affichage.

## Laboratoire GPT-2 facultatif

La dernière étape `16b-transformer-explainer` ouvre le véritable fork de
Transformer Explainer adapté en français, distinct de Luciole. Génération et
inspection se font dans son interface ; il n'existe pas de pont permettant
aux vues Luciole de lire arbitrairement ses tenseurs. Le laboratoire s'ouvre
uniquement dans un nouvel onglet. Après chargement, **Masquer les informations**
agrandit la visualisation à la hauteur de la fenêtre ; **Afficher les informations**
rouvre le bandeau. **Plein écran** et **Quitter le plein écran** contrôlent le
mode du navigateur. Ces commandes ne rechargent ni le modèle ni le prompt.

Le téléchargement des poids (656,7 Mo), du tokenizer et du runtime lourd
attend le bouton interne **Charger GPT-2**. Le montage de l'interface ne vaut
pas consentement au téléchargement. HTTPS ou localhost et WebCrypto sont
nécessaires ; une adresse HTTP distante permet de lire l'interface mais pas
de lancer GPT-2. La prévisualisation `http://ilex-dind-playlab42:5242` est dans
ce dernier cas. La traduction française ne réentraîne pas le modèle.

Les 63 fragments des poids sont vérifiés par SHA-256. Ils peuvent être
préparés sur le même hébergement statique pour éviter une dépendance au
transport distant pendant l'usage, sans les ajouter à Git. Le fork conserve
son build isolé, ses licences et ses commandes reproductibles dans
[`transformer-explainer/README.md`](transformer-explainer/README.md).
La CI prépare cette copie statique avant le build et la publie avec le cours.
Le build global vérifie le manifeste, les tailles et les SHA-256 des fragments ;
il refuse un paquet incomplet avant de remplacer `site/`. `verify:site` effectue
également ce contrôle sur l'archive reçue. Aucun téléchargement ne se produit
pendant le build global lui-même.

Depuis la racine du projet, dans Docker, préparer une première fois les poids :

```sh
npm run prepare:gpt2
npm run build
```

Cette commande explicite télécharge environ 657 Mo depuis la révision épinglée,
réutilise les fragments du cache dont le SHA-256 est correct et prépare les
fichiers publics. Le cache et les poids restent hors Git. Avec des fragments
déjà disponibles, le script du fork accepte `--from` sans téléchargement.
Le site complet doit être servi en **HTTPS**, ou sur le **localhost du navigateur**.
La copie locale résout la dépendance CORS ; elle ne remplace pas cette exigence
de contexte sécurisé pour WebCrypto.

Les téléchargements conservent la session du site (`credentials: 'same-origin'`)
pour fonctionner derrière une prévisualisation authentifiée. Aucun cookie
n'est envoyé à une origine externe. Les erreurs précisent l'étape du chargement
et, pour un fragment inaccessible, son URL ; une erreur réseau générique ne
permet pas à elle seule de conclure à un problème CORS.

Dans Docker, avant le build global, si le fork doit être reconstruit :

```sh
cd parcours/epics/anatomie-llm/transformer-explainer/.source
npm ci --cache ./npm-cache --no-audit --no-fund
node scripts/build.mjs
# Nécessaire après reconstruction du fork : préparer les poids statiques, hors Git.
node --use-env-proxy scripts/local-model.mjs --download
```

Une inférence réelle et les contrôles du laboratoire ont été validés avec
les poids statiques locaux sous une limite mémoire de 8 Gio. Le premier
retest a mesuré un pic de 3,86 Gio pour le cgroup partagé, pas pour le seul
navigateur. Le transport navigateur direct vers les fragments upstream était
bloqué par CORS/proxy dans cet environnement ; il ne doit pas être présenté
comme validé par le succès du chargement local.

## Apprentissage et mesures

Luciole est préentraîné avant publication. **Aucun entraînement dans la page** :
le curseur de sa fiche et de l'étape apprentissage relit 13 points enregistrés
de 0 à 12 000 mises à jour. Il ne remplace pas les poids utilisés ensuite.
Tous les instruments du modèle utilisent les mêmes poids finaux.

Les courbes suivent 64 phrases fixes par lot (32 accords et 32 boîtes),
avec le même mélange de tâches. Elles excluent Tatoeba et les phrases initiales.
La perte est une moyenne par phrase de l'entropie croisée en nats/token ;
les mesures finales sur les lots complets sont distinctes. L'entraînement
échantillonne 15 % de phrases initiales, 15 % Tatoeba, 35 % accords, 35 % boîtes.
Graine 42, Adam, clipping élémentaire ±1, taux 0.0025 vers 0.00025.

Le nombre de mises à jour est fixé à l'avance, sans sélection du meilleur
checkpoint. Le test n'intervient qu'après ce calcul. Les scores portent sur
un seul token cible classé premier parmi tout le vocabulaire, avec
dédoublonnage des prompts. Ils ne mesurent pas des phrases générées complètes.

| Test réservé | Luciole | Référence simple |
|---|---|---|
| Accord « est / sont » | 16 / 16 (100 %) | Toujours « est » : 50 % |
| Objet dans deux boîtes | 90 / 216 (41,7 %) | Dernier objet cité : 50 % |

L'accord peut être résolu à partir de « le / les » : ce résultat ne démontre
pas une maîtrise générale de la grammaire. Sur les boîtes, Luciole ne dépasse
pas la référence. Les échecs sont consultables, pas masqués. L'évaluation
mesure une recombinaison limitée de mots et de patrons connus, avec une seule
graine. Aucune capacité conversationnelle ou de traduction n'est revendiquée.

## Sources et génération

- `_shared/chapters.js` : source éditoriale (texte, sources, défis et notes).
- `glossary.json` : définitions et infobulles du système de glossaire existant.
- `_shared/reading-aids.js` : schémas de lecture et repères d'extraits de code.
- `scripts/generate-llm-anatomy.js` : produit les 24 pages du parcours et leurs
  manifests, plus la lecture de code `slides/17-sources/code.html`.
- `assets/corpus.json` : phrases des trois lots, groupes réservés et provenance.
- `assets/tatoeba.json` : snapshot CC0 multilingue, sources et licences.
- `scripts/prepare-llm-corpus.js` : extraction des 40 IDs relus depuis les
  exports CC0 téléchargés explicitement ; aucun réseau dans le build.
- `scripts/llm-anatomy-corpus.js` : patrons et partition déterministes.
- `scripts/train-llm-anatomy.js` : entraînement reproductible, graine 42,
  12 000 mises à jour Adam avec clipping élémentaire.
- `assets/model.json` : poids arrondis à 7 décimales, hash SHA-256 du corpus,
  architecture, hyperparamètres, pertes et prédictions aux checkpoints.
- `assets/evaluation.json` : mesures complètes et prédictions, liées au SHA-256
  du modèle publié ; les scores sont recalculés dans les tests.

Modifier les sources éditoriales puis régénérer, plutôt que modifier les HTML
produits. La génération éditoriale est explicite ; elle n’ajoute aucune étape
au build global. Les poids sont versionnés et ne sont pas réentraînés au build.
Les éléments intermédiaires de calcul restent dans le navigateur.

## Lecture guidée et clarté

La première page définit LLM, token, prompt, contexte et poids avant de détailler
l'architecture. Les consignes correspondent à l'état initial des instruments.
Les explications précèdent les expériences dans le HTML et à l'écran. Une
navigation « Comprendre · Expérimenter · Vérifier » donne accès aux trois
moments, au clavier comme sur mobile. Les scores et probabilités précèdent
désormais la logit lens, sans changer les identifiants des slides.
Les tokens ajoutés sont surlignés ; revenir en arrière retire aussi ce repère.
À température nulle, le panneau explique que les 100 % résultent du choix du
maximum, sans affirmer une certitude du modèle. Les détails d'entraînement de
la fiche Luciole sont repliés. Le masque causal, le cache, les filtres de tirage,
le débit et la latence disposent d'explications et d'exemples explicites.

La génération et le laboratoire affichent aussi la probabilité du favori
avant réglage et permettent d'ouvrir la distribution initiale. Cela distingue
un choix forcé à 100 % d'une probabilité réellement concentrée. La logit lens
débute sur « le chat », moins contraint que les capitales, sans modifier les
scores ni les poids, et indique la masse des candidats non affichés.

Pour le tirage, les situations sont : plusieurs choix plausibles, favori
dominant et égalité. Les candidats sont des libellés fictifs, pas des tokens
réels. Les scores sont log(p) pour retrouver la distribution choisie à T=1.
Changer un réglage réinitialise les comptes et la graine ; tirer ajoute des
observations à distribution constante, sans simuler une phrase générée.
À T=0 ou à la frontière de top-k, les égalités sont départagées dans l'ordre
des candidats affichés. Aucun réglage ne fabrique de nouvelles connaissances.

Les schémas statiques de Q/K/V reprennent exactement le cas initial inventé
de l'expérience : deux scores égaux et le mélange `[0,5 ; 1]` pour « chat ».
La frise du cache distingue le token traité du token prédit, explique pourquoi
les anciennes requêtes Q ne sont pas nécessaires et sépare paramètres appris,
K/V temporaires et poids d'attention. Une démonstration numérique ne devient
pas pour autant une mesure de performance.

Des volets facultatifs relient tokenizer, embeddings, blocs, Q/K/V, softmax,
cache, apprentissage et traces aux fichiers réels. Le générateur extrait le
code depuis `model.js`, `tensor.js`, `math.js` et le script d'entraînement ;
il échoue si les repères d'un extrait n'existent plus. La lecture complète
locale expose les chemins du dépôt et reste utilisable sans JavaScript.

Les références vérifiées ajoutent cache HF, FlashAttention, DPO, DeepSeek-R1
et DeepSeek-V3. Elles documentent les variantes présentées, sans attribuer
ces capacités à Luciole ni prétendre classer les modèles contemporains.
Les anecdotes historiques sur BPE et le Transformer sont liées aux articles.

Dans le conteneur de développement du worktree :

```sh
docker compose exec dev node scripts/generate-llm-anatomy.js
docker compose exec dev node scripts/train-llm-anatomy.js
make npm CMD="test -- --runInBand parcours/epics/anatomie-llm"
make npm CMD="run test:e2e -- e2e/llm-anatomy.spec.js"
make build-parcours
```

Pour la suite navigateur, utiliser l’environnement Playwright du dépôt
(`make test-e2e` ou sa configuration CDP). Les tests du parcours léger n’autorisent pas les
ressources externes ; les tests du fork GPT-2 sont séparés et documentés.
`e2e/gpt2-local.spec.js` ouvre le laboratoire depuis le cours, charge les 63
fragments locaux après consentement et attend une première génération réelle,
sans réseau externe. Il s'exécute aussi sur l'archive CI, avec un délai maximal
de cinq minutes et plusieurs Go de RAM.
Le script d’entraînement refuse de publier une perte
non finie ou supérieure à 1 nat/token sur son propre corpus.

## Animation de 45 minutes

| Séquence | Étapes | Temps |
|---|---|---|
| La boucle et les unités | 1, 2 | 5 min |
| Carte, vecteurs et position | 4, 5, 6 | 8 min |
| Attention et transformation | 7, 8 | 8 min |
| Choisir et vérifier | 10, 11 | 6 min |
| Coûts et entraînement | 12, 13, 14 | 8 min |
| Laboratoire et synthèse | 15, 16 | 10 min |

Les étapes 3 et 9 constituent des détours selon les questions.
Les numéros de ce tableau désignent les identifiants historiques des pages,
pas leur rang après enrichissement. Les cinq nouvelles étapes peuvent servir
de pauses de clarification ; la visite autonome complète prend environ 110 min.
Chaque page contient des notes repliées : accroche, manipulation, transition.
Repartir de l’état initial avant une démonstration ; les tirages utilisent la
graine 42. Pas de lecture animée automatique. Les matrices possèdent une
région défilable accessible et des valeurs numériques.

L’impression du navigateur produit une version de secours de la page et de
l’état visible. Ce n’est pas un export multi-pages automatique, ni une console
présentateur sur second écran. Conserver des captures des manipulations utiles.
La visite d’une page dans le viewer ne certifie pas une compétence.
