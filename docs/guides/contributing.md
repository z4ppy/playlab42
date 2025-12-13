# Contribuer à PlayLab42

Bienvenue ! Ce guide vous accompagne pour contribuer du contenu à PlayLab42.

## Philosophie

PlayLab42 est une plateforme **en lecture seule** pour les utilisateurs. Toute contribution passe par **Pull Request** sur GitHub :

- Pas de compte utilisateur sur la plateforme
- Pas d'upload direct de contenu
- Chaque contribution est revue avant intégration
- Le projet s'enrichit des contributions de chaque session de formation

## Prérequis

Avant de contribuer, assurez-vous d'avoir :

- **Git** installé sur votre machine
- **Docker** installé (pour le serveur de développement)
- Un compte **GitHub**
- Un éditeur de code (VS Code recommandé)

## Workflow général

```
1. FORK
   └── Fork playlab42 sur votre compte GitHub

2. CLONE
   └── git clone https://github.com/VOUS/playlab42.git

3. CRÉATION
   └── Ajouter votre contenu selon le type :
       - tools/mon-outil/ (index.html + tool.json)
       - games/mon-jeu/ (game.json, index.html, engine.js...)
       - parcours/epics/mon-epic/ (epic.json, slides/...)

4. TEST LOCAL
   └── make serve
   └── Vérifier http://localhost:5242

5. COMMIT
   └── git add . && git commit -m "feat: ajout [type] [nom]"

6. PUSH
   └── git push origin main

7. PULL REQUEST
   └── Ouvrir PR vers playlab42/main
   └── Remplir le template
   └── Attendre review

8. MERGE
   └── Après approbation, contenu disponible sur le site
```

---

## Contribuer un Tool

Les outils sont des fichiers HTML autonomes et simples.

### Structure

```
tools/
└── mon-outil/
    ├── index.html    # L'outil (tout inclus : CSS + JS)
    └── tool.json     # Métadonnées
```

### Checklist Tool

- [ ] Fichier `index.html` standalone
- [ ] Fichier `tool.json` avec champs requis
- [ ] Utilise `/lib/theme.css` pour les styles
- [ ] Utilise `/lib/theme.js` pour le thème (dark/light)
- [ ] Fonctionne en mode sombre et clair
- [ ] Responsive (mobile + desktop)
- [ ] Commentaires en français

### Exemple tool.json

```json
{
  "id": "mon-outil",
  "name": "Mon Outil",
  "description": "Description courte de l'outil",
  "tags": ["utility", "dev"],
  "author": "Votre nom",
  "icon": "🔧",
  "version": "1.0.0"
}
```

### Régénérer le catalogue

```bash
make npm CMD="run build:catalogue"
```

---

## Contribuer un Game

Les jeux sont composés d'un moteur (logique), d'un client (UI) et de bots (IA).

### Structure

```
games/
└── mon-jeu/
    ├── index.html    # Client (interface utilisateur)
    ├── engine.js     # Moteur (logique de jeu)
    ├── bots.js       # Bots (IA)
    ├── game.json     # Métadonnées
    └── thumb.png     # Vignette (optionnel)
```

### Checklist Game

- [ ] Dossier complet `games/mon-jeu/`
- [ ] `game.json` avec champs requis
- [ ] `index.html` point d'entrée
- [ ] `engine.js` moteur isomorphe (pas de dépendance DOM)
- [ ] `bots.js` avec au moins un bot
- [ ] `thumb.png` vignette (200x200px, < 50KB)
- [ ] Fonctionne en mode sombre et clair
- [ ] Tests du moteur (optionnel mais recommandé)

### Exemple game.json

```json
{
  "id": "mon-jeu",
  "name": "Mon Jeu",
  "description": "Description du jeu",
  "tags": ["strategy", "2-players"],
  "author": "Votre nom",
  "icon": "🎮",
  "version": "1.0.0",
  "players": {
    "min": 2,
    "max": 2
  },
  "bots": [
    { "id": "random", "name": "Random", "difficulty": "easy" },
    { "id": "smart", "name": "Smart", "difficulty": "medium" }
  ]
}
```

### Régénérer le catalogue

```bash
make npm CMD="run build:catalogue"
```

---

## Contribuer un Epic (Parcours)

Les Epics sont des parcours pédagogiques composés de slides HTML.

### Structure

```
parcours/
└── epics/
    └── mon-epic/
        ├── epic.json           # Métadonnées et structure
        ├── thumbnail.png       # Vignette (optionnel)
        └── slides/
            ├── 01-intro/
            │   ├── slide.json  # Métadonnées de la slide
            │   └── index.html  # Contenu
            └── 02-suite/
                ├── slide.json
                └── index.html
```

### Checklist Epic

- [ ] Dossier complet `parcours/epics/mon-epic/`
- [ ] `epic.json` avec champs requis
- [ ] Au moins 1 slide avec `slide.json` + `index.html`
- [ ] Slides utilisent `/lib/theme.css` et `/parcours/_shared/slide-base.css`
- [ ] Slides utilisent `/lib/theme.js` pour le thème
- [ ] Assets optimisés (images < 500KB)
- [ ] `thumbnail.png` vignette (400x300px, < 100KB) - optionnel

### Exemple epic.json

```json
{
  "id": "mon-epic",
  "title": "Mon Parcours",
  "description": "Description du parcours",
  "hierarchy": ["playlab42"],
  "tags": ["howto", "debutant"],
  "metadata": {
    "author": "Votre nom",
    "created": "2025-01-15",
    "duration": "10 min",
    "difficulty": "beginner",
    "language": "fr"
  },
  "icon": "📚",
  "content": [
    { "id": "01-intro" },
    { "id": "02-suite" }
  ]
}
```

### Exemple slide.json

```json
{
  "id": "01-intro",
  "title": "Introduction",
  "type": "content",
  "icon": "👋"
}
```

### Régénérer le catalogue

```bash
node scripts/build-parcours.js
```

---

## Test local

Avant de soumettre une PR, testez toujours en local :

```bash
# Démarrer le serveur
make serve

# Ouvrir dans le navigateur
http://localhost:5242
```

Vérifiez :
- Votre contenu apparaît dans le catalogue
- Il fonctionne correctement
- Il s'affiche bien en mode sombre ET clair
- Il est responsive (testez sur mobile)

---

## Soumettre une PR

1. **Commitez** vos changements avec un message clair :
   ```bash
   git add .
   git commit -m "feat: ajout tool json-formatter"
   ```

2. **Poussez** vers votre fork :
   ```bash
   git push origin main
   ```

3. **Ouvrez une PR** sur GitHub :
   - Allez sur le repo original
   - Cliquez "New Pull Request"
   - Sélectionnez votre fork
   - Remplissez le template

4. **Attendez la review** :
   - Un mainteneur vérifiera votre contribution
   - Il peut demander des modifications
   - Une fois approuvée, elle sera mergée

---

## Bonnes pratiques

### Code

- **Commentaires** en français
- **Nommage** : kebab-case pour les fichiers, camelCase pour les variables
- **Simplicité** : un fichier HTML = un outil complet
- **Pas de frameworks** sans justification
- **Pas de dépendances externes** pour les tools

### Contenu

- **Original** : créez du contenu original ou citez vos sources
- **Qualité** : testez avant de soumettre
- **Accessibilité** : labels, contrastes, navigation clavier
- **Inclusif** : langage neutre et respectueux

### Git

- **Commits atomiques** : un commit = un changement logique
- **Messages clairs** : `feat: ajout`, `fix: correction`, `docs: mise à jour`
- **Branche propre** : pas de commits de merge inutiles

---

## Limites de taille

| Élément | Limite |
|---------|--------|
| Tool HTML | < 500KB |
| Game total | < 5MB |
| Epic total | < 50MB |
| Image | < 500KB |
| Vidéo | < 10MB |
| Audio | < 5MB |
| Vignette | < 100KB |

---

## Besoin d'aide ?

- Consultez les [guides existants](./README.md)
- Regardez les [exemples dans le code](../../tools/)
- Ouvrez une issue sur GitHub

Merci de contribuer à PlayLab42 ! 🎉
