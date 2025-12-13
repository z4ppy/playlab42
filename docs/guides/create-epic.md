# Créer un Epic (Parcours pédagogique)

Ce guide vous accompagne dans la création d'un Epic, une collection de slides formant un parcours pédagogique cohérent sur PlayLab42.

## Qu'est-ce qu'un Epic ?

Un **Epic** est l'unité de publication dans le système Parcours :

- Collection ordonnée de **slides** (1 à N)
- Possède ses propres **métadonnées** (titre, auteur, vignette, etc.)
- Organisé en **sections** optionnelles
- Classé dans une **hiérarchie** et taggé pour le filtrage

**Caractéristiques :**
- 100% statique (compatible GitHub Pages)
- Slides en HTML ou **Markdown** (conversion automatique)
- Support des médias (images, vidéos, audio)
- Progression utilisateur sauvegardée

## Prérequis

- Connaissances de base en HTML et/ou Markdown
- Docker installé (`make serve` pour tester)

## Structure d'un Epic

```
parcours/epics/mon-epic/
├── epic.json                # Manifest de l'epic (obligatoire)
├── thumbnail.png            # Vignette (recommandée)
├── assets/                  # Médias partagés
│   ├── images/
│   │   └── schema.png
│   └── videos/
│       └── demo.mp4
└── slides/
    ├── 01-intro/
    │   ├── slide.json       # Métadonnées de la slide
    │   └── index.html       # ou index.md (contenu)
    └── 02-concepts/
        ├── slide.json
        └── index.md
```

## Étapes

### 1. Créer le dossier de l'Epic

```bash
mkdir -p parcours/epics/mon-epic/slides/01-intro
```

**Convention de nommage :** `kebab-case` pour le nom du dossier.

### 2. Créer le manifest `epic.json`

```json
{
  "id": "mon-epic",
  "title": "Mon Premier Epic",
  "description": "Description courte (1-3 phrases) de l'epic.",
  "hierarchy": ["playlab42"],
  "tags": ["howto", "debutant"],
  "metadata": {
    "author": "Votre Nom",
    "created": "2025-01-15",
    "duration": "15 min",
    "difficulty": "beginner",
    "language": "fr"
  },
  "icon": "📚",
  "thumbnail": "thumbnail.png",
  "content": [
    { "id": "01-intro" }
  ]
}
```

### Champs du manifest

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `id` | ✅ | Identifiant unique = nom du dossier |
| `title` | ✅ | Titre affiché |
| `description` | ✅ | Description courte (1-3 phrases) |
| `hierarchy` | ✅ | Position dans la hiérarchie (`["playlab42"]` ou `["autres"]`) |
| `tags` | ✅ | Tags pour le filtrage |
| `metadata.author` | ✅ | Auteur de l'epic |
| `metadata.created` | ✅ | Date de création (ISO 8601) |
| `metadata.updated` | | Date de dernière modification |
| `metadata.duration` | | Durée estimée (`"15 min"`, `"2h"`) |
| `metadata.difficulty` | | `"beginner"`, `"intermediate"`, `"advanced"` |
| `metadata.language` | | Langue (`"fr"`, `"en"`) |
| `icon` | | Emoji pour l'icône |
| `thumbnail` | | Chemin vers la vignette (380x180px, 19:9, < 50KB) |
| `content` | ✅ | Liste des slides et sections |
| `draft` | | `true` pour ne pas publier |

### 3. Créer les slides

Chaque slide est un dossier avec `slide.json` et un fichier de contenu.

#### Format `slide.json`

```json
{
  "id": "01-intro",
  "title": "Introduction",
  "icon": "👋"
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `id` | ✅ | Identifiant = nom du dossier |
| `title` | ✅ | Titre affiché dans le menu |
| `icon` | | Emoji pour l'icône |
| `description` | | Description courte |
| `duration` | | Durée estimée |

#### Contenu HTML (`index.html`)

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Introduction - PlayLab42</title>
  <link rel="stylesheet" href="/lib/theme.css">
  <link rel="stylesheet" href="/parcours/_shared/slide-base.css">
  <script type="module">
    import { initTheme } from '/lib/theme.js';
    initTheme();
  </script>
</head>
<body>
  <article class="slide">
    <h1>Introduction</h1>
    <p>Bienvenue dans ce parcours !</p>

    <h2>Objectifs</h2>
    <ul>
      <li>Premier objectif</li>
      <li>Deuxième objectif</li>
    </ul>
  </article>
</body>
</html>
```

#### Contenu Markdown (`index.md`) - Recommandé

```markdown
# Introduction

Bienvenue dans ce parcours !

## Objectifs

- Premier objectif
- Deuxième objectif

## Code d'exemple

```javascript
function hello() {
  console.log("Hello World!");
}
```

> **Note :** Les slides Markdown sont converties automatiquement en HTML lors du build.
```

**Avantages du Markdown :**
- Plus simple et rapide à écrire
- Coloration syntaxique automatique pour le code
- Conversion automatique lors du `build:parcours`

### 4. Organiser avec des sections

Pour structurer un epic avec plusieurs slides, utilisez des sections :

```json
{
  "id": "mon-epic",
  "title": "Mon Epic",
  "description": "...",
  "hierarchy": ["playlab42"],
  "tags": ["tutorial"],
  "metadata": {
    "author": "Auteur",
    "created": "2025-01-15"
  },
  "content": [
    {
      "id": "introduction",
      "title": "Introduction",
      "icon": "👋",
      "content": [
        { "id": "01-bienvenue" },
        { "id": "02-prerequis" }
      ]
    },
    {
      "id": "pratique",
      "title": "Mise en pratique",
      "icon": "🛠️",
      "content": [
        { "id": "03-exercice-1" },
        { "id": "04-exercice-2" }
      ]
    },
    { "id": "05-conclusion" }
  ]
}
```

### 5. Marquer des slides optionnelles

```json
{
  "content": [
    { "id": "01-intro" },
    { "id": "02-avance", "optional": true },
    { "id": "03-conclusion" }
  ]
}
```

Une section entière peut aussi être optionnelle :

```json
{
  "id": "bonus",
  "title": "Pour aller plus loin",
  "icon": "🚀",
  "optional": true,
  "content": [
    { "id": "bonus-01" },
    { "id": "bonus-02" }
  ]
}
```

### 6. Ajouter des médias

#### Structure recommandée

```
mon-epic/
├── assets/
│   ├── images/
│   │   ├── schema.png
│   │   └── capture.jpg
│   └── videos/
│       └── demo.mp4
└── slides/
    └── 01-intro/
        └── index.html
```

#### Référencer dans HTML

```html
<!-- Image depuis les assets de l'epic -->
<img src="../../assets/images/schema.png" alt="Schéma explicatif">

<!-- Vidéo -->
<video controls>
  <source src="../../assets/videos/demo.mp4" type="video/mp4">
</video>
```

#### Référencer dans Markdown

```markdown
![Schéma explicatif](../../assets/images/schema.png)

<!-- Pour vidéo/audio, utiliser HTML inline -->
<video controls src="../../assets/videos/demo.mp4"></video>
```

#### Limites de taille

| Élément | Limite |
|---------|--------|
| Image | < 500KB |
| Vidéo | < 10MB |
| Audio | < 5MB |
| Vignette | 380x180px (19:9), < 50KB |
| Total Epic | < 50MB |

### 7. Générer le catalogue

```bash
make build-parcours
```

Le build :
- Valide les manifests
- Convertit les slides Markdown en HTML
- Génère `data/parcours.json`

### 8. Tester

```bash
make serve
# Ouvrir http://localhost:5242
# Naviguer vers l'onglet "Parcours"
```

## Exemples

### Epic minimal (1 slide Markdown)

```
parcours/epics/exemple-article/
├── epic.json
└── slides/
    └── 01-introduction/
        ├── slide.json
        └── index.md
```

**`epic.json`**
```json
{
  "id": "exemple-article",
  "title": "Mon Article",
  "description": "Un article simple.",
  "hierarchy": ["autres"],
  "tags": ["article"],
  "metadata": {
    "author": "Moi",
    "created": "2025-01-15"
  },
  "content": [
    { "id": "01-introduction" }
  ]
}
```

**`slides/01-introduction/slide.json`**
```json
{
  "id": "01-introduction",
  "title": "Introduction"
}
```

**`slides/01-introduction/index.md`**
```markdown
# Introduction

Bienvenue dans mon article !

## Points clés

- Point 1
- Point 2
- Point 3
```

### Epic complet avec sections

Voir l'epic `hello-playlab42` dans `parcours/epics/hello-playlab42/` pour un exemple complet avec :
- Vignette
- Sections multiples
- Slides HTML et Markdown
- Assets

## Checklist de validation

Avant de publier votre epic, vérifiez :

- [ ] `epic.json` contient tous les champs obligatoires
- [ ] Chaque slide référencée dans `content` existe dans `slides/`
- [ ] Chaque slide a un `slide.json` et un `index.html` ou `index.md`
- [ ] Les médias référencés existent
- [ ] La vignette fait 380x180px (19:9) et < 50KB (si sp\u00e9cifi\u00e9e)
- [ ] `make build-parcours` ne génère pas d'erreurs
- [ ] L'epic s'affiche correctement dans le viewer

## Bonnes pratiques

### Contenu

1. **Titre clair** : Le titre doit indiquer le sujet du parcours
2. **Description utile** : 1-3 phrases décrivant ce que l'utilisateur va apprendre
3. **Slides courtes** : Une idée principale par slide
4. **Progression logique** : Du simple au complexe

### Structure

1. **Préfixes numériques** : `01-intro`, `02-concepts`, `03-pratique`
2. **Sections pour 4+ slides** : Organiser en groupes logiques
3. **Slides optionnelles** : Pour le contenu avancé ou bonus

### Médias

1. **Optimiser les images** : WebP ou PNG compressé
2. **Alt text** : Toujours fournir des descriptions
3. **Vidéos courtes** : < 2 minutes, ou utiliser YouTube/Vimeo

### Style

1. **Utiliser les CSS** : `slide-base.css` pour la cohérence
2. **Variables CSS** : `var(--color-accent)`, etc.
3. **Responsive** : Tester sur mobile

## Markdown supporté

| Fonctionnalité | Syntaxe |
|----------------|---------|
| Titres | `# H1`, `## H2`, `### H3` |
| Gras | `**texte**` |
| Italique | `*texte*` |
| Code inline | `` `code` `` |
| Bloc de code | ` ```langage ``` ` |
| Listes | `- item` ou `1. item` |
| Liens | `[texte](url)` |
| Images | `![alt](chemin)` |
| Citations | `> citation` |
| Tableaux | GFM |
| Séparateurs | `---` |

La coloration syntaxique est automatique pour les blocs de code avec un langage spécifié (`javascript`, `python`, `html`, etc.).

## Voir aussi

- [Architecture](architecture.md) - Vue d'ensemble de la plateforme
- [Spec Parcours](../../openspec/specs/parcours/spec.md) - Spécification technique complète
- [parcours/README.md](../../parcours/README.md) - Documentation technique
