/**
 * NoteRenderer - Composant spécialisé pour afficher une note isolée
 *
 * Ce composant combine StaffRenderer et ScoreRenderer pour afficher
 * une note en mode "flash card" avec feedback visuel.
 *
 * @module renderer/NoteRenderer
 */

import { StaffRenderer } from './StaffRenderer.js';

// ============================================================================
// Constantes
// ============================================================================

const FEEDBACK_DURATION = 800; // Durée du feedback en ms

const COLORS = {
  correct: '#4CAF50',
  incorrect: '#f44336',
  hint: '#FF9800',
};

// ============================================================================
// Classe NoteRenderer
// ============================================================================

/**
 * Renderer spécialisé pour l'affichage d'une note seule
 */
export class NoteRenderer {
  /**
   * Crée un nouveau NoteRenderer
   *
   * @param {HTMLElement} container - Élément DOM conteneur
   * @param {Object} options - Options
   * @param {string} options.clef - Clé ('treble' ou 'bass')
   * @param {boolean} options.useVexFlow - Utiliser VexFlow si disponible
   * @param {number} options.width - Largeur
   * @param {number} options.height - Hauteur
   */
  constructor(container, options = {}) {
    this.container = container;
    this.clef = options.clef || 'treble';
    this.useVexFlow = options.useVexFlow || false;
    this.width = options.width || 200;
    this.height = options.height || 120;

    /** @type {StaffRenderer|null} Renderer actif */
    this.renderer = null;

    /** @type {import('../core/Pitch.js').Pitch|null} Note courante */
    this.currentPitch = null;

    /** @type {number|null} Timer pour le feedback */
    this.feedbackTimer = null;

    this._init();
  }

  // --------------------------------------------------------------------------
  // Initialisation
  // --------------------------------------------------------------------------

  /**
   * Initialise le renderer
   * @private
   */
  _init() {
    // Créer le conteneur de rendu
    this.renderContainer = document.createElement('div');
    this.renderContainer.className = 'note-renderer';
    this.renderContainer.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      min-height: ${this.height}px;
    `;
    this.container.appendChild(this.renderContainer);

    // Pour l'instant, on utilise uniquement StaffRenderer (fallback SVG)
    // VexFlow sera intégré plus tard si nécessaire
    this.renderer = new StaffRenderer(this.renderContainer, {
      width: this.width,
      height: this.height,
      clef: this.clef,
    });
  }

  // --------------------------------------------------------------------------
  // Affichage
  // --------------------------------------------------------------------------

  /**
   * Affiche une note
   *
   * @param {import('../core/Pitch.js').Pitch} pitch - Note à afficher
   * @param {Object} options - Options
   * @param {boolean} options.showAccidental - Afficher l'altération
   * @param {boolean} options.animate - Animer l'apparition
   */
  showNote(pitch, options = {}) {
    this.currentPitch = pitch;
    this.clearFeedback();

    this.renderer.renderNote(pitch, {
      showAccidental: options.showAccidental !== false,
    });

    if (options.animate) {
      this._animateAppear();
    }
  }

  /**
   * Anime l'apparition de la note
   * @private
   */
  _animateAppear() {
    const note = this.renderContainer.querySelector('.note');
    if (note) {
      note.style.opacity = '0';
      note.style.transform = 'scale(0.5)';
      note.style.transition = 'all 0.3s ease-out';

      requestAnimationFrame(() => {
        note.style.opacity = '1';
        note.style.transform = 'scale(1)';
      });
    }
  }

  // --------------------------------------------------------------------------
  // Feedback
  // --------------------------------------------------------------------------

  /**
   * Affiche le feedback de réponse correcte
   *
   * @param {Object} options - Options
   * @param {number} options.duration - Durée du feedback en ms
   * @param {Function} options.onComplete - Callback à la fin
   */
  showCorrect(options = {}) {
    const duration = options.duration || FEEDBACK_DURATION;

    this.renderer.highlightCorrect();
    this._animateFeedback('correct');

    if (options.onComplete) {
      this.feedbackTimer = setTimeout(options.onComplete, duration);
    }
  }

  /**
   * Affiche le feedback de réponse incorrecte
   *
   * @param {Object} options - Options
   * @param {number} options.duration - Durée du feedback en ms
   * @param {Function} options.onComplete - Callback à la fin
   */
  showIncorrect(options = {}) {
    const duration = options.duration || FEEDBACK_DURATION;

    this.renderer.highlightError();
    this._animateFeedback('incorrect');

    if (options.onComplete) {
      this.feedbackTimer = setTimeout(options.onComplete, duration);
    }
  }

  /**
   * Affiche un indice visuel
   *
   * @param {string} hint - Texte de l'indice
   */
  showHint(hint) {
    // Créer un élément pour l'indice
    const hintElement = document.createElement('div');
    hintElement.className = 'note-hint';
    hintElement.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      padding: 4px 12px;
      background: ${COLORS.hint};
      color: white;
      border-radius: 4px;
      font-size: 14px;
      font-weight: bold;
    `;
    hintElement.textContent = hint;

    this.renderContainer.style.position = 'relative';
    this.renderContainer.appendChild(hintElement);
  }

  /**
   * Anime le feedback
   * @private
   */
  _animateFeedback(type) {
    const note = this.renderContainer.querySelector('.note');
    if (!note) {return;}

    if (type === 'correct') {
      // Animation de pulse pour correct
      note.style.transition = 'transform 0.2s ease-out';
      note.style.transform = 'scale(1.2)';
      setTimeout(() => {
        note.style.transform = 'scale(1)';
      }, 200);
    } else {
      // Animation de shake pour incorrect
      note.style.transition = 'transform 0.1s ease-out';
      const shake = [
        'translateX(-5px)',
        'translateX(5px)',
        'translateX(-3px)',
        'translateX(3px)',
        'translateX(0)',
      ];
      let i = 0;
      const interval = setInterval(() => {
        note.style.transform = shake[i];
        i++;
        if (i >= shake.length) {
          clearInterval(interval);
        }
      }, 50);
    }
  }

  /**
   * Efface le feedback
   */
  clearFeedback() {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }

    // Retirer les éléments de hint
    const hints = this.renderContainer.querySelectorAll('.note-hint');
    hints.forEach((h) => h.remove());
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  /**
   * Change la clé
   *
   * @param {string} clef - Nouvelle clé
   */
  setClef(clef) {
    this.clef = clef;
    this.renderer.setClef(clef);

    // Re-afficher la note courante si elle existe
    if (this.currentPitch) {
      this.showNote(this.currentPitch);
    }
  }

  /**
   * Redimensionne le renderer
   *
   * @param {number} width - Nouvelle largeur
   * @param {number} height - Nouvelle hauteur
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.renderer.resize(width, height);

    if (this.currentPitch) {
      this.showNote(this.currentPitch);
    }
  }

  // --------------------------------------------------------------------------
  // Nettoyage
  // --------------------------------------------------------------------------

  /**
   * Efface la note
   */
  clear() {
    this.renderer.clear();
    this.clearFeedback();
    this.currentPitch = null;
  }

  /**
   * Libère les ressources
   */
  dispose() {
    this.clearFeedback();
    this.renderer.dispose();
    this.container.innerHTML = '';
    this.renderer = null;
    this.currentPitch = null;
  }
}

export default NoteRenderer;
