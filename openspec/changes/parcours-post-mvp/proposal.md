# Proposal: Parcours Post-MVP

## Résumé

Améliorations et fonctionnalités reportées après le MVP du système Parcours.

## Motivation

Le MVP du système Parcours a été implémenté avec les fonctionnalités essentielles. Cette proposition regroupe les éléments identifiés mais reportés pour une version ultérieure.

## Éléments reportés

### 1. Conversion Markdown

**Objectif** : Permettre de rédiger les slides en Markdown plutôt qu'en HTML.

- Évaluer dépendance markdown (marked, micromark, ou autre)
- Étendre `build-parcours.js` pour convertir `.md` → `.html`
- Template HTML pour slides Markdown
- Syntax highlighting pour code blocks (Prism.js, highlight.js)

**Priorité** : Haute (améliore l'expérience auteur)

### 2. Tests unitaires complets

**Objectif** : Couverture de tests pour le système Parcours.

#### build-parcours.js
- Lecture config `index.json`
- Validation manifests `epic.json`
- Construction hiérarchie avec threshold
- Agrégation tags avec compteurs
- Génération `parcours.json`

#### parcours-viewer.js
- Navigation (next, prev, goTo)
- Gestion progression localStorage
- Hash routing
- Keyboard shortcuts

**Priorité** : Moyenne (stabilité)

### 3. Documentation utilisateur

**Objectif** : Guides pour créer des Epics.

- `docs/guides/create-epic.md`
  - Structure d'un Epic
  - Format `epic.json` détaillé
  - Format `slide.json` détaillé
  - Gestion des assets (images, vidéos, audio)
  - Limites de taille recommandées
  - Sections et slides optionnelles
  - Exemples minimal et complet

- Mise à jour `docs/guides/architecture.md`
  - Section Parcours
  - Diagramme de structure

**Priorité** : Moyenne (onboarding contributeurs)

### 4. Fonctionnalités avancées (optionnel)

- **Mode présentation** : Plein écran sans UI, contrôle par clavier uniquement
- **Export PDF** : Génération de PDF à partir d'un Epic
- **Analytics** : Tracking temps passé par slide (localStorage)
- **Thèmes de slides** : Variantes de style (dark, light, presentation)
- **Embed externe** : Intégration de contenu externe (YouTube, CodePen)

**Priorité** : Basse (nice-to-have)

## Dépendances

- MVP Parcours implémenté ✅

## Statut

- **Créé** : 2025-01-15
- **Statut** : Draft
- **Priorité** : Post-MVP
