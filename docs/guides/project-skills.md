# Skills de projet

Les skills Playlab42 guident les agents sur les tâches récurrentes du dépôt.
Ils complètent [AGENTS.md](../../AGENTS.md), sans remplacer les contrats
[OpenSpec](../../openspec/AGENTS.md) ni les permissions de l'environnement.
Leur source canonique est **`.github/skills/`** ; les ressources restent
versionnées avec le projet, pas dans les skills personnels de l'utilisateur.

## Choisir le bon skill

| Skill | Usage | Exemple |
|---|---|---|
| [playlab-ui](../../.github/skills/playlab-ui/SKILL.md) | Portail, outils, clients et interactions accessibles | « Corrige le focus du morpion sans toucher aux règles. » |
| [playlab-create-game](../../.github/skills/playlab-create-game/SKILL.md) | Moteur, règles, bots, manifeste et client d'un jeu | « Ajoute un jeu de dés déterministe et testable. » |
| [playlab-create-epic](../../.github/skills/playlab-create-epic/SKILL.md) | Parcours, manifests, slides et build | « Transforme ce cours en trois slides avec un exercice. » |
| [playlab-release](../../.github/skills/playlab-release/SKILL.md) | Branche, validations, PR et publication encadrée | « Prépare le handoff de cette branche sans merger. » |
| [playlab-review](../../.github/skills/playlab-review/SKILL.md) | Revue du diff, contrats, conception, tests et risques | « Revois ce changement sans le corriger ni le publier. » |

Chaque dossier contient un `SKILL.md` avec un frontmatter YAML `name` /
`description`, des références dans `references/` et des scénarios dans
`evals/evals.json`. Le corps principal reste court ; les références sont lues
seulement quand elles servent à la tâche.

Le [guide qualité](software-quality.md) porte les bonnes pratiques communes.
`playlab-review` traite les constats et leurs preuves ; `playlab-release` prépare
la livraison. Il n'est pas nécessaire d'ajouter un skill distinct pour chaque
linter, métrique ou commande du pipeline.

Les chemins de sources indiqués en code sont relatifs à la racine du dépôt ;
les liens vers les références internes sont relatifs au fichier du skill.
Les skills ne supposent ni chemin absolu de workspace ni commande CLI privée.

## Utilisation avec un agent

La découverte automatique dépend du client : ne pas supposer que tous les
agents chargent `.github/skills/`. Si nécessaire, demander explicitement
« lis `.github/skills/playlab-ui/SKILL.md`, puis corrige cette interface ».
Une intégration spécifique peut exposer le même dossier à son chemin de
découverte, sans maintenir une seconde copie divergente.

Pour un nouveau module, utiliser le [kit de contribution](contribution-kit.md)
et ses gabarits `templates/{game,tool,epic}`. Les skills ne fournissent pas un
second générateur. La [galerie UI](../../tools/ui-kit/index.html) montre les
primitives partagées : thème, focus, formulaires et composants.

La stack reste HTML/CSS/JavaScript ESM, avec TypeScript optionnel. Les moteurs
restent purs, isomorphes et déterministes. Une correction d'UI n'autorise pas
à changer les règles d'un moteur. Les commentaires et explications suivent
les conventions françaises du dépôt.

## Commandes et permissions

Les commandes runtime passent par Docker, comme décrit dans `AGENTS.md` :
par exemple `make build-catalogue`, `make build-parcours`,
`make npm CMD="test -- --runTestsByPath games/tictactoe/engine.test.js"` ou
`make test-e2e`. Lire le `Makefile` actuel avant exécution.

Un agent dont le rôle interdit Docker ou GitHub remet les commandes au parent
ou à l'opérateur ; il ne contourne pas l'interdiction avec `npm` / `node` sur
le host. Un skill ne donne aucune permission supplémentaire de commit, push,
fusion ou déploiement. **Pas de merge automatique.**

## Évaluations légères

Les fichiers `evals/evals.json` contiennent au moins deux demandes réalistes,
leur `expected_output`, les fichiers de contexte et des assertions observables.
Les `trigger_cases` couvrent un déclenchement attendu et un cas voisin hors
périmètre. Ils servent à la revue ; ils ne constituent pas un runner installé.

Pour comparer un skill à une approche sans skill, exécuter le même scénario
sur deux états identiques et isolés du dépôt, avec les mêmes permissions.
Le parent/opérateur pilote ces évaluations et les commandes runtime autorisées.
Comparer le résultat réel aux assertions, conserver les preuves et distinguer
succès, échec et vérification non exécutée. Une assertion sur le clavier ou
le replay demande une observation ou un test adapté, pas seulement la présence
d'un mot dans la réponse.

Ne pas laisser les modules temporaires d'évaluation dans une contribution
de documentation. Les rapports comparatifs restent des artefacts de session.
Réviser le skill si les résultats montrent une confusion de périmètre, une API
inventée ou des commandes incompatibles avec les permissions du rôle.

La comparaison initiale porte sur deux demandes : compteur accessible et tests
de replay du morpion, chacune avec et sans skill. Les quatre sorties inchangées
respectent leurs assertions dans Docker, y compris les interactions Chromium
du compteur. Ce petit échantillon ne démontre pas un gain : la baseline réussit
aussi. Les autres scénarios et les cas de déclenchement restent à évaluer ;
les preuves et le visualiseur comparatif sont conservés hors du dépôt.
Les scénarios du nouveau skill de revue sont définis et contrôlés structurellement,
mais aucune comparaison d'agents ni gain d'efficacité n'est revendiqué.
Le skill release inclut aussi le cas de mise à jour d'un scanner et de parser
incompatible : vérifier la source officielle et les limites, sans forcer les
dépendances ni neutraliser un gate pour accélérer la livraison.
