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

Le [kit de contribution](./contribution-kit.md) fournit les gabarits et la
[galerie UI](../../tools/ui-kit/index.html). Les [skills de projet](./project-skills.md)
guident les agents sans remplacer les conventions de `AGENTS.md`.
Pour un nouveau module, suivre aussi le [workflow OpenSpec](./openspec-workflow.md).

```
1. FORK
   └── Fork playlab42 sur votre compte GitHub

2. CLONE ET BRANCHE
   └── git clone https://github.com/VOUS/playlab42.git
   └── git switch -c feat/mon-contenu

3. CRÉATION
   └── Ajouter votre contenu selon le type :
       - tools/mon-outil/ (index.html + tool.json)
       - games/mon-jeu/ (game.json, index.html, engine.js...)
       - parcours/epics/mon-epic/ (epic.json, slides/...)

4. PRÉPARATION ET PARCOURS LOCAL
   └── make npm CMD="run build:local"
   └── make serve
   └── make info pour connaître le port de ce worktree
   └── make test-e2e pour les interactions navigateur

5. COMMIT
   └── git add . && git commit -m "feat: ajout [type] [nom]"

6. PUSH
   └── git push -u origin feat/mon-contenu

7. PULL REQUEST
   └── Ouvrir PR vers playlab42/main
   └── Remplir le template
   └── Attendre review

8. MERGE
   └── Après décision de merge, CI complète puis publication de l'archive testée
   └── Contrôle HTTP du commit publié ; un merge seul ne prouve pas une livraison
```

---

## Contribuer un Tool

Les outils sont autonomes, en HTML unique ou en modules locaux. Le
[kit](contribution-kit.md) fournit un point de départ compatible avec le portail.

### Structure

```
tools/
└── mon-outil/
    ├── index.html    # Point d'entrée (styles/scripts locaux possibles)
    ├── tool.json     # Métadonnées
    └── src/          # Modules ou TypeScript, si nécessaire
```

### Checklist Tool

- [ ] Point d'entrée `index.html` autonome, servi en HTTP si imports/ressources
- [ ] Fichier `tool.json` avec champs requis
- [ ] Chemins relatifs vers `lib/theme.css` et `lib/theme.js` (clair/sombre/système)
- [ ] Charge `lib/ui.css` pour le focus visible et les préférences de mouvement
- [ ] Contrôles utilisables au clavier, formulaires étiquetés et états annoncés
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
    └── thumb.png     # Vignette 380x180 (19:9), < 50KB (optionnel)
```

### Checklist Game

- [ ] Dossier complet `games/mon-jeu/`
- [ ] `game.json` avec champs requis
- [ ] `index.html` point d'entrée
- [ ] `engine.js` moteur isomorphe (pas de dépendance DOM)
- [ ] `bots.js` avec au moins un bot
- [ ] `thumb.png` vignette (380x180px, 19:9, < 50KB)
- [ ] Fonctionne en mode sombre et clair
- [ ] Tests du moteur : replay, actions légales/illégales, immutabilité et fin

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
- [ ] Chemins relatifs vers `lib/theme.css` et `parcours/_shared/slide-base.css`
- [ ] Slides initialisées avec `slide-utils.js` pour thème et footer
- [ ] Contrôles natifs accessibles et styles de composants partagés (cartes, tableaux, formulaires)
- [ ] Assets optimisés (images < 500KB)
- [ ] `thumbnail.png` vignette (380x180px, 19:9, < 50KB) - optionnel

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
make build-parcours
```

---

## Test local

Avant de soumettre une PR, testez toujours en local :

```bash
# Préparer le site sans collecte réseau puis connaître l'URL du worktree
make npm CMD="run build:local"
make info
make serve
```

Vérifiez :
- Votre contenu apparaît dans le catalogue
- Il fonctionne correctement
- Il s'affiche bien en mode sombre ET clair
- Il est responsive (testez sur mobile)

Lancer les contrôles adaptés : `make test`, `make lint`, `make typecheck`,
`make openspec-validate`, puis `make test-e2e` pour les interactions.
Commencer par les tests ciblés sans les présenter comme une CI complète.
`make build` construit l'image Docker ; le build du site est un script npm.

---

## Soumettre une PR

1. **Commitez** vos changements avec un message clair :
   ```bash
   git add .
   git commit -m "feat: ajout tool json-formatter"
   ```

2. **Poussez** vers votre fork :
   ```bash
   git push -u origin feat/mon-contenu
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
- **Simplicité** : HTML/CSS/JS natifs, fichier unique ou modules selon le besoin
- **Pas de frameworks** sans justification
- **Dépendances maîtrisées** : réutiliser les distributions runtime et documenter les besoins réseau

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
| Vignette | 380x180px (19:9), < 50KB |

### Pourquoi les vignettes de jeux et d'outils sont en PNG

Les vignettes de jeux et d'outils sont des images photographiques : en JPEG ou
en WebP, elles pèseraient 15 à 25 Ko au lieu de 38 à 50 Ko (c'est le cas des
vignettes d'epics, déjà en `.jpg`). Elles restent pourtant en `.png`, parce que
leur chemin n'est pas déclaré : il est **dérivé du chemin du jeu ou de l'outil**
dans `app/catalogue.js` (`path.replace('index.html', 'thumb.png')` pour un jeu,
`path.replace('.html', '-thumb.png')` pour un outil). Changer d'extension
supposerait donc de rendre le chemin de vignette explicite — champ dédié dans
`game.json` / `tool.json`, propagé par `scripts/build-catalogue.js` jusqu'au
catalogue — ce qui dépasse le cadre d'une optimisation d'images.

En attendant, respecter la limite de 50 Ko impose de quantiser la palette
(`pngquant 128`, par exemple) plutôt que de flouter l'image.

---

## Besoin d'aide ?

- Consultez les [guides existants](./README.md)
- Regardez les [composants en action dans la galerie UI](../../tools/ui-kit/index.html)
- Lisez [l'usine logicielle et sa feuille de route](software-factory.md)
- Ouvrez une issue sur GitHub

Merci de contribuer à PlayLab42 ! 🎉
