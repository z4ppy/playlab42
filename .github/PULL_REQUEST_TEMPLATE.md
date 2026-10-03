# Description

<!-- Décrivez brièvement les changements apportés -->

## Type de contribution

<!-- Cochez le type qui correspond -->

- [ ] Tool (nouvel outil)
- [ ] Game (nouveau jeu)
- [ ] Epic (nouveau parcours)
- [ ] Fix (correction de bug)
- [ ] Docs (documentation)
- [ ] Autre

## Checklist

### Général

- [ ] J'ai testé en local avec `make serve`
- [ ] Le contenu fonctionne en mode sombre ET clair
- [ ] Le contenu est responsive (mobile + desktop)
- [ ] Les commentaires sont en français
- [ ] Change OpenSpec lié, ou absence justifiée selon le périmètre
- [ ] Résultats des contrôles pertinents indiqués, validations non exécutées signalées

### Pour un Tool

- [ ] Point d'entrée `index.html` autonome (modules locaux possibles)
- [ ] Fichier `tool.json` avec tous les champs requis
- [ ] Chemins relatifs vers `lib/theme.css` et `lib/theme.js`
- [ ] Catalogue régénéré avec `make npm CMD="run build:catalogue"`

### Pour un Game

- [ ] Dossier complet avec `index.html`, `engine.js`, `bots.js`, `game.json`
- [ ] Moteur isomorphe (pas de dépendance DOM dans engine.js)
- [ ] Au moins un bot fonctionnel
- [ ] Vignette `thumb.png` (380x180px, 19:9, < 50KB)
- [ ] Tests du moteur et des interactions modifiées
- [ ] Catalogue régénéré avec `make npm CMD="run build:catalogue"`

### Pour un Epic

- [ ] Dossier complet avec `epic.json` et slides
- [ ] Chaque slide a `slide.json` + `index.html`
- [ ] Styles partagés en chemins relatifs et initialisation par `slide-utils.js`
- [ ] Assets optimisés (images < 500KB)
- [ ] Catalogue régénéré dans Docker avec `make build-parcours`

## Screenshots

<!-- Si applicable, ajoutez des captures d'écran -->

## Notes additionnelles

<!-- Informations complémentaires pour les reviewers -->
