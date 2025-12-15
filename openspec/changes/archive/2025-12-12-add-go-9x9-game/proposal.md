# Proposition : Jeu de Go 9x9 standalone

## Contexte
- La plateforme dispose déjà de Tic-Tac-Toe et d'un pipeline pour ajouter des jeux isomorphes.
- Demande : ajouter un jeu de Go en plateau 9x9, avec règles par défaut et bot simple pour le mode solo.
- Contraintes projet : moteurs déterministes et isomorphes (client/serveur), manifests conformes, catalogue statique, intégration portail.

## Objectifs (MVP)
- Fournir un moteur Go 9x9 tour par tour respectant les règles de base (placement, captures, ko simple, passes, fin par double passe ou abandon, scoring chinois avec komi).
- Exposer un manifest `game.json` pour le catalogue, index.html jouable standalone desktop-first, et un registre de bots `bots.available` incluant au moins Random (défaut) et Greedy.
- Garantir la sérialisation et la déterminisme (seedé), avec tests unitaires couvrant captures, ko, fin de partie et scoring.

## Portée
- Inclus : moteur isomorphe, UI HTML/JS simple, manifest catalogue, bot défaut, tests, documentation courte.
- Exclus : taille >9x9, superko, handicap, modes réseau, analyse avancée, UI avancée (review, score estimé) pour ce MVP.

## Hypothèses et choix par défaut
- Plateau 9x9 fixé (option `boardSize` figée à 9 pour ce MVP).
- Komi 6.5, scoring chinois (aire/territoire), ko simple, pas de handicap, pas de superko.
- Deux joueurs (Noir, Blanc), noir commence, actions autorisées : placer, passer, résigner.
- Bot défaut : choisit un coup légal aléatoire (Random), bot additionnel Greedy (heuristique simple : maximiser captures et libertés) listé dans `bots.available`.
- Orientation cible : desktop par défaut (layout adapté desktop, responsive minimal mobile), icône/emoji défini dans le manifest.

## Risques
- Vérification de ko simple et détection de suicide : risque d'erreur sur les libertés ; mitigé par tests ciblés.
- Performance : acceptable sur 9x9, pas d'enjeu particulier.

## Validation
- Tests unitaires sur captures, ko, double passe, scoring chinois, bot déterministe via seed.
- Vérification manuelle de l'UI (placement, passes, fin de partie, affichage du score, reset).
