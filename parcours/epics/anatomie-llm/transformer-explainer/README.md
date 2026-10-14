# Transformer Explainer FR — original-gpt2

Fork réel de [poloclub/transformer-explainer](https://github.com/poloclub/transformer-explainer),
révision **bfe50afba10b9b560b84143ee1107d977defa74f**, récupérée par HTTP public le 12 octobre 2026.
Licence **MIT**, copyright © 2022 Polo Club of Data Science, conservée dans
`.source/LICENSE` et dans la page publique de crédits.
Le README amont (auteurs, article, citation et export du modèle) est conservé dans `.source/README.md`.

## Livrable et intégration

- Sources Svelte/SvelteKit/D3 et exporteur ONNX amont : `.source/`.
- Application statique autonome : `public/index.html` et `public/_app/`.
- Crédits, licences et limites : `public/credits.html`.
- Poids : **656 662 664 octets**, soit **656,7 Mo / 626,2 Mio**, 63 fragments.
  Ils ne sont pas versionnés dans Playlab42 et ne sont chargés dans le navigateur qu'après accord.
  Le manifeste inclut taille et SHA-256 de chaque fichier.
- Tokenizer local : Xenova/gpt2, révision **bf2c7f02e0b826c60d03af341171bde20893da66**.
- ONNX Runtime Web **1.23.0**, local ; Transformers.js **2.17.2**, local.
- Aucun remplacement par Luciole, aucune prédiction précalculée visible, aucune API de génération.
- Taille livrée : environ **15,6 Mo de sources** (hors dépendances et poids)
  et **33,5 Mo d'artefact statique hors poids**. Celui-ci n'est pas téléchargé intégralement
  à l'ouverture : le tokenizer et le WASM restent à la demande.

URL publique :

```text
/parcours/epics/anatomie-llm/transformer-explainer/public/index.html
```

Le préfixe d'hébergement est dérivé de l'URL de la page ; une publication sous `/playlab42/`
doit conserver l'arborescence du module. Les tests vérifient aussi un préfixe supplémentaire.

Dans la dernière étape du parcours :

```js
import { transformerExplainer } from '../../_shared/transformer-explainer.js';

const laboratory = await transformerExplainer(document.getElementById('gpt2-laboratory'));
// À la destruction du chapitre : laboratory.destroy();
```

Une sélection annulable peut passer `transformerExplainer(root, { signal })`.
Un signal déjà annulé ou une racine détachée provoque un rejet `AbortError`
(ou la raison personnalisée du signal). Le wrapper nettoie aussi un détachement
pendant la résolution ; après montage, l'annulation appelle automatiquement
`destroy()`, qui est idempotent. Le cours doit toujours détruire le montage lors
d'un reset/navigation, surtout sans signal. Ce montage est un lien : il ne crée
aucune session ONNX. Le laboratoire ouvert dans son onglet reste indépendant
de la navigation du cours ; fermer cet onglet termine son exploration.

L'entrée `transformerExplainer(root)` est réservée à **16b-transformer-explainer**,
après la synthèse et avant les annexes. Elle reprend automatiquement le thème du
document du chapitre. `mountTransformerExplainer(root, { theme, url })` reste
disponible pour un montage avec options explicites. Ces montages ne déclenchent
aucun téléchargement externe ; le consentement se fait dans le laboratoire.
Une URL personnalisée doit rester sur la même origine.

### Contrat pour les autres slides

Le montage retourne `{ link, capabilities, destroy }`. L'export sans effet réseau
`transformerExplainerCapabilities` décrit le seul modèle du fork : GPT-2 small 124M.
Ce sont des métadonnées de capacité, pas l'état d'une session ou du déploiement.
Il annonce les commandes accessibles **dans le nouvel onglet** et les URL stables des fichiers
locaux `tokenizer.json` / `tokenizer_config.json`, révision Xenova épinglée ci-dessus.
Les autres slides peuvent réutiliser ces assets avec leur propre moteur de tokenisation.
Le wrapper ne fournit **aucune fonction** de tokenisation, génération, attention ou
extraction de tensors : `programmatic` expose explicitement trois valeurs `false`.
Il n'y a ni protocole `postMessage` ni contrat d'accès aux stores internes Svelte.
`destroy()` retire le lien et son écouteur d'annulation ; il ne ferme pas l'onglet
déjà ouvert. BERT et T5 ne sont pas des modèles de ce fork.

HTML du conteneur :

```html
<div id="gpt2-laboratory"></div>
```

Le cours propose uniquement le nouvel onglet (`target="_blank"`,
`rel="noopener noreferrer"`), sans iframe ni choix de modèle dans le final.
Après chargement, **Masquer les informations** libère la hauteur de la fenêtre
pour la visualisation ; **Afficher les informations** restaure le bandeau et
les crédits. Ces actions conservent le modèle, le prompt et l'exploration.
**Plein écran** utilise l'API du navigateur lorsqu'elle est disponible ; on peut
le quitter avec le bouton ou Échap. Un refus est signalé sans interrompre le calcul.
Le schéma garde sa largeur minimale de 1300 px avec défilement interne.

Alternative HTML, sans module de montage :

```html
<a href="../../transformer-explainer/public/index.html" target="_blank" rel="noopener noreferrer">
  Ouvrir le laboratoire GPT-2 dans un nouvel onglet ↗
</a>
```

## Fabrication, exclusivement en Docker

Le lockfile du fork intègre les correctifs de sécurité des dépendances. Les
overrides conservent les branches compatibles de `brace-expansion`, utilisent
le même fork borné de `braces` que Playlab42 et mettent à jour `protobufjs`,
`sharp` et le parseur PostCSS. Le cours importe uniquement le tokenizer de
Transformers.js ; les poids et le runtime ONNX restent épinglés séparément.
Après toute mise à jour, reconstruire `public/` et ses notices de licence,
puis vérifier les tests dédiés et les tests navigateur du parcours.

Depuis le sous-répertoire `.source/` **dans un conteneur Node 26** :

```sh
# Seulement lors de la restauration de dépendances absentes.
npm ci --cache ./npm-cache --no-audit --no-fund
node --test src/utils/*.test.js scripts/*.test.mjs
node scripts/build.mjs
```

La chaîne dédiée construit `../public/`, copie le moteur WebAssembly local et
produit les notices de licence des dépendances. Aucun téléchargement des poids
n'est nécessaire au build. Le manifeste fourni est issu des fragments exacts de
la révision amont ; pour le régénérer après une mise à jour volontaire :

```sh
node scripts/model-manifest.mjs /chemin/vers/model-v2
```

Correctifs de compatibilité indispensables dans le fork : Vite 7.3.7 compatible
avec le plugin Svelte 6, chemins Sass absolus, casse Linux `Popovers/`, imports
client-only du tokenizer pour ne pas lancer ONNX natif pendant le prerender.
Le build supprime les appels de télémétrie et utilise un identifiant de version fixe.
Il garde les avertissements Svelte/Sass historiques visibles dans son journal.
Les liens SVG et inspecteurs sont positionnés dans les coordonnées de la surface
embarquée, et non celles du document : l'introduction et le scroll ne décalent pas
les liens d'attention ou les contours des blocs.

### Poids statiques locaux, sans backend ni relais

Le mode recommandé pour un réseau bloquant la source amont est une copie statique
servie **sur la même origine que le cours**. Dans le conteneur Docker isolé :

```sh
# Action opérateur explicite : 656,7 Mo depuis la révision publique épinglée.
# Utiliser le proxy normal de l'environnement s'il est configuré, sans contourner un refus HTTP.
node --use-env-proxy scripts/local-model.mjs --download
# Ou installer des fragments déjà disponibles ; aucune requête réseau :
node scripts/local-model.mjs --from /chemin/des/fragments
# Pour un rebuild avec le cache opérateur déjà préparé, aucune requête réseau :
node scripts/build.mjs --local-model=.model-cache
```

Chaque fragment est vérifié (taille + SHA-256) **avant** d'être copié. Le script ne
publie `public/model-local-manifest.json` qu'après réussite des 63 fragments.
Ce descripteur et `public/model-v2/` sont exclus de Git, comme `.source/.model-cache/`.
Le descripteur conserve la provenance amont ; seules les URL de transport deviennent
locales. Un HTTP 403 arrête la préparation, sans alternative ni contournement.
L'application lit uniquement ces petits manifestes locaux à l'ouverture, annonce
la source choisie avant consentement et préfère la copie statique si son descripteur
existe. Sans copie locale, elle annonce et utilise la source publique épinglée.
Aucun poids/runtime WASM/tokenizer n'est chargé avant le clic.

Publier les 63 fragments et le descripteur **ensemble** avec l'artefact : environ
**690,1 Mo** au total. Ne pas les ajouter au dépôt Git. Un build classique régénère
`public/` et retire la copie locale : restager ensuite les poids, ou utiliser
`--local-model` avec une source hors de `public/`. Les licences publiques doivent
rester dans l'archive. Les fichiers locaux ne constituent pas une garantie hors ligne :
le navigateur doit encore les recevoir du site.

### Build global et publication

La CI exécute `npm run prepare:gpt2` avant le build global. Le workflow navigateur
autonome prépare également les poids ; avec `prebuilt`, il utilise exclusivement
ceux de l'archive reçue. Le build et `verify:site` refusent des poids locaux
absents, divergents du manifeste amont ou corrompus. La publication ne dépend
donc plus des requêtes du navigateur vers GitHub.
Elle lance également `npm run test:gpt2` : chargement, manifestes, cache,
géométrie et montage, avec le runner natif Node. Le test de traduction reste
dans la suite complète du fork ci-dessous : il nécessite le compilateur
TypeScript de son lockfile isolé, dont l'API diffère du TypeScript 7 racine.

1. Restaurer les dépendances propres de `.source/` dans un sous-répertoire isolé
   (ne pas toucher aux `node_modules` du projet).
2. Exécuter `node scripts/build.mjs` depuis ce sous-répertoire avant `build-site.js`,
   ou publier l'artefact `public/` livré si aucune modification du fork n'est faite.
3. L'actuel `build-site.js` copie déjà `parcours/` et exclut les segments cachés :
   il publie `public/`, mais **pas** `.source/`.
4. Dans une archive de sources, inclure `.source/`, son lockfile et ses licences.
   Dans une archive publique, garder `public/licenses/` et `credits.html`.
5. Exclure le fork tierce partie `.source/` et les sorties générées `public/_app/`
   des linters de sources globaux (comme les autres dépendances vendoriées).
   Les tests dédiés restent exécutables séparément ; les notices des dépendances
   propres du fork doivent rester dans l'archive/SBOM publique.

Séquence reproductible, dans un conteneur Node 26 (depuis la racine du worktree) :

```sh
cd parcours/epics/anatomie-llm/transformer-explainer/.source
# Si node_modules manque : dépendances du fork seulement.
npm ci --cache ./npm-cache --no-audit --no-fund
node scripts/build.mjs
# Recommandé pour un déploiement autonome sans accès amont depuis le navigateur.
node --use-env-proxy scripts/local-model.mjs --download
cd ../../../../..
npm run build
```

`npm run build` global **ne construit pas le fork** : le construire/préparer avant
ce lancement, ou réutiliser `public/` livré. `build:ts` ignore les dossiers cachés ;
`build:site` copie l'arborescence publique, y compris les poids locaux présents,
sans connaître les exclusions Git. Aucun ajout de CSS au viewer n'est nécessaire :
le lien utilise les styles du cours et le nouvel onglet charge ses propres CSS locaux.

Les 40 fichiers de base de `public/` sont versionnables/reconstructibles. Les 63
fragments et le descripteur local ne le sont pas : un checkout propre exige
l'étape explicite de préparation. Les copies présentes dans le worktree ne
constituent pas une publication. Le pipeline conserve les licences.
`e2e/gpt2-local.spec.js` vérifie sur le site construit une première génération
réelle et l'absence de requêtes externes, avec les fragments protégés par un
cookie de session de test. L'ancienne politique `credentials: 'omit'` échoue
dans ce scénario avant de charger le modèle.

**Prévisualisation HTTP :** `http://ilex-dind-playlab42:5242` n'est pas une origine
HTTPS/localhost pour le navigateur utilisateur. Le shell peut s'y afficher,
mais le garde WebCrypto refuse le chargement : aucune inférence GPT-2 n'est
certifiée à cette URL. Les validations natives ont lieu sur le localhost du
navigateur de test ; publier en HTTPS pour l'usage normal.

## Confidentialité et fonctionnement

Le consentement précède le chargement du tokenizer, du runtime WASM et des poids.
La lecture automatique des petits manifestes de déploiement reste strictement locale.
Les requêtes de poids sont des GET avec `credentials: 'same-origin'`, sans
referrer, sans corps et sans prompt. Elles conservent donc la session d'accès
au site derrière un proxy authentifié, sans envoyer de cookie à une autre
origine. Elles ciblent les fichiers publics à la révision épinglée sur
`raw.githubusercontent.com` en mode distant, ou vers le même site en mode copie locale.
Le serveur distant peut naturellement voir l'IP.
Une CSP restreint les scripts aux ressources locales et les connexions à l'origine
du site et à cette source publique. GTM, Analytics et Google Fonts ont été retirés.

Les fragments sont vérifiés par SHA-256. Leur fusion utilise un seul grand tampon
et deux fragments en transit, plutôt que deux copies intégrales des poids.
Le Cache API est facultatif : refus, quota et corruption ne masquent pas les erreurs.
Une reprise conserve les fragments vérifiés lorsque le cache fonctionne.
Le cache HTTP implicite est désactivé pour éviter de doubler celui des poids.
Les erreurs de réseau, d'intégrité, d'initialisation et de calcul sont visibles ;
aucune erreur ne déclenche un résultat fictif.
Le téléchargement peut être annulé ; une création de session ONNX déjà engagée
ne peut pas être interrompue immédiatement, mais sa session est libérée ensuite.

**HTTPS ou localhost est nécessaire** pour WebCrypto. Aucun mode hors ligne
n'est garanti, ni au premier usage ni après un chargement réussi.
GPT-2 est principalement anglophone. Ses générations sont explicitement identifiées
comme produites par GPT-2 et peuvent être fausses, biaisées ou inappropriées.
Les notices incluent la licence MIT modifiée d'OpenAI (responsabilité et attribution
des générations), plus les licences des dépendances.

Le guide et les commandes principales sont en français. Q/K/V, logits, softmax,
MLP et GELU restent standards ; certaines fenêtres avancées de poids conservent
des formulations anglaises de l'amont. Prompts libres, limités à 25 mots et 48 tokens.
Les étapes du guide restent liées aux callbacks interactifs amont.
Le schéma conserve un fond clair pour la lisibilité des matrices ; l'habillage
honore le thème sombre Playlab42.

## Validation et limite de l'environnement

Tests ciblés disponibles :

```sh
node --test src/utils/*.test.js scripts/*.test.mjs
# Chromium accessible via CDP, sans toucher au serveur global :
BROWSER_CDP=http://adresse-du-navigateur:9222 node scripts/browser-test.mjs
# Facultatif : vrais fragments amont extraits, pas un modèle de remplacement :
MODEL_FIXTURE=/chemin/model-v2 node scripts/browser-test.mjs
# Test réel par relais streaming local, exclusivement dans le harnais de test :
REAL_DOWNLOADS=1 NATIVE_HTTP=1 TEST_ORIGIN=http://localhost:5253 \
  BROWSER_CDP=http://adresse-du-navigateur:9222 \
  node --use-env-proxy scripts/browser-test.mjs
# Copie statique préparée : vrai HTTP local, aucun relais/fichier de substitution :
LOCAL_MODEL=1 NATIVE_HTTP=1 TEST_ORIGIN=http://localhost:5263 \
  BROWSER_CDP=http://adresse-du-navigateur:9222 node scripts/browser-test.mjs
# Shell + garde WebCrypto uniquement (absence d'API simulée, aucune inférence) :
LOCAL_MODEL=1 NATIVE_HTTP=1 SHELL_ONLY=1 MISSING_WEBCRYPTO=1 \
  TEST_ORIGIN=http://localhost:5263 BROWSER_CDP=http://adresse-du-navigateur:9222 \
  node scripts/browser-test.mjs
# Diagnostic natif du seul premier fragment épinglé, sans relais/fallback :
BROWSER_CDP=http://adresse-du-navigateur:9222 node scripts/transport-test.mjs
```

Vérifiés : build statique, huit tests d'intégrité/cache/annulation/géométrie,
consentement sans appel externe/runtime/tokenizer, erreur HTTP 503 et retry,
absence de prédictions simulées, thème sombre, shell mobile, chemins préfixés,
API de montage historique, hauteur minimale d'iframe, plein écran/fallback et destruction
(l'intégration actuelle par nouvel onglet remplace cette iframe).
Un neuvième test valide l'entrée de registre `transformerExplainer(root)`, la reprise
du thème clair/sombre et son nettoyage, sans aucun appel réseau.
Un dixième test vérifie la traduction des vingt pages sur le tableau du guide,
sans modifier les sélecteurs ni les callbacks interactifs.
Deux autres tests couvrent la préparation statique atomique, corruption/refus 403,
les chemins préfixés et le refus d'une source externe non épinglée. Le contrat du
wrapper et l'absence d'API tensors sont vérifiés par le test de montage.
Le script peut produire des captures dans `browser-results/` (non publiées).

**L'inférence réelle est vérifiée avec les 63 fragments et leurs SHA-256**, sous
un cgroup de **8 589 934 592 octets (8 Gio)**. Un contrôle indépendant a obtenu
une première continuation après 82,807 s, le token suivant après 3,654 s et un
prompt libre après 4,076 s ; son pic partagé échantillonné était de
**4 148 744 192 octets**, sans nouveau OOM. Ce pic inclut les processus du cgroup :
ce n'est pas une mesure isolée de la mémoire de GPT-2 ni un minimum garanti.

Le contrôle final du fork compilé vérifie aussi le guide français, un nouveau
prompt plus court, l'ouverture de la matrice d'attention, la sélection de tête
à la souris puis au clavier, le passage au bloc suivant, la température 0,8 → 0,9,
les stratégies top-p et top-k, et l'absence d'erreur JavaScript. Il audite 63 GET
sans corps, referrer ni prompt, puis les chemins préfixés, le shell mobile sombre,
l'erreur/reprise et le montage/destruction du laboratoire. Les contrôles ont corrigé
les commandes de tête masquées en attention ouverte et des références DOM supprimées
lorsqu'un nouveau prompt contient moins de tokens.

**Le nouveau contrôle réel utilise des fichiers statiques locaux, sans relais.**
Les 63 fragments téléchargés explicitement par l'opérateur ont été vérifiés puis
servis par un serveur HTTP statique ordinaire sur la même origine. Le navigateur
les vérifie à nouveau : `verification.json` annonce
`native same-origin static weights, no relay`, `success: true`, les 63 fragments,
et aucune erreur JavaScript. La température passe à 0,9, top-p à 0,6 et top-k à 6.
La suite complète n'effectue aucun appel externe en ce mode, avant **ou après**
consentement. Cette validation ne dépend ni d'un proxy de modèle côté site ni de
réponses HTTP substituées lors des 63 téléchargements réels.

Un contrôle supplémentaire du shell valide la garde avant tokenizer/runtime/poids
en simulant l'absence de `crypto.subtle`, avec erreur et reprise visibles :
`shell-verification.json`. Ce n'est pas une certification d'un hébergement HTTP
non sécurisé ; l'essai sur IP privée était bloqué par le proxy (HTTP 407) avant
que l'application soit servie. HTTPS/localhost reste nécessaire et annoncé.

**Limite restante : navigateur → source publique direct non certifié ici.**
Dans cet environnement cloud, Chromium reçoit un blocage CORS/proxy sur
`raw.githubusercontent.com` (absence d'en-tête `Access-Control-Allow-Origin`),
alors que curl et Node via le proxy autorisé obtiennent HTTP 200.
`direct-transport.json` conserve ce diagnostic natif du premier fragment :
`Failed to fetch`, aucun fragment certifié, aucune inférence certifiée.
Le retest historique indépendant avait employé un relais localhost des vrais octets.
Ce relais de harnais reste **exclusivement un outil de test**, pas une solution
livrée au site. Avec la copie statique préparée, il n'est plus nécessaire.
Avant activation, publier les assets locaux et leur descripteur ; si l'on choisit
le mode distant, certifier séparément son transport depuis le navigateur cible.
Un blocage produit une erreur avec l'étape et le fichier concernés et un bouton
de reprise, jamais une génération fictive. « Failed to fetch » ne suffit pas
à distinguer une erreur réseau, un refus d'accès du proxy et un blocage CORS.

Historique : le précédent cgroup de **2 Gio** avait causé un OOM/crash avant
l'initialisation du modèle (50/63 fragments dans l'essai optimisé). Prévoir un
navigateur disposant de plusieurs Go effectivement disponibles. La démo globale,
son serveur permanent et les sources Luciole n'ont pas été modifiés par ces tests.
