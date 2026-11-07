---
name: playlab-create-epic
description: >-
  Créer ou enrichir un Epic Playlab42 : parcours pédagogique, epic.json,
  sections ordonnées, slide.json, slides HTML ou Markdown, médias, styles
  partagés et build du catalogue parcours. Utiliser pour transformer un cours
  en slides publiables ou corriger la structure d'un parcours. Ne pas confondre
  avec une issue GitHub de type epic ou une simple correction UI d'un jeu.
---

# Créer un Epic Playlab42

## Préparer

Lire [AGENTS.md](../../../AGENTS.md), `docs/guides/create-epic.md` et
[les références parcours](references/epic.md).
Tous les chemins en code sont relatifs à la racine du dépôt.
Pour une nouvelle capacité, suivre `openspec/AGENTS.md` et le changement approuvé.

Définir le public, les prérequis, l'objectif mesurable et la progression :
introduction, explication, pratique, retour sur l'exercice.
Choisir un id kebab-case et une hiérarchie existante dans `parcours/index.json`.
Partir de `templates/epic/` avec le générateur documenté dans
`docs/guides/contribution-kit.md` ; ne pas dupliquer son implémentation.

## Construire

1. Créer `parcours/epics/<id>/epic.json`. Utiliser les champs actuels :
   `id`, `title`, `description`, `hierarchy`, `tags`, `metadata`, `content`.
   Renseigner `metadata.author` (affiché sur la carte du parcours) avec le nom
   de la personne qui l'écrit (`git config user.name` ou demande explicite), et
   la date, sans inventer son identité ni utiliser « Playlab42 » ou « Anonyme ».
2. Ordonner les feuilles de `content` par ids de slides ; les sections ont leur
   propre `content`. Les ids doivent résoudre vers les dossiers réels.
   Ne pas remplacer cette structure par une liste de chemins inventée.
3. Fournir `slides/<slide-id>/slide.json` avec `id` et `title`, puis `index.html`
   ou `index.md`. Ne pas livrer un plan de cours à la place des slides demandées.
4. Préférer Markdown pour le contenu éditorial ; utiliser HTML pour l'interactivité.
   Le build convertit Markdown avec le template partagé. Ne pas maintenir à la
   main deux versions divergentes d'une slide.
5. Pour HTML, charger `lib/theme.css`, initialiser `initTheme()` et charger
   `parcours/_shared/slide-base.css` avec les chemins relatifs corrects.
   Réutiliser ses classes et les tokens ; ne pas recopier une feuille globale.
6. Garder une hiérarchie de titres lisible, des alternatives aux images utiles,
   des exemples français et des exercices avec consigne et retour pédagogique.
   Pour une interaction complexe, consulter `playlab-ui`.
7. Livrer uniquement les médias réellement référencés, avec chemins valides et
   droits d'utilisation appropriés. Ne pas pointer vers une vignette inexistante.

Une slide est chargée dans une iframe du viewer : préserver les liens et les
styles en affichage autonome et intégré. Ne pas ajouter un second système de
navigation ou de sauvegarde de progression.

## Vérifier

Runtime uniquement dans Docker et selon les permissions du rôle ; sinon déléguer
au parent/opérateur et indiquer les vérifications non exécutées.

```bash
make build-parcours
make serve
make info
```

Lire la sortie du build, puis vérifier que le nouvel epic apparaît dans
`data/parcours.json` avec le bon ordre et le bon nombre de slides.
Ouvrir le parcours dans le portail : navigation avant/arrière, sections, thèmes,
petit écran, médias et exercice interactif.
Utiliser `make test-e2e` pour les parcours navigateur pertinents.
Si la logique de build change réellement, cibler ses tests existants :
`make npm CMD="test -- --runTestsByPath scripts/parcours-utils.test.js"`.
Ne pas modifier le build simplement pour accepter un manifeste erroné.

## Livrer

Fournir l'epic complet, son chemin, ses objectifs et les limites éventuelles.
Ne pas versionner `data/parcours.json` ; vérifier `.gitignore` pour les sorties
HTML générées à partir de Markdown. Ne pas annoncer une publication tant que
la contribution n'est pas intégrée et déployée.
