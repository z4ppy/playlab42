# Restaurer les interactions de fin de partie et le contraste des plateaux

## Why

L'utilisateur signale sur le site livré des lignes invisibles au morpion et
un score Go calculé après deux passes sans pouvoir retirer les groupes morts.
Cette demande autorise les corrections et leurs tests, pas leur fusion,
publication ou archivage.

## What Changes

- Rendre les séparations du morpion contrastées dans les thèmes clair et sombre.
- Activer dans la page Go une revue manuelle des groupes après deux passes,
  avec marquage réversible, confirmation du score et reprise en cas de désaccord.
- Conserver le scoring automatique historique du moteur par défaut pour les
  appelants et replays existants ; la page active explicitement la revue.
- Couvrir les règles, la reprise JSON, le clavier, le bot suspendu et les erreurs.

## Capabilities

### New Capabilities
- Aucune.

### Modified Capabilities
- `go-9x9` : revue du plateau avant confirmation du score.
- `theme` : visibilité des séparations du morpion, sans modifier les tokens.

## Impact

Moteur et interface Go, commandes humaines, rendu, tests de contrats et
navigateur, CSS du morpion et référence calculée de cette seule règle.
Aucun backend, dépendance ou classification automatique de vie/mort.
