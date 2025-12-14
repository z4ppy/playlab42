# Audit de Sécurité - Playlab42

**Date**: 2025-12-14
**Auditeur**: Claude Code
**Périmètre**: Frontend JavaScript/TypeScript, dépendances npm, workflows CI/CD

---

## 🎯 Résumé Exécutif

Ce projet étant un support de formation, la sécurité est cruciale pour protéger les apprenants et leurs données. L'audit a identifié **7 catégories de vulnérabilités** nécessitant une attention, dont 3 critiques.

### Statistiques
- **Vulnérabilités critiques**: 3
- **Vulnérabilités moyennes**: 3
- **Vulnérabilités mineures**: 1
- **Bonnes pratiques**: 4 ✓

---

## 🔴 Vulnérabilités Critiques

### 1. PostMessage sans validation d'origine

**Sévérité**: 🔴 CRITIQUE
**CWE**: CWE-346 (Origin Validation Error)

#### Description
Les communications via `postMessage` n'utilisent pas de validation d'origine, permettant à n'importe quel site malveillant d'envoyer des messages au portail.

#### Localisation
- `lib/gamekit.js:110` - `window.parent.postMessage(message, '*')`
- `app.js:1271-1288` - Aucune validation de `event.origin`

#### Impact
- Un site malveillant pourrait envoyer des commandes au portail
- Injection de faux scores
- Manipulation de l'état de l'application
- Vol de données localStorage

#### Code vulnérable
```javascript
// lib/gamekit.js:110
_postMessage(message) {
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');  // ⚠️ Accepte toutes les origines
  }
}

// app.js:1271
on(window, 'message', (e) => {
  if (!e.data || !e.data.type) {return;}  // ⚠️ Pas de vérification de e.origin
  // ...
});
```

#### Recommandations
```javascript
// gamekit.js - Utiliser l'origine spécifique
_postMessage(message) {
  if (window.parent !== window) {
    const allowedOrigin = window.location.origin; // ou une liste d'origines autorisées
    window.parent.postMessage(message, allowedOrigin);
  }
}

// app.js - Valider l'origine
on(window, 'message', (e) => {
  // Valider l'origine
  const allowedOrigins = [
    window.location.origin,
    'https://z4ppy.github.io',  // GitHub Pages
    // Ajouter d'autres origines de confiance
  ];

  if (!allowedOrigins.includes(e.origin)) {
    console.warn('[Security] Message from untrusted origin:', e.origin);
    return;
  }

  if (!e.data || !e.data.type) {return;}
  // ...
});
```

---

### 2. Content Security Policy (CSP) manquante

**Sévérité**: 🔴 CRITIQUE
**CWE**: CWE-1021 (Improper Restriction of Rendered UI Layers)

#### Description
Aucune politique CSP n'est définie, ce qui permet l'exécution de scripts inline et le chargement de ressources depuis n'importe quelle origine.

#### Localisation
- `index.html` - Aucun header `<meta http-equiv="Content-Security-Policy">`

#### Impact
- Vulnérabilité XSS (Cross-Site Scripting)
- Injection de scripts malveillants
- Clickjacking
- Chargement de ressources depuis des CDN compromis

#### Recommandations
Ajouter dans `index.html` (après `<meta charset="UTF-8">`) :

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

**Note**: Si GitHub Pages nécessite des ajustements, adapter la politique en conséquence.

---

### 3. Sandbox iframe insuffisamment restrictif

**Sévérité**: 🔴 CRITIQUE
**CWE**: CWE-829 (Inclusion of Functionality from Untrusted Control Sphere)

#### Description
L'iframe utilisée pour charger les jeux/outils a un sandbox avec `allow-same-origin`, ce qui permet aux iframes d'accéder au localStorage et aux cookies du parent.

#### Localisation
- `index.html:95` - `<iframe id="game-iframe" sandbox="allow-scripts allow-same-origin">`

#### Impact
- Un jeu malveillant pourrait accéder au localStorage du portail
- Vol de scores, préférences, progression
- Modification de données sensibles

#### Code vulnérable
```html
<iframe id="game-iframe" sandbox="allow-scripts allow-same-origin"></iframe>
```

#### Recommandations
```html
<!-- Option 1 : Sandbox strict (préféré si les jeux n'ont pas besoin de localStorage partagé) -->
<iframe id="game-iframe" sandbox="allow-scripts"></iframe>

<!-- Option 2 : Si localStorage partagé nécessaire, utiliser une origin différente -->
<!-- Héberger les jeux sur un sous-domaine différent (ex: games.playlab42.com) -->
```

**Note importante**: Retirer `allow-same-origin` empêchera les jeux d'accéder au localStorage du portail. Si cette communication est nécessaire, utiliser uniquement `postMessage` avec validation d'origine.

---

## 🟠 Vulnérabilités Moyennes

### 4. Validation insuffisante des URLs dans les bookmarks

**Sévérité**: 🟠 MOYENNE
**CWE**: CWE-79 (XSS)

#### Description
Les URLs des bookmarks sont validées mais n'empêchent pas les protocoles dangereux comme `javascript:` ou `data:`.

#### Localisation
- `scripts/build-bookmarks.js:68-74` - Validation basique avec `new URL()`

#### Impact
- Possibilité d'injecter des URLs `javascript:` qui exécutent du code
- XSS via `data:text/html,...`

#### Code vulnérable
```javascript
function validateBookmark(bookmark, source) {
  // ...
  try {
    new URL(bookmark.url);  // ⚠️ Accepte javascript: et data:
  } catch {
    stats.errors.push(`URL invalide: ${bookmark.url} (${source})`);
    return false;
  }
  return true;
}
```

#### Recommandations
```javascript
function validateBookmark(bookmark, source) {
  if (!bookmark.url) {
    stats.errors.push(`Bookmark sans URL (${source})`);
    return false;
  }
  if (!bookmark.title) {
    stats.errors.push(`Bookmark sans titre: ${bookmark.url} (${source})`);
    return false;
  }

  // Valider le protocole
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

  return true;
}
```

---

### 5. Pas de vérification d'intégrité des dépendances

**Sévérité**: 🟠 MOYENNE
**CWE**: CWE-494 (Download of Code Without Integrity Check)

#### Description
Les dépendances npm ne sont pas vérifiées avec SRI (Subresource Integrity) et les versions ne sont pas pinnées strictement.

#### Localisation
- `package.json` - Utilisation de `^` pour les versions

#### Impact
- Attaque supply chain via des versions compromises
- Installation de packages malveillants

#### Recommandations
1. Utiliser `package-lock.json` en production (déjà présent ✓)
2. Vérifier régulièrement avec `npm audit`
3. Considérer l'utilisation de `npm ci` au lieu de `npm install` en CI (déjà fait ✓)

---

### 6. LocalStorage sans validation stricte

**Sévérité**: 🟠 MOYENNE
**CWE**: CWE-502 (Deserialization of Untrusted Data)

#### Description
Plusieurs endroits utilisent `JSON.parse()` sur des données localStorage sans validation approfondie du contenu.

#### Localisation
- `app.js:113,119,125,128,387` - `JSON.parse()` avec try-catch minimal
- `lib/gamekit.js:154,177,211,248` - Idem

#### Impact
- Injection de données malveillantes dans localStorage (via DevTools ou XSS)
- Corruption de l'état de l'application
- Potentiel DoS (denial of service) si données malformées

#### Recommandations
```javascript
// Ajouter une validation de schéma après JSON.parse
function loadPreferences() {
  try {
    const player = localStorage.getItem(STORAGE_KEYS.PLAYER);
    if (player) {
      const parsed = JSON.parse(player);
      // Valider le schéma
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Invalid player data');
      }
      if (parsed.name && typeof parsed.name !== 'string') {
        throw new Error('Invalid player name');
      }
      state.preferences.pseudo = parsed.name || 'Anonyme';
    }
    // ... suite
  } catch (e) {
    console.warn('Erreur chargement préférences, réinitialisation:', e);
    // Nettoyer les données corrompues
    localStorage.removeItem(STORAGE_KEYS.PLAYER);
  }
}
```

---

## 🟡 Vulnérabilités Mineures

### 7. Pas de rate limiting sur les requêtes externes

**Sévérité**: 🟡 MINEURE
**CWE**: CWE-770 (Allocation of Resources Without Limits)

#### Description
Le script `build-bookmarks.js` fait des requêtes pour récupérer les métadonnées OG sans rate limiting strict.

#### Localisation
- `scripts/build-bookmarks.js:296-315` - Batch de 5 requêtes concurrentes

#### Impact
- Possibilité de se faire bloquer par les serveurs cibles
- Potentiel DoS involontaire

#### Recommandations
- Ajouter un délai entre les batches
- Implémenter un retry avec backoff exponentiel
- Respecter les headers `Retry-After`

---

## ✅ Bonnes Pratiques Détectées

1. **Utilisation de `escapeHtml()`** - Protection XSS dans `lib/dom.js:94`
2. **Sandbox iframe** - Utilisation de l'attribut `sandbox` (même s'il peut être amélioré)
3. **Try-catch sur JSON.parse** - Protection contre les données corrompues
4. **Validation des manifests** - Vérification des champs requis dans `build-catalogue.js`

---

## 📋 Plan d'Action Recommandé

### Priorité 1 (URGENT)
- [ ] Ajouter validation d'origine pour `postMessage`
- [ ] Implémenter une CSP stricte
- [ ] Restreindre le sandbox des iframes

### Priorité 2 (IMPORTANT)
- [ ] Valider les protocoles des URLs (whitelist http/https)
- [ ] Ajouter validation de schéma pour localStorage
- [ ] Configurer Dependabot pour les mises à jour de sécurité

### Priorité 3 (AMÉLIORATION)
- [ ] Ajouter rate limiting pour les requêtes OG
- [ ] Implémenter des tests de sécurité automatisés
- [ ] Créer un workflow GitHub Actions pour l'audit de sécurité

---

## 🤖 Outils d'Automatisation Recommandés

### 1. npm audit
```bash
npm audit --audit-level=moderate
```
Vérifie les vulnérabilités dans les dépendances npm.

### 2. ESLint avec plugins de sécurité
```bash
npm install --save-dev eslint-plugin-security eslint-plugin-no-unsanitized
```

### 3. GitHub Dependabot
Activer dans `.github/dependabot.yml` pour des mises à jour automatiques.

### 4. CodeQL
Activer dans GitHub Actions pour l'analyse statique de code.

### 5. OWASP Dependency-Check
Scanner de vulnérabilités CVE pour les dépendances.

### 6. Snyk
Scanner de sécurité spécialisé JavaScript/npm.

---

## 📚 Références

- [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)
- [MDN - Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [MDN - postMessage Security](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_concerns)
- [HTML5 Security Cheatsheet](https://html5sec.org/)
- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices)

---

**Fin du rapport d'audit**
