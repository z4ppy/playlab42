## ADDED Requirements

### Requirement: Immutable build references
La chaîne SHALL utiliser des SHAs complets pour les actions externes et des
digests pour les images de développement et de navigateur versionnées.

#### Scenario: Workflow validation
- **WHEN** les contrats de pipeline sont testés
- **THEN** une référence d'action externe mutable est refusée
- **AND** les appels locaux réutilisés restent liés au commit courant

### Requirement: Verified scanner installation
La chaîne SHALL vérifier le checksum d'un binaire versionné avant extraction
et exécution et rendre tout échec d'installation explicite.

#### Scenario: Invalid download
- **WHEN** le téléchargement ou le checksum n'est pas valide
- **THEN** le scanner n'est pas extrait ni exécuté
- **AND** le contrôle échoue sans annoncer une analyse réussie

#### Scenario: Valid archive on supported runtimes
- **WHEN** une archive intègre est vérifiée avec GNU coreutils ou BusyBox
- **THEN** la commande réelle de checksum réussit avant extraction
- **AND** une archive corrompue reste refusée avec un diagnostic de checksum

### Requirement: Reproducible security lint
Le lint de sécurité SHALL utiliser la configuration flat et les dépendances
verrouillées du projet, sur les fichiers réellement présents.

#### Scenario: Forbidden code
- **WHEN** une règle bloquante détecte une construction interdite
- **THEN** le check requis échoue et publie ses diagnostics
- **AND** aucune commande ne transforme cet échec en succès

### Requirement: Explicit quality limitations
Les guides et procédures SHALL distinguer gate, diagnostic consultatif,
exception datée et contrôle non supporté par la stack.

#### Scenario: Unsupported TypeScript parser
- **WHEN** le peer du parser exclut la version TypeScript du dépôt
- **THEN** le lint TS n'est pas annoncé comme installé ou exécuté
- **AND** le contrôle strict des types reste actif sans dépendances forcées

#### Scenario: Exception proposal
- **WHEN** une exception à un contrôle est proposée
- **THEN** elle précise portée, justification, responsable, échéance et validation
- **AND** elle ne donne aucun droit de merge ou de publication

### Requirement: Literal glossary references
Le glossaire SHALL afficher les termes associés comme du texte et non comme HTML.

#### Scenario: Related term containing markup
- **WHEN** une référence du glossaire contient des caractères de balisage
- **THEN** ils restent visibles littéralement dans la tooltip
- **AND** aucun élément DOM n'est créé depuis ce terme

#### Scenario: Ordinary or absent references
- **WHEN** les termes sont ordinaires, absents ou vides
- **THEN** leur présentation et les interactions accessibles existantes sont conservées

### Requirement: Stable explicit JSON actions
Le formateur JSON SHALL conserver le résultat d'une minification explicite
sans qu'un auto-formatage antérieur le remplace.

#### Scenario: Pending input formatting
- **WHEN** l'utilisateur minifie la saisie avant son auto-formatage différé
- **THEN** le résultat reste minifié après le délai
- **AND** une nouvelle saisie déclenche toujours son auto-formatage
