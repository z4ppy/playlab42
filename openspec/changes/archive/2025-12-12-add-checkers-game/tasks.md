# Tasks : Jeu de Dames

## Phase 1 : Moteur de jeu

- [x] **1.1** Créer la structure de base du moteur
  - Définir les types TypeScript (Piece, Position, GameState, Move)
  - Créer le squelette de l'interface GameEngine
  - Valider la compilation TypeScript

- [x] **1.2** Implémenter l'initialisation du plateau
  - Créer plateau 10×10
  - Placer les pions initiaux (20 blancs, 20 noirs)
  - Tester l'état initial

- [x] **1.3** Implémenter les mouvements simples des pions
  - Calculer les cases accessibles (diagonales avant)
  - Valider les mouvements légaux
  - Tester déplacements basiques

- [x] **1.4** Implémenter les captures simples
  - Détecter les captures possibles
  - Exécuter capture (saut + suppression)
  - Rendre la prise obligatoire
  - Tester captures simples

- [x] **1.5** Implémenter les captures multiples
  - Algorithme récursif de recherche de captures
  - Gérer les chaînes de captures
  - Tester captures multiples

- [x] **1.6** Implémenter la promotion en dame
  - Détecter pion atteignant dernière rangée
  - Transformer en dame
  - Tester promotion

- [x] **1.7** Implémenter les mouvements de dame
  - Déplacements diagonaux multi-cases
  - Captures de dame avec atterrissage libre
  - Tester mouvements dame

- [x] **1.8** Implémenter la détection de fin de partie
  - Vérifier élimination de toutes les pièces
  - Vérifier blocage (aucun coup légal)
  - Mettre à jour status et winner
  - Tester conditions de victoire

- [x] **1.9** Implémenter getPlayerView pour fog of war
  - Créer vue joueur (dans ce jeu, information complète)
  - Tester cohérence de la vue

## Phase 2 : Tests

- [x] **2.1** Tests unitaires : Initialisation
  - Plateau correct (10×10, 40 cases actives)
  - Pions bien placés
  - Joueur blanc commence

- [x] **2.2** Tests unitaires : Mouvements pions
  - Mouvement avant valide
  - Mouvement arrière invalide (sauf capture)
  - Mouvement hors plateau invalide

- [x] **2.3** Tests unitaires : Captures
  - Capture simple obligatoire
  - Capture multiple
  - Prise vers l'arrière autorisée

- [x] **2.4** Tests unitaires : Dames
  - Promotion au bon moment
  - Mouvements multi-cases
  - Captures de dame

- [x] **2.5** Tests unitaires : Fin de partie
  - Victoire par élimination
  - Victoire par blocage
  - État final correct

- [x] **2.6** Tests de déterminisme
  - Même seed + mêmes moves = même résultat
  - Replay de partie complète

## Phase 3 : Interface utilisateur

- [x] **3.1** Créer la structure HTML
  - Header avec titre
  - Zone d'information (joueur actif, status)
  - Plateau de jeu (grille 10×10)
  - Bouton nouvelle partie
  - Valider l'accessibilité HTML

- [x] **3.2** Créer les styles CSS
  - Layout responsive
  - Style du plateau (damier)
  - Style des pièces (pions et dames)
  - Animations de mouvement
  - États hover/sélectionné

- [x] **3.3** Implémenter la logique de rendu
  - Fonction renderBoard()
  - Fonction renderPiece()
  - Affichage du statut
  - Mise à jour lors des changements

- [x] **3.4** Implémenter les interactions
  - Sélection de pièce au clic
  - Affichage des coups possibles
  - Exécution du mouvement
  - Gestion des prises multiples (choix du joueur)

- [x] **3.5** Tester l'interface
  - Test manuel : partie complète jouable
  - Test responsive (mobile/desktop)
  - Test accessibilité clavier

## Phase 4 : Bots

- [x] **4.1** Créer bot Random
  - Implémenter `computeMove()`
  - Utiliser `seeded-random`
  - Tester que les coups sont légaux

- [x] **4.2** Créer bot Smart (Minimax)
  - Implémenter fonction d'évaluation
  - Implémenter minimax avec alpha-beta
  - Limiter profondeur à 4
  - Tester performance (<1s par coup)

- [x] **4.3** Tester les bots
  - Bot random vs bot random (50/50)
  - Bot smart vs bot random (>80% victoires)
  - Vérifier déterminisme avec seed

## Phase 5 : Intégration

- [x] **5.1** Créer le manifest game.json
  - Métadonnées du jeu
  - Configuration des bots
  - Icône et visuels

- [x] **5.2** Intégrer au catalogue
  - Ajouter dans `data/catalogue.json`
  - Rebuild du catalogue
  - Vérifier apparition dans le portail

- [x] **5.3** Documentation
  - README.md dans `games/checkers/`
  - Règles du jeu
  - Guide de développement bot

- [x] **5.4** Tests d'intégration
  - Chargement depuis le portail
  - Lancement du jeu
  - Partie complète bot vs bot
  - Partie complète humain vs bot

## Phase 6 : Polish

- [x] **6.1** Améliorations visuelles
  - Feedback visuel sur captures multiples
  - Historique des coups
  - Compteur de pièces

- [x] **6.2** Améliorations UX
  - Bouton "Annuler" (pour debug)
  - Aide contextuelle (règles)
  - Son sur captures (optionnel)

- [x] **6.3** Validation finale
  - Revue de code
  - Tests de régression
  - Performance check
  - Documentation complète

---

**Dépendances entre tâches :**
- Phase 2 dépend de Phase 1
- Phase 3 dépend de Phase 1 complète
- Phase 4 dépend de Phase 1 complète
- Phase 5 dépend de Phases 1-4
- Phase 6 dépend de Phase 5

**Travail parallélisable :**
- Phase 3 et Phase 4 peuvent progresser en parallèle après Phase 1
- Tests unitaires (Phase 2) peuvent être écrits au fil de l'eau pendant Phase 1
