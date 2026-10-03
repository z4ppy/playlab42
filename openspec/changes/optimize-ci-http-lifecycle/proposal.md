## Why

Le build natif du lot 2 dure environ 5 min 40 s. Ses métadonnées OG sont
terminées à 15:06:46, mais le build des guides commence seulement à 15:11:28 :
environ 282 secondes après le travail utile. Les réponses HTTP non consommées
et un timeout limité aux en-têtes peuvent retenir le processus Node.

## What Changes

- Borner les requêtes OG jusqu'à la consommation du corps.
- Libérer les réponses abandonnées, y compris les erreurs de page et d'image.
- Reproduire la sortie du processus avec un vrai serveur HTTP local, sans
  `process.exit()` forcé ni remplacement du fetch natif.
- Comparer les temps natifs avant/après et documenter les choix de cache et
  de parallélisme à partir des mesures, sans optimisation spéculative.
- Conserver tous les gates et l'archive testée avant publication.
- Exécuter aussi CI et audits sur les PR empilées, sans déclencher de publication.

## Authorization

L'utilisateur demande de poursuivre tous les lots et d'insérer une optimisation
de la CI avant les lots restants. Les erreurs des PR #134/#136 ont d'abord été
corrigées et leurs runs natifs ont réussi. Cette demande autorise l'implémentation
isolée ; aucune fusion, publication ni archive n'est autorisée.

## Impact

Helper HTTP privé du fetcher OG, régressions de processus et de délai, guides
de fabrication/CI. Les métadonnées, images versionnées, replis et statut d'échec
restent compatibles. Le snapshot éditorial reste un chantier du lot 5.
