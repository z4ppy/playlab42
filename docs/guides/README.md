# Guides Playlab42

Bienvenue dans les guides de développement Playlab42. Ces guides vous accompagnent pas à pas pour créer vos propres outils et jeux.

## Guides disponibles

| Guide | Description | Niveau |
|-------|-------------|--------|
| [Architecture](architecture.md) | Vue d'ensemble de la plateforme | Tous |
| [Créer un outil](create-tool.md) | Créer un outil HTML standalone | Débutant |
| [Créer un moteur de jeu](create-game-engine.md) | Créer un moteur isomorphe | Intermédiaire |
| [Créer un client de jeu](create-game-client.md) | Créer une interface de jeu | Intermédiaire |
| [Créer un bot](create-bot.md) | Créer une IA pour un jeu | Avancé |

## Par où commencer ?

1. **Lisez d'abord** le guide [Architecture](architecture.md) pour comprendre la structure du projet
2. **Débutants** : Commencez par [Créer un outil](create-tool.md) - c'est le plus simple
3. **Intermédiaires** : Enchaînez avec [Créer un moteur](create-game-engine.md) puis [Créer un client](create-game-client.md)
4. **Avancés** : Terminez avec [Créer un bot](create-bot.md)

## Prérequis

- Connaissances de base en HTML, CSS, JavaScript
- Docker installé sur votre machine
- Un éditeur de code (VS Code recommandé)

## Environnement de développement

Toutes les commandes se font via Docker :

```bash
# Initialiser l'environnement
make init

# Lancer le serveur de développement
make serve

# Accéder au shell du container
make shell
```

## Conventions

- **Commentaires** : En français
- **Commits** : En français
- **Nommage fichiers** : kebab-case (`mon-outil.html`)
- **Nommage variables** : camelCase (`maVariable`)
- **Nommage types** : PascalCase (`MonType`)

## Ressources

- [Spécifications techniques](../../openspec/specs/)
- [Conventions du projet](../../openspec/project.md)
- [Exemples existants](../../tools/) et [jeux](../../games/)
