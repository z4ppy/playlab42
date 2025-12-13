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

### Pour un Tool

- [ ] Fichier `index.html` standalone
- [ ] Fichier `tool.json` avec tous les champs requis
- [ ] Utilise `/lib/theme.css` et `/lib/theme.js`
- [ ] Catalogue régénéré avec `make npm CMD="run build:catalogue"`

### Pour un Game

- [ ] Dossier complet avec `index.html`, `engine.js`, `bots.js`, `game.json`
- [ ] Moteur isomorphe (pas de dépendance DOM dans engine.js)
- [ ] Au moins un bot fonctionnel
- [ ] Vignette `thumb.png` (200x200px, < 50KB)
- [ ] Catalogue régénéré avec `make npm CMD="run build:catalogue"`

### Pour un Epic

- [ ] Dossier complet avec `epic.json` et slides
- [ ] Chaque slide a `slide.json` + `index.html`
- [ ] Slides utilisent `/lib/theme.css`, `/lib/theme.js` et `/parcours/_shared/slide-base.css`
- [ ] Assets optimisés (images < 500KB)
- [ ] Catalogue régénéré avec `node scripts/build-parcours.js`

## Screenshots

<!-- Si applicable, ajoutez des captures d'écran -->

## Notes additionnelles

<!-- Informations complémentaires pour les reviewers -->
