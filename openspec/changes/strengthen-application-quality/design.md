## Decisions

Chaque scope independant possede ses fichiers, dans un worktree dedie.
Les tests de comportement sont executes sur le code initial puis committes
avant extraction. Doubler les frontieres (DOM, horloge, audio, Three),
pas l'algorithme ou le controleur caracterise. Conserver les vrais E2E.

App assemble des responsabilites nommees ; ses helpers restent mesures.
Eviter classe de base universelle, dispatcher configurable et getters
ajoutes uniquement pour contourner un seuil. Les effets, courses, refus
et destruction ont des scenarios distincts.

Mutualiser seulement un contrat reel partage. Un export ou 0 % Jest
ne prouve pas qu'un module est inutilise ; une suppression exige une
preuve des usages et de compatibilite. Ne pas fusionner des inventaires,
themes ou moteurs dont les contrats different.

## Protections

Conserver les floors et scopes existants ; etendre la collecte aux sources
applicatives caracterisees plutot que masquer leur dette. Ajouter des floors
apres mesure complete et verifier les vrais CLI, acceptation et refus.
Les budgets de duplication portent sur comptes absolus de production,
pas sur un ratio dilue par du nouveau code ou des exemples pedagogiques.

La verification JS ciblee analyse les corps des modules selectionnes avec
checkJs strict ; pas de fixture de declarations presentee comme analyse
de toute l'application. Reutiliser tsc et les outils verrouilles.

## Validation et limites

Comparer le rapport a outils/parametres/exclusions constants, en signalant
les sources et la collecte ajoutees. Valider lint, types, couverture,
OpenSpec, audit et vrais builds de production hors reseau avec meme SHA/epoch.
Verifier archive, restauration et navigateur sur le site en lecture seule.

Firefox/WebKit commencent par des contrats critiques portables. Une fumee
ne certifie pas l'integralite des usages audio/3D, la perception sonore,
l'accessibilite ou les performances. Mesurer avant d'imposer ces derniers
budgets ; ne pas inventer de seuil universel.

Le resultat vise des criteres finis et verifiables, pas une promesse de
perfection. La derniere tete native et ses artefacts sont controles ; PR,
fusion, publication et archivage restent des etats distincts.
