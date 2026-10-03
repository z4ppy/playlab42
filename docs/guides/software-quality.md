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
| TypeScript | Contrôle strict des sources TS ; JS reste autorisé | La transpilation ne vérifie pas les types |
| Jest | Tests avec seuils ciblés ci-dessous | Couverture de lignes, pas qualité des assertions |
| Playwright | Interactions, clavier, thèmes et ressources du site préparé | Socle Chromium, pas tous les navigateurs |
| npm audit | Seuil modéré bloquant, dépendances de fabrication incluses | CVE connues au moment de l'exécution ; panne du registre = échec |
| Trivy | Outil 0.75.0 vérifié ; vulnérabilités/secrets HIGH et CRITICAL bloquants dans le workflow complémentaire | Base évolutive ; pas un gate complet de configuration Docker |
| OpenSpec | Structure stricte des exigences et changes | Ne vérifie pas le comportement du code |

La CI réutilisée avant publication exige lint qualité JS/HTML/TS et sécurité JS/HTML, tests, types,
audit npm, OpenSpec, navigateur et build. Trivy appartient au workflow
complémentaire, qui reste séparé et conserve certains diagnostics consultatifs. Le
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

Ces composants sont critiques pour le déterminisme et la livraison. Les seuils
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
| 3 — couverture du lint, PR #140 | Biome TS, ESLint scripts HTML et corrections de l'existant, alignement local/CI | Vrais CLI, entrées interdites refusées ; checks natifs constatés, intégration distincte |
| 4 — qualité du code, PR #142 validée | Contrats JSON/cache, responsabilités, complexité ciblée, persistance atomique et idempotence Diese & Mat | Défauts reproduits et checks natifs constatés ; intégration distincte |
| 5 — fabrication et exploitation préparée | Snapshot OG séparé, inventaire/SBOM, provenance non signée, monitoring et reprise locale | Deux fabrications comparées, archive vérifiée et restauration tar exercée ; publication/monitoring natif distincts |

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
