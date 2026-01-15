/**
 * NoteButtons - Boutons de sélection de notes
 *
 * Affiche les 7 notes (Do à Si) comme boutons cliquables.
 *
 * @module ui/NoteButtons
 */

// ============================================================================
// Constantes
// ============================================================================

/** Noms des notes en français */
const NOTE_NAMES = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];

/** Couleurs associées aux notes (optionnel) */
const NOTE_COLORS = [
  '#e53935', // Do - rouge
  '#FB8C00', // Ré - orange
  '#FDD835', // Mi - jaune
  '#43A047', // Fa - vert
  '#039BE5', // Sol - bleu
  '#5E35B1', // La - violet
  '#D81B60', // Si - rose
];

// ============================================================================
// Classe NoteButtons
// ============================================================================

/**
 * Composant de boutons de notes
 */
export class NoteButtons {
  /**
   * Crée un nouveau composant
   *
   * @param {HTMLElement} container - Conteneur DOM
   * @param {Object} options - Options
   * @param {Function} options.onSelect - Callback de sélection (index 0-6)
   * @param {boolean} options.includeAccidentals - Afficher les altérations
   * @param {boolean} options.useColors - Utiliser les couleurs
   */
  constructor(container, options = {}) {
    this.container = container;
    this.onSelect = options.onSelect || (() => {});
    this.includeAccidentals = options.includeAccidentals || false;
    this.useColors = options.useColors || false;

    /** @type {HTMLButtonElement[]} Boutons */
    this.buttons = [];

    /** @type {boolean} Activé */
    this.enabled = true;

    this._render();
  }

  // --------------------------------------------------------------------------
  // Rendu
  // --------------------------------------------------------------------------

  /**
   * Rendu du composant
   * @private
   */
  _render() {
    this.container.innerHTML = '';
    this.container.className = 'note-buttons';

    const buttonsRow = document.createElement('div');
    buttonsRow.className = 'note-buttons-row';

    for (let i = 0; i < 7; i++) {
      const button = this._createNoteButton(i);
      buttonsRow.appendChild(button);
      this.buttons.push(button);
    }

    this.container.appendChild(buttonsRow);

    // Ligne d'altérations si nécessaire
    if (this.includeAccidentals) {
      const accidentalsRow = document.createElement('div');
      accidentalsRow.className = 'note-buttons-row accidentals';
      accidentalsRow.innerHTML = `
        <span class="accidental-hint">♯ = dièse, ♭ = bémol</span>
      `;
      this.container.appendChild(accidentalsRow);
    }

    this._addStyles();
  }

  /**
   * Crée un bouton de note
   * @private
   */
  _createNoteButton(index) {
    const button = document.createElement('button');
    button.className = 'note-button';
    button.dataset.noteIndex = index;
    button.innerHTML = `
      <span class="note-name">${NOTE_NAMES[index]}</span>
      <span class="note-key">${index + 1}</span>
    `;

    if (this.useColors) {
      button.style.setProperty('--note-color', NOTE_COLORS[index]);
    }

    button.addEventListener('click', () => {
      if (this.enabled) {
        this._handleClick(index);
      }
    });

    return button;
  }

  /**
   * Gère le clic sur un bouton
   * @private
   */
  _handleClick(index) {
    // Animation de clic
    this.buttons[index].classList.add('clicked');
    setTimeout(() => {
      this.buttons[index].classList.remove('clicked');
    }, 150);

    this.onSelect(index);
  }

  // --------------------------------------------------------------------------
  // État
  // --------------------------------------------------------------------------

  /**
   * Active les boutons
   */
  enable() {
    this.enabled = true;
    this.buttons.forEach((btn) => {
      btn.disabled = false;
      btn.classList.remove('correct', 'incorrect');
    });
  }

  /**
   * Désactive les boutons
   */
  disable() {
    this.enabled = false;
    this.buttons.forEach((btn) => {
      btn.disabled = true;
    });
  }

  /**
   * Met en évidence le bouton correct
   *
   * @param {number} index - Index du bouton (0-6)
   */
  highlightCorrect(index) {
    if (index >= 0 && index < this.buttons.length) {
      this.buttons[index].classList.add('correct');
    }
  }

  /**
   * Met en évidence le bouton incorrect
   *
   * @param {number} index - Index du bouton (0-6)
   */
  highlightIncorrect(index) {
    if (index >= 0 && index < this.buttons.length) {
      this.buttons[index].classList.add('incorrect');
    }
  }

  /**
   * Réinitialise l'état des boutons
   */
  reset() {
    this.buttons.forEach((btn) => {
      btn.classList.remove('correct', 'incorrect', 'clicked');
    });
  }

  // --------------------------------------------------------------------------
  // Styles
  // --------------------------------------------------------------------------

  /**
   * Ajoute les styles CSS
   * @private
   */
  _addStyles() {
    if (document.getElementById('note-buttons-styles')) {return;}

    const style = document.createElement('style');
    style.id = 'note-buttons-styles';
    style.textContent = `
      .note-buttons {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .note-buttons-row {
        display: flex;
        justify-content: center;
        gap: var(--space-sm);
        flex-wrap: wrap;
      }

      .note-button {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 50px;
        height: 60px;
        padding: var(--space-sm);
        background: var(--color-bg-secondary);
        border: 2px solid var(--color-border);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all var(--transition-fast);
        position: relative;
      }

      .note-button:hover:not(:disabled) {
        border-color: var(--color-accent);
        transform: translateY(-2px);
      }

      .note-button:active:not(:disabled),
      .note-button.clicked {
        transform: scale(0.95);
      }

      .note-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .note-button.correct {
        border-color: var(--color-success);
        background: rgba(76, 175, 80, 0.1);
      }

      .note-button.incorrect {
        border-color: var(--color-error);
        background: rgba(244, 67, 54, 0.1);
      }

      .note-name {
        font-size: var(--font-size-lg);
        font-weight: bold;
      }

      .note-key {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        margin-top: 2px;
      }

      .accidentals {
        justify-content: center;
      }

      .accidental-hint {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
      }

      /* Responsive */
      @media (max-width: 400px) {
        .note-button {
          min-width: 40px;
          height: 50px;
        }

        .note-name {
          font-size: var(--font-size-md);
        }
      }
    `;

    document.head.appendChild(style);
  }

  // --------------------------------------------------------------------------
  // Nettoyage
  // --------------------------------------------------------------------------

  /**
   * Nettoie le composant
   */
  dispose() {
    this.container.innerHTML = '';
    this.buttons = [];
  }
}

export default NoteButtons;
