# Tests de Sécurité en Local - Playlab42

Ce guide explique comment lancer les tests de sécurité en local, identiques à ceux exécutés en CI/CD.

---

## 🎯 Prérequis

### Environnement Docker (Recommandé)

Le plus simple est d'utiliser Docker qui contient tous les outils nécessaires :

```bash
make up
```

### Sans Docker (Alternatif)

Si vous ne voulez pas utiliser Docker, installez :
- Node.js 20+
- Python 3 avec PyYAML (`pip3 install pyyaml`)
- Git

---

## 🚀 Commandes make disponibles

Toutes les commandes fonctionnent avec ou sans Docker.

### Audit Complet

Lance tous les tests de sécurité d'un coup :

```bash
make security-audit
```

**Contenu** :
1. npm audit (vulnérabilités CVE)
2. ESLint Security (analyse statique)
3. Validation YAML (workflows GitHub)
4. Packages obsolètes
5. Arbre des dépendances

**Durée** : ~30-60 secondes

---

## 🔍 Tests Individuels

### 1. npm audit

Vérifie les vulnérabilités CVE dans les dépendances npm :

```bash
make security-npm
```

**Exemple de sortie** :
```
found 0 vulnerabilities
```

**Interprétation** :
- **0 vulnerabilities** = ✅ Tout va bien
- **X vulnerabilities** = ⚠️ Voir les détails et mettre à jour

**Actions si vulnérabilités** :
```bash
# Voir le détail
npm audit

# Fix automatique (patch/minor)
npm audit fix

# Fix complet (peut casser)
npm audit fix --force
```

---

### 2. ESLint Security

Analyse statique du code avec règles de sécurité :

```bash
make security-eslint
```

**Règles vérifiées** :
- `security/detect-object-injection` - Injection d'objets
- `security/detect-unsafe-regex` - Regex vulnérables (ReDoS)
- `security/detect-eval-with-expression` - Utilisation de eval()
- `no-unsanitized/method` - Méthodes DOM non sanitizées
- `no-unsanitized/property` - Propriétés DOM non sanitizées

**Exemple de sortie** :
```
app.js:1300:36: Unsafe Regular Expression
```

**Actions si erreurs** :
Consulter `docs/SECURITY_AUDIT.md` pour les correctifs recommandés.

---

### 3. Validation YAML

Vérifie la syntaxe des workflows GitHub Actions :

```bash
make security-yaml
```

**Fichiers validés** :
- `.github/workflows/security-audit.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.github/dependabot.yml`

**Exemple de sortie** :
```
✓ .github/workflows/security-audit.yml: Syntaxe YAML valide
✓ .github/workflows/ci.yml: Syntaxe YAML valide
✓ .github/workflows/deploy.yml: Syntaxe YAML valide
✓ .github/dependabot.yml: Syntaxe YAML valide

✅ Tous les fichiers YAML sont valides
```

---

### 4. Packages Obsolètes

Liste les packages npm qui ont des versions plus récentes :

```bash
make security-deps
```

**Exemple de sortie** :
```
Package        Current  Wanted  Latest  Location
eslint         9.39.1   9.39.1  9.40.0  node_modules/eslint
```

**Interprétation** :
- **Current** : Version installée
- **Wanted** : Version compatible avec package.json
- **Latest** : Dernière version publiée

**Actions** :
```bash
# Mettre à jour vers "Wanted"
npm update

# Mettre à jour vers "Latest" (peut casser)
npm install package@latest
```

---

### 5. Rapport Consolidé

Génère un rapport résumé de tous les tests :

```bash
make security-report
```

**Exemple de sortie** :
```
=== Rapport de Sécurité ===

Date: 2025-12-14 10:30:00 UTC
Branche: claude/automate-security-audit-i905P
Commit: 8868d33

--- npm audit ---
Vulnérabilités: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 }

--- Packages obsolètes ---
Packages: 2

✅ Rapport terminé
```

---

## 🐳 Docker vs Sans Docker

### Avec Docker (Recommandé)

**Avantages** :
- ✅ Environnement isolé
- ✅ Tous les outils pré-installés
- ✅ Identique à la CI/CD
- ✅ Pas de pollution du système hôte

**Utilisation** :
```bash
make up              # Démarrer les containers
make security-audit  # Lancer les tests
make down            # Arrêter les containers
```

### Sans Docker

**Avantages** :
- ✅ Plus rapide (pas de overhead Docker)
- ✅ Intégration directe avec l'IDE

**Prérequis** :
```bash
# Installer les dépendances
npm install

# Installer Python YAML (si pas déjà fait)
pip3 install pyyaml
```

**Utilisation** :
```bash
# npm audit
npm audit --audit-level=moderate

# ESLint Security
npm install --no-save eslint-plugin-security eslint-plugin-no-unsanitized
npx eslint lib/ src/ games/ app.js \
  --plugin security \
  --plugin no-unsanitized \
  --rule 'security/detect-unsafe-regex: error' \
  --rule 'no-unsanitized/method: error'
npm uninstall --no-save eslint-plugin-security eslint-plugin-no-unsanitized

# Validation YAML
python3 -c "
import yaml
files = ['.github/workflows/security-audit.yml', ...]
for f in files:
    with open(f) as fp:
        yaml.safe_load(fp)
    print(f'✓ {f}: Syntaxe YAML valide')
"

# Packages obsolètes
npm outdated
```

---

## 🔄 Intégration Pre-commit

Pour lancer automatiquement les tests avant chaque commit :

### Option 1 : Git Hook Manuel

Créer `.git/hooks/pre-commit` :

```bash
#!/bin/bash
echo "🔒 Tests de sécurité pré-commit..."
make security-npm || exit 1
make security-yaml || exit 1
echo "✅ Tests OK"
```

Rendre exécutable :

```bash
chmod +x .git/hooks/pre-commit
```

### Option 2 : Husky (Recommandé pour équipe)

Installer Husky :

```bash
npm install --save-dev husky
npx husky init
```

Créer `.husky/pre-commit` :

```bash
#!/bin/bash
make security-npm
make security-yaml
```

---

## 📊 Benchmarks & Performance

Temps d'exécution moyens (sur Alpine Linux, Node 20) :

| Commande | Durée | Ressources |
|----------|-------|------------|
| `make security-npm` | 5-10s | CPU faible |
| `make security-eslint` | 15-30s | CPU moyen |
| `make security-yaml` | 1-2s | CPU faible |
| `make security-deps` | 5-10s | CPU faible |
| `make security-audit` | 30-60s | CPU moyen |

---

## 🛠️ Debugging

### Les tests échouent dans Docker mais pas localement

**Cause probable** : Différence de dépendances npm

**Solution** :
```bash
make down
make clean          # Nettoie volumes Docker
make init           # Réinstalle tout
make security-audit
```

### Python YAML non trouvé

**Cause** : `py3-yaml` non installé dans le container

**Solution** :
```bash
make build  # Rebuild le container avec Python
make up
```

### ESLint plugins manquants

**Cause** : Plugins temporaires pas installés

**Solution** :
Les commandes `make security-*` installent et désinstallent automatiquement les plugins. Si ça échoue :

```bash
make shell
npm install --no-save eslint-plugin-security eslint-plugin-no-unsanitized
npx eslint --version  # Vérifier que ça marche
```

---

## 🎓 Workflow Recommandé

### Développement Quotidien

```bash
# 1. Avant de commencer à coder
make up
make security-audit  # Baseline

# 2. Pendant le développement
# (coder normalement)

# 3. Avant de commit
make security-npm    # Vérif rapide
make lint            # Lint normal

# 4. Avant de push
make security-audit  # Audit complet
make test            # Tests unitaires

# 5. Fin de journée
make down
```

### Before PR

```bash
# Audit complet + tests
make security-audit
make test
make build-catalogue
make build-parcours
make build-bookmarks

# Vérifier qu'il n'y a pas de fichiers modifiés
git status

# Si OK, créer la PR
git push
```

---

## 📚 Ressources

- **Rapport d'audit** : `docs/SECURITY_AUDIT.md`
- **Guide de corrections** : `docs/SECURITY_SETUP.md`
- **Workflow CI/CD** : `.github/workflows/security-audit.yml`

---

## ❓ FAQ

### Q: Faut-il lancer les tests avant chaque commit ?

**R** : Non, mais au minimum avant chaque push. Les tests rapides (`security-npm`, `security-yaml`) peuvent être lancés en pre-commit hook.

### Q: Que faire si `make security-audit` échoue ?

**R** :
1. Identifier quel test échoue (npm audit, eslint, yaml...)
2. Lancer ce test individuellement : `make security-npm`
3. Consulter `docs/SECURITY_AUDIT.md` pour les correctifs
4. Appliquer les corrections
5. Re-tester

### Q: Les warnings ESLint sont-ils bloquants ?

**R** : Non, seulement les **errors**. Les warnings sont documentés dans l'audit et seront corrigés progressivement.

### Q: Puis-je skip les tests en local ?

**R** : Oui, mais ils seront obligatoires en CI/CD. Mieux vaut les lancer localement pour éviter les surprises.

---

**Dernière mise à jour** : 2025-12-14
