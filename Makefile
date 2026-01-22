# Playlab42 - Makefile
# Commandes de développement

# Export automatique de l'UID/GID pour Docker
# Permet aux fichiers créés dans le container d'avoir les bons droits
export LOCAL_UID := $(shell id -u)
export LOCAL_GID := $(shell id -g)

# Support multi-worktree : Nom de projet basé sur le dossier courant
# Permet d'avoir plusieurs instances Docker en parallèle (une par worktree)
CURRENT_DIR := $(notdir $(CURDIR))
export COMPOSE_PROJECT_NAME ?= $(CURRENT_DIR)

# Port dynamique pour éviter les conflits entre worktrees
# Calcule un hash simple du nom de projet pour obtenir un port unique
# Plage : 5200-5299 (100 ports disponibles)
PORT_HASH := $(shell echo "$(COMPOSE_PROJECT_NAME)" | cksum | cut -d' ' -f1)
PORT_OFFSET := $(shell echo $$(( $(PORT_HASH) % 100 )))
export PLAYLAB_PORT ?= $(shell echo $$(( 5200 + $(PORT_OFFSET) )))

.PHONY: help up down build shell logs status info claude install test lint typecheck build-ts

# Affiche l'aide par défaut
help:
	@echo "Playlab42 - Commandes disponibles"
	@echo ""
	@echo "Instance: $(COMPOSE_PROJECT_NAME) (port $(PLAYLAB_PORT))"
	@echo ""
	@echo "Docker:"
	@echo "  make build    - Construire les containers"
	@echo "  make up       - Démarrer les containers"
	@echo "  make down     - Arrêter les containers"
	@echo "  make restart  - Redémarrer les containers"
	@echo "  make status   - État des containers"
	@echo "  make logs     - Suivre les logs"
	@echo "  make shell    - Shell dans le container dev"
	@echo "  make info     - Infos de l'instance (worktree, port)"
	@echo ""
	@echo "Développement:"
	@echo "  make install         - Installer les dépendances npm"
	@echo "  make npm CMD=...     - Commande npm (ex: make npm CMD=\"install lodash\")"
	@echo "  make serve           - Serveur statique (interactif)"
	@echo "  make serve-bg        - Serveur statique (arrière-plan)"
	@echo "  make serve-stop      - Arrêter le serveur"
	@echo "  make build-catalogue - Générer data/catalogue.json"
	@echo "  make build-parcours  - Générer data/parcours.json"
	@echo "  make build-bookmarks - Générer data/bookmarks.json"
	@echo "  make test            - Lancer les tests"
	@echo "  make lint            - Vérifier le code"
	@echo "  make typecheck       - Vérifier les types TypeScript"
	@echo "  make build-ts        - Transpiler TypeScript vers JavaScript"
	@echo ""
	@echo "Sécurité:"
	@echo "  make security-audit     - Audit complet de sécurité"
	@echo "  make security-npm       - Audit npm (vulnérabilités CVE)"
	@echo "  make security-eslint    - Analyse statique ESLint Security"
	@echo "  make security-yaml      - Validation syntaxe YAML"
	@echo "  make security-deps      - Vérifier packages obsolètes"
	@echo "  make security-report    - Générer rapport consolidé"
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

# Afficher les infos de l'instance (utile en mode multi-worktree)
info:
	@echo "Instance Docker Playlab42"
	@echo "========================="
	@echo "Projet:     $(COMPOSE_PROJECT_NAME)"
	@echo "Port:       $(PLAYLAB_PORT)"
	@echo "Dossier:    $(CURDIR)"
	@echo "Container:  $(COMPOSE_PROJECT_NAME)-dev"
	@echo ""
	@echo "URL:        http://localhost:$(PLAYLAB_PORT)"

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

typecheck:
	docker compose exec dev npm run typecheck

build-ts:
	docker compose exec dev npm run build:ts

# Serveur statique pour tester tools/games (mode interactif)
serve:
	@echo "════════════════════════════════════════════════════════════"
	@echo "  Serveur accessible sur http://localhost:$(PLAYLAB_PORT)"
	@echo "  (ignorer le port 5242 affiché ci-dessous, c'est le port interne)"
	@echo "════════════════════════════════════════════════════════════"
	@echo ""
	@docker compose exec dev npm run serve

# Serveur statique en arrière-plan
serve-bg:
	docker compose exec -d dev npm run serve
	@echo "Serveur démarré sur http://localhost:$(PLAYLAB_PORT)"

# Arrêter le serveur en arrière-plan
serve-stop:
	docker compose exec dev pkill -f "serve" || true

# Build du catalogue
build-catalogue:
	docker compose exec dev npm run build:catalogue

# Build du catalogue parcours
build-parcours:
	docker compose exec dev npm run build:parcours

# Build du catalogue bookmarks
build-bookmarks:
	docker compose exec dev npm run build:bookmarks

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

# Initialiser les permissions des volumes Docker (exécuté en root)
init-volumes:
	@echo "Initialisation des volumes Docker..."
	@docker compose exec -u 0 -e LOCAL_UID=$(LOCAL_UID) -e LOCAL_GID=$(LOCAL_GID) dev /usr/local/bin/init-volumes.sh

init: build up init-volumes install
	@echo "Projet initialisé avec succès"

clean:
	docker compose down -v --rmi local
	rm -rf node_modules dist

# === Sécurité ===

# Audit complet de sécurité (tous les tests)
security-audit:
	@echo "🔒 Audit de sécurité complet"
	@echo ""
	@echo "1/5 - npm audit..."
	@docker compose exec dev npm audit --audit-level=moderate || true
	@echo ""
	@echo "2/5 - ESLint Security..."
	@docker compose exec dev sh -c "npm install --no-save eslint-plugin-security eslint-plugin-no-unsanitized && npx eslint lib/ src/ games/ --plugin security --plugin no-unsanitized --rule 'security/detect-unsafe-regex: error' --rule 'no-unsanitized/method: error' --rule 'no-unsanitized/property: error' --format compact && npm uninstall --no-save eslint-plugin-security eslint-plugin-no-unsanitized" || true
	@echo ""
	@echo "3/5 - Validation YAML..."
	@docker compose exec dev python3 -c "import yaml; import sys; files = ['.github/workflows/security-audit.yml', '.github/workflows/ci.yml', '.github/workflows/deploy.yml', '.github/dependabot.yml']; errors = []; [print(f'✓ {f}') if yaml.safe_load(open(f)) or True else errors.append(f) for f in files]; sys.exit(1 if errors else 0)"
	@echo ""
	@echo "4/5 - Packages obsolètes..."
	@docker compose exec dev npm outdated || true
	@echo ""
	@echo "5/5 - Dépendances..."
	@docker compose exec dev npm ls --depth=0 || true
	@echo ""
	@echo "✅ Audit terminé"

# Audit npm uniquement
security-npm:
	@echo "🔍 npm audit - Vérification des vulnérabilités CVE"
	@docker compose exec dev npm audit --audit-level=moderate

# Analyse statique ESLint avec règles de sécurité
security-eslint:
	@echo "🔍 ESLint Security - Analyse statique du code"
	@docker compose exec dev sh -c "npm install --no-save eslint-plugin-security eslint-plugin-no-unsanitized && npx eslint lib/ src/ games/ app.js --plugin security --plugin no-unsanitized --rule 'security/detect-object-injection: warn' --rule 'security/detect-unsafe-regex: error' --rule 'security/detect-eval-with-expression: error' --rule 'no-unsanitized/method: error' --rule 'no-unsanitized/property: error' && npm uninstall --no-save eslint-plugin-security eslint-plugin-no-unsanitized"

# Validation syntaxe YAML
security-yaml:
	@echo "🔍 Validation YAML - Workflows GitHub Actions"
	@docker compose exec dev python3 -c "import yaml; import sys; files = ['.github/workflows/security-audit.yml', '.github/workflows/ci.yml', '.github/workflows/deploy.yml', '.github/dependabot.yml']; errors = []; [[print(f'✓ {f}: Syntaxe YAML valide'), True] if yaml.safe_load(open(f)) or True else [errors.append(f), print(f'✗ {f}: Erreur YAML')] for f in files]; print('\n✅ Tous les fichiers YAML sont valides') if not errors else [print(f'\n❌ Erreurs détectées: {errors}'), sys.exit(1)]"

# Vérifier packages obsolètes
security-deps:
	@echo "🔍 Packages obsolètes"
	@docker compose exec dev npm outdated

# Rapport consolidé
security-report:
	@echo "📊 Génération du rapport de sécurité consolidé"
	@echo ""
	@echo "=== Rapport de Sécurité ==="
	@echo ""
	@echo "Date: $$(date -u +'%Y-%m-%d %H:%M:%S UTC')"
	@echo "Branche: $$(git branch --show-current)"
	@echo "Commit: $$(git rev-parse --short HEAD)"
	@echo ""
	@echo "--- npm audit ---"
	@docker compose exec dev npm audit --json | docker compose exec -T dev node -e "const data = require('fs').readFileSync(0, 'utf-8'); const audit = JSON.parse(data); console.log('Vulnérabilités:', audit.metadata?.vulnerabilities || 'N/A');" || echo "Erreur parsing npm audit"
	@echo ""
	@echo "--- Packages obsolètes ---"
	@docker compose exec dev npm outdated --json | docker compose exec -T dev node -e "const data = require('fs').readFileSync(0, 'utf-8'); try { const outdated = JSON.parse(data); console.log('Packages:', Object.keys(outdated).length); } catch { console.log('Aucun package obsolète'); }" || echo "Tous les packages sont à jour"
	@echo ""
	@echo "✅ Rapport terminé"
