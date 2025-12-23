# Tasks: add-glossary-system

## Phase 1 : Infrastructure

- [ ] Définir le format JSON du glossaire (epic + global)
- [ ] Mettre à jour la spec parcours avec la section glossaire
- [ ] Créer le module `lib/parcours/ParcoursGlossary.js`
  - [ ] Chargement du glossaire (epic + global)
  - [ ] Fusion des définitions (epic override global)
  - [ ] API pour récupérer une définition

## Phase 2 : Affichage Tooltip

- [ ] Créer les styles CSS pour les termes (`<dfn>`)
  - [ ] Underline pointillé
  - [ ] Curseur help
  - [ ] Couleur distinctive (subtile)
- [ ] Créer le composant tooltip
  - [ ] Positionnement intelligent (éviter débordement)
  - [ ] Animation d'apparition
  - [ ] Support mobile (tap)
- [ ] Intégrer dans le viewer parcours
  - [ ] Injection du glossaire dans les slides
  - [ ] Event listeners sur les termes

## Phase 3 : Marquage des termes

- [ ] Support HTML : `<dfn>` et `<dfn data-term="...">`
- [ ] Support Markdown : syntaxe à définir
- [ ] Helper dans `slide-utils.js` pour auto-marquage
- [ ] Documentation d'utilisation

## Phase 4 : Page glossaire auto-générée

- [ ] Nouveau type de slide `glossary`
- [ ] Template HTML pour la page glossaire
- [ ] Génération au build (ou lazy à l'affichage)
- [ ] Tri alphabétique des termes
- [ ] Liens croisés ("voir aussi")

## Phase 5 : Build & Validation

- [ ] Mise à jour `build-parcours.js`
  - [ ] Chargement des fichiers glossaire
  - [ ] Validation des termes référencés
  - [ ] Warning si terme utilisé sans définition
- [ ] Tests unitaires
- [ ] Documentation

## Phase 6 : Application au parcours deep-learning

- [ ] Créer `glossary.json` pour deep-learning-intro
- [ ] Définir les termes : régression, classification, gradient, etc.
- [ ] Marquer les termes dans les slides existantes
- [ ] Ajouter une slide glossaire optionnelle

---

## Définitions à ajouter (deep-learning-intro)

### Termes généraux ML

| Terme | Définition courte |
|-------|-------------------|
| régression | Prédire une valeur numérique continue |
| classification | Prédire une catégorie parmi plusieurs |
| overfitting | Modèle qui mémorise au lieu d'apprendre |
| underfitting | Modèle trop simple pour capturer les patterns |
| outlier | Valeur aberrante, éloignée de la distribution |

### Termes réseaux de neurones

| Terme | Définition courte |
|-------|-------------------|
| neurone | Unité de calcul : somme pondérée + activation |
| poids | Paramètre appris qui pondère une entrée |
| biais | Paramètre appris qui décale l'activation |
| activation | Fonction non-linéaire appliquée à la somme pondérée |
| couche | Ensemble de neurones au même niveau du réseau |

### Termes apprentissage

| Terme | Définition courte |
|-------|-------------------|
| propagation avant | Calcul de la prédiction de l'entrée vers la sortie |
| rétropropagation | Calcul des gradients de la sortie vers l'entrée |
| gradient | Direction et intensité de la pente de la fonction de perte |
| descente de gradient | Algorithme d'optimisation qui suit le gradient |
| fonction de perte | Mesure de l'écart entre prédiction et réalité |
| epoch | Un passage complet sur toutes les données d'entraînement |
| batch | Sous-ensemble de données traité ensemble |
| learning rate | Taille du pas dans la descente de gradient |

### Termes problèmes

| Terme | Définition courte |
|-------|-------------------|
| vanishing gradient | Gradients qui deviennent trop petits dans les réseaux profonds |
| exploding gradient | Gradients qui deviennent trop grands |
| minimum local | Creux dans la fonction de perte qui n'est pas le minimum global |

---

*Dernière mise à jour : 2025-12-23*
