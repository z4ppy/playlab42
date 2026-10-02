## Why

La demande utilisateur autorise explicitement la revue **et l'implémentation**
des corrections de Relativity dans son worktree indépendant. Les réceptions
Doppler, les impulsions non colinéaires et les contrôles temporels présentent
des erreurs reproductibles. Le rendu dépend également de distributions CDN.

## What Changes

- Corriger le Doppler général, les impulsions et les bornes numériques.
- Séparer le temps simulé du rafraîchissement graphique ; conserver les
  émissions et réceptions entre deux pas.
- Déclarer explicitement la vue 3D comme une coupe simultanée du laboratoire :
  sélectionner un observateur pilote le cockpit, pas un boost de coordonnées.
- Nettoyer les ressources et les contrôles interrompus ; actualiser en pause.
- Épingler Three 0.186.1 et lil-gui 0.21.0, servir leurs modules localement.

## Capabilities

### New Capabilities
- `relativity-lab`: modèle pédagogique, horloges, propulsion et cycle de vie local.

### Modified Capabilities
Aucune spec existante de Relativity n'est présente.

## Impact

Uniquement `tools/relativity-lab`, tests associés, pins Three/lil-gui et hook
de build des assets 3D. Ni framework, ni backend, ni dépendance ML. Cette
autorisation ne constitue pas une approbation de revue, merge ou déploiement.
