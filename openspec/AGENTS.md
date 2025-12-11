# OpenSpec - Instructions pour Agents IA

Ce document définit le workflow spec-driven development pour playlab42.

## Quand créer une proposal OpenSpec ?

**Créer une proposal pour :**
- Nouvelles fonctionnalités (nouveau jeu, nouvelle IHM, nouvel agent...)
- Breaking changes sur les APIs existantes
- Changements d'architecture
- Travaux significatifs de performance ou sécurité

**Ne pas créer de proposal pour :**
- Bug fixes simples
- Corrections de typos
- Mises à jour de dépendances
- Ajout de tests sur code existant

## Structure des dossiers

```
openspec/
├── AGENTS.md           # Ce fichier
├── project.md          # Conventions du projet
├── specs/              # Spécifications des capabilities
│   └── [capability]/
│       └── spec.md
└── changes/            # Propositions de changement
    ├── [change-id]/
    │   ├── proposal.md # Pourquoi, Quoi, Impact
    │   ├── tasks.md    # Checklist d'implémentation
    │   ├── design.md   # Décisions techniques (optionnel)
    │   └── specs/      # Deltas des specs
    └── archive/        # Changes déployés
```

## Workflow en 3 étapes

### 1. Créer un changement
```bash
/openspec:proposal
```
- Décrire le **pourquoi** et le **quoi**
- Identifier l'impact sur les specs existantes
- Obtenir validation avant implémentation

### 2. Implémenter
```bash
/openspec:apply
```
- Suivre `tasks.md` séquentiellement
- Cocher chaque tâche terminée
- Mettre à jour `design.md` si décisions techniques

### 3. Archiver après déploiement
```bash
/openspec:archive
```
- Déplacer vers `changes/archive/YYYY-MM-DD-[name]/`
- Fusionner les deltas dans `specs/`

## Format des Change IDs

Utiliser kebab-case avec verbe d'action :
- `add-poker-game` - Ajout de fonctionnalité
- `update-game-engine` - Modification
- `remove-legacy-api` - Suppression
- `refactor-ui-components` - Refactoring

## Format des Requirements

```markdown
## ADDED Requirements

### Requirement: [Nom]
The system SHALL [comportement attendu].

#### Scenario: [Nom du scénario]
- **WHEN** [condition]
- **THEN** [résultat attendu]
```

## Commandes disponibles

| Commande | Description |
|----------|-------------|
| `openspec list` | Changes actifs |
| `openspec list --specs` | Toutes les capabilities |
| `openspec show [item]` | Détails d'un item |
| `openspec validate [item]` | Validation stricte |
| `openspec archive <id>` | Archiver après déploiement |
