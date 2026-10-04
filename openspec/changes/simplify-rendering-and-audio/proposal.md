## Why

Le 4 octobre 2026, l'utilisateur confirme la fusion #149 et autorise la
poursuite de la qualité. Le rapport natif de main `72a8f5d` (run 37199116572)
contient 62 fonctions de production > 10, dont six > 20, et 62 clones.
Les six hotspots > 20 concernent les rendus Dames/Triomino et Diese & Mat :
construction audio, réglages, curseurs et menu.

## What Changes

- Caractériser les rendus, événements et ordre des effets avant extraction.
- Séparer quelques responsabilités de présentation/audio, sans changer les
  moteurs, séquences RNG, états JSON, styles ou comportement des commandes.
- Mutualiser seulement les duplications de panneaux réellement compatibles.
- Corriger le setter live `MetalSynth.harmonicity` confirmé défectueux avec
  Tone 15.1.22 et réaligner le double ; exception intentionnelle à la
  conservation du comportement défaillant, avec tests rouges avant correction.
- Collecter et protéger les nouvelles sources avec budgets ciblés, puis
  publier les mesures avant/après avec les outils déjà verrouillés.

## Impact

Jeux Dames/Triomino, AudioEngine et contrôleurs Diese & Mat, tests, collecte,
budgets, guides et parcours liés. Nouveau worktree depuis main fusionné.
Autorisation d'implémentation, pas de fusion, publication ni archivage.
