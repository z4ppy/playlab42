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
      <div class="exercise-container">
        <!-- Header -->
        <div class="exercise-topbar">
          <button id="btn-quit" class="exercise-quit" aria-label="Quitter l'exercice">✕</button>
          <div class="exercise-heading">
            <div class="exercise-heading-title">${exercise.title}</div>
            <div class="exercise-heading-count">
              Question <span id="question-num">1</span>/${exercise.config.questionsCount}
            </div>
          </div>
          <div id="score-display" class="exercise-score">0 pts</div>
        </div>

        <!-- Barre de progression -->
        <div class="exercise-progress">
          <div id="progress-bar" class="exercise-progress-fill" style="width: 0%;"></div>
        </div>

        <!-- Zone de portée -->
        <div id="staff-container" class="exercise-staff"></div>

        <!-- Feedback -->
        <div id="feedback-container" class="exercise-feedback" role="status" aria-live="polite"></div>

        <!-- Boutons de réponse -->
        <div id="note-buttons" class="exercise-answers" style="grid-template-columns: repeat(7, 1fr);"></div>

        <!-- Actions -->
        <div class="exercise-actions">
          <button id="btn-play-sound" class="exercise-action exercise-action-primary">🔊 Écouter</button>
          <button id="btn-hint" class="exercise-action">💡 Indice</button>
          <button id="btn-skip" class="exercise-action">Passer →</button>
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
 * @param {{totalScore: number, bestStreak?: number, maxStreak?: number}} summary
 *   Le moteur fournit `bestStreak` ; `maxStreak` reste accepté.
 * @param {number} accuracy - Pourcentage entier de réussite
 * @returns {string} HTML
 */
export function resultsHtml(summary, accuracy) {
  const bestStreak = summary.bestStreak ?? summary.maxStreak ?? 0;
  return `
      <div class="results-screen" role="region" aria-label="Résultats de l'exercice">
        <div class="results-medal" aria-hidden="true">
          ${medalFor(accuracy)}
        </div>
        <h2>Exercice terminé !</h2>

        <div class="results-stats" role="group" aria-label="Statistiques">
          <div class="results-stat">
            <div class="results-stat-value" style="color: var(--color-accent);" aria-label="Score">
              ${summary.totalScore}
            </div>
            <div class="results-stat-label">
              Points
            </div>
          </div>
          <div class="results-stat">
            <div class="results-stat-value" style="color: var(--color-success);" aria-label="Taux de réussite">
              ${accuracy}%
            </div>
            <div class="results-stat-label">
              Réussite
            </div>
          </div>
          <div class="results-stat">
            <div class="results-stat-value" style="color: var(--color-warning);" aria-label="Meilleure série">
              ${bestStreak}
            </div>
            <div class="results-stat-label">
              Meilleure série
            </div>
          </div>
        </div>

        <div class="results-actions" role="group" aria-label="Actions">
          <button id="btn-replay" class="results-btn results-btn-primary" aria-label="Rejouer cet exercice">
            Rejouer
          </button>
          <button id="btn-back-menu" class="results-btn" aria-label="Retour au menu principal">
            Menu
          </button>
        </div>
      </div>
    `;
}
