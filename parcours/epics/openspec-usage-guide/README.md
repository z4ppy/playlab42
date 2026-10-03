# OpenSpec — Des idées aux specs avec OPSX

Parcours en français pour découvrir le développement piloté par les spécifications avec **OpenSpec 1.14.0**, version publiée vérifiée sur npm le **3 octobre 2026**. Comptez environ **75 minutes**, exercices compris. Les sept slides gardent leurs identifiants pour préserver les liens et la progression.

## Objectifs

- Comprendre la différence entre les specs de référence et les deltas d'un changement.
- Installer et initialiser OpenSpec, distinguer les commandes du terminal de celles de l'assistant.
- Utiliser le profil `core` : `explore`, `propose`, `apply`, `update`, `sync`, `archive`.
- Réviser les artefacts, contrôler l'implémentation et archiver sans confondre validation des specs, tests et déploiement.
- Reconnaître les workflows supplémentaires et situer la migration d'un projet qui utilise encore les anciennes commandes.

Le dépôt Playlab42 applique déjà OPSX : profil `core` en livraison skills seuls (`.github/skills/openspec-*`, exposés à Claude par le lien `.claude/skills`), CLI 1.14.0 épinglé et exécuté dans Docker (`make openspec-list`, `make openspec-validate`, `make npm CMD="exec -- openspec ..."`). Les trois alias Claude `/openspec:*` sont conservés comme alias locaux de compatibilité. Le parcours distingue le fonctionnement général d'OpenSpec (commandes `/opsx:*` si elles sont générées) de la **politique du projet** décrite dans `AGENTS.md` et `docs/guides/openspec-workflow.md` : skills demandés par leur nom canonique, pas de `openspec init --force` ni de `openspec update` directement dans le dépôt, synchronisation et archivage seulement après livraison et décision explicite. Il n'exécute aucune migration à votre place.

## Présentation et interactions

Les styles et interactions sont locaux à cet epic (`openspec-guide.css` et `openspec-guide.js`) : thèmes clair/sombre, mise en page responsive, commandes copiables, exercices et quiz. Le contenu reste lisible sans JavaScript. Les boutons de copie signalent aussi les erreurs de presse-papiers ; les exemples restent sélectionnables manuellement.

Les slides utilisent les styles, le thème et les utilitaires partagés de Playlab42. Aucun changement du lecteur global ni aucune dépendance supplémentaire n'est nécessaire.

Les blocs terminal gardent une palette sombre complète, y compris le code, les boutons et les messages de copie, même en thème clair. Les tests navigateur mesurent les contrastes des textes des sept slides en clair, sombre et thème système : au moins **4,5:1** pour le texte courant et **3:1** pour les grands titres.

## Sources officielles

Les références sont figées sur le tag **v1.14.0** pour éviter de présenter une fonctionnalité de la branche de développement comme déjà publiée.

| Sujet | Documentation |
|-------|---------------|
| Premiers pas | [Getting Started](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs/getting-started.md) |
| Concepts et artefacts | [Concepts](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs/concepts.md) |
| Commandes de l'assistant et profils | [Commands](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs/commands.md) |
| Commandes du terminal | [CLI Reference](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs/cli.md) |
| Syntaxe propre à chaque assistant | [Supported Tools](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs/supported-tools.md) |
| Révision d'un changement | [Editing Changes](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs/editing-changes.md) |
| Configuration projet | [Customization](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs/customization.md) |
| Documentation évolutive | [Documentation actuelle](https://github.com/Fission-AI/OpenSpec/tree/main/docs) |

## Validation

Depuis ce worktree, dans Docker :

```bash
make up
make npm CMD="test -- --runInBand --runTestsByPath scripts/openspec-guide.test.js scripts/openspec-parcours.test.js scripts/parcours-utils.test.js"
make npm CMD="run build:local"
make npm CMD="run test:e2e -- e2e/openspec.spec.js"
make lint
```

Les tests navigateur utilisent l'installation Playwright du projet, avec ses fixtures et sa configuration habituelles.
