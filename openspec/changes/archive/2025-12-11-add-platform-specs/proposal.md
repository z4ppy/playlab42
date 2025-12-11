# Proposal: add-platform-specs

## Pourquoi ?

Le projet Playlab42 a une vision claire (features, concepts, conventions) mais **aucune spécification technique formelle**. Avant d'implémenter quoi que ce soit, nous devons définir :

- L'architecture technique de la plateforme (version standalone)
- Les interfaces des composants (GameEngine, manifests)
- Les formats de données (catalogue JSON, état de jeu)
- Le système de build pour assembler le catalogue

**Scope de cette version** : Tools et games standalone uniquement. Le backend et le multijoueur seront ajoutés dans une version ultérieure.

Sans ces specs, chaque implémentation risque d'être incohérente avec les autres.

### Bénéfices

1. **Cohérence** : Toutes les implémentations suivront les mêmes interfaces
2. **Documentation** : Les participants aux formations auront des références claires
3. **Qualité** : Code prévisible et maintenable
4. **Onboarding** : Nouveaux contributeurs opérationnels rapidement

## Quoi ?

Créer les spécifications techniques fondamentales dans `openspec/specs/` :

### 1. `platform.spec.md` - Architecture globale

- Stack technique (choix et justifications)
- Structure des dossiers
- Mode d'exécution standalone
- Système de build

### 2. `catalogue.spec.md` - Base de données JSON

- Format du fichier `catalogue.json` généré au build
- Structure des entrées (tools et games)
- Script de génération (scan des manifests)
- Utilisation par le frontend

### 3. `game-engine.spec.md` - Interface GameEngine

- Interface TypeScript définitive
- Contraintes (isomorphisme, déterminisme, pureté)
- Cycle de vie d'un moteur
- Gestion des tours et du temps réel

### 4. `manifests.spec.md` - Formats de manifests

- `tool.json` : Structure pour les outils
- `game.json` : Structure pour les jeux
- Champs obligatoires vs optionnels
- Schémas de validation

### 5. `seeded-random.spec.md` - Générateur aléatoire

- Interface SeededRandom
- Algorithme (reproductibilité)
- Utilisation dans les moteurs

### 6. `bot.spec.md` - Interface Bot (IA)

- Interface Bot abstraite (isomorphe)
- Configuration des slots joueurs (humain/bot/disabled)
- Types de bots (Random, Greedy, Minimax)
- Game Runner pour orchestrer humains et bots
- Bots par défaut en mode solo

### 7. `portal.spec.md` - Interface du portail

- Écrans (catalogue, jeu, settings)
- Filtrage et recherche
- Game Loader (iframe sandboxé)
- Communication iframe ↔ portail
- Gestion des préférences (son, pseudo)
- Historique des jeux récents

### 8. `gamekit.spec.md` - SDK pour les jeux

- API GameKit (init, scores, progression)
- Asset Loader (images, sons, JSON)
- Hooks de cycle de vie (pause, resume, dispose)
- Communication avec le portail
- Template de jeu minimal

### Specs reportées (version future avec backend)

Les specs suivantes seront créées quand le backend sera implémenté :

- `sdk.spec.md` - Interface PlayLabSDK (communication plateforme)
- `websocket.spec.md` - Protocole de communication temps réel

## Impact

### Nouvelles specs créées

| Spec | Description |
|------|-------------|
| `platform.spec.md` | Architecture et stack (standalone) |
| `catalogue.spec.md` | Base de données JSON des tools/games |
| `game-engine.spec.md` | Interface moteur de jeu |
| `manifests.spec.md` | Formats game.json, tool.json |
| `seeded-random.spec.md` | Générateur aléatoire |
| `bot.spec.md` | Interface Bot (IA) et configuration slots |
| `portal.spec.md` | Interface utilisateur du portail |
| `gamekit.spec.md` | SDK pour les jeux |

### Specs reportées

| Spec | Raison |
|------|--------|
| `sdk.spec.md` | Nécessite backend (version future) |
| `websocket.spec.md` | Nécessite backend (version future) |

### Fichiers existants impactés

- `docs/CONCEPTS.md` : Ajout de références vers les specs
- `docs/FEATURES.md` : Liens vers les specs concernées
- `CLAUDE.md` : Références aux specs techniques

### Dépendances

Aucune - c'est la première proposal, elle établit les fondations.

### Breaking changes

Aucun - pas de code existant.

## Décisions techniques (validées)

| Question | Choix | Justification |
|----------|-------|---------------|
| Frontend | **HTML pur** | Standalone, pas de build, pédagogique |
| Tests | **Jest** | Standard, déjà configuré |
| Catalogue | **JSON généré** | Assemblé au build, pas de BDD |

### Décisions reportées (version avec backend)

| Question | Choix prévu | Notes |
|----------|-------------|-------|
| Backend | Hono | Léger, moderne, TypeScript natif |
| WebSocket | ws | Standard, pas de dépendance client |
| Persistance | JSON files | Standalone, pas de BDD |

Voir `design.md` pour les justifications détaillées.

## Validation

- [ ] Toutes les interfaces sont définies en TypeScript
- [ ] Les choix techniques sont justifiés
- [ ] Les specs sont cohérentes entre elles
- [ ] La documentation existante est mise à jour
