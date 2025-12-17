# Tasks: Système de Navigation Hash Router

## Phase 1: Infrastructure Router

- [ ] Créer `lib/router.js` avec le module de routing
  - [ ] Parser le hash URL
  - [ ] Matcher les routes avec paramètres
  - [ ] Gérer l'événement `hashchange`
  - [ ] Exposer `navigate(route)` et `getCurrentRoute()`

- [ ] Ajouter tests unitaires pour le router
  - [ ] Test parsing des routes
  - [ ] Test extraction des paramètres
  - [ ] Test matching des patterns

## Phase 2: Intégration dans le portail

- [ ] Refactorer `app.js` pour utiliser le router
  - [ ] Initialiser le router au démarrage
  - [ ] Remplacer `loadGame()` par navigation hash
  - [ ] Remplacer `showCatalogue()` par navigation hash
  - [ ] Gérer la route initiale au chargement

- [ ] Mettre à jour `index.html`
  - [ ] Convertir les liens en liens hash (`href="#/games/..."`)
  - [ ] Ajouter gestionnaire pour liens dynamiques

## Phase 3: Navigation parcours

- [ ] Intégrer le router avec `parcours-viewer.js`
  - [ ] Synchroniser le hash avec la slide courante
  - [ ] Permettre navigation directe vers une slide

## Phase 4: Nettoyage

- [ ] Supprimer les chemins absolus inutiles des jeux/tools
  - [ ] `games/checkers/index.html` - déjà corrigé
  - [ ] `games/tictactoe/index.html`
  - [ ] `tools/json-formatter.html`
  - [ ] Slides des parcours

- [ ] Mettre à jour la documentation
  - [ ] `docs/guides/architecture.md`
  - [ ] `AGENTS.md` si nécessaire

## Phase 5: Specs

- [ ] Mettre à jour `openspec/specs/portal/spec.md`
  - [ ] Documenter le système de routing
  - [ ] Ajouter les routes supportées

## Critères de validation

- [ ] Toutes les routes fonctionnent sur GitHub Pages
- [ ] Le bouton précédent/suivant du navigateur fonctionne
- [ ] Les URLs sont partageables et bookmarkables
- [ ] Pas de régression sur le chargement des jeux/tools
- [ ] Les parcours naviguent correctement entre slides
