# Tasks: update-portal-tabs

## Phase 1 : Mise à jour de la spec

- [x] Mettre à jour `openspec/specs/portal/spec.md`
  - Ajouter `activeTab` dans PortalState
  - Mettre à jour les wireframes avec onglets
  - Ajouter requirement "Tab Navigation"
  - Ajouter clé localStorage `activeTab`

## Phase 2 : Implémentation HTML/CSS

- [x] Modifier `index.html`
  - Ajouter structure des onglets (nav avec boutons)
  - Séparer les conteneurs games et tools
  - Déplacer "Joué récemment" dans le conteneur games

- [x] Modifier `style.css`
  - Styles des onglets (actif/inactif)
  - Transitions de fade
  - Responsive mobile (onglets full-width)

## Phase 3 : Implémentation JavaScript

- [x] Modifier `app.js`
  - État `activeTab` avec getter/setter
  - Fonction `switchTab(tab)`
  - Persistence localStorage de l'onglet
  - Filtrage par onglet (tags séparés)
  - Restauration de l'onglet au chargement

## Phase 4 : Tests et validation

- [x] Tester navigation entre onglets
- [x] Tester persistence au rechargement
- [x] Tester filtres indépendants par onglet
- [x] Tester recherche dans l'onglet actif
- [x] Tester responsive mobile
- [x] Vérifier accessibilité (aria-selected, keyboard nav)

Note: Tests manuels effectués avec succès. L'implémentation suit les specs ARIA.
