# Qualité logicielle : pratiques et contrôles

La qualité combine **conception, comportements vérifiés, revue et exploitation**.
Un linter, un pourcentage de couverture ou un audit vert ne la certifie pas.
Ce guide est la référence commune aux contributeurs et aux skills ; la
[carte de l'usine](software-factory.md) décrit la chaîne de livraison.

## Le socle automatisé

| Contrôle | Politique dans le dépôt | Limite |
|----------|-------------------------|--------|
| ESLint JS et scripts HTML | Erreurs et warnings bloquants ; eslint-plugin-html 8.2.1, pas d'eval, `Function` dynamique ni URL JavaScript | Pas de lint du markup ; attributs événementiels refusés par un test de politique |
| Biome TypeScript | Version 2.5.15, preset recommandé, syntaxe et règles `.ts`, warnings bloquants | Pas d'analyse utilisant le compilateur TS ni de couverture des plugins de sécurité ESLint |
| ESLint Security | Plugins 4.2.0 / 4.1.5 verrouillés, configuration flat, gate JS et scripts HTML ciblé | Propriétés DOM et heuristiques consultatives ; pas de règles ESLint sécurité sur TS |
| TypeScript | Sources TS strictes et signatures réelles des six moteurs | Les corps JS ne sont pas tous analysés ; la transpilation ne vérifie pas les types |
| Jest | Tests avec seuils ciblés ci-dessous | Couverture de lignes, pas qualité des assertions |
| Playwright | Interactions, clavier, thèmes et ressources du site préparé | Socle Chromium, pas tous les navigateurs |
| npm audit | Seuil modéré bloquant, dépendances de fabrication incluses | CVE connues au moment de l'exécution ; panne du registre = échec |
| Trivy | Outil 0.75.0 vérifié ; scan partagé CI/audit, vulnérabilités/secrets HIGH et CRITICAL bloquants, dépendances de développement incluses | Base évolutive ; pas un gate complet de configuration Docker |
| OpenSpec | Structure stricte des exigences et changes | Ne vérifie pas le comportement du code |

La CI réutilisée avant publication exige lint qualité JS/HTML/TS et sécurité JS/HTML, tests, types,
audit npm, Trivy, OpenSpec, navigateur et build. Build exige le succès de
Security lint et du scan Trivy partagé. Le workflow d'audit complémentaire
reste séparé et conserve certains diagnostics consultatifs. Le
rapport de sécurité affiche les états réels des jobs : une analyse annulée,
ignorée ou sans résultat exploitable ne devient pas « aucun problème ».
Un succès peut conserver des diagnostics hors du périmètre bloquant :
ESLint cible des règles précises, Trivy le seuil HIGH/CRITICAL, Hadolint reste consultatif.
Les jobs d'audit n'ont par défaut que la lecture du dépôt ; seuls l'upload SARIF
et le commentaire PR reçoivent leurs permissions d'écriture respectives.

### Couverture progressive, pas un objectif global artificiel

Les seuils `jest.config.js` s'appliquent à `test:coverage`, exécuté en CI :

| Source | Branches | Fonctions | Lignes / statements |
|--------|----------|-----------|---------------------|
| `lib/seeded-random.js` | 100 % | 100 % | 100 % |
| `scripts/build-site.js` | 80 % | 100 % | 80 % |
| `scripts/check-deployment.js` | 80 % | 100 % | 80 % |
| `scripts/lib/build-utils.js` | 100 % | 100 % | 100 % |
| `scripts/og-fetcher.js` | 85 % | 100 % | 90 % |
| `scripts/lib/artifact-inventory.js` | 85 % | 100 % | 100 % |
| `app/events.js` | 95 % | 100 % | 95 % |
| `app/game-loader.js` | 90 % | 100 % | 95 % |
| `app/settings.js` | 80 % | 100 % | 100 % |
| `games/checkers/engine.js` | 90 % | 100 % | 95 % |
| `games/triomino/engine.ts` | 95 % | 95 % | 95 % |
| `tools/relativity-lab/src/Simulation.js` | 90 % | 100 % | 100 % |
| `scripts/coverage-report.js` | 80 % | 90 % | 80 % |
| Clavier/messages du portail ; events/clavier/chargement/messages du lecteur | 100 % | 100 % | 100 % |
| `lib/parcours-viewer.js` | 95 % | 100 % | 100 % |
| `lib/local-data.js` ; modules `lib/local-data/*.js` | 85 % ; 95 % | 100 % | 100 % |
| Moteur Diese & Mat, chaque module | 90 % | 100 % | 98 % lignes / 95 % statements |
| `games/go-9x9/engine.js` | 98 % | 100 % | 99 % |
| Tetris : racine ; modules extraits | 98 % ; 100 % | 100 % | 100 % |
| Triomino : placement et scoring extraits | 100 % | 100 % | 100 % |
| Helpers de validation/déploiement/bilan extraits | 100 % | 100 % | 100 % |
| Clavier App Diese & Mat ; forces Particle Life | 100 % | 100 % | 100 % |
| Simulation Particle Life | 85 % | 100 % | 100 % |
| Rapport Code quality | 75 % | 90 % | 90 % |

Ces composants protègent déterminisme, portail, moteurs, outils et livraison. Les seuils
ont été choisis après mesure, pas pour imposer 80 % à tout le dépôt.
Il n'y a **pas de seuil global**, ni de blocage universel du code modifié :
Codecov reste une intégration distincte, avec upload non bloquant.
Ajouter ensuite des seuils aux moteurs et modules partagés, après lecture des
scénarios et couverture des erreurs. Ne pas réduire les seuils pour verdir une PR.

```bash
make lint
make security-eslint
make typecheck
make npm CMD="run test:coverage -- --runInBand"
make npm CMD="run audit:dependencies"
make openspec-validate
```

Tout runtime passe par Docker. Ne pas lancer `npm audit fix --force` : proposer
une mise à jour ciblée, vérifier ses contrats et conserver le lockfile.

### Périmètre du lint de sécurité

`eslint.security.config.js` active les règles d'exécution dynamique, URL de
script, buffer obsolète, désactivation d'échappement Mustache, caractères bidi
et `no-unsanitized/method`. Elles échouent réellement et fournissent un rapport
JSON avec `lint:security -- --format json --output-file …`.
Les chemins inexistants `src/`, l'installation à la volée de plugins et les
échecs transformés en succès ont été retirés des commandes locales et CI.

### Couverture du lint des sources

`make lint` appelle `lint:js` puis `lint:ts`, avec propagation des échecs.
ESLint parcourt le dépôt, y compris les configs et JS de la documentation ;
ses HTML exposent uniquement les scripts exécutables. JSON, importmaps et
exemples échappés ne sont pas du JS. Le scope est `module` par défaut ;
des scripts classiques partageant des variables exigent un `sourceType: script`
explicite dans leur configuration, vérifié par une fixture réelle.
L'indentation de quatre espaces des anciens supports est conservée, pas ignorée.

Biome inclut les sources, tests et déclarations `.ts` (14 fichiers suivis lors
du lot 3), avec son parser indépendant de TS 7. Formatter et assist sont
désactivés : ce lot n'impose pas une migration de formatage.
Les tests de vrais CLI vérifient syntaxe invalide, règle sémantique,
warnings fatals, diagnostics JSON et exclusions ; une entrée ignorée ne
constitue pas un succès de lint. Les diagnostics informatifs ne bloquent pas.
La limite par défaut de taille de fichier et le reporter JSON expérimental
restent des limites de l'outil ; `.tsx` n'est pas inclus dans ce dépôt sans JSX.

Dépendances/vendor et sorties `dist`, `coverage`, `data`, `site`, `docs/site`,
`test-results` et `playwright-report` sont exclus. Les attributs événementiels HTML ne sont pas analysés par le
plugin : ceux existants ont été migrés vers des listeners lintés et un test
de politique en refuse la réintroduction, y compris dans les templates.
`lint:fix` peut aider, mais son diff et le lint sans `--fix` restent à vérifier :
le fixer HTML peut déplacer l'indentation de remplacements multiligne.

`make security-eslint-advisory` exécute séparément les heuristiques DOM-property,
regex, accès calculés, chemins de fichiers, processus et timing. Les warnings
sont visibles, non bloquants ; les erreurs du gate hérité restent bloquantes.
La mesure initiale a montré 783 warnings, dont 71 usages de propriétés DOM :
il faut vérifier leur provenance avant correction, pas activer tout le plugin
pour le neutraliser ensuite par des ignores.

Une correction concrète issue de cette revue échappe les termes « voir aussi »
du glossaire : ils doivent rester du texte, pas devenir des éléments HTML.
Cela ne prouve pas l'existence d'un attaquant contrôlant les fichiers du dépôt.
Les autres diagnostics restent une dette de triage explicite, pas une liste
de vulnérabilités confirmées.

La validation navigateur a aussi reproduit une minification JSON écrasée par
le formatage différé de la saisie. Les actions explicites annulent maintenant
ce traitement en attente via le helper partagé ; une nouvelle saisie conserve
son auto-formatage. Une régression à horloge contrôlée couvre cette concurrence.

## Concevoir du code maintenable

- **Responsabilités et frontières** : moteur pur séparé du DOM, des sons et du
  stockage ; SDK utilisé pour le protocole portail. Pas d'architecture parallèle.
- **Simplicité** : fonctions courtes par responsabilité, noms précis, données
  explicites. KISS et DRY guident les décisions ; ne pas ajouter une abstraction
  pour deux lignes similaires ou appliquer SOLID comme une checklist dogmatique.
- **Contrats** : types/guards aux entrées, invariants et formats versionnés.
  JSDoc pour les APIs et les décisions non évidentes, pas une paraphrase de chaque ligne.
- **Déterminisme** : RNG seedée, horloge injectée lorsque nécessaire, replay
  vérifiable. Une dépendance à l'heure ou au réseau est déclarée et testée.
- **Erreurs visibles** : distinguer entrée invalide, ressource absente et
  panne technique ; message accessible côté UI, diagnostic utile côté script.
  Aucun catch vide, défaut silencieux ou retour ayant la forme d'un succès.
- **État maîtrisé** : effets limités et explicites, absence de mutation surprise,
  migrations de données testées et refus des formats futurs sans destruction.
- **Maintenance** : dépendances justifiées, versions/lockfile, licences des
  distributions et assets vérifiées ; pas de nouvelle bibliothèque sans besoin.

### Contrats critiques de fabrication (lot 4)

Le socle des lots 3 à 5 est intégré à `main` et publié via la PR #144 le
3 octobre 2026 ; voir la [preuve datée](software-factory.md#livraison-constatée-et-correctifs-locaux).
Les garanties ci-dessous décrivent ce socle, pas une certification globale.

ESLint impose une **complexité cyclomatique ≤ 10** aux fonctions de
`scripts/lib/build-utils.js` et `scripts/og-fetcher.js`. L'extraction OG mesurée
passe de **14 à 8**, l'orchestration de **17 à 6** : parsing des attributs,
enrichissement d'image et diagnostic de repli ont des responsabilités distinctes.
Les lecteurs JSON dupliqués ont été remplacés par les helpers communs.
Un vrai appel CLI vérifie qu'une régression de complexité échoue.
La longueur et les autres composants restent des signaux de revue,
pas des seuils globaux ou un indice de duplication certifié.

Les manifests et cache exigent un objet JSON. Une erreur de lecture/format
est contextualisée et collectée par les builders, ou levée sans collecteur.
L'absence d'un cache facultatif est normale ; sa corruption ne l'est pas.
Une permission refusée n'est pas une absence. Le nom du projet, même contenant
`library`, ne doit pas changer sa racine.
Les dates futures/invalides et la borne de sept jours invalident le cache.
Les entités numériques hors Unicode deviennent un caractère de remplacement,
sans perdre les métadonnées valides de la page.

Cache et catalogues JSON sont remplacés atomiquement par un fichier temporaire
unique du même répertoire, avec conservation du mode du fichier existant.
Erreur de sérialisation/écriture/rename : propagation et ancien fichier conservé ;
les builders ne remplacent pas un catalogue après erreur de validation.
Les tests utilisent de vrais fichiers, permissions et subprocessus.
Ce n'est ni une transaction couvrant tous les assets/slides, ni une sérialisation
de builds concurrents, ni une garantie de durabilité après coupure électrique.
La couverture mesurée est 100 % sur les helpers ; OG dépasse les seuils ciblés,
sans prétendre couvrir tout le dépôt ou le réseau réel par des mocks.

La PR de revue a livré les corrections des builders, de préservation des images
OG et du mode d'écriture atomique depuis `fix/review-software-factory`. Elle ajoute aussi
Build, déjà requis, comme gate exigeant le succès de Security lint et de Trivy
HIGH/CRITICAL dans un workflow réutilisable partagé ; un gate ignoré ne doit
pas être accepté. Ces correctifs sont **intégrés à `main` et publiés** via la
PR #145 ; ils ne changent pas les neuf checks GitHub actuellement requis. La
[validation native datée de la PR](software-factory.md#livraison-constatée-et-correctifs-locaux)
est distincte de sa livraison et ne remplace pas les checks de sa tête courante.

## Tester les bons comportements

Relier chaque scénario à une observation : résultat, invariant ou interaction.
Tester le cas nominal **et** les bornes, erreurs, permissions et reprises.
Une correction ajoute un test qui aurait détecté le défaut avant la correction.

Mocker les frontières externes, pas l'algorithme ou le composant que l'on vérifie.
Les interactions d'interface importantes se testent dans le navigateur : clavier,
focus, annonces d'erreur, contraste composé, mobile et changements de thème.
Pour les moteurs, tester replay, coups invalides et absence de mutation de l'état
initial ; des propriétés peuvent compléter les exemples sans nouvel outil imposé.

Choisir les plus petits contrôles couvrant le diff. Une validation ciblée n'est
pas une CI complète. Les résultats des skills sont revus selon leurs assertions ;
un fichier `evals.json` présent n'est pas une évaluation exécutée.

## Sécurité et revue

Revoir les entrées non fiables, usages de `innerHTML`, URL, imports, messages
inter-fenêtres, sandbox et stockage. Préférer `textContent` pour du texte,
valider source/origine et schéma des messages selon le protocole existant,
ne pas mettre de secrets dans le client ni envoyer de données personnelles par défaut.
Un assouplissement de permissions doit être nécessaire, documenté et testé.

Avant la PR, revoir :

1. Besoin et contrat : scénarios couverts, compatibilité, périmètre du diff.
2. Conception : frontières, types, état, erreurs et simplicité.
3. Risques : sécurité, confidentialité, accessibilité, performances et licences.
4. Preuves : tests adaptés, résultat réel, validations non exécutées.
5. Handoff : documentation, limites, récupération et décisions encore nécessaires.

Le skill [playlab-review](../../.github/skills/playlab-review/SKILL.md) structure
cette revue. [playlab-release](../../.github/skills/playlab-release/SKILL.md)
prépare la contribution et sa livraison. Aucun n'autorise à merger ou publier.
Les constats sont localisés et expliquent un impact réel ; éviter le bruit de
style déjà traité par le linter. Une revue générale n'est pas un audit exhaustif
de vulnérabilités.

## Plan de progression

| Lot | Résultat visé | Critère de sortie |
|-----|---------------|-------------------|
| 1 — socle, PR #135 intégrée | Lint strict, audit npm requis, seuils ciblés, rapports fidèles, guide/revue | Checks natifs constatés et code intégré à main ; archivage sur décision distincte |
| 2 — sécurité et reproductibilité, PR #136 intégrée | Moderniser ESLint Security, épingler actions/scanners/images, définir gates et exceptions | Outils exécutés, références vérifiables, intégration à main constatée ; archive distincte |
| Avant 3 — optimisation CI | Corriger l'attente HTTP après enrichissement OG ; installations/cache/parallélisme conservés après mesure | Fixtures quittant naturellement sous 3 s, comparaison native avant/après ; gates et archive inchangés |
| 3 — couverture du lint, livré via PR #144 | Biome TS, ESLint scripts HTML et corrections de l'existant, alignement local/CI | Vrais CLI, entrées interdites refusées ; intégré à main et publié |
| 4 — qualité du code, livré via PR #144 | Contrats JSON/cache, responsabilités, complexité ciblée, persistance atomique et idempotence Diese & Mat | Défauts reproduits, checks natifs constatés ; intégré à main et publié |
| 5 — fabrication et exploitation, livré via PR #144 | Snapshot OG séparé, inventaire/SBOM, provenance non signée, workflow de monitoring intégré et reprise locale | Deux fabrications comparées, archive vérifiée et restauration tar exercée ; publication constatée, run planifié à constater séparément |

Historique au 3 octobre 2026 : les PR #140 (lot 3) et #142 (lot 4) portaient
les validations intermédiaires de la pile. La PR #144 a livré les lots 3 à 5
ensemble ; leur ancien état « préparé » ne décrit plus la livraison actuelle.
L'archivage OpenSpec exige toujours une autorisation distincte.

La **protection classique de `main` est désormais active sur GitHub** :
PR, neuf checks natifs après observation de la PR #135, discussions résolues et historique linéaire, sans bypass
admin ni force-push/suppression. Elle a été activée sur autorisation et relue
via l'API, pas simplement déclarée dans un fichier.
La revue indépendante reste à organiser : zéro approbation externe obligatoire
tant qu'un seul reviewer est habilité. Ajouter un second reviewer puis exiger
une approbation. Les noms requis devront suivre la transition du pipeline :
voir [le réglage détaillé](../DEPLOYMENT.md#protection-de-main--activée-sur-github).
Les previews et métriques utiles viennent après ces garanties, sans plateforme
lourde ni collecte personnelle ajoutée implicitement.
Le lint TS est désormais fourni par Biome. L'intégration **typescript-eslint**
8.71.0 reste non supportée : son peer `>=4.8.4 <6.1.0` exclut TS 7.
Le contrôle strict `tsc` reste requis et distinct. Ne pas downgrader le
compilateur ni utiliser `--force` / `--legacy-peer-deps` pour contourner ce contrat.

Dans le lot cœur, `typecheck` appelle aussi `typecheck:engine-contracts`.
Le projet `tsconfig.engine-contracts.json` compile la fixture des six signatures
réelles avec `allowJs`, sans analyse exhaustive des corps JS (`checkJs: false`).
Ses exclusions distinctes empêchent le tsconfig principal de masquer cette
fixture `.test.ts` et les preuves de types RNG/Triomino, dont les assertions
`@ts-expect-error` sont désormais vérifiées par le compilateur, pas seulement
transpilées par Jest. Un vrai appel du compilateur accepte un contrat complet
et refuse une méthode manquante ; ce n'est pas une garantie de pureté ou de
sérialisation à l'exécution, qui restent testées séparément.

## Suite proposée : qualité du code par étapes

**Statut initial : proposition dans la PR #146.** La mise en œuvre est ensuite
autorisée avec tests avant refactoring ; voir l'[application tests-first](#application-tests-first).
La branche
`plan/code-quality-stages` a été créée depuis `fix/review-software-factory`,
puis réalignée sur main `8a643e8` après la fusion squash de la PR #145.
L'égalité des sources de cette fusion avec le head revu a été vérifiée avant
réalignement ; les correctifs ne sont pas réintroduits dans une pile de branches.

### Point de départ mesuré

La [CI native 37148235271](https://github.com/z4ppy/playlab42/actions/runs/37148235271),
head `a5598b2`, a réussi : **100 suites / 2 124 tests**, lint JS/HTML/TS,
types, seuils Jest, scan Trivy, build vérifié et 64 interactions Chromium.
L'[audit complémentaire](https://github.com/z4ppy/playlab42/actions/runs/37148235235)
a réussi ; Hadolint est volontairement ignoré sur PR, pas exécuté ni certifié.
Les logs du job Tests donnent :

| Mesure Jest native | Statements | Branches | Fonctions | Lignes |
|--------------------|------------|----------|-----------|--------|
| Ensemble instrumenté | 65,93 % | 65,24 % | 68,94 % | 65,76 % |
| `app/events.js` | 57,44 % | 41,42 % | 33,33 % | 63,41 % |
| `app/game-loader.js` | 64,70 % | 72,22 % | 38,46 % | 65,06 % |
| `app/settings.js` | 59,32 % | 16,66 % | 85,71 % | 59,32 % |
| `games/checkers/engine.js` | 82,95 % | 72,97 % | 84,61 % | 85,93 % |
| `games/triomino/engine.ts` | 74,76 % | 67,17 % | 72,72 % | 78,14 % |
| `tools/relativity-lab/src/Simulation.js` | 0 % | 0 % | 0 % | 0 % |
| `games/tetris/engine.js` | 100 % | 99,34 % | 100 % | 100 % |
| `scripts/lib/build-utils.js` | 100 % | 100 % | 100 % | 100 % |

Ces chiffres portent sur `collectCoverageFrom`, **pas sur tous les fichiers
du dépôt ni sur les assertions E2E**. La collecte Jest ne mesure pas les
interactions Chromium ou automatiquement les builders lancés en subprocessus.
Relativity possède déjà des tests physiques et de vrais tests navigateur :
son orchestration temporelle n'est pas couverte par Jest, ce qui ne signifie
pas « aucun test ». Tetris et les helpers déjà bien protégés ne sont pas les
premiers candidats à une réécriture.

Au head de référence, l'upload Codecov a réussi, mais reste non bloquant. Ses flags mentionnent
`lib/`, `src/`, `games/`, alors que ce dépôt n'a pas de répertoire racine
`src/` et que Jest instrumente aussi `app/`, `tools/` et `scripts/`.
Il faut vérifier cette segmentation avant d'utiliser ses statuts comme gate ;
un upload réussi n'est pas une preuve de cohérence de toutes les vues.
La CI ne fournit pas actuellement de mesure exhaustive de duplication,
de complexité typée TS ou de qualité des assertions.

### Étapes et sorties vérifiables

| Étape | Périmètre et travail proposé | Critère de sortie |
|-------|-----------------------------|-------------------|
| Q0 — rendre les preuves exploitables | Publier JSON de couverture, LCOV et résumé par module avec SHA/run ; aligner les flags Codecov sur les sources réelles ; distinguer CLI, Jest et E2E | Rapports accessibles et périmètres expliqués, résultats comparables à cette baseline, aucun seuil réduit |
| Q1 — contrats du portail | Trois petites PR : messages iframe, cycle chargement/déchargement, réinitialisation du stockage | Scénarios de concurrence, refus et échec observés sur état/iframe/stockage ; correction des défauts reproduits puis mesure des branches gagnées |
| Q2 — moteurs déterministes | Deux PR indépendantes : captures/replay des Dames, transitions/scoring du Triomino | Replay après JSON identique, absence de mutation vérifiée, actions invalides et scores limites explicitement testés |
| Q3 — orchestration des outils | Commencer par Relativity Simulation : horloge, pause, émissions/réceptions et libération des ressources | Tests d'orchestration réels, avec doubles aux frontières seulement ; réception unique et reprise/reset vérifiés ; conserver le navigateur Three.js réel |
| Q4 — maintenabilité ciblée | Extraire les responsabilités mêlées révélées par Q1–Q3 ; mesurer complexité JS et duplication avant décision | API et comportement conservés, baisse mesurée sur les fonctions choisies, aucune abstraction ou migration générale sans bénéfice démontré |
| Q5 — verrouiller les acquis | Étendre les seuils par module après mesure et revoir les scénarios du code modifié | Une régression ciblée échoue réellement en CI ; seuils, exceptions et assertions justifiés, pas de 100 % global artificiel |

**Q0 n'est pas un préalable à tous les tests métier** : les rapports actuels
permettent déjà de commencer Q1 ou Q2. Q1 et les deux moteurs de Q2 peuvent être
traités en parallèle sur fichiers distincts. Q3 est également indépendant.
Q4 dépend des tests de caractérisation du module concerné ; Q5 s'applique
après mesure de chaque module, sans attendre une refonte de tout le dépôt.

### Scénarios prioritaires et découpage des PR

Pour Q1, commencer par les contrats observables plutôt que le pourcentage :

- **Messages** (`app/events.js`) : `ready`/`quit` de l'iframe attendue, d'une
  autre source/origine et d'une ancienne session. Définir les effets acceptés
  pour chaque type ; ne pas déclarer une vulnérabilité sans reproduction.
- **Cycle de vie** (`app/game-loader.js`) : ouvertures A/B avec réponses HEAD
  inversées ; déchargement A suivi d'ouverture B avant le callback de 100 ms.
  Vérifier ensemble iframe, hash, état, récents et timers, pas seulement un appel mocké.
- **Reset** (`app/settings.js`) : jeu actif ou confirmation refusée sans mutation ;
  échec de suppression puis échec de relecture après suppression. Vérifier état
  mémoire, stockage et notification, sans succès trompeur. Conserver les tests
  de migration/refus des formats futurs de `lib/local-data.js`.

Pour Q2, lire les specs moteur et les règles existantes avant toute correction :

- **Dames** : rafle changeant de diagonale, captures exactes et replay JSON ;
  métadonnées `captured` absentes ou incohérentes pour un même départ/arrivée.
  Caractériser puis clarifier le contrat, sans changer arbitrairement les règles.
- **Triomino** : séquence légale `PLACE/DRAW/PASS` avec reprise JSON intermédiaire,
  mêmes actions légales et même état final ; double hexagone et priorité des bonus
  dans les modes standard/simplified/kids. L'initialisation déterministe seule ne suffit pas.

Pour Q3, tester pause/reprise avec `timeScale`, réception unique d'un signal,
retrait de scène/retour au pool et reset. Les mocks portent sur scène/horloge,
pas sur le calcul ou l'algorithme dont on veut vérifier le résultat.
Séparer légèrement logique/rendu seulement si le couplage empêche ces observations.

Pour Q4, éviter un « grand ménage » du JavaScript embarqué ou un outil lourd
par défaut. Une duplication de RNG ne se remplace pas mécaniquement :
conserver seeds et replays de référence avant toute mutualisation.
La limite de complexité actuelle ≤ 10 reste ciblée sur les helpers de build
et OG ; son extension se décide après mesure et découpage, pas avec des ignores.

### Règles communes et prochaine action proposée

Chaque PR part de la base livrée, cible main et traite **un contrat borné** :
caractérisation/reproduction, correction si nécessaire, tests de non-régression,
documentation liée et CI du head final. Distinguer régression confirmée,
risque à caractériser et amélioration de conception. Consulter le diff effectif
après squash ; ne pas confondre une fusion dans une branche intermédiaire avec main.

Conserver les gates actuels, les versions et la stack Docker ; pas de baisse
de seuil, de dépendance forcée ni de framework de tests ajouté implicitement.
Définir les seuils de Q5 après les nouveaux scénarios et publier leur mesure.
Les erreurs, refus et absence de mutation importent autant que les chemins nominaux.
Un changement de capability/contrat requiert son change OpenSpec avant code ;
la livraison et l'archivage restent des décisions distinctes.

**Prochaine étape proposée : Q0 pour la lisibilité des preuves, puis Q1a
sur les messages et Q1b sur le cycle de vie**, avec des PR séparées.
Les captures Dames peuvent être travaillées indépendamment si une deuxième
contribution est disponible. Cette proposition seule ne lançait aucun travail ;
la demande utilisateur suivante autorise l'application ci-dessous.

## Application tests-first

**Les travaux de `quality/tests-first` sont intégrés à main et publiés.**
La [PR #147](https://github.com/z4ppy/playlab42/pull/147) a été fusionnée le
3 octobre 2026 au commit `611a29bebe6409f5fb0e59413ff35f3d03751f92`.
La [publication 37153902594](https://github.com/z4ppy/playlab42/actions/runs/37153902594)
et l'[audit 37153902484](https://github.com/z4ppy/playlab42/actions/runs/37153902484)
ont réussi sur ce commit. L'égalité des arbres entre le head `7be0e05`
et cette fusion squash a été constatée via l'API GitHub.
La proposition #146, incluse dans l'implémentation, est fermée comme remplacée.
La livraison ne constitue pas une décision d'archivage.
Les scopes ont été travaillés en worktrees séparés, avec commits tests puis
correction. Ce premier lot les intègre pour mesurer et verrouiller une base
commune ; loader et messages partagent désormais le même contrat de navigation.

L'ordre est **tests de comportement avant les refactorings** :
caractériser les refus, erreurs, courses et invariants, exécuter sur le code
initial, conserver les reproductions, puis corriger les causes confirmées.
Un module déjà conforme reçoit des tests, pas une réécriture de convenance.
Les moteurs et la Simulation restent réels ; seuls leurs frontières sont doublées.

Les scopes Q0 à Q3 avancent indépendamment : preuves CI, messages iframe,
cycle de chargement, reset, captures Dames, scoring/reprise Triomino et
orchestration de Relativity. Leur intégration précède la mesure complète et
les nouveaux seuils ciblés Q5, **sans seuil global artificiel** ni baisse
des seuils déjà actifs. Q4 reste une amélioration ciblée après caractérisation :
pas de migration générale de RNG ou de framework.

Une mesure partielle de module sert au diagnostic ; elle ne remplace pas
le runner complet avec les seuils versionnés. Une couverture élevée n'est
pas une preuve d'assertions pertinentes. Distinguer données Jest, tests CLI,
archive navigateur et CI native du head effectivement proposé.

Le change [strengthen-tests-first-quality](../../openspec/changes/strengthen-tests-first-quality/proposal.md)
consigne les contrats, dépendances et limites. Les tâches ne sont cochées
qu'après les vérifications correspondantes ; la livraison et l'archivage
restent distincts de l'implémentation.

### Contrats caractérisés et corrections bornées

Les tests ont notamment reproduit un `quit` d'une autre iframe détruisant
le jeu courant : un vrai second GameKit, pas seulement un mock, le confirme
dans Chromium. Les courses de HEAD, callbacks et fermeture différée sont
couvertes avec promesses/timers contrôlés. La revue a ajouté les transitions
croisées : réouverture du même jeu après unload et message d'une session
remplacée pendant une navigation. Les refus de reset ne mutent pas les données ;
une relecture en erreur ne remplace plus partiellement l'état mémoire.
Un `ready` valide conserve la synchronisation des préférences pendant un HEAD
en attente, contrairement au `quit` destructif. Source, origine et slug restent
les identifiants du protocole existant : deux documents successifs partageant
le même WindowProxy et le même slug ne disposent pas d'un nonce de session.
Ces gardes ne constituent pas une frontière contre du JavaScript malveillant
déjà exécuté dans la même origine.

Pour les Dames, appliquer une action utilise le trajet légal canonique,
pas un recalcul géométrique ou des captures arbitraires fournies par l'appelant.
Un trajet légal explicite disambiguïse les captures ; sans métadonnées fiables,
le premier trajet légal correspondant aux extrémités reste le choix compatible
avec l'UI. La prise majoritaire ferme un écart avec les règles françaises
annoncées : les rafles plus courtes acceptées auparavant sont désormais refusées.
Toutes les rafles maximales restent disponibles, sans priorité dame/pion.
Cela ne certifie pas une implémentation exhaustive de toutes les règles françaises.

Le Triomino est testé après une vraie séquence `PLACE/DRAW/PASS`, restauration
JSON et dans les trois modes. Les défauts de première pose hors centre et de
classement avant ajustement des scores finaux sont reproduits puis corrigés.
Les séquences RNG ne changent pas. Simulation est exercée réellement avec
doubles Three/canvas aux frontières : pause, temps, signaux, ressources et
désabonnement/dispose, en conservant les E2E de rendu réel.

### Maintenabilité après les tests

La récursion des Dames a été séparée de la géométrie des étapes de capture
**après** les tests publics, replay et immutabilité. La mesure avec le vrai
ESLint donne `#findAllCaptureSequences` **21 → 6**, et les nouveaux helpers
pion/dame **7 / 10**. `applyAction` reste à **11**, sans réduction inventée.
Une comparaison au moteur post-prise-majoritaire porte sur 625 positions,
6 055 applications et quatre replays (380 tours), avec ordre, état JSON et
immutabilité identiques. Ce corpus ne remplace pas une preuve exhaustive.

Le périmètre reste ciblé : pas de mutualisation mécanique des RNG, de
réécriture globale des moteurs ou de migration de framework. Les futurs
refactorings devront eux aussi disposer de scénarios pertinents avant extraction.

### Preuves locales et verrouillage

La validation Docker au commit `c72afc5` donne **109 suites / 2 356 tests**.
La couverture Jest complète est **76,73 / 73,19 / 79,15 / 76,56 %**
(statements / branches / fonctions / lignes). Ce sont des mesures locales
datées, pas une CI native anticipée ni un taux de couverture des E2E.

| Module | Branches natives avant (`a5598b2`) | Branches locales après (`c72afc5`) |
|--------|----------------------------------|----------------------------------|
| `app/events.js` | 41,42 % | 98,71 % |
| `app/game-loader.js` | 72,22 % | 93,65 % |
| `app/settings.js` | 16,66 % | 83,33 % |
| `games/checkers/engine.js` | 72,97 % | 90 % |
| `games/triomino/engine.ts` | 67,17 % | 96,32 % |
| `tools/relativity-lab/src/Simulation.js` | 0 % Jest | 92,59 % |

Les sept nouveaux seuils ciblés figurent dans la table du socle ; les six
anciens sont conservés exactement. Des fixtures exécutent le vrai CLI Jest :
assertions vertes et données présentes, puis refus effectif des quatre
mesures sous les seuils. Le vrai ESLint accepte une complexité de 11 et
refuse 12 pour le moteur Dames ; les helpers de fabrication restent limités
à 10. Le budget de fichier Dames n'impose pas un 10 fictif à `applyAction`.

Le job Tests publie un résumé par familles et modules et l'artefact
`jest-coverage-<sha>-<run>-<attempt>` (30 jours), avec summary/final JSON,
LCOV, provenance et Markdown. La collecte après un test échoué ne rend
pas les tests verts ; les rapports manquants ou invalides sont des erreurs.
Les flags Codecov incluent désormais app/lib/games/tools/scripts, sans `src/`
racine fantôme ; l'upload reste non bloquant. Ces preuves n'instrumentent
pas automatiquement le code lancé dans des subprocessus ou les scripts HTML.

### Première preuve native de l'application

La [PR #147](https://github.com/z4ppy/playlab42/pull/147) a une première preuve
datée au head `41952d4` :
[CI 37152623557](https://github.com/z4ppy/playlab42/actions/runs/37152623557)
et [audit 37152623539](https://github.com/z4ppy/playlab42/actions/runs/37152623539)
réussis, **109 suites / 2 356 tests et 65 Chromium**.
Le log Jest donne **76,72/73,13/79,15/76,54 %**, distinct de la mesure locale.
L'artefact de couverture a été téléchargé et ses cinq fichiers et sa
provenance contrôlés : run/tentative/état Tests, compteurs et familles/modules.
La SHA `5ef51553230ec8ac984d5ac9300fc6362f22e031` est la ref de merge testée
par GitHub pour cette PR ; elle ne se substitue pas au head de branche.

Les nouveaux pushes exigent leur propre CI. Hadolint reste ignoré sur PR,
`npm outdated` consultatif et Codecov non bloquant. Cette preuve n'autorise
ni fusion, ni déploiement, ni archivage.

### Dernière preuve native avant fusion

Au head `7be0e05`, [CI 37153110329](https://github.com/z4ppy/playlab42/actions/runs/37153110329)
et [audit 37153110483](https://github.com/z4ppy/playlab42/actions/runs/37153110483)
ont réussi : **109 suites / 2 359 tests, 65 interactions Chromium**.
Jest donne S/B/F/L **76,74/73,16/79,17/76,57 %**.
L'artefact de cinq fichiers a été contrôlé ; sa provenance référence
la ref de merge `72eafe48a92d61ddf97b41db85394a2d70f3aa64`, run `37153110329`,
tentative `1`, Tests `success`. Le rapport tronque désormais comme Jest :
`77/78 = 98,71 %`. Il distingue ses résultats consultatifs des seuils
versionnés appliqués par Jest. Hadolint a ensuite été exécuté sur main dans
l'audit de livraison, distinct de son état ignoré sur PR.

## Corrections prioritaires du cœur

**Travaux de `quality/core-refactors` intégrés à main et publiés via la PR #148.**
La fusion `ef0a2aa0b888ca3c0b660d0042bd54392dc78a2d` a été constatée :
[publication 37162681481](https://github.com/z4ppy/playlab42/actions/runs/37162681481)
et [audit 37162681303](https://github.com/z4ppy/playlab42/actions/runs/37162681303)
réussis. Cette livraison ne décide pas l'archivage OpenSpec.
Le change [refactor-core-with-contracts](../../openspec/changes/refactor-core-with-contracts/proposal.md)
part du socle livré `611a29b`. La demande de corrections autorise le code,
pas une fusion, une publication ou un archivage.

Les corrections et extractions sont réalisées dans cette branche : seed de
reset fournie par l'UI Mastermind, contrats canoniques des six moteurs,
orchestration du portail et du lecteur, persistance/validation JSON,
collections de progression indépendantes et reset réellement vierge.
Le RNG Triomino utilise le module partagé sans modifier les séquences.
Les imports émis résolvent les modules imbriqués depuis `dist`.
Three 0.186.1 et lil-gui 0.21.0 sont distribués localement et exercés avec
WebGL2 réel ; les cinq mises à jour conservent le lockfile.

| Surface | Maximum cyclomatique avant → après |
|---------|------------------------------------|
| Clavier portail | 27 → 6 |
| Chargement jeu / outil | 11 / 15 → 1 / 1 ; orchestration commune 7 |
| Lecteur : chargement / clavier / menu | 24 / 27 / 23 → 6 / 1 / 1 |
| Validation JSON / valeur / écriture / backup | 19 / 16 / 13 / 23 → 7 / 3 / 5 / 4 |
| Tetris / Dames applyAction / Go | 20 / 11 / 16 → 10 / 10 / 10 |
| Triomino | 19 → 9 ; maximum cognitif 15 → 7 |

Le budget ESLint ≤ 10 protège désormais les sources JS refactorées ciblées,
y compris les modules extraits, sans l'appliquer aux tests ou à tout le dépôt.
Les preuves CLI acceptent la borne et refusent son dépassement. Les treize
seuils hérités restent inchangés ; onze nouveaux sélecteurs protègent aussi
les extractions, avec refus réel des quatre métriques. Les patterns Jest
appliquent ces seuils à chaque fichier correspondant, pas seulement au wrapper.

Mesure locale après extraction Triomino (`c35611e`) : **122 suites,
2 601 tests**, couverture S/B/F/L **79,74/76,25/87,35/79,28 %**.
La collecte inclut désormais les moteurs imbriqués/pédagogiques et exclut
les fixtures de tests ; le global n'est donc pas directement comparable au
périmètre de la PR #147. Les 70 scénarios Chromium ont réussi avant cette
dernière extraction ; la validation finale du lot reste distincte.

Le triage consultatif au même commit mesure **1 237 warnings / 182 fichiers** :
728 accès calculés, 405 fichiers, 85 propriétés DOM, 9 regex complexes,
6 constructions RegExp et 4 timing. Dix-huit faux positifs contextuels ont
été examinés ; **1 219 diagnostics restent non revus**, aucun bug confirmé
dans ce triage borné. Le gate strict et Biome sont verts : cela ne certifie
ni l'absence de vulnérabilités ni un audit exhaustif. Aucun warning n'a été
masqué pour rendre le résultat vert.

Priorité au reset Mastermind déterministe et aux contrats communs des six
moteurs, **sans migration des états JSON**. Puis caractérisation et extraction
du clavier/focus, du chargement commun, du lecteur réel et des validations
du stockage. Les responsabilités Triomino/Tetris/Dames/Go et le RNG ne sont
mutualisés qu'après protection des replays ; pas de super-moteur générique.

Le moteur pédagogique Diese & Mat possède déjà des tests mais était absent
de la collecte `games/**/engine.{js,ts}`. La baseline diagnostique locale à
`611a29b`, avant extension de la politique, donne **4 suites / 144 tests**
et S/B/F/L **93,73/84,76/95,58/94,58 %** pour son dossier `src/engine`.
Ce périmètre distinct n'est pas directement comparable au total des six
moteurs du rapport historique. La collecte devra aussi suivre les modules
extraits : cette extension est réalisée dans le lot cœur, déplacer le code
hors instrumentation n'est pas un gain de qualité.

Les mises à jour de dépendances sont vérifiées avec les vrais runtimes
navigateur, pas seulement les mocks. Les heuristiques consultatives sont
triées sans transformer des warnings en vulnérabilités confirmées.
Complexité, couverture et CI verte sont des preuves ciblées, **pas une certification**
du cœur entier. Après les garde-fous finaux, **122 suites / 2 636 tests** et
lint/types/audit npm/OpenSpec sont verts dans Docker ; les treize seuils
hérités et les onze nouveaux sélecteurs sont appliqués. La CI native du head
final reste à consigner une fois effectivement réalisée.
Au commit `74ebcef`, deux builds Docker **hors réseau** produisent le même
manifeste de hashes, avec `SOURCE_DATE_EPOCH=1791061551` (main de référence).
Les **1 024 fichiers** sont vérifiés, la restauration tar détecte une corruption
et les **70 scénarios Chromium** passent sur ce site préparé, vérifié à nouveau
après les interactions. Ces preuves locales ne se substituent pas à la CI native.

## Duplication et complexité

**Continuation autorisée dans `quality/duplication-complexity`, non livrée.**
Le change `reduce-duplication-and-complexity` poursuit les responsabilités
ciblées après la PR #148, avec tests avant refactoring.

Avant ce lot, la CI publiait lint, couverture et sécurité, mais pas de rapport
global de duplication/complexité. Le budget ESLint ciblé est un gate,
pas un rapport de tous les hotspots. Le job **Code quality** ajouté dans cette
branche exécute `npm ci` puis `npm run quality:report`, publie son résumé dans
le run et archive deux fichiers : `code-quality.json` et `code-quality.md`,
dans `code-quality-<sha>-<run>-<attempt>` (30 jours).
Ce job appartient à la CI réutilisée par PR et publication ; les neuf checks
de protection GitHub ne sont pas modifiés automatiquement.

Les trois outils sont verrouillés : **jscpd 5.4.0**, ESLint 10.12.0 et
Biome 2.5.15. Aucun outil n'est téléchargé à la volée ni source envoyée à un
service externe. jscpd utilise des clones exacts locaux, mode `mild`,
minimum **50 tokens / 5 lignes**, avec JS/TS, HTML et CSS.
ESLint mesure le cyclomatique JS/HTML (scripts seulement), Biome le cognitif
TS > 1 : ce ne sont pas deux valeurs interchangeables.

Le rapport sélectionne les sources suivies JS/CJS/MJS/TS/HTML/CSS et partage
les exclusions des sorties/vendor avec le lint. Production, tests/fixtures
et pédagogie (`parcours`, documentation) sont scannés **séparément** : les
clones entre scopes ne sont pas mesurés. Les assets JS des parcours restent
visibles. jscpd peut écarter un fichier trop court ; nombre sélectionné et
nombre scanné sont distincts. Une erreur, sortie invalide ou diagnostic
tronqué fait échouer la commande ; un ancien rapport est supprimé avant
analyse. Aucun zéro manquant n'est présenté comme un succès.

Baseline locale du main **`ef0a2aa`**, avec la configuration définitive :

| Scope | Sources sélectionnées / scannées | Clones | Lignes dupliquées / lignes | Cyclomatique JS/HTML > 10 / > 20 | Cognitif TS > 15 |
|-------|----------------------------------|--------|----------------------------|--------------------------------|-----------------|
| Production | 181 / 170 | 68 | 782 / 46 765 | 75 / 8 | 1 |
| Pédagogie | 104 / 104 | 150 | 1 643 / 25 361 | 10 / 2 | 0 |
| Tests | 144 / 144 | 79 | 694 / 29 597 | 2 / 0 | 1 |

La première exploration ne comptait pas les CSS autonomes : ses 44 clones et
1,31 % ne sont pas directement comparables à cette baseline. Les 85 fonctions
JS/HTML > 10 regroupaient production **et** pédagogie ; les tables les séparent.
Les thèmes clair/sombre, slides et fixtures peuvent légitimement répéter du
code. La duplication est un signal de revue, pas un objectif à diminuer par
des exclusions, suppressions d'exemples ou abstractions artificielles.

Depuis un clone ordinaire, dans Docker :

```bash
make npm CMD="run quality:report"
```

Dans un worktree dont `.git` référence un dépôt extérieur, exposer aussi
ses métadonnées Git en lecture seule (le chemin est conservé dans le conteneur) :

```bash
GIT_COMMON_DIR="$(git rev-parse --path-format=absolute --git-common-dir)"
docker compose run --rm -v "$GIT_COMMON_DIR:$GIT_COMMON_DIR:ro" dev npm run quality:report
```

La provenance contient SHA, run/tentative et état propre/modifié du checkout.
Les métriques sont consultatives, sans seuil global artificiel ; l'exécution
et la publication du rapport doivent réussir, et les budgets ciblés du lint
et de Jest restent bloquants. Les résultats avant/après se comparent avec
les mêmes outils, paramètres et périmètres, pas à partir d'un seul pourcentage.

### Corrections caractérisées de cette continuation

| Responsabilité | Avant → après |
|----------------|----------------|
| `checkDeployment` | Cyclomatique 39 → 3 ; validation et HTTP séparés |
| `buildHierarchy` | Cyclomatique 19 → 5 ; ordre et regroupement conservés |
| Quatre builders catalogue/parcours/bookmarks/TS | Maximum 20 → 10 ; neuf fonctions > 10 → zéro |
| `App.handleKeydown` Diese & Mat | Cyclomatique 32 → 1 ; helper maximum 8 |
| `Simulation.update` Particle Life | Cognitif 31 → 2 ; forces pures maximum 5 |
| Niveau XP | Un calcul partagé ; suppression du clone de 87 tokens |

Les tests CLI comparent code de sortie, stdout exact et JSON sur les anciens
builders avant extraction ; l'archive précédente est préservée en cas d'erreur.
Le clavier est exercé avec le vrai App et DOM, y compris focus, ordre d'Escape,
modificateurs et fallback piano. Les coordonnées et forces conservent l'ordre
des opérations ; trois snapshots seedés de 14 particules à 1/25/60 ticks sont
identiques sans tolérance numérique.

Le calcul XP rejette désormais explicitement les entrées non numériques
(`TypeError`) et non finies (`RangeError`) : l'ancien calcul bouclait avec
NaN/+Infinity. Ce correctif intentionnel ne prétend pas préserver le blocage.
Les XP finies, négatives et fractionnaires restent compatibles, ainsi que la
normalisation NaN → 0 déjà effectuée par ProgressTracker.

Les nouveaux helpers JS, builders, contrôles de publication et hiérarchie
sont protégés par ESLint **≤ 10**. Simulation et forces TS ont un budget
cognitif Biome **≤ 10**, avec vrai CLI acceptant 10 et refusant 11.
Les extractions restent collectées, le clavier App auparavant hors couverture
est ajouté explicitement. Les seuils existants ne baissent pas ; les cinq
nouveaux sélecteurs de couverture figurent dans la table du socle.
Les appels CLI en subprocessus ne sont pas artificiellement comptés comme
couverture Jest des wrappers.

La comparaison locale intégrée, avec les mêmes paramètres que `ef0a2aa`,
donne **68 → 62 clones de production**, **782 → 693 lignes dupliquées**,
**75 → 62 fonctions JS/HTML > 10** et **8 → 6 > 20**.
Les fonctions TS > 15 passent de **1 à 0**. Les clones pédagogiques restent
à 150 ; aucune slide ou fixture n'est supprimée pour améliorer le score.
Ces chiffres ne signifient pas que les 62 hotspots restants sont corrigés.
Restent notamment AudioEngine/contrôleurs musicaux, rendus Dames/Triomino,
helpers de fabrication et animations pédagogiques : les prioriser après
caractérisation, pas imposer universellement un 10 avec des ignores.

Validation locale au commit `b41eaab` : **131 suites / 2 883 tests**,
lint qualité/sécurité, types, audit npm et **33 validations OpenSpec** verts.
Deux builds Docker hors réseau produisent le même manifeste à
`SOURCE_DATE_EPOCH=1791071014`. Les **1 033 fichiers** sont vérifiés,
la reprise tar refuse une corruption puis restaure l'archive ; les
**70 scénarios Chromium** passent sur ce site préparé et revérifié.
La revue indépendante n'a trouvé aucune régression qualifiée ; le cas des
sources ignorées par ESLint a ensuite reçu un refus explicite et une fixture
réelle. Les résultats natifs de la dernière tête seront consignés en PR.

Première preuve native de la [PR #149](https://github.com/z4ppy/playlab42/pull/149),
head `365af23` : [CI 37164388196](https://github.com/z4ppy/playlab42/actions/runs/37164388196)
et [audit 37164388203](https://github.com/z4ppy/playlab42/actions/runs/37164388203)
réussis. **Code quality** est exécuté et son artefact de deux fichiers
téléchargé : compteurs de production 62 clones / 693 lignes / 62 fonctions
JS/HTML > 10, aucune fonction TS cognitive > 15 ; outils et scopes contrôlés.
Sa provenance référence la merge SHA `39f0720b1bf7c123c64463c234e61bebba9d969f`,
run/tentative `37164388196` / `1`, checkout propre, distinct du head de PR.
Chaque nouvelle tête exige sa propre validation ; la dernière preuve est
consignée en commentaire, sans confondre PR verte et livraison.

## Maintenance des références et exceptions

Les workflows utilisent des SHAs complets avec commentaire de version ; les
images de développement et de navigateur utilisent des digests. Un tag lisible
ne remplace pas le digest. Dependabot couvre les actions, npm et les Dockerfiles
de la racine et de `docker/`.

Pour actualiser une référence : lire les notes de release, résoudre le tag sur
le dépôt officiel (et l'objet annoté si nécessaire), vérifier le digest ou
checksum publié, changer la référence avec son commentaire puis exécuter les
tests du pipeline et les contrôles concernés. Ne pas copier une valeur d'une
source tierce non vérifiée. Un checksum assure l'intégrité vis-à-vis de la
valeur de référence ; ce n'est pas une signature indépendante.
Les scanners figent leur binaire, **pas leur base de vulnérabilités** : le
résultat dépend de la base et de la date d'analyse.

Une dérogation à un diagnostic ne doit jamais prendre la forme d'un `|| true`,
d'un catch vide ou d'une désactivation générale. La PR doit documenter :

| Champ | Exigence |
|-------|----------|
| Portée | Règle/outil, fichier et ligne ou fingerprint précis |
| Justification | Faux positif démontré ou risque accepté ; pas « la CI échoue » |
| Responsable | Rôle ou équipe chargée du suivi, sans données personnelles ajoutées |
| Dates | Décision et expiration ou date de réexamen |
| Mesure compensatoire | Test, limitation, correctif prévu et lien de suivi |
| Validation | Revue explicite ; un agent ne s'accorde pas une autorisation de livraison |

Les ignores historiques de Gitleaks restent des données de scan, pas des
exceptions automatiquement approuvées par cette politique. Les requalifier
lors de leur revue, sans afficher les secrets dans les logs ou rapports.
Les diagnostics consultatifs sont documentés comme tels : ce ne sont pas des
dérogations silencieuses ni un résultat « zéro problème ».

### Compatibilité du lint TypeScript

| Contrôle | Décision du 3 octobre 2026 | Suivi |
|----------|---------------------------|-------|
| Parser typescript-eslint | 8.71.0 incompatible TS 7 ; pas d'installation forcée ni de downgrade | Biome 2.5.15 couvre le lint syntaxique/sémantique `.ts` ; tsc strict reste le contrôle de types |

Ce choix ne prétend pas reproduire une analyse typée ESLint ou toutes ses
heuristiques de sécurité. Références : [Biome](https://biomejs.dev/linter/),
[configuration](https://biomejs.dev/reference/configuration/) et
[eslint-plugin-html](https://github.com/BenoitZugmeyer/eslint-plugin-html/tree/v8.2.1).

## Référentiels et niveau réel

Le [NIST SSDF](https://csrc.nist.gov/projects/ssdf) organise le développement
sécurisé en quatre groupes : préparer l'organisation, protéger le logiciel,
produire un logiciel sécurisé et répondre aux vulnérabilités. Ici, conventions
et skills contribuent à la préparation ; CI et revue à la production.
Revue indépendante, fabrication immuable et réponse aux incidents restent
à renforcer : des scripts seuls ne couvrent pas tout le cycle.

[OWASP ASVS 5.0.0](https://owasp.org/projects/asvs) fournit des exigences de
vérification applicative. Sélectionner celles pertinentes pour les entrées,
DOM, ressources et données d'un client statique ; ne pas ajouter artificiellement
une authentification ou un backend pour cocher une liste.
Toute future référence à une exigence ASVS doit préciser sa version.

Ces référentiels guident le plan ; ils ne constituent pas une déclaration de
conformité, un niveau ASVS atteint ou une certification de Playlab42.
Sources consultées le 3 octobre 2026.
