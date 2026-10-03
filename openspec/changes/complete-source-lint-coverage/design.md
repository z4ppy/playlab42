## Chaîne choisie

ESLint 10 conserve les règles qualité JS et les plugins de sécurité verrouillés.
eslint-plugin-html expose les scripts embarqués ; les seuls documents statiques,
blocs de données JSON et exemples textuels ne sont pas du JavaScript exécutable.

Le parser typescript-eslint 8.71.0 exige TS <6.1 et exclut TS 7.
Biome 2.5.15 n'a pas ce peer ; son parser et ses règles TS sont validés sur le
dépôt sans downgrade, force ni legacy-peer-deps. Ce lint ne devient pas
automatiquement une analyse typée utilisant les informations du compilateur.
Le contrôle strict tsc reste complémentaire et obligatoire.

## Intégration et corrections

Une commande globale échoue sur tout périmètre requis ; les commandes ciblées
restent disponibles pour le diagnostic. Les outputs/vendor/builds sont exclus,
pas les sources réelles. Les warnings retenus font échouer le gate.

Corriger les diagnostics confirmés, réutiliser types et helpers et conserver
les interactions HTML existantes. Les exceptions éventuelles sont précisément
justifiées, jamais une désactivation générale du linter.

## Vérification

Tests des vrais CLI : syntaxe TS, constructions interdites, JS dans scripts
HTML classiques/modules, positions de diagnostics et code d'échec.
Types, unitaires, build et navigateur vérifient les corrections existantes.
La CI native de la PR du lot doit ensuite être constatée ; pas de livraison
ou de couverture exhaustive de sécurité présumée.
