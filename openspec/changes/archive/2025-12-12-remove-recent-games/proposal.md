# Proposal: remove-recent-games

## Résumé

Supprimer la section "Joué récemment" de l'interface du portail. Cette fonctionnalité n'apporte pas de valeur ajoutée avec un catalogue de jeux réduit.

## Motivation

- Avec un seul jeu disponible, la section "Joué récemment" est redondante
- Elle occupe de l'espace visuel inutilement
- Simplification de l'interface utilisateur

## Changements proposés

### Suppression UI
- Retirer la section "Joué récemment" du HTML
- Retirer les styles CSS associés
- Retirer le code JS de rendu des jeux récents

### Conservation des données
- **Conserver** le stockage localStorage `recent_games`
- **Conserver** la logique de suivi dans `addToRecentGames()`
- Permettre une réactivation future si le catalogue s'enrichit

## Impact

| Composant | Impact |
|-----------|--------|
| portal/spec.md | Modification du requirement Recent Games |
| index.html | Suppression section HTML |
| style.css | Aucun (styles génériques réutilisables) |
| app.js | Suppression du rendu, conservation du tracking |

## Risques

- **Faible** : Changement purement cosmétique, données préservées

## Statut

- [ ] En attente de validation
