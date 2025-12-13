# Proposal: Système de Bookmarks

## Résumé

Ajouter un 4ème onglet **Liens** au portail pour centraliser les ressources externes.

## Motivation

Les ressources externes (documentation, outils en ligne, providers LLM) sont dispersées. Un système de bookmarks élégant qui :
- Agrège les liens des manifests (tools, games, parcours)
- Supporte des bookmarks standalone par catégories
- Affiche une arborescence avec preview au survol

## Design

### Onglet

```
┌────────────┬────────────┬────────────┬────────────┐
│ 📚 Parcours│ 🔧 Outils  │ 🎮 Jeux    │ 🔗 Liens   │
└────────────┴────────────┴────────────┴────────────┘
```

### Arborescence

```
🤖 LLM & IA
├── 💬 ChatGPT                    [openai.com]
│   Assistant IA généraliste
├── 🟣 Claude                     [anthropic.com]
│   IA conversationnelle avancée
└── ✨ Gemini                     [gemini.google]
    Modèle multimodal Google

🛠️ Développement
├── 📦 npm                        [npmjs.com]
│   Registry de packages JavaScript
└── 🐙 GitHub                     [github.com]
    Hébergement de code source
```

### Preview au survol

```
┌─────────────────────────────────────────┐
│ ┌───────────────────────────────────┐  │
│ │     [og:image / miniature]        │  │
│ └───────────────────────────────────┘  │
│ 💬 ChatGPT                              │
│ Assistant IA généraliste d'OpenAI...   │
│ 🌐 chat.openai.com                      │
└─────────────────────────────────────────┘
```

Fallback : `og:title || title`, `og:description || description`, `og:image || emoji`

## Sources

1. **Standalone** : `bookmarks/*.json`
2. **Manifests** : champ `bookmarks` dans tool.json, game.json, epic.json

## Build

```
make build-bookmarks
```

1. Scanner sources
2. Dédupliquer par URL
3. Fetch métadonnées OG (cache 7 jours)
4. Output `data/bookmarks.json`

## Impact

| Fichier | Changement |
|---------|------------|
| `index.html` | Panel bookmarks |
| `app.js` | Logique bookmarks + preview |
| `style.css` | Styles arborescence + preview |
| `scripts/build-bookmarks.js` | Nouveau |
| `bookmarks/` | Nouveau dossier |

## Critères de succès

- [x] Onglet "Liens" fonctionnel
- [x] 10+ bookmarks de démo (12 bookmarks)
- [x] Preview au survol avec og:image
- [x] Build génère `data/bookmarks.json`

---

*Proposal créé le 2025-12-13*
*Implémenté le 2025-12-13*
