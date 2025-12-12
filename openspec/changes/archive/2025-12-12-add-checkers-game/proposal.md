# Proposition : Ajouter un jeu de Dames

## Why

Playlab42 currently has only Tic-Tac-Toe as a game example. Adding Checkers provides a more complex strategic game that demonstrates advanced AI algorithms (minimax), multi-step move validation (jump sequences), and state management patterns that are valuable for educational purposes.

## What Changes

- Add complete Checkers game implementation following GameEngine interface
- Implement French Checkers rules (10×10 board, mandatory captures, king promotion)
- Create two AI bots (Random and Smart with minimax algorithm)
- Add game to catalogue with proper manifest
- Include comprehensive test coverage

## Contexte

Playlab42 possède actuellement uniquement le jeu Tic-Tac-Toe. Pour enrichir la plateforme pédagogique, nous proposons d'ajouter le jeu de Dames (Checkers), un jeu de stratégie classique qui présente une complexité intermédiaire, idéale pour la formation.

## Objectif

Implémenter un jeu de Dames complet suivant les mêmes standards que Tic-Tac-Toe :
- Moteur de jeu isomorphe et déterministe
- Interface utilisateur responsive
- Support des bots IA (différents niveaux)
- Intégration au catalogue de jeux

## Portée

**Inclus dans cette proposition :**
- Moteur de jeu de Dames (engine.js)
- Tests unitaires du moteur (engine.test.js)
- Interface utilisateur HTML/CSS (index.html + styles)
- Manifest de jeu (game.json)
- Au moins 2 bots : random et intelligent
- Documentation du jeu

**Exclus de cette proposition :**
- Mode multijoueur en ligne (sera ajouté plus tard via la plateforme)
- Variantes internationales (dames polonaises, turques, etc.)
- Mode tournoi ou classement

## Règles du jeu implémentées

Le jeu suivra les règles françaises standard :
- Plateau 10×10 avec 40 cases actives (cases noires)
- 20 pions par joueur (blancs et noirs)
- Les pions avancent en diagonale d'une case
- La prise est obligatoire et par saut
- Les prises multiples sont possibles
- Un pion atteignant la dernière rangée devient une dame
- Les dames se déplacent en diagonale sur plusieurs cases
- Victoire par élimination de tous les pions adverses ou blocage

## Bénéfices pédagogiques

- **Complexité algorithmique** : Permet d'aborder la recherche de chemin, l'arbre de jeu
- **IA plus sophistiquée** : Opportunité d'implémenter minimax, alpha-beta
- **Gestion d'état** : État de jeu plus riche que Tic-Tac-Toe
- **Validation de règles** : Logique métier complexe (prises multiples, dame)

## Alternatives considérées

1. **Dames anglaises (8×8)** : Rejeté car moins riche stratégiquement
2. **Échecs** : Trop complexe pour une première itération
3. **Othello/Reversi** : Envisagé, mais les Dames offrent plus de progression pédagogique

## Décision

Implémenter les Dames françaises (10×10) comme deuxième jeu de la plateforme.
