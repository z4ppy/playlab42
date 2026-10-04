/**
 * Diese & Mat - Gabarits HTML de la vue d'exercice (module privé de App)
 *
 * Fonctions pures : elles retournent du balisage et ne touchent ni au DOM ni
 * à l'état de l'application. Les valeurs dynamiques proviennent des données
 * d'exercices embarquées avec l'application.
 *
 * @module app-exercise-markup
 */

/**
 * Structure complète de la vue d'exercice.
 * @param {{title: string, config: {questionsCount: number}}} exercise
 * @returns {string} HTML
 */
export function exerciseShellHtml(exercise) {
  return `
      <div class="exercise-container" style="
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: var(--space-md);
      ">
        <!-- Header -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-md);
        ">
          <button id="btn-quit" style="
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: var(--color-text-muted);
          ">✕</button>
          <div style="text-align: center;">
            <div style="font-weight: bold;">${exercise.title}</div>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
              Question <span id="question-num">1</span>/${exercise.config.questionsCount}
            </div>
          </div>
          <div id="score-display" style="
            font-size: var(--font-size-lg);
            font-weight: bold;
            color: var(--color-accent);
          ">0 pts</div>
        </div>

        <!-- Barre de progression -->
        <div style="
          height: 4px;
          background: var(--color-border);
          border-radius: 2px;
          margin-bottom: var(--space-lg);
          overflow: hidden;
        ">
          <div id="progress-bar" style="
            height: 100%;
            width: 0%;
            background: var(--color-accent);
            transition: width 0.3s ease;
          "></div>
        </div>

        <!-- Zone de portée -->
        <div id="staff-container" style="
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 150px;
        "></div>

        <!-- Feedback -->
        <div id="feedback-container" role="status" aria-live="polite" style="
          min-height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: var(--space-md);
        "></div>

        <!-- Boutons de réponse -->
        <div id="note-buttons" style="
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: var(--space-sm);
          margin-bottom: var(--space-md);
        "></div>

        <!-- Actions -->
        <div style="
          display: flex;
          justify-content: center;
          gap: var(--space-md);
        ">
          <button id="btn-play-sound" style="
            padding: var(--space-sm) var(--space-md);
            background: var(--color-accent);
            color: var(--color-text-inverse);
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
          ">🔊 Écouter</button>
          <button id="btn-hint" style="
            padding: var(--space-sm) var(--space-md);
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            cursor: pointer;
          ">💡 Indice</button>
          <button id="btn-skip" style="
            padding: var(--space-sm) var(--space-md);
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            cursor: pointer;
          ">Passer →</button>
        </div>
      </div>
    `;
}

/**
 * Feedback d'une bonne réponse.
 * @param {{points: number, streak: number}} result
 * @returns {string} HTML
 */
export function correctFeedbackHtml(result) {
  return `
        <div style="
          padding: var(--space-sm) var(--space-md);
          background: rgba(76, 175, 80, 0.1);
          color: var(--color-success);
          border-radius: var(--radius-md);
          font-weight: bold;
        ">
          ✓ Correct ! +${result.points} pts
          ${result.streak > 1 ? `<span style="margin-left: var(--space-sm);">🔥 Série de ${result.streak}</span>` : ''}
        </div>
      `;
}

/**
 * Feedback d'une mauvaise réponse.
 * @param {{french: string}} expected - Réponse attendue
 * @returns {string} HTML
 */
export function incorrectFeedbackHtml(expected) {
  return `
        <div style="
          padding: var(--space-sm) var(--space-md);
          background: rgba(244, 67, 54, 0.1);
          color: var(--color-error);
          border-radius: var(--radius-md);
          font-weight: bold;
        ">
          ✗ La réponse était <strong>${expected.french}</strong>
        </div>
      `;
}

/**
 * Affichage d'un indice.
 * @param {{text: string}} hint
 * @returns {string} HTML
 */
export function hintHtml(hint) {
  return `
        <div style="
          padding: var(--space-sm) var(--space-md);
          background: rgba(255, 193, 7, 0.1);
          color: var(--color-warning);
          border-radius: var(--radius-md);
        ">
          💡 ${hint.text}
        </div>
      `;
}

/**
 * Emoji de récompense selon le taux de réussite.
 * @param {number} accuracy - Pourcentage entier
 * @returns {string}
 */
function medalFor(accuracy) {
  if (accuracy >= 80) {return '🏆';}
  return accuracy >= 50 ? '👍' : '💪';
}

/**
 * Écran de fin d'exercice.
 * @param {{totalScore: number, maxStreak: number}} summary
 * @param {number} accuracy - Pourcentage entier de réussite
 * @returns {string} HTML
 */
export function resultsHtml(summary, accuracy) {
  return `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: var(--space-lg);
        text-align: center;
      " role="region" aria-label="Résultats de l'exercice">
        <div style="font-size: 4rem; margin-bottom: var(--space-lg);" aria-hidden="true">
          ${medalFor(accuracy)}
        </div>
        <h2>Exercice terminé !</h2>

        <div style="
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-lg);
          margin: var(--space-lg) 0;
          width: 100%;
          max-width: 400px;
        " role="group" aria-label="Statistiques">
          <div style="
            padding: var(--space-md);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
          ">
            <div style="font-size: 2rem; font-weight: bold; color: var(--color-accent);" aria-label="Score">
              ${summary.totalScore}
            </div>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
              Points
            </div>
          </div>
          <div style="
            padding: var(--space-md);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
          ">
            <div style="font-size: 2rem; font-weight: bold; color: var(--color-success);" aria-label="Taux de réussite">
              ${accuracy}%
            </div>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
              Réussite
            </div>
          </div>
          <div style="
            padding: var(--space-md);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
          ">
            <div style="font-size: 2rem; font-weight: bold; color: var(--color-warning);" aria-label="Meilleure série">
              ${summary.maxStreak}
            </div>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
              Meilleure série
            </div>
          </div>
        </div>

        <div style="display: flex; gap: var(--space-md);" role="group" aria-label="Actions">
          <button id="btn-replay" style="
            padding: var(--space-sm) var(--space-lg);
            background: var(--color-accent);
            color: var(--color-text-inverse);
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--font-size-md);
          " aria-label="Rejouer cet exercice">
            Rejouer
          </button>
          <button id="btn-back-menu" style="
            padding: var(--space-sm) var(--space-lg);
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--font-size-md);
          " aria-label="Retour au menu principal">
            Menu
          </button>
        </div>
      </div>
    `;
}
