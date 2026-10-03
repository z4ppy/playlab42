# Procédure et preuves de revue

La checklist technique est dans
[software-quality.md](../../../../docs/guides/software-quality.md), pas dupliquée ici.
Pour les commandes, consulter la
[matrice release](../../playlab-release/references/release.md).

## Format d'un constat

Indiquer fichier et lignes, comportement déclencheur, conséquence observable,
preuve ou test pertinent, puis confiance et éventuelle limite. Prioriser perte
de données, rupture de contrat et risques réels avant les améliorations de lisibilité.
Ne pas transformer une absence de preuve en défaut confirmé.

## Choisir la validation

La permission de lecture n'autorise pas l'exécution. En lecture seule, proposer
les commandes Docker, sans `npm` sur le host. En revue autorisée à exécuter,
commencer par les sélecteurs couvrant le diff et les contrats voisins.
Une bibliothèque partagée ou le packaging peut justifier la suite complète.

Un rapport doit distinguer : inspection effectuée, test exécuté et résultat,
test non exécuté, audit consultatif et contrôle bloquant. Vérifier les véritables
codes de sortie ; ne pas retirer un test ou baisser un seuil pour réussir.
Vérifier que le gate `lint` exécute JS/scripts HTML et TS. Ne pas confondre
Biome, tsc et plugins sécurité ESLint ; un script ignoré n'est pas validé.
Les attributs événementiels HTML sont refusés par le test de politique :
brancher les interactions dans du JS linté, pas dans des attributs.
Pour les builders/helpers OG, vérifier aussi le gate de complexité ciblé (10),
les seuils de couverture et les contrats d'erreur : absence ≠ corruption ou
permission refusée, date future ≠ cache frais, fichier précédent conservé.
Une extraction doit améliorer une responsabilité réelle, pas contourner le score.

## Handoff

L'utilisateur décide d'une correction. Après correction, vérifier le scénario
initial et les régressions pertinentes ; le skill release gère ensuite le
handoff de PR. Aucune décision implicite de merge, déploiement ou archive.
