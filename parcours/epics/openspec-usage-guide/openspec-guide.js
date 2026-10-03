/**
 * Enhancements légers du parcours OpenSpec (sans dépendance).
 *
 * Chargé par chaque slide via :
 *   <script type="module" src="../../openspec-guide.js"></script>
 *
 * Fonctionnalités, toutes déclenchées par une action explicite de l'utilisateur :
 * - bouton « Copier » devant chaque bloc `pre > code` ;
 * - mini quiz natif décrit par `data-guide-quiz`.
 *
 * Contrat du quiz (HTML) :
 *   <div data-guide-quiz>
 *     <p id="q1">Question ?</p>
 *     <button type="button" data-guide-answer="correct"
 *             data-guide-explanation="Pourquoi c'est juste">Réponse A</button>
 *     <button type="button" data-guide-answer="incorrect"
 *             data-guide-explanation="Pourquoi c'est faux">Réponse B</button>
 *     <p data-guide-quiz-result></p>   <!-- optionnel, créé si absent -->
 *   </div>
 *
 * Les fonctions n'utilisent que l'API DOM la plus basique pour rester
 * testables sans jsdom (voir openspec-guide.test.js).
 */

/** Attribut posé sur un élément déjà initialisé (garantit l'idempotence). */
export const READY_ATTR = 'data-guide-ready';

/** Messages affichés à l'utilisateur. */
export const MESSAGES = Object.freeze({
  copy: 'Copier',
  copied: 'Copié dans le presse-papiers',
  copyUnavailable: 'Copie impossible : le presse-papiers n\'est pas disponible dans ce contexte.',
  copyFailed: 'Copie impossible : accès au presse-papiers refusé.',
  correct: 'Bonne réponse.',
  incorrect: 'Ce n\'est pas la bonne réponse, essayez à nouveau.',
});

/**
 * Copie un texte via l'API Clipboard native.
 * Ne masque jamais un échec : retourne un statut explicite.
 *
 * @param {string} text - Texte à copier
 * @param {{writeText?: function(string): Promise<void>}} [clipboard]
 *   Presse-papiers à utiliser (par défaut `navigator.clipboard`)
 * @returns {Promise<{ok: boolean, message: string}>} Résultat avec message affichable
 */
export async function copyText(text, clipboard = globalThis.navigator?.clipboard) {
  if (!clipboard || typeof clipboard.writeText !== 'function') {
    return { ok: false, message: MESSAGES.copyUnavailable };
  }
  try {
    await clipboard.writeText(text);
    return { ok: true, message: MESSAGES.copied };
  } catch {
    return { ok: false, message: MESSAGES.copyFailed };
  }
}

/**
 * Ajoute une barre « Copier » avant chaque `pre > code` de la racine.
 * Idempotent : un bloc déjà équipé n'est pas modifié.
 *
 * @param {ParentNode} [root=document] - Racine de recherche
 * @param {{document?: Document, clipboard?: object}} [options] - Dépendances injectables
 * @returns {number} Nombre de blocs nouvellement équipés
 */
export function initCopyButtons(root = globalThis.document, options = {}) {
  const doc = options.document ?? globalThis.document;
  if (!root || !doc) {
    return 0;
  }
  let added = 0;
  for (const pre of root.querySelectorAll('pre')) {
    const code = pre.querySelector('code');
    if (!code || pre.getAttribute(READY_ATTR) === 'copy' || !pre.parentNode) {
      continue;
    }
    pre.setAttribute(READY_ATTR, 'copy');

    const bar = doc.createElement('div');
    bar.className = 'guide-copy-bar';
    const button = doc.createElement('button');
    button.setAttribute('type', 'button');
    button.className = 'guide-copy-button';
    button.textContent = MESSAGES.copy;
    const status = doc.createElement('span');
    status.className = 'guide-copy-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    button.addEventListener('click', async () => {
      const result = await copyText(code.textContent ?? '', options.clipboard);
      status.setAttribute('data-state', result.ok ? 'success' : 'error');
      status.textContent = result.message;
    });

    bar.appendChild(button);
    bar.appendChild(status);
    pre.parentNode.insertBefore(bar, pre);
    added += 1;
  }
  return added;
}

/**
 * Initialise un quiz : chaque bouton `[data-guide-answer]` affiche un retour
 * dans une zone `role="status"`. Les réponses restent rejouables.
 *
 * @param {Element} quiz - Conteneur `[data-guide-quiz]`
 * @param {Document} [doc=document] - Document, pour créer la zone de résultat
 * @returns {boolean} `true` si initialisé maintenant, `false` si ignoré
 */
export function initQuiz(quiz, doc = globalThis.document) {
  if (!quiz || quiz.getAttribute(READY_ATTR) === 'quiz') {
    return false;
  }
  const buttons = quiz.querySelectorAll('[data-guide-answer]');
  if (buttons.length === 0) {
    return false;
  }
  quiz.setAttribute(READY_ATTR, 'quiz');

  let result = quiz.querySelector('[data-guide-quiz-result]');
  if (!result) {
    result = doc.createElement('p');
    result.setAttribute('data-guide-quiz-result', '');
    quiz.appendChild(result);
  }
  result.setAttribute('role', 'status');
  result.setAttribute('aria-live', 'polite');

  for (const button of buttons) {
    button.setAttribute('type', 'button');
    button.addEventListener('click', () => {
      const isCorrect = button.getAttribute('data-guide-answer') === 'correct';
      for (const other of buttons) {
        other.setAttribute('aria-pressed', other === button ? 'true' : 'false');
      }
      const explanation = button.getAttribute('data-guide-explanation');
      result.setAttribute('data-state', isCorrect ? 'success' : 'error');
      result.textContent = [isCorrect ? MESSAGES.correct : MESSAGES.incorrect, explanation]
        .filter(Boolean)
        .join(' ');
    });
  }
  return true;
}

/**
 * Initialise tous les quiz de la racine.
 *
 * @param {ParentNode} [root=document] - Racine de recherche
 * @param {Document} [doc=document] - Document
 * @returns {number} Nombre de quiz nouvellement initialisés
 */
export function initQuizzes(root = globalThis.document, doc = globalThis.document) {
  if (!root) {
    return 0;
  }
  let count = 0;
  for (const quiz of root.querySelectorAll('[data-guide-quiz]')) {
    if (initQuiz(quiz, doc)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Point d'entrée : initialise copie et quiz. Idempotent, sans effet hors navigateur.
 *
 * @param {Document} [doc=document] - Document à enrichir
 * @returns {{copyButtons: number, quizzes: number}} Éléments initialisés
 */
export function initOpenSpecGuide(doc = globalThis.document) {
  if (!doc) {
    return { copyButtons: 0, quizzes: 0 };
  }
  return {
    copyButtons: initCopyButtons(doc, { document: doc }),
    quizzes: initQuizzes(doc, doc),
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initOpenSpecGuide(document), { once: true });
  } else {
    initOpenSpecGuide(document);
  }
}
