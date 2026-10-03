# Parcours pédagogiques

Ce dossier contient les parcours pédagogiques (Epics) de PlayLab42.

## Structure

```
parcours/
├── index.json          # Configuration des parcours
├── _shared/            # Fichiers partagés
│   ├── slide-base.css      # Styles de base des slides
│   ├── slide-template.html # Template pour slides Markdown
│   ├── slide-utils.js      # Utilitaires JavaScript
│   └── highlight-theme.css # Thème pour la coloration syntaxique
└── epics/
    └── mon-epic/
        ├── epic.json       # Manifest de l'epic
        ├── thumbnail.png   # Vignette (optionnel)
        └── slides/
            └── 01-intro/
                ├── slide.json  # Métadonnées de la slide
                └── index.html  # ou index.md (contenu)
```

## Créer une slide en Markdown

Les slides peuvent être rédigées en Markdown (`.md`) au lieu de HTML. Lors du build, les fichiers `index.md` sont automatiquement convertis en `index.html`.

### Exemple minimal

**`slides/01-intro/slide.json`**
```json
{
  "id": "01-intro",
  "title": "Introduction"
}
```

**`slides/01-intro/index.md`**
```markdown
# Titre de la slide

Paragraphe d'introduction avec du **texte en gras** et du `code inline`.

## Section

- Item 1
- Item 2

### Code avec coloration syntaxique

```javascript
function hello() {
  console.log("Hello World!");
}
```
```

### Fonctionnalités supportées

| Fonctionnalité | Support |
|----------------|---------|
| Titres (H1-H6) | ✅ |
| Texte formaté (gras, italique) | ✅ |
| Listes (ordonnées, non ordonnées) | ✅ |
| Code inline et blocs | ✅ |
| Coloration syntaxique | ✅ |
| Tableaux (GFM) | ✅ |
| Liens et images | ✅ |
| Citations | ✅ |
| Séparateurs (`---`) | ✅ |

### Coloration syntaxique

Les blocs de code avec un langage spécifié (`javascript`, `python`, etc.) bénéficient de la coloration syntaxique automatique via [highlight.js](https://highlightjs.org/).

Le thème s'adapte automatiquement au mode clair/sombre de l'interface.

## Build

```bash
# Générer data/parcours.json et convertir les slides Markdown
make build-parcours
```

Le rapport de build affiche le nombre de slides Markdown converties :
```
Slides Markdown converties: 3
```

## Voir aussi

- [Guide OpenSpec / OPSX](epics/openspec-usage-guide/README.md) - Parcours actualisé, version de référence et sources officielles
- [Playlab42 — Guide et usine logicielle](epics/hello-playlab42/README.md) - Utilisation, contribution, OpenSpec, skills et chaîne CI/publication
- [Spec Parcours](../openspec/specs/parcours/spec.md) - Spécification technique complète
