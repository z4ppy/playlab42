# Configuration de la Sécurité - Playlab42

Ce document explique comment mettre en place les outils de sécurité pour le projet Playlab42.

## 📋 Table des matières

1. [Installation des outils](#installation-des-outils)
2. [Configuration ESLint Security](#configuration-eslint-security)
3. [Activation de Dependabot](#activation-de-dependabot)
4. [Workflow GitHub Actions](#workflow-github-actions)
5. [Corrections prioritaires](#corrections-prioritaires)

---

## 🔧 Installation des outils

### Plugins ESLint de sécurité

Installer les plugins ESLint pour détecter les failles de sécurité :

```bash
# Dans le container Docker
make shell

# Ou directement avec npm
npm install --save-dev eslint-plugin-security eslint-plugin-no-unsanitized
```

### Outils supplémentaires (optionnels)

```bash
# Snyk CLI pour scanner les vulnérabilités
npm install -g snyk

# GitLeaks pour détecter les secrets
brew install gitleaks  # macOS
# ou
wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.0/gitleaks_8.18.0_linux_x64.tar.gz
```

---

## 🛡️ Configuration ESLint Security

### Option 1 : Configuration inline (utilisée par le workflow)

Le workflow GitHub Actions utilise déjà les règles de sécurité sans modification permanente du code.

### Option 2 : Configuration permanente

Pour ajouter les règles de sécurité de manière permanente, modifier `eslint.config.js` :

```javascript
import js from '@eslint/js';
import globals from 'globals';
import security from 'eslint-plugin-security';
import noUnsanitized from 'eslint-plugin-no-unsanitized';

export default [
  js.configs.recommended,
  security.configs.recommended,

  {
    plugins: {
      security,
      'no-unsanitized': noUnsanitized,
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Règles existantes...
      'no-eval': 'error',
      'no-implied-eval': 'error',

      // Règles de sécurité
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'no-unsanitized/method': 'error',
      'no-unsanitized/property': 'error',
    },
  },
];
```

---

## 🤖 Activation de Dependabot

### Étapes dans GitHub

1. Aller dans **Settings** → **Security & analysis**
2. Activer **Dependabot alerts**
3. Activer **Dependabot security updates**
4. Le fichier `.github/dependabot.yml` est déjà configuré ✅

### Vérification

Dependabot créera automatiquement des PRs pour :
- Vulnérabilités de sécurité (immédiatement)
- Mises à jour hebdomadaires (tous les lundis à 6h)

---

## ⚙️ Workflow GitHub Actions

### Workflow `security-audit.yml`

Le workflow est déjà configuré dans `.github/workflows/security-audit.yml` et s'exécute :

- ✅ Sur chaque push vers `main`
- ✅ Sur chaque pull request
- ✅ Quotidiennement à 6h UTC (détection de nouvelles CVE)
- ✅ Manuellement via l'onglet Actions

### Jobs exécutés

1. **npm-audit** : Scan des vulnérabilités npm
2. **eslint-security** : Analyse statique du code
3. **trivy-scan** : Scan des vulnérabilités et secrets
4. **gitleaks** : Détection de secrets dans le code
5. **outdated-check** : Packages obsolètes
6. **docker-security** : Sécurité du Dockerfile
7. **security-report** : Rapport consolidé

### Activer CodeQL (recommandé)

Pour une analyse encore plus poussée, activer CodeQL :

1. Aller dans **Settings** → **Code security and analysis**
2. Cliquer sur **Set up** pour CodeQL analysis
3. GitHub créera automatiquement un workflow `.github/workflows/codeql.yml`

---

## 🚨 Corrections Prioritaires

Voici les correctifs à appliquer en priorité (voir `docs/SECURITY_AUDIT.md` pour le détail) :

### Priorité 1 : URGENT

#### 1. Validation d'origine pour postMessage

**Fichier** : `lib/gamekit.js`

```javascript
// AVANT
_postMessage(message) {
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');  // ❌ Dangereux
  }
}

// APRÈS
_postMessage(message) {
  if (window.parent !== window) {
    const allowedOrigin = window.location.origin;
    window.parent.postMessage(message, allowedOrigin);  // ✅ Sécurisé
  }
}
```

**Fichier** : `app.js`

```javascript
// AVANT
on(window, 'message', (e) => {
  if (!e.data || !e.data.type) {return;}  // ❌ Pas de vérification d'origine
  // ...
});

// APRÈS
on(window, 'message', (e) => {
  // Valider l'origine
  const allowedOrigins = [
    window.location.origin,
    'https://z4ppy.github.io',  // GitHub Pages
  ];

  if (!allowedOrigins.includes(e.origin)) {
    console.warn('[Security] Message from untrusted origin:', e.origin);
    return;
  }

  if (!e.data || !e.data.type) {return;}
  // ...
});
```

#### 2. Ajouter Content Security Policy

**Fichier** : `index.html`

Ajouter après `<meta charset="UTF-8">` :

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self';
  frame-src 'self';
  base-uri 'self';
  form-action 'self';
">
```

#### 3. Restreindre le sandbox des iframes

**Fichier** : `index.html`

```html
<!-- AVANT -->
<iframe id="game-iframe" sandbox="allow-scripts allow-same-origin"></iframe>

<!-- APRÈS -->
<iframe id="game-iframe" sandbox="allow-scripts"></iframe>
```

**⚠️ Impact** : Les jeux n'auront plus accès au localStorage du portail. Utiliser uniquement `postMessage` pour la communication.

### Priorité 2 : IMPORTANT

#### 4. Valider les protocoles des URLs

**Fichier** : `scripts/build-bookmarks.js`

```javascript
// AVANT
try {
  new URL(bookmark.url);
} catch {
  stats.errors.push(`URL invalide: ${bookmark.url} (${source})`);
  return false;
}

// APRÈS
try {
  const url = new URL(bookmark.url);
  const allowedProtocols = ['http:', 'https:'];
  if (!allowedProtocols.includes(url.protocol)) {
    stats.errors.push(`Protocole non autorisé (${url.protocol}): ${bookmark.url} (${source})`);
    return false;
  }
} catch {
  stats.errors.push(`URL invalide: ${bookmark.url} (${source})`);
  return false;
}
```

#### 5. Validation de schéma pour localStorage

Ajouter un fichier `lib/storage-validator.js` :

```javascript
/**
 * Valide les données localStorage avant utilisation
 */

export function validatePlayerData(data) {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid player data type');
  }
  if (data.name !== undefined && typeof data.name !== 'string') {
    throw new Error('Invalid player name type');
  }
  if (data.name && data.name.length > 50) {
    throw new Error('Player name too long');
  }
  return true;
}

export function validatePreferencesData(data) {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid preferences data type');
  }
  if (data.sound !== undefined && typeof data.sound !== 'boolean') {
    throw new Error('Invalid sound preference type');
  }
  return true;
}

export function validateScoreData(data) {
  if (!Array.isArray(data)) {
    throw new Error('Scores must be an array');
  }
  for (const entry of data) {
    if (typeof entry.score !== 'number') {
      throw new Error('Invalid score type');
    }
    if (typeof entry.date !== 'number') {
      throw new Error('Invalid date type');
    }
    if (typeof entry.player !== 'string') {
      throw new Error('Invalid player type');
    }
  }
  return true;
}
```

Utiliser dans `app.js` :

```javascript
import { validatePlayerData, validatePreferencesData } from './lib/storage-validator.js';

function loadPreferences() {
  try {
    const player = localStorage.getItem(STORAGE_KEYS.PLAYER);
    if (player) {
      const parsed = JSON.parse(player);
      validatePlayerData(parsed);  // ✅ Validation
      state.preferences.pseudo = parsed.name || 'Anonyme';
    }
    // ...
  } catch (e) {
    console.warn('Erreur chargement préférences, réinitialisation:', e);
    localStorage.removeItem(STORAGE_KEYS.PLAYER);
  }
}
```

---

## 📊 Monitoring continu

### Surveiller les alertes de sécurité

1. **GitHub Security tab** : Consulter régulièrement
2. **Dependabot PRs** : Reviewer et merger rapidement
3. **Workflow security-audit** : Vérifier les échecs
4. **npm audit** : Exécuter localement avant chaque commit

### Commandes utiles

```bash
# Audit npm local
npm audit

# Audit avec fix automatique (patch/minor)
npm audit fix

# Audit complet avec analyse détaillée
npm audit --json > audit-report.json

# Vérifier les packages obsolètes
npm outdated

# Mettre à jour un package spécifique
npm update package-name
```

---

## 🔗 Ressources

- [Rapport d'audit complet](./SECURITY_AUDIT.md)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices)

---

**Dernière mise à jour** : 2025-12-14
