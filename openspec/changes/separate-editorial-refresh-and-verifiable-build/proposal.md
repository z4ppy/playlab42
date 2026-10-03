## Why

Le lot 5 autorisé complète la fabrication/exploitation après les gates et
contrats critiques. Le build actuel collecte encore des métadonnées externes,
date les catalogues à l'heure courante et n'inventorie pas l'ensemble de
l'artefact. Une identité de commit seule ne prouve ni son intégrité ni sa reprise.

## What Changes

- Séparer refresh éditorial OG explicite et build utilisant un snapshot revu.
- Utiliser SOURCE_DATE_EPOCH en CI pour des sorties comparables à sources/outils identiques.
- Produire SBOM npm de fabrication et inventaire hashé du site/runtime livré.
- Vérifier l'archive avant publication ; exercer altération/refus et restauration locale.
- Documenter monitoring et récupération sans déclencher déploiement ou rollback automatique.

## Authorization

L'utilisateur demande tous les lots restants en ordre, en corrigeant l'existant.
Lot 4 proposé dans #142 et défaut d'idempotence natif corrigé ; contrôles suivis.
Aucune autorisation implicite de merge, publication, archive ou attestation signée.

## Impact

Builders, métadonnées éditoriales, packaging, CI, tests, guide et skills.
Le build normal ne dépend plus du succès réseau OG ; refresh est une décision
éditoriale explicite. Les dépendances externes au runtime restent déclarées.
