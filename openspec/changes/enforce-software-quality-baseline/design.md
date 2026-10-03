# Context

L'audit npm au niveau modéré existe déjà dans le workflow de sécurité.
Les tests avec couverture ont mesuré SeededRandom à 100 %, le packaging
à 85 % des statements et le smoke à 85,29 %. Les branches des deux scripts
dépassent 80 %. Les analyses consultatives ne doivent pas être maquillées
en contrôles bloquants.

# Decisions

1. Réutiliser la politique npm modérée dans un job CI indépendant et bloquant,
   y compris pour les dépendances de développement de la chaîne de fabrication.
   Une indisponibilité du registre est un échec, pas un résultat sans défaut.
2. Refuser les warnings lint et ajouter les règles natives `no-new-func` et
   `no-script-url`, sans installer un second linter.
3. Fixer SeededRandom à 100 % et les scripts de livraison à 80 % pour statements,
   lignes et branches, avec 100 % des fonctions. Aucun seuil global artificiel.
4. Le rapport de sécurité lit les états réels des jobs. Un succès consultatif
   ne signifie pas zéro problème ; skipped/cancelled/failure restent visibles.
5. Un guide qualité est la référence commune. Le skill de revue le consulte ;
   le skill release conserve la préparation de livraison, sans procédures rivales.
6. Les audits reçoivent `contents: read` par défaut. Les droits SARIF et commentaire
   PR sont localisés aux deux jobs qui les consomment.

# Risks and Limits

Les nouvelles CVE peuvent bloquer une livraison après un build réussi. Ne pas
contourner ce blocage par un fix forcé ou une exception silencieuse.
Les seuils ciblés ne couvrent ni tout le code ni la qualité des assertions.
Pinning immuable, analyse statique de sécurité modernisée, code modifié,
protections distantes, herméticité et exercices de récupération restent des lots
ultérieurs. Aucun niveau SLSA ou audit exhaustif n'est revendiqué.
