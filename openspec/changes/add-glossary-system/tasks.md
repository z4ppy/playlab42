# Tasks: add-glossary-system

## Phase 1 : Infrastructure

- [x] Définir le format JSON du glossaire (epic + global)
- [x] Mettre à jour la spec parcours avec la section glossaire
- [x] Créer le module `lib/parcours/ParcoursGlossary.js`
  - [x] Chargement du glossaire (epic + global)
  - [x] Fusion des définitions (epic override global)
  - [x] API pour récupérer une définition

## Phase 2 : Affichage Tooltip

- [x] Créer les styles CSS pour les termes (`<dfn>`)
  - [x] Underline pointillé
  - [x] Curseur help
  - [x] Couleur distinctive (subtile)
- [x] Créer le composant tooltip
  - [x] Positionnement intelligent (éviter débordement)
  - [x] Animation d'apparition
  - [x] Support mobile (tap)
- [x] Intégrer dans le viewer parcours
  - [x] Injection du glossaire dans les slides
  - [x] Event listeners sur les termes

## Phase 3 : Marquage des termes

- [x] Support HTML : `<dfn>` et `<dfn data-term="...">`
- [x] Support Markdown : syntaxe `[[terme]]` et `[[terme|texte]]`
- [x] Helper dans `slide-utils.js` pour auto-marquage
- [x] Documentation d'utilisation (JSDoc)

## Phase 4 : Page glossaire auto-générée

- [x] Nouveau type de slide `glossary`
- [x] Template HTML pour la page glossaire
- [x] Génération lazy à l'affichage (via generateGlossaryPage)
- [x] Tri alphabétique des termes
- [x] Liens croisés ("voir aussi")

## Phase 5 : Build & Validation

- [x] Mise à jour `build-parcours.js`
  - [x] Chargement des fichiers glossaire
  - [x] Validation des termes référencés
  - [x] Warning si terme dans `see` non défini
- [ ] Tests unitaires (à faire dans une prochaine itération)
- [x] Documentation (JSDoc complète)

## Phase 6 : Application au parcours deep-learning

- [x] Créer `glossary.json` pour deep-learning-intro (31 termes)
- [x] Définir les termes : régression, classification, gradient, etc.
- [x] Marquer les termes dans les slides existantes (02-neurone, 04-forward-loss)
- [x] Ajouter une slide glossaire optionnelle (09-glossaire)

---

## Fichiers créés/modifiés

| Fichier | Action |
|---------|--------|
| `lib/parcours/ParcoursGlossary.js` | Créé - Module de gestion du glossaire |
| `lib/parcours-viewer.css` | Modifié - Styles glossaire ajoutés |
| `parcours/_shared/slide-utils.js` | Modifié - Fonctions initGlossary, transformWikiTerms, autoMarkTerms |
| `parcours/_shared/templates/glossary-slide.html` | Créé - Template de slide glossaire |
| `parcours/epics/deep-learning-intro/glossary.json` | Créé - 31 termes définis |
| `parcours/epics/deep-learning-intro/slides/09-glossaire/` | Créé - Slide glossaire |
| `parcours/epics/deep-learning-intro/epic.json` | Modifié - Ajout slide glossaire |
| `scripts/build-parcours.js` | Modifié - Support glossaire dans le build |

---

*Dernière mise à jour : 2025-12-23*
