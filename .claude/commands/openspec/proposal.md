Crée une nouvelle proposition de changement OpenSpec.

## Instructions

1. Demande à l'utilisateur de décrire le changement souhaité
2. Lis `@/openspec/AGENTS.md` pour comprendre le workflow
3. Lis `@/openspec/project.md` pour les conventions
4. Explore les specs existantes dans `@/openspec/specs/`
5. Crée le dossier `openspec/changes/[change-id]/` avec :
   - `proposal.md` : Pourquoi, Quoi, Impact
   - `tasks.md` : Checklist d'implémentation
   - `specs/` : Deltas des spécifications affectées

## Format du Change ID

Utilise kebab-case avec verbe d'action :
- `add-[feature]` pour ajouts
- `update-[feature]` pour modifications
- `remove-[feature]` pour suppressions
- `refactor-[scope]` pour refactoring

## Validation

Avant de finaliser, vérifie que :
- [ ] Le proposal.md explique clairement le "pourquoi"
- [ ] Les tâches sont concrètes et séquentielles
- [ ] Les specs impactées sont identifiées
