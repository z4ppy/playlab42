# Gestion des Secrets

Ce document décrit comment gérer les secrets (API keys, tokens, credentials) dans Playlab42.

## Table des matières

1. [Principes](#principes)
2. [Types de secrets](#types-de-secrets)
3. [Secrets GitHub](#secrets-github)
4. [Variables d'environnement](#variables-denvironnement)
5. [Bonnes pratiques](#bonnes-pratiques)
6. [Détection de secrets](#détection-de-secrets)
7. [Incidents de sécurité](#incidents-de-sécurité)

---

## Principes

### Règles d'or

1. **Jamais de secrets dans le code** :
   - ❌ Hardcoder un token/password dans le code
   - ✅ Utiliser des variables d'environnement

2. **Jamais de secrets dans Git** :
   - ❌ Committer `.env` ou `credentials.json`
   - ✅ Ajouter ces fichiers au `.gitignore`

3. **Principe du moindre privilège** :
   - Donner uniquement les permissions nécessaires
   - Utiliser des tokens read-only quand possible

4. **Rotation régulière** :
   - Régénérer les tokens périodiquement
   - Révoquer les tokens non utilisés

5. **Séparation par environnement** :
   - Secrets différents pour dev/staging/production
   - Ne jamais utiliser les secrets de prod en dev

---

## Types de secrets

### Secrets actuellement utilisés

| Secret | Type | Utilisé par | Permissions requises |
|--------|------|-------------|----------------------|
| `CODECOV_TOKEN` | Token API | CI workflow (tests) | Upload coverage reports |
| `GITHUB_TOKEN` | Token auto-généré | Workflows GitHub Actions | Dépend du workflow |

### Secrets futurs (roadmap)

| Secret | Type | Usage prévu |
|--------|------|-------------|
| `NPM_TOKEN` | Token npm | Publication de packages |
| `SLACK_WEBHOOK` | Webhook URL | Notifications CI/CD |
| `SENTRY_DSN` | DSN | Monitoring erreurs |
| `ANALYTICS_KEY` | API key | Google Analytics / Plausible |

---

## Secrets GitHub

### Configuration

Les secrets GitHub sont stockés de manière sécurisée et accessibles uniquement aux workflows autorisés.

**Accès** : Settings > Secrets and variables > Actions

### Ajouter un secret

**Via interface GitHub** :

1. Aller dans **Settings** > **Secrets and variables** > **Actions**
2. Cliquer sur **New repository secret**
3. Renseigner :
   - **Name** : `SECRET_NAME` (majuscules, underscores)
   - **Value** : La valeur du secret
4. Cliquer sur **Add secret**

**Via GitHub CLI** :

```bash
# Définir un secret depuis un fichier
gh secret set SECRET_NAME < secret.txt

# Définir un secret interactivement
gh secret set SECRET_NAME
# → Saisir la valeur
# → Ctrl+D pour terminer

# Lister les secrets
gh secret list

# Supprimer un secret
gh secret delete SECRET_NAME
```

### Utiliser un secret dans un workflow

```yaml
# .github/workflows/example.yml
jobs:
  example:
    runs-on: ubuntu-latest
    steps:
      - name: Use secret
        run: echo "Secret value is hidden"
        env:
          MY_SECRET: ${{ secrets.SECRET_NAME }}

      - name: Pass to action
        uses: some-action@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

**Important** :
- Les secrets ne sont **jamais affichés** dans les logs
- GitHub masque automatiquement les valeurs dans les outputs

### Secrets spécifiques

#### 1. CODECOV_TOKEN

**Usage** : Upload coverage reports vers Codecov

**Obtenir le token** :

1. Aller sur [codecov.io](https://codecov.io/)
2. Se connecter avec GitHub
3. Sélectionner le repo `z4ppy/playlab42`
4. Aller dans Settings > General
5. Copier le **Repository Upload Token**

**Configurer** :

```bash
gh secret set CODECOV_TOKEN
# Coller le token
```

**Workflow** : `.github/workflows/ci.yml`

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v5
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: ./coverage/lcov.info
```

#### 2. GITHUB_TOKEN

**Usage** : Token auto-généré par GitHub pour chaque workflow run

**Permissions** :

```yaml
# Configurer dans le workflow
permissions:
  contents: read       # Lire le code
  pull-requests: write # Commenter les PRs
  security-events: write # Upload SARIF
```

**Pas besoin de le configurer** : GitHub le fournit automatiquement.

**Utilisation** :

```yaml
- name: Comment PR
  uses: actions/github-script@v8
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    script: |
      github.rest.issues.createComment({...})
```

---

## Variables d'environnement

### Développement local

**Fichier** : `.env` (à créer, ignoré par Git)

```bash
# .env (NE JAMAIS COMMITTER)
NODE_ENV=development
API_URL=http://localhost:3000
DEBUG=true
```

**Charger les variables** :

```javascript
// Node.js (avec dotenv)
import dotenv from 'dotenv';
dotenv.config();

const apiUrl = process.env.API_URL;
```

**Ajouter `.env` au `.gitignore`** :

```bash
# .gitignore
.env
.env.local
.env.*.local
```

### Template pour nouveaux contributeurs

**Fichier** : `.env.example` (committé dans Git)

```bash
# .env.example - Copier vers .env et renseigner les valeurs

# Environment
NODE_ENV=development

# API (optionnel)
# API_URL=http://localhost:3000

# Debug
# DEBUG=true
```

**Usage** :

```bash
# Nouveau contributeur
cp .env.example .env
# Éditer .env avec les vraies valeurs
```

### Docker

**Fichier** : `docker-compose.yml`

```yaml
services:
  dev:
    environment:
      - NODE_ENV=development
      - DEBUG=true
    env_file:
      - .env  # Charger depuis fichier .env
```

---

## Bonnes pratiques

### 1. Ne jamais hardcoder de secrets

```javascript
// ❌ MAUVAIS
const apiKey = 'sk_live_abc123def456';
fetch('https://api.example.com', {
  headers: { 'Authorization': `Bearer sk_live_abc123def456` }
});

// ✅ BON
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error('API_KEY environment variable is required');
}
fetch('https://api.example.com', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
```

### 2. Valider la présence des secrets

```javascript
// Vérifier au démarrage
const requiredEnvVars = ['API_KEY', 'DATABASE_URL'];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}
```

### 3. Masquer les secrets dans les logs

```javascript
// ❌ MAUVAIS
console.log('API Key:', process.env.API_KEY);

// ✅ BON
console.log('API Key: [REDACTED]');

// Ou utiliser une fonction helper
function maskSecret(secret) {
  if (!secret) return '[MISSING]';
  return secret.substring(0, 4) + '...' + secret.substring(secret.length - 4);
}
console.log('API Key:', maskSecret(process.env.API_KEY));
// → "API Key: sk_l...f456"
```

### 4. Rotation des secrets

**Fréquence recommandée** :

| Type de secret | Rotation |
|----------------|----------|
| Tokens développement | Tous les 3 mois |
| Tokens production | Tous les mois |
| Après incident | Immédiatement |
| Contributeur quitte projet | Immédiatement |

**Procédure de rotation** :

```bash
# 1. Générer un nouveau token
# → Sur le service (GitHub, Codecov, etc.)

# 2. Mettre à jour le secret GitHub
gh secret set CODECOV_TOKEN
# Coller le nouveau token

# 3. Tester que ça fonctionne
# → Déclencher le workflow manuellement

# 4. Révoquer l'ancien token
# → Sur le service
```

### 5. Séparation dev/prod

**Utiliser des comptes différents** :

- Dev : Token avec permissions limitées
- Prod : Token avec permissions minimales requises

**Exemple** :

```bash
# Dev : Token read-write
CODECOV_TOKEN_DEV=...

# Prod : Token read-only (si possible)
CODECOV_TOKEN_PROD=...
```

---

## Détection de secrets

### GitLeaks (workflow automatique)

**Workflow** : `.github/workflows/security-audit.yml`

```yaml
gitleaks:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0  # Tout l'historique Git

    - uses: gitleaks/gitleaks-action@v2
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Ce qui est détecté** :

- API keys (AWS, Stripe, etc.)
- Tokens GitHub
- Passwords hardcodés
- Clés privées SSH/GPG
- Database URLs avec credentials

**Faux positifs** :

Si GitLeaks détecte un faux positif :

```bash
# .gitleaksignore
# Ignorer un fichier spécifique
path/to/false-positive.js

# Ignorer un pattern
**/*test-fixture*.json
```

### Trivy (scan de secrets)

**Workflow** : `.github/workflows/security-audit.yml`

```yaml
trivy-scan:
  steps:
    - run: |
        trivy fs . \
          --scanners vuln,secret,misconfig \
          --severity CRITICAL,HIGH,MEDIUM
```

**Détecte** :

- Secrets hardcodés
- Fichiers de configuration sensibles (.env, credentials.json)

### Scan local avant commit

```bash
# Installer gitleaks localement
# macOS
brew install gitleaks

# Linux
wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.0/gitleaks_8.18.0_linux_x64.tar.gz
tar -xzf gitleaks_8.18.0_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/

# Scanner le repo
gitleaks detect --verbose

# Scanner avant commit (hook Git)
gitleaks protect --staged
```

**Intégrer dans un hook Git** :

```bash
# .git/hooks/pre-commit
#!/bin/bash
gitleaks protect --staged --verbose
if [ $? -ne 0 ]; then
  echo "❌ GitLeaks a détecté des secrets ! Commit annulé."
  exit 1
fi
```

---

## Incidents de sécurité

### Que faire si un secret est exposé ?

**Procédure d'urgence** :

#### 1. Confirmer l'incident

```bash
# Vérifier si le secret est dans Git
git log --all --full-history --source -- '*.*' | grep -i "secret"

# Vérifier GitHub public repo
# → Si public : Le secret est considéré comme compromis
```

#### 2. Révoquer immédiatement

**Pour chaque type de secret** :

- **CODECOV_TOKEN** :
  1. Aller sur codecov.io > Settings > General
  2. Cliquer sur "Regenerate Token"
  3. Copier le nouveau token

- **GitHub Token** :
  1. Aller sur github.com > Settings > Developer settings > Personal access tokens
  2. Révoquer le token compromis

- **API Keys tierces** :
  1. Se connecter au service
  2. Révoquer la clé compromise
  3. Générer une nouvelle clé

#### 3. Mettre à jour le secret

```bash
# GitHub Secret
gh secret set CODECOV_TOKEN
# Coller le nouveau token

# .env local (tous les devs doivent le faire)
# Mettre à jour la valeur
```

#### 4. Nettoyer l'historique Git

**⚠️ ATTENTION** : Cette opération réécrit l'historique Git et nécessite un force push.

**Option 1 : BFG Repo Cleaner (recommandé)**

```bash
# Télécharger BFG
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# Backup du repo
cp -r playlab42 playlab42-backup

# Supprimer le secret
java -jar bfg-1.14.0.jar --replace-text passwords.txt playlab42/

# passwords.txt contient :
# SECRET_VALUE==>***REMOVED***

# Nettoyer
cd playlab42
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (⚠️ Coordination avec l'équipe requise)
git push --force --all
```

**Option 2 : git-filter-repo**

```bash
# Installer
pip3 install git-filter-repo

# Supprimer le fichier de tout l'historique
git filter-repo --path .env --invert-paths

# Force push
git push --force --all
```

#### 5. Notifier l'équipe

**Message type** :

```
🚨 INCIDENT DE SÉCURITÉ 🚨

Un secret a été exposé dans le repo :
- Type : CODECOV_TOKEN
- Commit : abc123def456
- Branche : main

Actions prises :
✅ Secret révoqué
✅ Nouveau secret généré et configuré
✅ Historique Git nettoyé

Actions requises de votre part :
1. Faire un git pull --rebase origin main
2. Vérifier que vos branches locales sont à jour
3. Ne PAS utiliser l'ancien token

Si vous avez des questions : @mainteneur
```

#### 6. Post-mortem

**Documenter l'incident** :

1. Qu'est-ce qui s'est passé ?
2. Comment le secret a-t-il été exposé ?
3. Quand a-t-il été détecté ?
4. Quelles actions ont été prises ?
5. Comment éviter cela à l'avenir ?

**Exemples de mesures préventives** :

- Ajouter un hook Git pre-commit avec gitleaks
- Formation de l'équipe sur les bonnes pratiques
- Review systématique des PRs avant merge

---

## Checklist de sécurité

### Pour les contributeurs

Avant chaque commit :

- [ ] Aucun secret hardcodé dans le code
- [ ] `.env` est dans `.gitignore`
- [ ] Pas de fichiers de credentials committés
- [ ] Valeurs sensibles dans variables d'environnement
- [ ] Tests locaux ne nécessitent pas de secrets de prod

### Pour les mainteneurs

Lors de la configuration du projet :

- [ ] Tous les secrets GitHub configurés
- [ ] `.env.example` à jour
- [ ] `.gitignore` inclut `.env`, `credentials.json`, etc.
- [ ] GitLeaks activé dans CI
- [ ] Trivy activé dans CI
- [ ] Documentation des secrets à jour

Mensuellement :

- [ ] Audit des secrets GitHub (supprimer inutilisés)
- [ ] Rotation des tokens de production
- [ ] Vérifier les permissions des tokens
- [ ] Review des alertes de sécurité

---

## Ressources

- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitLeaks Documentation](https://github.com/gitleaks/gitleaks)
- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [OWASP Secret Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [12-Factor App : Config](https://12factor.net/config)

---

*Document maintenu par les contributeurs de Playlab42*
*Dernière mise à jour : 2025-12-14*
