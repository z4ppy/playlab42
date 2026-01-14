# Proposal: Étendre le Hash Routing aux Jeux et Outils

**Status:** Draft  
**Author:** Claude  
**Date:** 2025-01-14  
**Change ID:** extend-hash-routing-games-tools

## Contexte

### État actuel

Les épics (parcours pédagogiques) gèrent actuellement les liens profonds via hash router :

```
#/parcours/epic-id/slide-index
```

Ce système fonctionne très bien en local ET une fois déployé. 

**Problème** : Les jeux et outils ne bénéficient pas de ce système. Ils sont toujours chargés via :
- Clics dans le catalogue
- Chemins directs comme `games/tictactoe/index.html`

Cela signifie qu'**on ne peut pas partager directement un lien vers un jeu ou outil** — l'utilisateur doit toujours passer par le catalogue.

### Cas d'usage

1. **Partage de lien direct** : `example.com/#/games/tictactoe` ou `example.com/#/tools/json-formatter`
2. **Bookmarks** : Les favoris pointent directement vers un jeu/outil
3. **Historique navigateur** : Les boutons précédent/suivant fonctionnent correctement
4. **Préservation du contexte** : Rafraîchir la page réouvre le jeu/outil au lieu de revenir au catalogue

### Bonus (optionnel)

L'utilisateur mentionne qu'il serait intéressant de gérer les **miniatures Open Graph** pour améliorer le partage sur Teams, Slack, etc. — mais reconnaît que c'est difficile en JS pur. Cette proposition n'inclut pas cette partie (peut être un suivant).

## Solution proposée

### Scope

Étendre le hash router existant (`app/router.js`) pour supporter :

1. **Route pour jeux** : `#/games/:id`
2. **Route pour outils** : `#/tools/:id`
3. **Route bonus** : `#/games/:id/config` (passer de la config au hash)

### Architecture

- Modifier `app/router.js` pour ajouter les routes jeux/outils
- Modifier `app/game-loader.js` pour synchroniser le hash quand on charge un jeu/outil
- Modifier `app/catalogue.js` pour générer des clics qui mettent à jour le hash au lieu de charger directement
- Pas de changement aux jeux/outils eux-mêmes (restent standalone)

### Flux utilisateur

```
Utilisateur clique sur "Tic-Tac-Toe" dans le catalogue
                    ↓
app/catalogue.js met à jour window.location.hash = '#/games/tictactoe'
                    ↓
Événement 'hashchange' déclenche app/router.js
                    ↓
router.handleHashRoute() reconnaît la route '#/games/tictactoe'
                    ↓
app/game-loader.js charge le jeu dans l'iframe
                    ↓
Utilisateur peut copier-coller l'URL → fonctionne directement
```

### URLs cibles

| Route | Description | Exemple |
|-------|-------------|---------|
| `#/games/:id` | Charge un jeu | `#/games/tictactoe` |
| `#/tools/:id` | Charge un outil | `#/tools/json-formatter` |
| `#/` | Catalogue (accueil) | `#/` |

### Exemples concrets

```
https://example.com/#/games/tictactoe
https://example.com/#/games/checkers
https://example.com/#/tools/json-formatter
https://example.com/#/tools/neural-style
```

## Avantages

1. **Cohérence** : Jeux/outils au même niveau que les épics pour le deep linking
2. **Partageabilité** : Copier-coller une URL ouvre directement le contenu
3. **UX améliorée** : Refresh de page préserve le contexte
4. **Pas de régression** : Les jeux/outils restent accessibles directement
5. **Minimaliste** : Changements localisés, pas de refactoring massif

## Impact

### Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `app/router.js` | Ajouter routes pour `#/games/:id` et `#/tools/:id` |
| `app/game-loader.js` | Synchroniser hash quand on charge un jeu/outil |
| `app/catalogue.js` | Générer des clics qui mettent à jour le hash |
| `app.js` | Optionnel : appel du router au démarrage (déjà fait) |

### Specs impactées

- `openspec/specs/portal/spec.md` — ajouter routes jeux/outils au Hash Router section

### Tests

| Type | Coverage |
|------|----------|
| Unitaire | Routes et parsing du hash |
| Intégration | Clic catalogue → charge jeu |
| E2E manuel | Partage d'URL, refresh, bookmarks |

## Rétrocompatibilité

- ✅ Jeux/outils restent accessibles en accès direct (`games/id/index.html`)
- ✅ Anciens liens sans hash redirigent vers le catalogue
- ✅ Pas de breaking change côté jeu/outil

## Risques et mitigation

| Risque | Probabilité | Mitigation |
|--------|------------|-----------|
| URL parsing complexe | Faible | Parser simple avec regex |
| État désynchronisé | Faible | Synchroniser dans game-loader |
| Catalog ID vs path mismatch | Moyen | Valider ID avant load |
| Perte de tab (catalogue → game) | Faible | Parser url au démarrage |

## Décision demandée

Approuver l'extension du hash router aux jeux et outils pour permettre le partage direct de liens et améliorer la préservation du contexte.

### Follow-up optionnel

Une fois cette phase approuvée et implémentée, on pourrait explorer :
- **Open Graph metadata** pour le partage sur Teams/Slack (nécessiterait serveur)
- **Preset links** : Partager des jeux avec config pré-remplie (ex: `#/games/tictactoe?players=3`)
