# Playlab42 - Makefile
# Commandes de développement

.PHONY: help up down build shell logs status claude install test lint

# Affiche l'aide par défaut
help:
	@echo "Playlab42 - Commandes disponibles"
	@echo ""
	@echo "Docker:"
	@echo "  make build    - Construire les containers"
	@echo "  make up       - Démarrer les containers"
	@echo "  make down     - Arrêter les containers"
	@echo "  make restart  - Redémarrer les containers"
	@echo "  make status   - État des containers"
	@echo "  make logs     - Suivre les logs"
	@echo "  make shell    - Shell dans le container dev"
	@echo ""
	@echo "Développement:"
	@echo "  make install         - Installer les dépendances npm"
	@echo "  make npm CMD=...     - Commande npm (ex: make npm CMD=\"install lodash\")"
	@echo "  make serve           - Serveur statique (interactif)"
	@echo "  make serve-bg        - Serveur statique (arrière-plan)"
	@echo "  make serve-stop      - Arrêter le serveur"
	@echo "  make build-catalogue - Générer data/catalogue.json"
	@echo "  make build-parcours  - Générer data/parcours.json"
	@echo "  make test            - Lancer les tests"
	@echo "  make lint            - Vérifier le code"
	@echo ""
	@echo "Claude Code:"
	@echo "  make claude   - Lancer Claude Code"
	@echo ""
	@echo "OpenSpec:"
	@echo "  make openspec-list     - Lister les changes"
	@echo "  make openspec-validate - Valider les specs"

# === Docker ===

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

restart: down up

status:
	docker compose ps

logs:
	docker compose logs -f

shell:
	docker compose exec dev sh

# === Développement ===

install:
	docker compose exec dev npm install

# Commande npm générique (usage: make npm CMD="install lodash")
npm:
	docker compose exec dev npm $(CMD)

test:
	docker compose exec dev npm test

test-watch:
	docker compose exec dev npm run test:watch

lint:
	docker compose exec dev npm run lint

lint-fix:
	docker compose exec dev npm run lint:fix

# Serveur statique pour tester tools/games (mode interactif)
serve:
	docker compose exec dev npm run serve

# Serveur statique en arrière-plan
serve-bg:
	docker compose exec -d dev npm run serve
	@echo "Serveur démarré sur http://localhost:5242"

# Arrêter le serveur en arrière-plan
serve-stop:
	docker compose exec dev pkill -f "serve" || true

# Build du catalogue
build-catalogue:
	docker compose exec dev npm run build:catalogue

# Build du catalogue parcours
build-parcours:
	docker compose exec dev npm run build:parcours

# === Claude Code ===

claude:
	claude

# === OpenSpec ===

openspec-list:
	@echo "Changes actifs:"
	@ls -la openspec/changes/ 2>/dev/null | grep -v "archive" | grep -v "total" || echo "  (aucun)"
	@echo ""
	@echo "Specs:"
	@ls -la openspec/specs/ 2>/dev/null | grep -v "total" || echo "  (aucune)"

openspec-validate:
	@echo "Validation des specs..."
	@echo "(À implémenter avec openspec CLI)"

# === Raccourcis ===

init: build up install
	@echo "Projet initialisé avec succès"

clean:
	docker compose down -v --rmi local
	rm -rf node_modules dist
