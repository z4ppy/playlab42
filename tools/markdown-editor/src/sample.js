/**
 * Document d'accueil : montre la syntaxe prise en charge et sert de
 * démonstration quand aucun brouillon n'est enregistré.
 * @module sample
 */

export const SAMPLE_DOCUMENT = `# Bienvenue dans l'éditeur Markdown

Écrivez ici, l'**aperçu** se met à jour en direct. Tout reste dans votre
navigateur : le brouillon est sauvegardé automatiquement, rien n'est envoyé.

## Mise en forme

Du texte en **gras**, en *italique*, en ~~barré~~ et du \`code en ligne\`.
Un [lien vers CommonMark](https://commonmark.org "La spécification") et un lien
automatique : https://github.github.com/gfm/

> Une citation peut contenir d'autres blocs.
>
> > Et même une citation imbriquée.

## Listes

1. Les listes numérotées
2. continuent toutes seules quand on appuie sur Entrée ;
   - Tab ou le bouton ⇥ imbrique un élément,
   - Maj+Tab ou le bouton ⇤ le remonte (Échap puis Tab pour quitter la zone).

- [x] Lire la documentation
- [ ] Cocher une tâche directement dans l'aperçu
- [ ] Exporter le document en HTML

## Tableau

| Raccourci | Action | Disponible |
| :-- | :-- | :-: |
| Ctrl+B | Gras | ✓ |
| Ctrl+I | Italique | ✓ |
| Ctrl+K | Lien | ✓ |
| Ctrl+E | Code | ✓ |

## Code coloré

\`\`\`js
// Compte les mots d'un texte
function countWords(text) {
  return text.match(/\\p{L}+/gu)?.length ?? 0;
}
const total = countWords('Bonjour le monde'); // 3
\`\`\`

\`\`\`json
{ "outil": "markdown-editor", "local": true, "version": 1 }
\`\`\`

\`\`\`bash
# Servir le dépôt en local
npx serve . -p 5242 --cors
\`\`\`

---

Le HTML brut est affiché tel quel, jamais exécuté : <script>alert('non')</script>
`;
