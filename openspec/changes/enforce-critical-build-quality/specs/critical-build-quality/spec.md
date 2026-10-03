## ADDED Requirements

### Requirement: Explicit build input errors
Les entrées JSON critiques SHALL être des objets et leurs échecs SHALL être
diagnostiqués, sans défaut silencieux ; les rapports agrégés restent disponibles.

#### Scenario: Corrupt cache
- **WHEN** le cache présent contient une syntaxe ou racine JSON invalide
- **THEN** une erreur contextualisée remonte plutôt qu'un cache vide présumé valide

### Requirement: Accurate build root
La racine SHALL dépendre des segments du chemin scripts, pas d'un substring.

#### Scenario: Library named project
- **WHEN** un projet contient lib dans son nom et appelle un builder normal
- **THEN** la racine reste celle du projet

### Requirement: Valid cache lifetime
Les dates futures, invalides ou expirées SHALL déclencher une récupération
réelle plutôt que servir un cache déclaré frais.

#### Scenario: Future fetched timestamp
- **WHEN** une entrée porte un timestamp futur
- **THEN** elle n'est pas considérée comme un cache valide

### Requirement: Safe output replacement
Les sorties JSON SHALL conserver leur version précédente si une sérialisation
ou une écriture/remplacement échoue, et propager l'erreur.

#### Scenario: Failed serialization
- **WHEN** les nouvelles données ne sont pas sérialisables
- **THEN** le fichier précédent reste intact et aucun succès n'est annoncé

### Requirement: Measured targeted quality gates
Les seuils retenus SHALL couvrir les responsabilités critiques mesurées,
sans suppression générale ou baisse opportuniste.

#### Scenario: Complexity regression
- **WHEN** une fonction ciblée dépasse le seuil
- **THEN** le vrai lint requis échoue avec un diagnostic de complexité
