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

## Handoff

L'utilisateur décide d'une correction. Après correction, vérifier le scénario
initial et les régressions pertinentes ; le skill release gère ensuite le
handoff de PR. Aucune décision implicite de merge, déploiement ou archive.
