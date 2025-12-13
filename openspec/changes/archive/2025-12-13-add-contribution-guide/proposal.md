# Proposal: add-contribution-guide

## Résumé

Documenter le workflow de contribution pour tous les types de contenus de PlayLab42 (Tools, Games, Epics). La plateforme est en lecture seule pour les utilisateurs ; toute contribution passe par Pull Request GitHub.

## Motivation

### Contexte

PlayLab42 est une plateforme de formation où les participants peuvent contribuer du contenu :
- **Tools** : Outils HTML standalone
- **Games** : Jeux avec moteur et bots
- **Epics** : Parcours pédagogiques (slides)

Actuellement, il n'existe pas de documentation unifiée expliquant comment contribuer.

### Objectifs

- Documenter le workflow Fork → PR → Review → Merge
- Fournir des checklists par type de contenu
- Expliquer le test local avant PR
- Définir les conventions et limites (tailles, formats)
- Faciliter l'onboarding des nouveaux contributeurs

## Changements proposés

### 1. Guide de contribution global

Créer `docs/guides/contributing.md` avec :

- Philosophie (lecture seule, PR uniquement)
- Workflow général
- Checklists par type de contenu
- Test local
- Conventions

### 2. Structure du guide

```markdown
# Contribuer à PlayLab42

## Philosophie
## Prérequis
## Workflow général
## Contribuer un Tool
## Contribuer un Game
## Contribuer un Epic
## Test local
## Soumettre une PR
## Review et merge
## Bonnes pratiques
```

### 3. Workflow général

```
1. FORK
   └── Fork playlab42 sur votre compte GitHub

2. CLONE
   └── git clone https://github.com/VOUS/playlab42.git

3. CRÉATION
   └── Ajouter votre contenu selon le type :
       - tools/mon-outil.html + tools/mon-outil.json
       - games/mon-jeu/ (game.json, index.html, engine.js...)
       - parcours/epics/mon-epic/ (epic.json, slides/...)

4. TEST LOCAL
   └── make serve (ou docker compose up)
   └── Vérifier http://localhost:3000

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

### 4. Checklists par type

#### Tool
- [ ] Fichier HTML standalone (`tools/mon-outil.html`)
- [ ] Manifest JSON (`tools/mon-outil.json`)
- [ ] Utilise `lib/theme.css` et `lib/dom.js`
- [ ] Fonctionne en dark/light mode
- [ ] Responsive

#### Game
- [ ] Dossier complet (`games/mon-jeu/`)
- [ ] `game.json` avec champs requis
- [ ] `index.html` point d'entrée
- [ ] `engine.js` moteur de jeu
- [ ] `thumb.png` vignette (200x200px, < 50KB)
- [ ] Au moins un bot

#### Epic
- [ ] Dossier complet (`parcours/epics/mon-epic/`)
- [ ] `epic.json` avec champs requis
- [ ] `thumbnail.png` vignette (400x300px, < 100KB)
- [ ] Au moins 1 slide
- [ ] Assets optimisés (images < 500KB, vidéos < 10MB)

### 5. Limites de taille

| Élément | Limite |
|---------|--------|
| Tool HTML | < 500KB |
| Game total | < 5MB |
| Epic total | < 50MB |
| Image | < 500KB |
| Vidéo | < 10MB |
| Audio | < 5MB |
| Vignette | < 100KB |

### 6. Template PR GitHub

Créer `.github/PULL_REQUEST_TEMPLATE.md` :

```markdown
## Type de contribution

- [ ] Tool
- [ ] Game
- [ ] Epic
- [ ] Autre

## Description

[Décrivez votre contribution]

## Checklist

- [ ] J'ai testé localement (`make serve`)
- [ ] Le build passe (`make build`)
- [ ] J'ai lu les guidelines de contribution
- [ ] Mon contenu est original ou avec attribution

## Screenshots

[Si pertinent, ajoutez des captures d'écran]
```

### 7. CI/CD (optionnel)

À chaque PR :
- Lint : Validation JSON des manifests
- Build : Régénération catalogues
- Size check : Vérification limites

## Impact

| Fichier | Changement |
|---------|------------|
| `docs/guides/contributing.md` | Nouveau guide complet |
| `.github/PULL_REQUEST_TEMPLATE.md` | Template PR |
| `README.md` | Lien vers le guide de contribution |

## Risques

- **Très faible** : Documentation uniquement, pas de code

## Non-objectifs

- Pas de CI/CD automatisé (peut venir plus tard)
- Pas de système de review automatique
- Pas de CLA (Contributor License Agreement)

## Statut

- [x] Implémenté et déployé le 2025-12-13
- Commit: 8f58b82 - "Ajout du guide de contribution et template PR"
