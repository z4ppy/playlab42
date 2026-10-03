## ADDED Requirements

### Requirement: Explicit Markdown output ownership

Le builder SHALL distinguer les HTML auteur des sorties Markdown grâce à la
première ligne exacte `<!-- playlab42:generated-from-index.md -->` suivie d'un
saut de ligne LF ou CRLF à la reconnaissance, avec LF à l'écriture du marqueur.
Il SHALL reconstruire chaque sortie Markdown à chaque build
avec sa source, le titre de la slide et le template courants.

#### Scenario: First Markdown build and subsequent updates
- **WHEN** une slide contient `index.md` sans HTML ou avec un HTML marqué
- **THEN** chaque build produit un HTML marqué depuis le Markdown actuel
- **AND** toute modification du titre ou du template apparaît dans cette sortie

#### Scenario: Unchanged rebuild
- **WHEN** les mêmes sources, métadonnées et template sont reconstruits
- **THEN** le contenu HTML produit reste identique

#### Scenario: CRLF checkout
- **WHEN** une sortie marquée en première ligne passe de LF à CRLF et le Markdown change
- **THEN** le build reconnaît cette sortie et la reconstruit depuis le Markdown actuel
- **AND** le marqueur réécrit est suivi de LF

#### Scenario: Similar or misplaced comment
- **WHEN** un HTML contient un commentaire similaire mais non exact ou un marqueur hors première ligne
- **THEN** ce HTML n'est pas reconnu comme une sortie générée

#### Scenario: Authored HTML
- **WHEN** une slide contient uniquement un HTML non marqué
- **THEN** le builder le conserve sans modification même sans template Markdown

### Requirement: Actionable Markdown source errors

Le builder SHALL échouer avec un diagnostic permettant de corriger une paire
Markdown/HTML non marquée, un template Markdown manquant ou une sortie marquée
privée de son Markdown. Il SHALL conserver le dernier catalogue sur ces erreurs
et SHALL préserver le HTML auteur plutôt que l'écraser pour résoudre une ambiguïté.

#### Scenario: Ambiguous legacy or authored pair
- **WHEN** `index.md` et un HTML non marqué coexistent
- **THEN** le build échoue sans modifier le HTML ni le dernier catalogue
- **AND** le diagnostic propose de retirer le Markdown pour garder le HTML ou
  de sauvegarder puis supprimer le HTML pour le régénérer depuis le Markdown

#### Scenario: Missing template
- **WHEN** une slide Markdown n'a pas de template disponible
- **THEN** le build échoue même si une ancienne sortie générée existe
- **AND** cette sortie et le dernier catalogue restent inchangés

#### Scenario: Missing Markdown source
- **WHEN** un HTML marqué existe sans `index.md`
- **THEN** le build échoue et propose de restaurer le Markdown ou d'adopter
  explicitement le HTML comme source auteur en retirant son marqueur
- **AND** le dernier catalogue reste inchangé
