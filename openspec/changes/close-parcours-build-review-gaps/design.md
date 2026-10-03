## Context

Les builders sont des CLI autonomes : leurs erreurs doivent être visibles
par le code de sortie et empêcher le remplacement du dernier catalogue.
Les tests exécutent ces vrais CLI dans des fixtures isolées sous le projet,
avec les dépendances Docker déjà disponibles, sans installation.

## Decisions

1. Le scanner des outils simples collecte l'absence du HTML comme les scanners
   d'outils complexes et de jeux. Le rapport agrégé reste le point de décision.
2. Le HTML généré commence par la ligne exacte
   `<!-- playlab42:generated-from-index.md -->` suivie de `\n` à l'écriture.
   La reconnaissance accepte aussi `\r\n` après cette première ligne exacte
   pour supporter les checkouts Git avec conversion des fins de ligne.
   Ce marqueur est une déclaration de propriété de la sortie, pas une heuristique
   de contenu. Une sortie marquée est reconstruite systématiquement.
3. Le HTML seul sans marqueur est une source auteur intacte. Une paire sans
   marqueur échoue avec les deux options de migration : conserver le HTML en
   retirant le Markdown, ou sauvegarder puis supprimer la sortie legacy pour
   repartir du Markdown. Aucun champ de configuration supplémentaire n'est
   ajouté et le champ optionnel `format` ne lève pas l'ambiguïté de propriété.
4. Sans template, le Markdown est une erreur, même si une ancienne sortie
   existe. Une sortie marquée sans Markdown est aussi une erreur ; l'adoption
   explicite en HTML auteur requiert le retrait du marqueur après revue.
5. Des métadonnées de slide absentes/illisibles ne déclenchent pas de conversion
   utilisant un titre de repli. Les erreurs empêchent la publication du catalogue.

## Compatibility and limits

La migration legacy est volontairement explicite pour protéger les HTML auteur.
Les sources HTML seules ne nécessitent pas le template et ne sont pas réécrites.
La conservation atomique existante porte sur les catalogues JSON, pas sur une
transaction multi-slides : des sorties générées déjà actualisées peuvent rester
sur disque si une autre entrée échoue. Les glossaires facultatifs, la CI, les
dépendances et les autres surfaces de revue sont hors périmètre.

## Validation

Les tests CLI couvrent un outil HTML absent avec un second outil valide, les
formats complexes/jeux existants, deux exécutions identiques, Alpha vers Beta,
le titre et le template modifiés, les paires ambiguës et leur migration, le
HTML seul et la conservation des sorties/catalogues sur les erreurs ciblées.
Lint ESLint ciblé et validation stricte de ce change dans Docker uniquement.
