/**
 * QuestionRenderer - Rendu des différents types de questions
 *
 * Centralise l'affichage des questions (notes, intervalles, accords, ear training).
 * Utilise le StaffRenderer pour le rendu sur portée musicale.
 *
 * @module renderer/QuestionRenderer
 */

// ============================================================================
// Classe QuestionRenderer
// ============================================================================

/**
 * Renderer de questions musicales.
 */
export class QuestionRenderer {
  /**
   * Crée un nouveau renderer de questions.
   *
   * @param {Object} options - Options
   * @param {import('./StaffRenderer.js').StaffRenderer} options.staffRenderer - Renderer de portée
   * @param {Function} options.playNoteAudio - Fonction pour jouer une note
   */
  constructor(options = {}) {
    /** @type {import('./StaffRenderer.js').StaffRenderer|null} Renderer de portée */
    this._staffRenderer = options.staffRenderer || null;

    /** @type {Function} Fonction pour jouer une note */
    this._playNoteAudio = options.playNoteAudio || (() => {});

    /** @type {HTMLElement|null} Container de la portée */
    this._staffContainer = null;
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  /**
   * Définit le StaffRenderer.
   *
   * @param {import('./StaffRenderer.js').StaffRenderer} staffRenderer - Renderer de portée
   */
  setStaffRenderer(staffRenderer) {
    this._staffRenderer = staffRenderer;
  }

  /**
   * Définit le container de la portée.
   *
   * @param {HTMLElement} container - Container DOM
   */
  setStaffContainer(container) {
    this._staffContainer = container;
  }

  // --------------------------------------------------------------------------
  // Rendu des questions
  // --------------------------------------------------------------------------

  /**
   * Affiche une question de note (lecture visuelle).
   *
   * @param {Object} question - Question de note
   */
  renderNoteQuestion(question) {
    if (!this._staffRenderer || !question.pitch) {return;}
    this._staffRenderer.renderNote(question.pitch);
  }

  /**
   * Affiche une question d'ear training (audio uniquement).
   *
   * @param {Object} question - Question de note
   */
  renderEarTrainingQuestion(question) {
    const container = this._staffContainer;
    if (!container) {return;}

    // Afficher un indicateur visuel au lieu de la note
    container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: var(--space-md);
      ">
        <div style="
          font-size: 4rem;
          color: var(--color-accent);
        ">🎧</div>
        <div style="
          font-size: var(--font-size-lg);
          color: var(--color-text);
          text-align: center;
        ">
          Écoutez la note et identifiez-la
        </div>
        <div style="
          font-size: var(--font-size-sm);
          color: var(--color-text-muted);
        ">
          Cliquez sur "Écouter" pour rejouer
        </div>
      </div>
    `;

    // Jouer automatiquement la note après un court délai
    if (question.pitch) {
      setTimeout(() => {
        this._playNoteAudio(question.pitch);
      }, 300);
    }
  }

  /**
   * Affiche une question d'intervalle (2 notes).
   *
   * @param {Object} question - Question d'intervalle
   */
  renderIntervalQuestion(question) {
    const container = this._staffContainer;
    if (!container || !this._staffRenderer) {return;}

    // Afficher les 2 notes visuellement
    const note1 = question.pitch1.toFrench();
    const note2 = question.pitch2.toFrench();

    // Clear et afficher la première note
    this._staffRenderer.clear();
    this._staffRenderer.renderNote(question.pitch1);

    // Supprimer les anciens indicateurs
    this._removeOldInfos();

    // Ajouter un indicateur visuel pour la 2ème note
    const infoDiv = document.createElement('div');
    infoDiv.id = 'interval-info';
    infoDiv.style.cssText = `
      text-align: center;
      margin-top: var(--space-sm);
      font-size: var(--font-size-lg);
      color: var(--color-text);
    `;
    infoDiv.innerHTML = `
      <span style="color: var(--color-accent);">${note1}</span>
      <span style="margin: 0 var(--space-sm);">→</span>
      <span style="color: var(--color-success);">${note2}</span>
      <div style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-top: var(--space-xs);">
        Quel intervalle ?
      </div>
    `;

    container.appendChild(infoDiv);
  }

  /**
   * Affiche une question d'accord.
   *
   * @param {Object} question - Question d'accord
   */
  renderChordQuestion(question) {
    const container = this._staffContainer;
    if (!container || !this._staffRenderer) {return;}

    // Récupérer les notes de l'accord
    const chord = question.chord;
    const pitches = chord.getPitches();
    const notesStr = pitches.map(p => p.toFrench()).join(' - ');

    // Clear et afficher la fondamentale
    this._staffRenderer.clear();
    this._staffRenderer.renderNote(chord.root);

    // Supprimer les anciens indicateurs
    this._removeOldInfos();

    // Ajouter un indicateur visuel pour l'accord
    const infoDiv = document.createElement('div');
    infoDiv.id = 'chord-info';
    infoDiv.style.cssText = `
      text-align: center;
      margin-top: var(--space-sm);
      font-size: var(--font-size-lg);
      color: var(--color-text);
    `;
    infoDiv.innerHTML = `
      <div style="font-size: var(--font-size-md); color: var(--color-accent);">
        ${notesStr}
      </div>
      <div style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-top: var(--space-xs);">
        Quel type d'accord ?
      </div>
    `;

    container.appendChild(infoDiv);
  }

  // --------------------------------------------------------------------------
  // Méthodes privées
  // --------------------------------------------------------------------------

  /**
   * Supprime les anciens indicateurs d'info.
   * @private
   */
  _removeOldInfos() {
    const oldChordInfo = document.getElementById('chord-info');
    if (oldChordInfo) {oldChordInfo.remove();}

    const oldIntervalInfo = document.getElementById('interval-info');
    if (oldIntervalInfo) {oldIntervalInfo.remove();}
  }

  // --------------------------------------------------------------------------
  // Nettoyage
  // --------------------------------------------------------------------------

  /**
   * Nettoie le renderer.
   */
  dispose() {
    this._staffRenderer = null;
    this._staffContainer = null;
  }
}

export default QuestionRenderer;
