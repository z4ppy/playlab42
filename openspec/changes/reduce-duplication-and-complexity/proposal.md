## Why

La PR #148 est intégrée à main `ef0a2aa`. Le 4 octobre 2026, l'utilisateur
autorise la poursuite des corrections de qualité, notamment duplication et
complexité, en fleet. La CI possède lint, couverture et sécurité, mais aucun
rapport global de duplication/complexité accessible. Ne pas présenter une
mesure locale comme un rapport natif existant.

## What Changes

- Caractériser puis simplifier les hotspots de fabrication, du clavier musical
  et de la simulation de particules ; mutualiser les calculs XP et les vrais
  clones de fabrication, sans généraliser les moteurs ni changer les formats.
- Ajouter un rapport reproductible local/CI avec outils verrouillés, scopes
  explicites, provenance et artefact ; distinguer cyclomatique JS/HTML,
  cognitif TS et clones détectés.
- Conserver les seuils existants et protéger les extractions. Les répétitions
  pédagogiques et de tests ne sont pas supprimées pour améliorer un score.

## Impact

Scripts de fabrication, Diese & Mat, Particle Life, tooling/CI et guide qualité.
Worktrees indépendants, intégration vers main, aucune autorisation de fusion,
publication du site, modification de protection ou archivage.
