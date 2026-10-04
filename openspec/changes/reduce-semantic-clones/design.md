## Decisions

Six scopes independants possedent leurs fichiers : styles partages, pages jeux,
styles musicaux, styles outils, JS musical et algorithmes jeux. Le parent gere
les wrappers de fabrication, configurations communes, docs et integration.
Les tests de caracterisation sont executes et conserves avant extraction.

Une ressemblance de tokens ne suffit pas : les palettes conditionnelles,
metadonnees HTML obligatoires, conversions de notes et branches de regles peuvent
avoir des contrats distincts. Les conserver et les expliquer vaut mieux qu'une
abstraction artificielle. Aucun changement de formatage ne doit servir a passer
en dessous du minimum de cinq lignes ou cinquante tokens du scanner.

## Validation

Comparer styles calcules sur themes clair/sombre/systeme, avant initialisation JS
si pertinent, largeurs desktop/mobile et etats interactifs. Verifier ordre des
regles, specificite, inheritance, focus et reduced-motion. Les preuves navigateur
portent sur les declarations reellement touchees, pas seulement un screenshot.
Conserver comportements JS/CLI, trajectoires a seeds fixes, erreurs et sorties.

Tous les runtimes passent par Docker. La baseline native est conservee. Mesurer
clones/lignes/tokens avec les outils verrouilles et memes parametres/exclusions ;
ne pas utiliser un ratio pour diluer une dette. Garder complexite 10, tous les
floors historiques et ajouter des floors mesures pour les nouveaux helpers JS.
Les budgets sont resserres apres integration, jamais releves pour verdir.
Finir par gates complets, deux vrais builds hors reseau, verification/reprise,
suite Chromium et smoke trois moteurs, puis derniere tete native de la PR.

## Non-goals

Zero clone a tout prix, perfection certifiee, migration des pages standalone vers
un templating necessitant un serveur, nouveau framework ou couverture globale
artificielle. Fusion, publication et archivage attendent une decision distincte.
