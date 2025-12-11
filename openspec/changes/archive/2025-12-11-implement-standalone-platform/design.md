# Design: implement-standalone-platform

## Décisions techniques

### 1. JavaScript ES Modules plutôt que TypeScript

**Choix** : JavaScript avec `"type": "module"` dans package.json

**Justification** :
- Simplicité pour un projet pédagogique
- Pas de build step pour le code frontend
- Les fichiers HTML importent directement les modules JS
- ESLint strict compense l'absence de types

**Trade-off** : Moins de sécurité type, mais plus accessible pour les participants.

### 2. Serveur statique `serve` plutôt que Express

**Choix** : Package `serve` avec configuration `serve.json`

**Justification** :
- Zéro code serveur à maintenir
- Configuration déclarative
- Suffisant pour la phase standalone
- Prêt pour déploiement GitHub Pages / Netlify

### 3. Architecture iframe sandboxée

**Choix** : Charger tools et games dans des iframes avec `sandbox="allow-scripts"`

**Justification** :
- Isolation complète du code des jeux
- Sécurité (pas d'accès au DOM parent)
- Chaque jeu peut avoir ses propres dépendances
- Communication via postMessage

### 4. Mulberry32 pour le PRNG

**Choix** : Algorithme Mulberry32 (32 bits)

**Justification** :
- Rapide et léger
- Bonne distribution statistique
- État simple (un seul entier)
- Suffisant pour des jeux (pas de crypto)

### 5. Minimax avec alpha-beta pour le bot Perfect

**Choix** : Minimax classique avec élagage alpha-beta

**Justification** :
- Tic-Tac-Toe a un arbre de jeu petit (~9! max)
- Garantit le jeu parfait
- Élagage réduit les calculs inutiles
- Bon exemple pédagogique d'IA de jeu

### 6. Stockage localStorage pour les préférences

**Choix** : localStorage avec préfixe `playlab42.`

**Justification** :
- Simple et natif
- Persiste entre sessions
- Pas de backend nécessaire
- Suffisant pour pseudo, scores locaux, historique récent

## Problèmes rencontrés et solutions

### Port 9229 déjà alloué
- **Problème** : Conflit avec un autre service de debug
- **Solution** : Retiré du docker-compose.yml (pas nécessaire)

### Permissions npm dans Docker
- **Problème** : `npm install` échouait avec USER node
- **Solution** : Exécution en root dans le container dev

### Directory listing HTTP
- **Problème** : `/tools/` listait les fichiers (sécurité)
- **Solution** : `serve.json` avec `"directoryListing": false`

### 404 à la racine
- **Problème** : Après désactivation du listing, `/` retournait 404
- **Solution** : Rewrite rule dans serve.json vers `/index.html`

## Métriques

| Métrique | Valeur |
|----------|--------|
| Fichiers JS | 12 |
| Lignes de code | ~2500 |
| Tests | 50 |
| Couverture ESLint | 100% |
| Temps build catalogue | < 100ms |
