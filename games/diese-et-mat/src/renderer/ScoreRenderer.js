/**
 * ScoreRenderer - Wrapper VexFlow pour le rendu de partitions
 *
 * Ce renderer utilise VexFlow pour un rendu professionnel des partitions.
 * Il est chargé à la demande (lazy loading) pour optimiser le temps de chargement.
 *
 * @module renderer/ScoreRenderer
 */

// ============================================================================
// Classe ScoreRenderer
// ============================================================================

/**
 * Renderer de partitions utilisant VexFlow
 */
export class ScoreRenderer {
  /**
   * Crée un nouveau renderer VexFlow
   *
   * @param {HTMLElement} container - Élément DOM conteneur
   * @param {Object} options - Options de configuration
   * @param {number} options.width - Largeur du rendu
   * @param {number} options.height - Hauteur du rendu
   * @param {string} options.clef - Clé: 'treble' ou 'bass'
   * @param {Object} options.timeSignature - Signature (ex: { beats: 4, beatValue: 4 })
   */
  constructor(container, options = {}) {
    this.container = container;
    this.width = options.width || 300;
    this.height = options.height || 150;
    this.clef = options.clef || 'treble';
    this.timeSignature = options.timeSignature || null;

    /** @type {Object|null} Instance VexFlow (chargée à la demande) */
    this.VF = null;

    /** @type {Object|null} Renderer VexFlow */
    this.renderer = null;

    /** @type {Object|null} Contexte de rendu */
    this.context = null;

    /** @type {Object|null} Stave (portée) */
    this.stave = null;

    /** @type {boolean} Prêt pour le rendu */
    this.ready = false;

    /** @type {Object|null} Couleurs de highlight */
    this.highlightColor = null;
  }

  // --------------------------------------------------------------------------
  // Initialisation
  // --------------------------------------------------------------------------

  /**
   * Initialise le renderer (charge VexFlow si nécessaire)
   *
   * @returns {Promise<void>}
   */
  async init() {
    if (this.ready) {return;}

    try {
      // Charger VexFlow dynamiquement
      const vexflow = await import('vexflow');
      this.VF = vexflow.Vex?.Flow || vexflow.Flow || vexflow;

      // Créer le renderer
      this._createRenderer();

      this.ready = true;
    } catch (error) {
      console.error('Erreur lors du chargement de VexFlow:', error);
      throw new Error('Impossible de charger VexFlow');
    }
  }

  /**
   * Crée le renderer et la portée
   * @private
   */
  _createRenderer() {
    // Nettoyer le conteneur
    this.container.innerHTML = '';

    // Créer le renderer
    this.renderer = new this.VF.Renderer(
      this.container,
      this.VF.Renderer.Backends.SVG,
    );
    this.renderer.resize(this.width, this.height);

    // Obtenir le contexte
    this.context = this.renderer.getContext();
    this.context.setFont('Arial', 10);

    // Créer la portée
    this._createStave();
  }

  /**
   * Crée la portée
   * @private
   */
  _createStave() {
    const margin = 10;
    this.stave = new this.VF.Stave(
      margin,
      this.height / 2 - 40,
      this.width - 2 * margin,
    );

    // Ajouter la clé
    this.stave.addClef(this.clef);

    // Ajouter la signature rythmique si définie
    if (this.timeSignature) {
      this.stave.addTimeSignature(
        `${this.timeSignature.beats}/${this.timeSignature.beatValue}`,
      );
    }

    // Dessiner la portée
    this.stave.setContext(this.context).draw();
  }

  // --------------------------------------------------------------------------
  // Rendu des notes
  // --------------------------------------------------------------------------

  /**
   * Affiche une seule note
   *
   * @param {import('../core/Pitch.js').Pitch} pitch - Note à afficher
   * @param {Object} options - Options
   * @param {string} options.duration - Durée VexFlow ('q', 'h', 'w', etc.)
   * @param {string} options.color - Couleur de la note
   */
  renderNote(pitch, options = {}) {
    if (!this.ready) {
      throw new Error('Renderer non initialisé. Appelez init() d\'abord.');
    }

    const duration = options.duration || 'w'; // Ronde par défaut
    const color = options.color || null;

    // Recréer la portée
    this._clearAndRedrawStave();

    // Créer la note
    const noteKey = pitch.toVexFlow();
    const staveNote = new this.VF.StaveNote({
      clef: this.clef,
      keys: [noteKey],
      duration: duration,
    });

    // Ajouter l'altération si présente
    if (pitch.accidental) {
      const accidental = this._getVexFlowAccidental(pitch.accidental);
      if (accidental) {
        staveNote.addModifier(new this.VF.Accidental(accidental));
      }
    }

    // Appliquer la couleur si spécifiée
    if (color) {
      staveNote.setStyle({ fillStyle: color, strokeStyle: color });
    }

    // Formater et dessiner
    this._formatAndDraw([staveNote]);
  }

  /**
   * Affiche plusieurs notes (accord)
   *
   * @param {import('../core/Pitch.js').Pitch[]} pitches - Notes à afficher
   * @param {Object} options - Options
   * @param {string} options.duration - Durée VexFlow
   * @param {string} options.color - Couleur des notes
   */
  renderChord(pitches, options = {}) {
    if (!this.ready) {
      throw new Error('Renderer non initialisé. Appelez init() d\'abord.');
    }

    const duration = options.duration || 'w';
    const color = options.color || null;

    this._clearAndRedrawStave();

    // Créer les clés pour l'accord
    const keys = pitches.map((p) => p.toVexFlow());

    const staveNote = new this.VF.StaveNote({
      clef: this.clef,
      keys: keys,
      duration: duration,
    });

    // Ajouter les altérations
    pitches.forEach((pitch, index) => {
      if (pitch.accidental) {
        const accidental = this._getVexFlowAccidental(pitch.accidental);
        if (accidental) {
          staveNote.addModifier(new this.VF.Accidental(accidental), index);
        }
      }
    });

    if (color) {
      staveNote.setStyle({ fillStyle: color, strokeStyle: color });
    }

    this._formatAndDraw([staveNote]);
  }

  /**
   * Affiche une séquence de notes (mesure)
   *
   * @param {Array<{pitch: Pitch, duration: string}>} notes - Notes avec durées
   * @param {Object} options - Options
   */
  renderMeasure(notes, _options = {}) {
    if (!this.ready) {
      throw new Error('Renderer non initialisé. Appelez init() d\'abord.');
    }

    this._clearAndRedrawStave();

    const staveNotes = notes.map((note) => {
      const staveNote = new this.VF.StaveNote({
        clef: this.clef,
        keys: [note.pitch.toVexFlow()],
        duration: note.duration || 'q',
      });

      if (note.pitch.accidental) {
        const accidental = this._getVexFlowAccidental(note.pitch.accidental);
        if (accidental) {
          staveNote.addModifier(new this.VF.Accidental(accidental));
        }
      }

      if (note.color) {
        staveNote.setStyle({ fillStyle: note.color, strokeStyle: note.color });
      }

      return staveNote;
    });

    this._formatAndDraw(staveNotes);
  }

  // --------------------------------------------------------------------------
  // Utilitaires privés
  // --------------------------------------------------------------------------

  /**
   * Efface et redessine la portée
   * @private
   */
  _clearAndRedrawStave() {
    this.context.clear();
    this._createStave();
  }

  /**
   * Formate et dessine les notes
   * @private
   */
  _formatAndDraw(staveNotes) {
    const voice = new this.VF.Voice({ num_beats: 4, beat_value: 4 });
    voice.setMode(this.VF.Voice.Mode.SOFT);
    voice.addTickables(staveNotes);

    new this.VF.Formatter()
      .joinVoices([voice])
      .format([voice], this.width - 100);

    voice.draw(this.context, this.stave);
  }

  /**
   * Convertit une altération en notation VexFlow
   * @private
   */
  _getVexFlowAccidental(accidental) {
    const map = {
      sharp: '#',
      flat: 'b',
      natural: 'n',
      'double-sharp': '##',
      'double-flat': 'bb',
    };
    return map[accidental] || null;
  }

  // --------------------------------------------------------------------------
  // Feedback visuel
  // --------------------------------------------------------------------------

  /**
   * Met en évidence avec une couleur (feedback correct/incorrect)
   *
   * @param {string} color - Couleur de highlight
   */
  highlight(_color) {
    // Pour le highlight, on doit re-render avec la nouvelle couleur
    // Cette méthode est appelée après renderNote/renderChord
    // Note: implémentation future avec re-render
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
    if (this.ready) {
      this._clearAndRedrawStave();
    }
  }

  /**
   * Définit la signature rythmique
   *
   * @param {number} beats - Nombre de temps
   * @param {number} beatValue - Valeur du temps
   */
  setTimeSignature(beats, beatValue) {
    this.timeSignature = { beats, beatValue };
    if (this.ready) {
      this._clearAndRedrawStave();
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
    if (this.ready) {
      this.renderer.resize(width, height);
      this._clearAndRedrawStave();
    }
  }

  // --------------------------------------------------------------------------
  // Nettoyage
  // --------------------------------------------------------------------------

  /**
   * Efface le contenu
   */
  clear() {
    if (this.context) {
      this.context.clear();
      this._createStave();
    }
  }

  /**
   * Nettoie et libère les ressources
   */
  dispose() {
    this.container.innerHTML = '';
    this.renderer = null;
    this.context = null;
    this.stave = null;
    this.VF = null;
    this.ready = false;
  }
}

export default ScoreRenderer;
