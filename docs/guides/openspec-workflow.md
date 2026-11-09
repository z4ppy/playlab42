# Workflow OpenSpec dans Playlab42

OpenSpec organise les besoins et decisions en Markdown. Il ne remplace ni les
conventions de [AGENTS.md](../../AGENTS.md), ni les tests, ni la revue de PR.
Ce fichier explique le workflow ; les
[skills de projet](project-skills.md) et le
[kit de contribution](contribution-kit.md) restent des guides metier.

## Version et installation reproductible

La version officielle retenue, verifiee le **9 novembre 2026**, est
**`@fission-ai/openspec@1.16.0`** (publiee sur npm le 30 octobre 2026). Depuis
1.16.0, le paquet npm exige Node `>=22.12.0` (rupture annoncee dans le
CHANGELOG : Node 20 n'est plus supporte), compatible avec Node 26 dans le
conteneur du projet. Le CLI est une **devDependency locale epinglee**, pas un
outil global suppose deja installe.

Depuis 1.15.0, OpenSpec publie aussi un binaire autonome sans Node.js
(installeur `curl ... | sh`, commande `openspec install`) et en fait
l'installation par defaut de sa documentation. Playlab42 ne l'utilise pas :
la version exacte est figee dans `package-lock.json` et executee dans Docker,
comme les autres outils du depot.

L'installation et le lockfile relevent du mainteneur des dependances. Pour
ajouter ou mettre a jour cette version, executer **dans le conteneur** :

```bash
npm install --save-dev --save-exact @fission-ai/openspec@1.16.0
```

Ensuite, depuis le worktree avec le service Docker de developpement initialise :

```bash
make openspec-list
make openspec-validate
make npm CMD="exec -- openspec --version"
```

`make openspec-validate` lance
`openspec validate --all --strict --no-interactive` via le script npm local.
Ne pas lancer npm, node ou le CLI sur le host, ni utiliser un `npx` non epingle
qui telechargerait une version differente.

La validation stricte s'est durcie entre 1.14.0 et 1.16.0 ; ces avertissements
font echouer `--strict`, donc `make openspec-validate` et la CI :

- une exigence de plus de 500 caracteres (1.14.1) ;
- dans un delta, un texte qu'archive ne reporte pas dans la spec principale :
  section `## ` autre que `Purpose` et les sections de delta, texte avant le
  premier `## `, prose avant la premiere exigence d'un bloc `ADDED` ou
  `MODIFIED` (1.14.2) ;
- un `#### Scenario:` sans etape `WHEN`/`GIVEN` ou sans etape `THEN` (1.16.0).
  Les mots-cles sont reconnus en anglais : `QUAND`/`ALORS` ne comptent pas.

`validate` echoue aussi (code 1) si `openspec/config.yaml` est illisible ou
n'est pas du YAML valide. Dans `.openspec.yaml`, les clefs de premier niveau
prefixees par `x-` en minuscules sont reservees aux metadonnees de l'equipe et
ne sont plus signalees.

## Workflow recommande : OPSX

Le schema officiel `spec-driven` est selectionne par `openspec/config.yaml`.
Il associe :

| Artefact | Role |
|---------|------|
| `proposal.md` | Pourquoi, changements, capabilities et impact |
| `specs/<capability>/spec.md` | Deltas des exigences et scenarios observables |
| `design.md` | Decisions techniques et contraintes |
| `tasks.md` | Travail restant et preuves d'achevement |

La proposal precede les specs et le design ; les taches s'appuient sur ces
deux artefacts. Ce sont des **dependances d'artefacts**, pas une obligation
de serialiser toutes les taches d'implementation. Les scopes independants
peuvent avancer en parallele, avec un proprietaire par fichier.

Le profil officiel **core** contient `propose`, `explore`, `apply`, `update`,
`sync` et `archive`. Les commandes et skills ne sont pas le CLI :

| Action | Commande Claude si generee | Skill canonique |
|--------|------------------------------|------------------------|
| Explorer sans implementer | `/opsx:explore` | `openspec-explore` |
| Preparer un change | `/opsx:propose` | `openspec-propose` |
| Implementer | `/opsx:apply` | `openspec-apply-change` |
| Reviser les artefacts | `/opsx:update` | `openspec-update-change` |
| Synchroniser les specs | `/opsx:sync` | `openspec-sync-specs` |
| Archiver | `/opsx:archive` | `openspec-archive-change` |

Ces six skills ont ete generes avec le CLI officiel 1.16.0, profil core et
livraison skills-only. Leur metadata `generatedBy: "1.16.0"` identifie la
version du generateur. Les noms effectivement generes correspondent au
tableau ; aucun corps local de remplacement n'est ajoute.
Le skill officiel `openspec-propose` s'arrete aux artefacts de planification,
meme si la demande initiale parle d'implementation. Apres presentation des
artefacts, il attend une nouvelle demande utilisateur pour passer au workflow
apply ; une generation de proposal ne vaut pas approbation de livraison.
Quand toutes les taches suivies sont cochees, `openspec-apply-change` annonce
qu'elles sont terminees et propose une revue ou une verification avant
l'archivage ; il ne declare plus le change pret a archiver.

Les corps des skills vivent uniquement dans `.github/skills/`. Le lien
`.claude/skills -> ../.github/skills` expose la meme source a Claude ; il
ne cree aucune commande slash OPSX. Avec les clients qui chargent ces skills,
demander leur utilisation par nom ou utiliser leur mecanisme de decouverte.
Les noms `/opsx:*` du tableau supposent des commandes Claude generees
distinctes et ne sont pas promis par ce lien.

Avec Copilot CLI, demander l'utilisation du skill par son nom. Les fichiers
`.github/prompts/opsx-*.prompt.md` servent aux extensions IDE : ils ne sont
pas directement consommes par Copilot CLI. Les commandes optionnelles `new`,
`continue`, `ff`, `verify`, `bulk-archive` et `onboard` appartiennent a une
selection de workflows etendue ; ne pas les supposer installees par defaut.

Le CLI reste utilisable sans commandes slash. Dans le conteneur :

```bash
npm exec -- openspec list
npm exec -- openspec list --specs
npm exec -- openspec new change add-example-module
npm exec -- openspec status --change add-example-module --json
npm exec -- openspec instructions proposal --change add-example-module --json
npm exec -- openspec instructions apply --change add-example-module --json
```

La derniere commande donne les instructions d'implementation ; elle
n'implemente pas automatiquement le code.

## Configuration et source commune

`openspec/config.yaml` contient le schema, les references communes dans
`context`, les regles d'artefacts dans `rules` et les conseils d'operation
dans `operations`. Les clefs `proposal`, `specs`, `design`, `tasks` sont celles
du schema officiel. `githubCopilot.cloudAgent: false` evite de generer une
configuration Actions pour le cloud coding agent hors du scope de ce travail.

Les instructions injectent ce contexte, mais ne lisent pas a la place de
l'agent les documents references : ouvrir `AGENTS.md` et les specs concernees.
Ne pas copier une autre stack dans les skills ou les exemples de configuration.
Le contexte est consulte a chaque invocation ; les conseils d'operation sont
consultatifs, pas une preuve d'approbation ou d'execution.

`openspec/project.md` et `openspec/AGENTS.md` sont conserves comme points
d'entree historiques vers ces references, pas comme une seconde source de
conventions.

## Generation des integrations sans migration destructive

Les trois fichiers `.claude/commands/openspec/{proposal,apply,archive}.md`
sont des **alias locaux de compatibilite**. Ils respectent les memes regles
que le guide, mais ne sont pas les commandes recommandees par OpenSpec 1.x.

**Ne pas executer `openspec init --force` ni `openspec update` directement
dans ce depot** : la migration officielle peut supprimer les anciennes
commandes, `openspec/AGENTS.md` et les marqueurs historiques.
Depuis 1.15.0, `openspec update --dry-run --json` liste les fichiers qu'une
mise a jour ajouterait, modifierait ou supprimerait, sans rien ecrire. Essaye
le 9 novembre 2026 sur une copie jetable du depot avec le HOME isole decrit
ci-dessous, il ne prevoyait aucun changement ; avec `--force`, il listait la
suppression des trois `.github/prompts/openspec-*.prompt.md` et de
`openspec/AGENTS.md`. C'est un apercu utile, pas une autorisation : la
procedure ci-dessous reste la seule maniere de regenerer les skills. Conserver aussi
les changes actifs et les archives. Le seul ancien wrapper invalide
`changes/_archives/parcours-post-mvp/` est conserve sans modification de
contenu dans [les brouillons historiques](../../openspec/legacy/README.md) :
ses taches restent ouvertes, il n'est pas declare livre ou archive.

Pour generer ou rafraichir les skills officiels, le mainteneur execute ces
commandes **dans un projet temporaire d'un conteneur isole**, avec la version
locale epinglee. Depuis le projet dont les dependances sont deja installees,
memoriser le chemin absolu du CLI avant de changer de repertoire ; ne pas
laisser `npm exec` telecharger un CLI flottant depuis le scratch :

```bash
OPENSPEC_CLI="$PWD/node_modules/.bin/openspec"
OPENSPEC_SCRATCH="$(mktemp -d)"
OPENSPEC_HOME="$(mktemp -d)"
cd "$OPENSPEC_SCRATCH"
export HOME="$OPENSPEC_HOME" OPENSPEC_TELEMETRY=0
"$OPENSPEC_CLI" config set delivery skills
"$OPENSPEC_CLI" init --tools github-copilot --profile core --no-copilot-cloud --no-animation
```

`delivery` est une configuration **globale de cet environnement isole**, pas
une clef a ajouter a `openspec/config.yaml`. Le HOME temporaire evite de
modifier les preferences du mainteneur. Copier ensuite uniquement les
repertoires generes `.github/skills/openspec-*` dans le worktree et examiner
le diff, en conservant le proprietaire local lors de l'extraction tar
(`--no-same-owner`). Ne pas recopier le contexte d'exemple ou remplacer les specs,
les alias, les skills `playlab-*`, `AGENTS.md` ou les fichiers CI.
Ne pas inventer des skills officiels a la main.

La source canonique est `.github/skills/openspec-*`. Le lien
`.claude/skills -> ../.github/skills` expose automatiquement les memes fichiers
a Claude : **aucun second corps de skill ne doit etre cree dans `.claude/skills`**.
Ne pas generer une integration Claude directement dans le worktree lie :
elle pourrait modifier les fichiers canoniques. Si des commandes Claude OPSX
sont souhaitees ulterieurement, les generer a part et revoir uniquement les
fichiers de commandes `.claude/commands/opsx/`. Les trois alias historiques
fonctionnent sans ces nouvelles commandes. Ne pas presenter `/opsx:*` comme
disponible avant leur generation.

## Autorisation, validation et livraison

Creer une proposal pour une nouvelle capability, une rupture de contrat ou
un changement d'architecture. Un correctif simple, une typo ou un test du
comportement existant n'en exige pas automatiquement une.

Une demande utilisateur explicite d'implementation autorise **son perimetre**.
La consigner dans la proposal. Une demande d'exploration seule ne l'autorise
pas. Ne pas fabriquer une approbation de revue, une execution de CI, un merge
ou un deploiement. Les artefacts peuvent etre ajustes en cours de travail.

Les exigences ajoutees ou modifiees utilisent `SHALL` ou `MUST` dans leur
corps, et au moins un `#### Scenario:` non vide. Un bloc `MODIFIED` conserve
l'ensemble des scenarios non retires explicitement : il remplace l'exigence
entiere. Les specs principales ont `## Purpose` et `## Requirements`.

Dans Docker, valider le change puis toutes les specs et changes actifs :

```bash
npm exec -- openspec validate update-project-skills-kit-e2e --strict --no-interactive
npm exec -- openspec validate --all --strict --no-interactive
npm exec -- openspec status --change update-project-skills-kit-e2e --json
npm exec -- openspec instructions apply --change update-project-skills-kit-e2e --json
```

La validation CLI controle la structure des specs, pas la conformite du code.
Les tests unitaires, navigateur et controles de qualite restent distincts.
Ne cocher une tache que lorsque son resultat est realise et verifie. Rapporter
les erreurs historiques separement ; ne pas les contourner en faisant passer
un examen manuel pour une validation stricte reussie.

Ne synchroniser les deltas dans les specs principales ni archiver ce change
avant sa livraison et la decision explicite correspondante. Apres merge et
deploiement si applicable, le mainteneur peut utiliser le workflow d'archive
ou `openspec archive <change-id>` dans Docker : il fusionne les deltas et
deplace le change dans `openspec/changes/archive/YYYY-MM-DD-<change-id>/`.
Les archives existantes ne sont ni regenerees ni reecrites. Ne pas utiliser
`--no-validate` pour masquer un probleme.

La checklist residuelle `add-algorithm-complexity-epic` reste active et conserve
ses cases. Elle declare `skip_specs: true` car elle suit du contenu pedagogique
sans changement de contrat logiciel. Cette option officielle n'est pas un
substitut a des deltas lorsqu'un comportement de la plateforme change.

## References officielles consultees

References figees sur la version retenue, et non sur une branche mouvante :

- [Metadata npm](https://registry.npmjs.org/@fission-ai%2fopenspec/1.16.0)
- [CHANGELOG 1.16.0](https://github.com/Fission-AI/OpenSpec/blob/v1.16.0/CHANGELOG.md)
  (entrees 1.14.1 a 1.16.0)
- [README 1.16.0](https://github.com/Fission-AI/OpenSpec/blob/v1.16.0/README.md)
- [Installation](https://github.com/Fission-AI/OpenSpec/blob/v1.16.0/docs/installation.md)
- [CLI et options](https://github.com/Fission-AI/OpenSpec/blob/v1.16.0/docs/cli.md)
- [Integrations et chemins](https://github.com/Fission-AI/OpenSpec/blob/v1.16.0/docs/supported-tools.md)
- [Configuration](https://github.com/Fission-AI/OpenSpec/blob/v1.16.0/docs/customization.md)
- [Migration legacy vers OPSX](https://github.com/Fission-AI/OpenSpec/blob/v1.16.0/docs/migration-guide.md)
