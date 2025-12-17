# Proposal: Système de Navigation Hash Router

**Status:** Draft
**Author:** Claude
**Date:** 2025-12-17

## Contexte

### Problèmes actuels

1. **Chemins fragiles** : Les imports utilisent des chemins absolus (`/lib/theme.js`) qui cassent sur GitHub Pages car le site est déployé sous `/playlab42/` au lieu de la racine.

2. **Pas de deep linking** : Impossible de partager une URL directe vers un jeu ou un parcours. L'utilisateur doit toujours passer par le catalogue.

3. **Architecture fragmentée** : Chaque jeu/tool est une page HTML standalone qui duplique les imports et la configuration du thème.

4. **Navigation non persistante** : Rafraîchir la page ramène toujours au catalogue.

### Erreurs observées en production

```
GET https://z4ppy.github.io/lib/theme.css 404 (Not Found)
GET https://z4ppy.github.io/lib/theme.js 404 (Not Found)
```

## Solution proposée

Implémenter un **Hash Router** centralisé qui :

1. Utilise le hash de l'URL pour la navigation (`#/games/checkers`)
2. Centralise le chargement de tous les contenus depuis `index.html`
3. Permet le partage d'URLs directes
4. Élimine les problèmes de chemins relatifs

### URLs cibles

| Route | Description |
|-------|-------------|
| `#/` | Catalogue (accueil) |
| `#/games/:id` | Jeu spécifique |
| `#/tools/:id` | Outil spécifique |
| `#/parcours/:epic` | Parcours (premier slide) |
| `#/parcours/:epic/:slideIndex` | Slide spécifique |
| `#/settings` | Paramètres |

### Exemples concrets

```
https://z4ppy.github.io/playlab42/#/games/checkers
https://z4ppy.github.io/playlab42/#/tools/json-formatter
https://z4ppy.github.io/playlab42/#/parcours/deep-learning/3
```

## Avantages

1. **URLs partageables** : Copier-coller une URL ouvre directement le contenu
2. **Bookmarks fonctionnels** : Les favoris pointent vers le bon contenu
3. **Historique navigateur** : Boutons précédent/suivant fonctionnels
4. **Plus de problèmes de chemins** : Tout est relatif à la racine
5. **Compatible GitHub Pages** : Pas besoin de configuration serveur

## Impact

### Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `app.js` | Ajout du router, refactoring navigation |
| `index.html` | Mise à jour des liens |
| `lib/router.js` | **Nouveau** - Module router |
| `style.css` | Ajustements mineurs |

### Specs impactées

- `openspec/specs/portal/spec.md` - Mise à jour navigation
- `openspec/specs/platform/spec.md` - Mention du routing

### Rétrocompatibilité

- Les jeux/tools standalone restent fonctionnels en accès direct
- Les anciens liens sans hash redirigent vers le catalogue
- Le comportement actuel (iframe) est conservé

## Risques

| Risque | Mitigation |
|--------|------------|
| SEO | Non applicable (app pédagogique interne) |
| Complexité | Router minimaliste (~50 lignes) |
| Régression | Tests manuels sur les routes principales |

## Décision demandée

Approuver la création d'un hash router pour améliorer la navigation et résoudre les problèmes de chemins sur GitHub Pages.
