# Configuration de la sécurité

## Dépendances et compatibilité

La configuration sécurité utilise ESLint 10 avec Node.js 26 dans Docker :

| Dépendance | Version exacte | Rôle |
|---|---|---|
| `eslint-plugin-security` | `4.2.0` | Heuristiques sécurité JavaScript |
| `eslint-plugin-no-unsanitized` | `4.1.5` | Sinks HTML dans le DOM |

Ces versions sont enregistrées dans `package.json` et `package-lock.json`.
Leurs exports `rules` ont été vérifiés dans le conteneur ; la configuration
n'utilise que des noms de règles réellement exportés. Les tests exécutent ces
plugins avec l'ESLint du lockfile, pas une installation globale.

```bash
make up
docker compose exec -T dev npm ci
make security-eslint
```

Pour mettre à jour un plugin, vérifier ses contraintes de runtime et de peers,
modifier son pin puis installer et tester **dans Docker**. Le lockfile doit
faire partie de la modification. Ne pas ajouter d'installation `--no-save`
dans un workflow ou un target Make, ni utiliser les anciens arguments
`--plugin` avec la flat config.

## Deux niveaux d'analyse explicites

- `eslint.security.config.js` définit les règles bloquantes.
  `npm run lint:security` propage tout échec et permet l'export JSON.
- `scripts/security-lint-advisory.config.js` étend ce gate avec des diagnostics
  heuristiques en warnings, accessibles par `npm run lint:security:advisory`.
- `eslint.config.js` définit la qualité JS et scripts HTML, sans mélange
  avec les règles du gate sécurité. Les exclusions de sources sont partagées.

Les contrôles d'exécution dynamique, de méthodes DOM non sanitizées, de buffers
et de caractères bidi sont bloquants. Les propriétés DOM, accès calculés,
regex, chemins dynamiques et autres heuristiques nécessitant davantage de
contexte sont publiés séparément. Aucun preset « recommended » complet n'est
activé implicitement et aucune nouvelle exception générale n'est inventée.

La liste exacte, les commandes Make et les limites sont documentées dans
[SECURITY_LOCAL_TESTING.md](./SECURITY_LOCAL_TESTING.md).

## Intégration CI et diagnostics

Après une installation depuis le lockfile, le contrat du job sécurité est :

```bash
npm run lint:security -- \
  --format json --output-file eslint-security-results.json
```

Le job doit préserver le statut ESLint et collecter le rapport même en cas
d'échec. Les warnings advisory ne doivent pas être présentés comme un gate
strict ni comme une preuve d'absence de vulnérabilité. La configuration des
workflows, scanners, exceptions et protections GitHub est distincte de ce
contrat local ; consulter leurs fichiers versionnés et la politique du projet.

Le contrôle npm utilise `npm run audit:dependencies` (seuil `moderate`,
dépendances de développement incluses). Les targets Make ne masquent plus ses
erreurs. Le scanner de secrets et le scan des images restent complémentaires ;
ces plugins ne réalisent pas ces analyses.

## Décision TypeScript

Le compilateur du projet reste TypeScript 7.0.2 (contrainte existante `^7.0.2`).
Le parser `typescript-eslint` 8.71.0 supporte officiellement
`>=4.8.4 <6.1.0` : il ne constitue pas une solution supportée ici.

**Biome 2.5.15 fournit le lint `.ts`**, via son parser indépendant du compilateur.
Son preset recommandé et les warnings bloquants sont vérifiés sur les sources
réelles. Aucune rétrogradation, installation forcée ou contournement des peers.
`make typecheck` reste le contrôle strict des types ; les règles de sécurité
des plugins ESLint ne sont pas exécutées sur TS. Les JS générés dans `dist/`
restent exclus. Le gate ESLint inclut maintenant les scripts HTML exécutables,
pas le markup ni les attributs inline, refusés par un test de politique.

## Vérification avant évolution des règles

```bash
docker compose exec -T dev npm test -- --runInBand scripts/security-lint.test.js
make security-eslint
make security-eslint-advisory
make security-npm
```

Avant de promouvoir une règle advisory en erreur, examiner les diagnostics
réels et corriger les sinks concernés. Une fonction d'échappement locale ne doit
pas être déclarée sûre par commodité ; sa sécurité dépend du contexte de sortie.
L'analyse statique ne suit pas tous les flux et ne remplace pas une revue
contextualisée des données non fiables.

Ressources :
- [ESLint flat config](https://eslint.org/docs/latest/use/configure/configuration-files)
- [eslint-plugin-security](https://github.com/eslint-community/eslint-plugin-security)
- [eslint-plugin-no-unsanitized](https://github.com/mozilla/eslint-plugin-no-unsanitized)
- [OWASP](https://owasp.org/www-project-top-ten/)
