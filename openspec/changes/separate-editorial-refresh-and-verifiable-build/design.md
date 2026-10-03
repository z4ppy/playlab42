## Deux chemins

`metadata/bookmarks-og.json`, version 1, contient seulement les entrées utilisées.
Absent/corrompu : erreur explicite. Une URL nouvelle sans entrée reste utilisable
avec son titre/description manuels et un diagnostic ; le build ne fetch pas.
`refresh:bookmarks` réalise le refresh, conserve les replis d'images versionnées,
écrit un snapshot atomique à relire avant commit. Le cache technique reste ignoré.

## Fabrication vérifiable

SOURCE_DATE_EPOCH provient du timestamp Git en CI. Sans epoch, le build local
date ses sorties à l'heure réelle et ne revendique pas leur reproductibilité.
Comparer deux vrais builds à commit, outils, plateforme et epoch identiques.
Un manifeste liste chaque fichier public (sauf lui-même), taille et SHA-256,
ainsi que commit, lockfile, snapshot, outils et runtime vendor existant.

La SBOM CycloneDX native npm couvre les dépendances de fabrication installées,
pas seulement les packages distribués au navigateur. Retirer le serial aléatoire,
normaliser timestamp et nom racine, conserver le graphe et les composants.
L'inventaire public distingue les assets réellement livrés et documente les
limites des CDN, modèles et dépendances chargées dynamiquement.

## Exploitation

Vérification locale et de l'archive CI avant navigateur/publication. Pas de
signature ou niveau SLSA prétendu : un manifeste hashé peut être remplacé avec
ses fichiers et nécessite une source de confiance (archive/run/commit revu).
Exercice local de corruption et restauration de l'archive, jamais de production.
Monitoring HTTP planifié, erreurs visibles, intervention humaine pour reprise.
