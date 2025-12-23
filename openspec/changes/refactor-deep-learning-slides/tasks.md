# Tâches d'implémentation

## Phase 1 : Préparation

- [x] **Créer le dossier _shared**
  - Fichier : `parcours/epics/deep-learning-intro/_shared/`
  - Extraire les styles CSS communs dans `deep-learning.css`
  - Garder les variables CSS, classes utilitaires, styles de base

- [x] **Extraire la classe DeepNeuralNetwork**
  - Fichier : `parcours/epics/deep-learning-intro/_shared/neural-network.js`
  - Extraire la classe avec Adam optimizer
  - Exporter comme module ES6

## Phase 2 : Création des slides théoriques

- [x] **Slide 01-introduction**
  - Fichier : `parcours/epics/deep-learning-intro/slides/01-introduction/index.html`
  - Contenu : Hero section + Chapitre 1 (L'Objectif)
  - Inclure les 3 cards (Forward, Erreur, Backprop)
  - Importer styles partagés

- [x] **Slide 02-neurone**
  - Fichier : `parcours/epics/deep-learning-intro/slides/02-neurone/index.html`
  - Contenu : Chapitre 2 (Anatomie d'un Neurone)
  - Formules : somme pondérée, activation
  - Analogie du robinet

- [x] **Slide 03-forward-loss**
  - Fichier : `parcours/epics/deep-learning-intro/slides/03-forward-loss/index.html`
  - Contenu : Chapitres 3-4 fusionnés
  - Forward propagation + Fonction de perte MSE
  - Analogies : chaîne de production, montagne dans le brouillard

- [x] **Slide 04-backpropagation**
  - Fichier : `parcours/epics/deep-learning-intro/slides/04-backpropagation/index.html`
  - Contenu : Chapitre 5
  - Règle de la chaîne, calcul étape par étape
  - Analogie du téléphone inversé

- [x] **Slide 05-optimisation**
  - Fichier : `parcours/epics/deep-learning-intro/slides/05-optimisation/index.html`
  - Contenu : Chapitre 6
  - Descente de gradient + Adam optimizer
  - Formules momentum et taux adaptatif

- [x] **Slide 06-contexte**
  - Fichier : `parcours/epics/deep-learning-intro/slides/06-contexte/index.html`
  - Contenu : Chapitres 7-8 fusionnés
  - Timeline historique
  - Cards des pièges (Vanishing, Exploding, Overfitting, Minimums)

## Phase 3 : Laboratoire

- [x] **Slide 07-laboratoire**
  - Fichier : `parcours/epics/deep-learning-intro/slides/07-laboratoire/index.html`
  - Contenu : Section Lab complète
  - Layout plein écran optimisé
  - Importer `neural-network.js` depuis `_shared/`
  - Charger Chart.js et TailwindCSS

## Phase 4 : Mise à jour Epic

- [x] **Mettre à jour epic.json**
  - Fichier : `parcours/epics/deep-learning-intro/epic.json`
  - Nouvelle structure avec 7 slides
  - Sections optionnelles : Contexte (histoire + pièges)

- [x] **Supprimer l'ancienne slide**
  - Supprimer : `parcours/epics/deep-learning-intro/slides/01-retropropagation/`

## Phase 5 : Validation

- [x] **Reconstruire le catalogue**
  - Commande : `make build-parcours`
  - Vérifier que l'epic apparaît correctement

- [ ] **Tester la navigation**
  - Vérifier les 7 slides dans le viewer
  - Tester la progression
  - Tester le lab en isolation

- [ ] **Vérifier le rendu**
  - Tester sur desktop et mobile
  - Vérifier MathJax sur toutes les slides
  - Vérifier le lab interactif

## Phase 6 : Commit

- [x] **Commit des changements**
  - Message : "Refactor deep-learning en 7 slides"
