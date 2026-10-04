## Responsabilités

Séparer préparation validée, génération des distributions et conservation
des licences ; séparer identité, filtre/copie publique et prérequis du site ;
séparer contrôles d'identité, commit et inventaire d'une archive.
Pas de framework de pipeline, classe de base ou dispatcher configurable.

Conserver ordre des validations et messages, API publiques et sorties CLI.
Les contrôles préalables ne doivent pas commencer à effacer une distribution
ou un site avant le point où le code actuel le fait.
Les versions et manifestes verrouillés ne changent pas.

## Compatibilité et mutualisation

Réutiliser les helpers de fabrication existants lorsque le contrat le permet.
L'inventaire vendor asynchrone et l'inventaire d'archive n'ont pas le même
tri ni le même traitement des liens : ne pas les fusionner en ignorant ces
différences. Les clones détectés restent consultatifs, pas une obligation
d'introduire une abstraction pour cinquante tokens.

Les corpus et fixtures exercent les vraies APIs et fichiers, y compris bundle
esbuild, dépendances transitives, copies, notices, images et erreurs.
Une empreinte cohérente ne remplace pas une archive de confiance ou signature.

## Preuves

Tests avant refactoring et mesures de couverture par fichier ; floors hérités
inchangés. Budget ESLint <= 10 sur les responsabilités corrigées et nouvelles
fonctions, sans déplacer des wrappers hors mesure.
Rapport identique en outils/paramètres/scopes à la baseline native.

Comparer les octets d'un build avant/après avec mêmes dépendances, SHA et epoch,
puis deux builds hors réseau du lot. Vérifier inventaire, reprise et archive
dans Chromium. Valider la dernière tête native et télécharger les artefacts.
La livraison #150 est constatée séparément ; l'archivage reste une décision.
