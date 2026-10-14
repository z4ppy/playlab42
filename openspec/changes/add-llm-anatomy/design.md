# Design

## Expérience

Direction éditoriale : atlas scientifique avec les couleurs du thème Playlab42,
titres compacts et repères numérotés en forme d'atome. Une question par
étape, une explication avant l'expérience principale, une limite et un défi.

La lecture suit « Comprendre → Expérimenter → Vérifier » dans l'ordre du DOM,
avec liens d'ancrage et titres focalisables. Les schémas natifs HTML restent
lisibles sans JavaScript et s'adaptent au mobile. Les scores précèdent la
logit lens, les IDs historiques restent stables. Les longs calculs et le
code sont repliables pour préserver un premier niveau de lecture accessible.

Les extraits sont lus dans les fichiers source pendant la génération, sans
copie manuelle susceptible de diverger. Une annexe locale `code.html` publie
une lecture échappée du code complet avec chemins de dépôt, sans l'exécuter.
Elle accompagne la version du cours même avant publication de la branche.
Pas de carrousel automatique. Les animations respectent reduced-motion.
Les données saisies restent locales et sont rendues comme texte.
Dans le viewer, masquer l'en-tête et la progression redondants avec le portail.
En standalone, conserver ces moyens de navigation et de changement de thème.
Après EOS, conserver le passage avant qui l'a choisi et proposer une nouvelle
génération depuis le prompt, sans faire croire que la séquence continue après
son marqueur de fin. La relance conserve les réglages et réinitialise la graine.

## Architecture

Epic standard HTML avec contenu éditorial statique, scripts ES modules locaux.
Styles partagés au niveau de l'epic, thème Playlab42, liens internes compatibles
avec le viewer. Aucun changement de catalogue généré versionné.

Le laboratoire exécute un petit décodeur causal à deux blocs, quatre têtes,
positions apprises, RMSNorm sans affine et MLP ReLU. Ce choix est annoncé :
il ne s'agit ni de GPT-2 ni d'un modèle généraliste. Les poids sont appris
sur un corpus mixte ; corpus, graine, paramètres et métriques sont publiés.
L'entraînement utilise une différentiation automatique matricielle en JS,
hors navigateur. Le même graphe réalise l'inférence, sans gradients.

La tokenisation du mini-modèle est lexicale avec vocabulaire fermé et erreurs
explicites pour les mots inconnus. Une seconde expérience compare caractères,
octets et fusions BPE pédagogiques, sans prétendre mesurer GPT ou Llama.
Les limitations du corpus et de la tokenisation sont toujours visibles.
Une comparaison distincte charge à la demande les définitions originales
GPT-2, BERT uncased et T5 small avec Tokenizers.js, depuis des fichiers locaux.
Les pièces internes et identifiants sont affichés avec les règles de
normalisation ; aucun marqueur spécial n'est ajouté automatiquement.
Ces identifiants ne sont jamais injectés dans les poids de Luciole.

L'atlas d'embeddings sélectionne trois coordonnées parmi trente-deux, puis applique
une rotation et une projection orthographique SVG. Ni PCA ni nouvelles
coordonnées apprises : les axes sont explicitement ceux des poids originaux.
La similarité cosinus et les voisins restent calculés sur les trente-deux dimensions.
Le vocabulaire propre à chaque expérience est déclaré dans `chapterTerms`.
La génération refuse un terme sans définition. Les infobulles utilisent le
composant de glossaire existant ; une liste HTML repliable fournit les mêmes
définitions sans survol ni JavaScript. Les étapes de fondation utilisent des
nombres inventés explicitement identifiés avant les vues du modèle réel.
Les contrôles sont accessibles au clavier, sans WebGL ni dépendance 3D.

## Données et exactitude

Pas de benchmark récent non vérifié. Les formules de mémoire et de roofline
sont des estimations avec hypothèses visibles. MoE, RoPE et effort sont des
expériences contrôlées, pas des observations attribuées à un modèle commercial.
La logit lens et l'attention proviennent des activations du mini-modèle.

L'expérience de tirage utilise cinq libellés fictifs et trois distributions
initiales contrôlées. Leurs log-probabilités passent dans la même fonction de
décodage que Luciole, avec top-k optionnel avant min-p et top-p. Les candidats
restent dans un ordre fixe dans les graphiques avant/après ; les exclusions
sont visibles à zéro et leur cause est consultable. Chaque action ajoute un
ou cent tirages à distribution constante. Modifier un réglage remet les
comptes et la graine à zéro. Aucun poids de modèle n'est chargé dans cette vue.

Les vues de génération conservent les vrais calculs et distinguent la
distribution initiale à T=1 du choix après réglage. La logit lens commence
avec « le chat », sans amplifier ni modifier les scores, et indique quelle
masse de probabilité n'est pas représentée par les candidats affichés.
Une attention n'est jamais présentée comme une preuve causale.

### Luciole enrichi

Le choix utilisateur `visualization-only` exclut l'entraînement et les poids
personnels dans le navigateur. Le modèle publié compte 38 720 paramètres,
333 tokens de vocabulaire, une dimension de 32, un MLP de largeur 64 et un
contexte de 32 tokens. Il est ajusté pendant 12 000 mises à jour Adam,
graine 42, sur 1 512 phrases. Les phrases initiales et Tatoeba sont
suréchantillonnées explicitement pour rester visibles dans ce corpus mixte.

Tatoeba : 40 phrases issues des exports officiels CC0, 16 FR, 16 EN et 8 ES,
relues avant sélection. Les textes sont conservés sans modification dans
un snapshot local, avec ID, source, licence et empreinte des archives.
Le vocabulaire est construit uniquement sur les phrases d'apprentissage,
avec la même fonction NFC/minuscules/découpage lexical que l'inférence.
Ponctuation, apostrophes, espaces, marqueurs BOS/EOS et mots inconnus sont
expliqués par un instrument qui utilise ces mêmes fonctions.

Les patrons synthétiques sont séparés par groupes avant optimisation :
paire sujet/lieu pour l'accord, paire non ordonnée d'objets pour la restitution
dans deux boîtes. Une paire ne traverse jamais les lots, même lorsque
l'ordre, la couleur ou la requête change. Validation et test contiennent
264 phrases chacun, avec des mots et patrons connus. La validation est
suivie pendant le calcul ; le test est évalué après la dernière mise à jour,
sans sélection de checkpoint. Cela n'est pas un test du langage naturel.

Les 13 checkpoints conservent pertes et prédictions, pas leurs poids.
Le curseur relit ces observations sans modifier l'inférence finale.
Les courbes portent sur 64 phrases fixes de chaque lot, moitié accords,
moitié boîtes. Les mesures finales portent sur les lots complets.
Le score de tâche est le top-1 du token cible dans le vocabulaire entier,
avec dédoublonnage des prompts. Références simples : toujours « est » et
dernier objet cité. Les échecs restent consultables, même quand le modèle
fait moins bien que cette référence.

## Hors ligne et repli

Toutes les ressources nécessaires à Luciole et aux tokenizers sont locales. Le paquet doit être servi
par HTTP ; une première visite ne crée pas un cache hors ligne du site.
Les textes et schémas restent lisibles sans JS. En cas d'échec de chargement
des poids, l'interface montre l'erreur et une commande de nouvelle tentative.
L'impression conserve le contenu éditorial et l'état visible des expériences.

## Choix et progression pour les novices

Une commande compacte reste dans l'expérience, jamais dans un nouveau bandeau
redondant avec le viewer. Le modèle de génération détermine son tokenizer ;
la comparaison de tokenizers est indépendante et ne charge pas les poids de
BERT ou T5. L'accès au laboratoire GPT-2 est réservé au final. Les autres
vues de modèle identifient Luciole sans sélecteur ni mention GPT-2 et ignorent
une ancienne préférence incompatible. Aucun calcul Luciole ne porte une
étiquette GPT-2.

Le tokenizer reste une préférence commune aux comparaisons. Les anciens choix
de modèle ne pilotent plus les chapitres. Le final propose uniquement un lien
vers un nouvel onglet GPT-2 ; aucune iframe de laboratoire n'est montée.
Quitter le chapitre ne ferme pas l'onglet autonome.

Chaque étape propose un aller-retour entre explication et manipulation.
L'ouverture définit LLM, token, prompt et contexte avant les détails techniques.
La continuation générée est surlignée ; à température nulle, les 100 % sont
expliqués comme un choix forcé du décodage, sans certitude sur la vérité du texte.

Les cas conceptuels restent identifiés comme tels. Luciole et GPT-2 ont des
positions apprises et sont denses : RoPE et MoE ne leur sont pas attribués.
Le cache est expliqué par prefill puis decode, couche par couche, avant
son estimation mémoire. Une animation conceptuelle n'est pas une mesure
d'accélération du moteur Luciole, qui recalcule toujours son contexte.

La première étape définit MLP. Q/K/V précède ses usages dans les positions :
projections apprises, scores, masque causal, softmax puis mélange des V.
Les petits nombres inventés sont distingués des traces réelles. Les détails
mathématiques approfondissent l'explication simple plutôt que la remplacer.

GPT-2 utilise le vrai fork adapté et un chargement volontaire distinct.
Une session lourde ne doit pas être multipliée silencieusement ; l'ouverture
d'un laboratoire dédié réutilisable est explicite. Les prompts restent
locaux. Échec réseau, contexte non sécurisé et manque de mémoire doivent
être visibles et ne déclenchent jamais une inférence simulée.

Après chargement, le bandeau d'information peut être masqué et réaffiché, avec
transfert du focus clavier. La visualisation occupe alors la hauteur disponible
sans recréer la session. Une commande distincte active le plein écran natif ;
sa sortie par bouton ou Échap reste synchronisée avec l'interface.

## Vérification

Tests numériques : gradients par différences finies, causalité, distributions,
bornes, apprentissage et répétabilité. Tests navigateur : chaque expérience,
viewer, clavier, mobile, thèmes, absence de requêtes externes et échec réseau.
Relecture des états et captures 1280×900 et 390×844.

## Distribution des poids GPT-2 sur la même origine

La CI prépare les 63 fragments avant le build global via `prepare:gpt2`.
Cette étape explicite réutilise le script du fork et vérifie chaque SHA-256.
Les poids et leur cache restent hors Git. Le build standard ne télécharge rien,
mais refuse une copie absente ou divergente du manifeste amont versionné avant
de remplacer le site précédent. `verify:site` applique le même contrat à l'archive.
Le navigateur charge donc les poids depuis le site HTTPS, après consentement,
sans dépendre du transport CORS vers GitHub. Un test navigateur du cours attend
une véritable première génération avec les 63 fragments locaux. La copie locale
ne lève ni l'exigence WebCrypto ni les besoins mémoire du modèle.

Le chargement utilise `credentials: 'same-origin'` pour conserver la session du
proxy de prévisualisation sans transmettre de cookie à une origine externe.
Le test navigateur exige un cookie sur les fragments et vérifie une véritable
inférence. Les erreurs indiquent l'étape et le fichier au lieu d'attribuer
toute erreur de fetch à CORS.
