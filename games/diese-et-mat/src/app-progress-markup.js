/**
 * Diese & Mat - Gabarits des vues progression et paramètres (module privé de App)
 *
 * Fonctions pures qui retournent du balisage.
 *
 * @module app-progress-markup
 */

/**
 * Barre de compétence.
 * @param {string} name - Nom de la compétence
 * @param {number} accuracy - Taux de réussite (0-1)
 * @returns {string} HTML
 */
export function skillBarHtml(name, accuracy) {
  const percent = Math.round(accuracy * 100);
  const skillId = `skill-${name.replace(/\s+/g, '-').toLowerCase()}`;
  return `
      <div style="
        padding: var(--space-sm) var(--space-md);
        background: var(--color-bg-secondary);
        border-radius: var(--radius-md);
      " role="listitem">
        <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-xs);">
          <span id="${skillId}">${name}</span>
          <span style="color: var(--color-text-muted);">${percent}%</span>
        </div>
        <div style="
          height: 8px;
          background: var(--color-bg);
          border-radius: 4px;
          overflow: hidden;
        " role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-labelledby="${skillId}">
          <div style="
            width: ${percent}%;
            height: 100%;
            background: var(--color-success);
            transition: width 0.3s ease;
          "></div>
        </div>
      </div>
    `;
}

/** Compétences affichées, dans l'ordre : [libellé, identifiant de progression]. */
const DISPLAYED_SKILLS = [
  ['Clé de sol', 'treble-clef'],
  ['Clé de fa', 'bass-clef'],
  ['Altérations', 'accidentals'],
  ['Intervalles', 'intervals'],
];

/**
 * Vue progression.
 * @param {{level: number, xp: number, skills: Object}} progress
 * @returns {string} HTML
 */
export function progressHtml(progress) {
  const skillBars = DISPLAYED_SKILLS
    .map(([label, id]) => skillBarHtml(label, progress.skills[id]?.accuracy || 0))
    .join('\n          ');

  return `
      <div style="padding: var(--space-lg); max-width: 600px; margin: 0 auto;" role="region" aria-label="Ma progression">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg);">
          <h2>Ma progression</h2>
          <button id="btn-back-progress" class="btn-back" aria-label="Retour au menu">
            <span class="btn-back-icon" aria-hidden="true">←</span>
            <span>Retour</span>
          </button>
        </div>

        <!-- Niveau global -->
        <div style="
          padding: var(--space-lg);
          background: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          text-align: center;
          margin-bottom: var(--space-lg);
        " role="group" aria-label="Niveau actuel">
          <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
            NIVEAU
          </div>
          <div style="font-size: 3rem; font-weight: bold; color: var(--color-accent);" aria-label="Niveau ${progress.level}">
            ${progress.level}
          </div>
          <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);" aria-label="${progress.xp} points d'expérience">
            ${progress.xp} XP
          </div>
        </div>

        <!-- Compétences -->
        <h3 style="margin-bottom: var(--space-md);">Compétences</h3>
        <div style="display: flex; flex-direction: column; gap: var(--space-sm);" role="list" aria-label="Liste des compétences">
          ${skillBars}
        </div>
      </div>
    `;
}

/**
 * Bouton radio d'un choix de notation.
 * @param {string} notation - 'french' ou 'english'
 * @param {string} label - Texte du bouton
 * @param {boolean} active - Choix courant
 * @returns {string} HTML
 */
function notationButtonHtml(notation, label, active) {
  return `<button class="notation-btn ${active ? 'active' : ''}" data-notation="${notation}" role="radio" aria-checked="${active}" style="
                flex: 1;
                padding: var(--space-sm);
                background: ${active ? 'var(--color-accent)' : 'var(--color-bg)'};
                color: ${active ? 'white' : 'var(--color-text)'};
                border: 1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'};
                border-radius: var(--radius-sm);
                text-align: center;
                cursor: pointer;
              ">
                ${label}
              </button>`;
}

/**
 * Vue paramètres.
 * @param {boolean} isFrench - Notation française active
 * @returns {string} HTML
 */
export function settingsHtml(isFrench) {
  return `
      <div style="padding: var(--space-lg); max-width: 600px; margin: 0 auto;" role="region" aria-label="Paramètres">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg);">
          <h2>Paramètres</h2>
          <button id="btn-back-settings" class="btn-back" aria-label="Retour au menu">
            <span class="btn-back-icon" aria-hidden="true">←</span>
            <span>Retour</span>
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-md);">
          <!-- Notation -->
          <fieldset style="
            padding: var(--space-md);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
            border: none;
          ">
            <legend style="font-weight: bold; margin-bottom: var(--space-sm);">
              Notation musicale
            </legend>
            <div class="notation-buttons" style="display: flex; gap: var(--space-sm);" role="radiogroup" aria-label="Choix de la notation musicale">
              ${notationButtonHtml('french', 'Do Ré Mi', isFrench)}
              ${notationButtonHtml('english', 'C D E', !isFrench)}
            </div>
          </fieldset>

          <!-- Volume -->
          <div style="
            padding: var(--space-md);
            background: var(--color-bg-secondary);
            border-radius: var(--radius-md);
          ">
            <label for="volume-slider" style="font-weight: bold; margin-bottom: var(--space-sm); display: block;">
              Volume
            </label>
            <input type="range" id="volume-slider" min="0" max="100" value="80" style="width: 100%;" aria-label="Volume sonore">
          </div>

          <!-- Reset -->
          <button id="btn-reset-progress" style="
            padding: var(--space-md);
            background: var(--color-error);
            color: white;
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            margin-top: var(--space-lg);
          " aria-label="Réinitialiser toute la progression (action irréversible)">
            Réinitialiser la progression
          </button>
        </div>
      </div>
    `;
}
