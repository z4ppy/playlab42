/**
 * StaffRenderer - Rendu SVG d'une portée musicale simple
 *
 * Ce renderer est un fallback léger qui ne dépend pas de VexFlow.
 * Il permet d'afficher une note sur une portée de façon minimaliste.
 *
 * @module renderer/StaffRenderer
 */

// ============================================================================
// Constantes
// ============================================================================

/** Espace entre les lignes de la portée */
const LINE_SPACING = 10;

/** Hauteur d'une note */
const NOTE_HEIGHT = LINE_SPACING;

/** Largeur d'une note */
const NOTE_WIDTH = 12;

/** Marge verticale */
const MARGIN_Y = 30;

/** Marge horizontale */
const MARGIN_X = 40;

/** Couleurs par défaut */
const DEFAULT_COLORS = {
  staff: 'currentColor',
  note: 'currentColor',
  highlight: '#4CAF50',
  error: '#f44336',
};

// ============================================================================
// Symboles des clés (paths SVG simplifiés)
// ============================================================================

/**
 * Symboles des altérations
 */
const ACCIDENTAL_SYMBOLS = {
  sharp: '♯',
  flat: '♭',
  natural: '♮',
  'double-sharp': '𝄪',
  'double-flat': '𝄫',
};

// ============================================================================
// Classe StaffRenderer
// ============================================================================

/**
 * Renderer SVG pour afficher une portée musicale simple
 */
export class StaffRenderer {
  /**
   * Crée un nouveau renderer
   *
   * @param {HTMLElement} container - Élément DOM conteneur
   * @param {Object} options - Options de configuration
   * @param {number} options.width - Largeur du SVG
   * @param {number} options.height - Hauteur du SVG
   * @param {string} options.clef - Clé: 'treble' ou 'bass'
   * @param {Object} options.colors - Couleurs personnalisées
   */
  constructor(container, options = {}) {
    this.container = container;
    this.width = options.width || 200;
    this.height = options.height || 100;
    this.clef = options.clef || 'treble';
    this.colors = { ...DEFAULT_COLORS, ...options.colors };

    this.svg = null;
    this.noteGroup = null;

    this._createSVG();
  }

  // --------------------------------------------------------------------------
  // Création du SVG
  // --------------------------------------------------------------------------

  /**
   * Crée la structure SVG de base
   * @private
   */
  _createSVG() {
    // Nettoyer le conteneur
    this.container.innerHTML = '';

    // Créer le SVG
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', this.width);
    this.svg.setAttribute('height', this.height);
    this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    this.svg.style.display = 'block';

    // Dessiner la portée
    this._drawStaff();

    // Dessiner la clé
    this._drawClef();

    // Créer un groupe pour les notes
    this.noteGroup = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g',
    );
    this.svg.appendChild(this.noteGroup);

    this.container.appendChild(this.svg);
  }

  /**
   * Dessine les 5 lignes de la portée
   * @private
   */
  _drawStaff() {
    const staffGroup = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g',
    );
    staffGroup.setAttribute('class', 'staff-lines');

    for (let i = 0; i < 5; i++) {
      const y = MARGIN_Y + i * LINE_SPACING;
      const line = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'line',
      );
      line.setAttribute('x1', MARGIN_X - 10);
      line.setAttribute('y1', y);
      line.setAttribute('x2', this.width - 10);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', this.colors.staff);
      line.setAttribute('stroke-width', '1');
      staffGroup.appendChild(line);
    }

    this.svg.appendChild(staffGroup);
  }

  /**
   * Dessine la clé
   * @private
   */
  _drawClef() {
    const clefGroup = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g',
    );
    clefGroup.setAttribute('class', 'clef');

    if (this.clef === 'treble') {
      // Utiliser un texte pour la clé de sol (plus lisible)
      const text = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text',
      );
      text.setAttribute('x', '10');
      text.setAttribute('y', MARGIN_Y + LINE_SPACING * 3);
      text.setAttribute('font-size', '48');
      text.setAttribute('fill', this.colors.staff);
      text.textContent = '𝄞';
      clefGroup.appendChild(text);
    } else {
      // Clé de fa
      const text = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text',
      );
      text.setAttribute('x', '10');
      text.setAttribute('y', MARGIN_Y + LINE_SPACING * 2.5);
      text.setAttribute('font-size', '36');
      text.setAttribute('fill', this.colors.staff);
      text.textContent = '𝄢';
      clefGroup.appendChild(text);
    }

    this.svg.appendChild(clefGroup);
  }

  // --------------------------------------------------------------------------
  // Rendu des notes
  // --------------------------------------------------------------------------

  /**
   * Calcule la position Y d'une note sur la portée
   *
   * @param {number} staffPosition - Position sur la portée (0 = ligne du milieu)
   * @returns {number} Position Y en pixels
   */
  _getYPosition(staffPosition) {
    // Ligne du milieu = ligne 3 (index 2)
    const middleLineY = MARGIN_Y + 2 * LINE_SPACING;
    return middleLineY - (staffPosition * LINE_SPACING) / 2;
  }

  /**
   * Affiche une note sur la portée
   *
   * @param {import('../core/Pitch.js').Pitch} pitch - Note à afficher
   * @param {Object} options - Options d'affichage
   * @param {string} options.color - Couleur de la note
   * @param {boolean} options.showAccidental - Afficher l'altération
   */
  renderNote(pitch, options = {}) {
    const color = options.color || this.colors.note;
    const showAccidental = options.showAccidental !== false;

    // Effacer les notes précédentes
    this.clear();

    // Calculer la position
    const staffPosition = pitch.getStaffPosition(this.clef);
    const y = this._getYPosition(staffPosition);
    const x = this.width / 2;

    // Dessiner les lignes supplémentaires si nécessaire
    this._drawLedgerLines(staffPosition, x);

    // Dessiner l'altération si nécessaire
    if (showAccidental && pitch.accidental) {
      this._drawAccidental(pitch.accidental, x - NOTE_WIDTH - 8, y);
    }

    // Dessiner la note (ellipse)
    const note = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'ellipse',
    );
    note.setAttribute('cx', x);
    note.setAttribute('cy', y);
    note.setAttribute('rx', NOTE_WIDTH / 2);
    note.setAttribute('ry', NOTE_HEIGHT / 2);
    note.setAttribute('fill', color);
    note.setAttribute('class', 'note');

    this.noteGroup.appendChild(note);
  }

  /**
   * Dessine les lignes supplémentaires
   * @private
   */
  _drawLedgerLines(staffPosition, x) {
    const ledgerGroup = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g',
    );
    ledgerGroup.setAttribute('class', 'ledger-lines');

    // Lignes supplémentaires au-dessus
    if (staffPosition > 4) {
      for (let pos = 6; pos <= staffPosition; pos += 2) {
        const y = this._getYPosition(pos);
        this._addLedgerLine(ledgerGroup, x, y);
      }
    }

    // Lignes supplémentaires en-dessous
    if (staffPosition < -4) {
      for (let pos = -6; pos >= staffPosition; pos -= 2) {
        const y = this._getYPosition(pos);
        this._addLedgerLine(ledgerGroup, x, y);
      }
    }

    // Ligne du Do central (position 0 en clé de sol, position 0 en clé de fa)
    // En clé de sol, Do4 est à la position -6
    // En clé de fa, Do4 est à la position +6
    if (this.clef === 'treble' && staffPosition === -6) {
      const y = this._getYPosition(-6);
      this._addLedgerLine(ledgerGroup, x, y);
    }
    if (this.clef === 'bass' && staffPosition === 6) {
      const y = this._getYPosition(6);
      this._addLedgerLine(ledgerGroup, x, y);
    }

    this.noteGroup.appendChild(ledgerGroup);
  }

  /**
   * Ajoute une ligne supplémentaire
   * @private
   */
  _addLedgerLine(group, x, y) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x - NOTE_WIDTH);
    line.setAttribute('y1', y);
    line.setAttribute('x2', x + NOTE_WIDTH);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', this.colors.staff);
    line.setAttribute('stroke-width', '1');
    group.appendChild(line);
  }

  /**
   * Dessine une altération
   * @private
   */
  _drawAccidental(accidental, x, y) {
    const symbol = ACCIDENTAL_SYMBOLS[accidental];
    if (!symbol) {return;}

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y + 5);
    text.setAttribute('font-size', '16');
    text.setAttribute('fill', this.colors.note);
    text.setAttribute('text-anchor', 'middle');
    text.textContent = symbol;

    this.noteGroup.appendChild(text);
  }

  // --------------------------------------------------------------------------
  // Feedback visuel
  // --------------------------------------------------------------------------

  /**
   * Met en évidence la note (feedback correct)
   */
  highlightCorrect() {
    const note = this.noteGroup.querySelector('.note');
    if (note) {
      note.setAttribute('fill', this.colors.highlight);
      this._addCheckmark();
    }
  }

  /**
   * Met en évidence la note (feedback incorrect)
   */
  highlightError() {
    const note = this.noteGroup.querySelector('.note');
    if (note) {
      note.setAttribute('fill', this.colors.error);
      this._addCross();
    }
  }

  /**
   * Ajoute un checkmark
   * @private
   */
  _addCheckmark() {
    const x = this.width / 2 + NOTE_WIDTH + 10;
    const y = this.height / 2;

    const check = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'text',
    );
    check.setAttribute('x', x);
    check.setAttribute('y', y);
    check.setAttribute('font-size', '24');
    check.setAttribute('fill', this.colors.highlight);
    check.textContent = '✓';

    this.noteGroup.appendChild(check);
  }

  /**
   * Ajoute une croix
   * @private
   */
  _addCross() {
    const x = this.width / 2 + NOTE_WIDTH + 10;
    const y = this.height / 2;

    const cross = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'text',
    );
    cross.setAttribute('x', x);
    cross.setAttribute('y', y);
    cross.setAttribute('font-size', '24');
    cross.setAttribute('fill', this.colors.error);
    cross.textContent = '✗';

    this.noteGroup.appendChild(cross);
  }

  // --------------------------------------------------------------------------
  // Utilitaires
  // --------------------------------------------------------------------------

  /**
   * Efface les notes et feedback
   */
  clear() {
    this.noteGroup.innerHTML = '';
  }

  /**
   * Change la clé
   *
   * @param {string} clef - Nouvelle clé
   */
  setClef(clef) {
    this.clef = clef;
    this._createSVG();
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
    this._createSVG();
  }

  /**
   * Nettoie et libère les ressources
   */
  dispose() {
    this.container.innerHTML = '';
    this.svg = null;
    this.noteGroup = null;
  }
}

export default StaffRenderer;
