/**
 * RhythmController - Contrôleur du mode rythme
 *
 * Gère l'affichage et l'interaction du mode rythme :
 * curseur défilant, détection des taps, scoring.
 *
 * @module controllers/RhythmController
 */

import { EventEmitter } from '../utils/EventEmitter.js';

// ============================================================================
// Constantes
// ============================================================================

/** Symboles des durées de notes */
const DURATION_SYMBOLS = {
  whole: '𝅝',
  half: '𝅗𝅥',
  quarter: '♩',
  eighth: '♪',
};

/** Noms des durées de notes */
const DURATION_NAMES = {
  whole: 'Ronde',
  half: 'Blanche',
  quarter: 'Noire',
  eighth: 'Croche',
};

// ============================================================================
// Classe RhythmController
// ============================================================================

/**
 * Contrôleur du mode rythme.
 *
 * Émet les événements suivants :
 * - 'rhythm-started' : Le rythme a démarré
 * - 'rhythm-ended' : { hits, total, accuracy, isCorrect }
 * - 'tap' : L'utilisateur a tapé
 */
export class RhythmController extends EventEmitter {
  /**
   * Crée un nouveau contrôleur de rythme.
   *
   * @param {Object} options - Options
   * @param {Function} options.getMetronome - Retourne l'instance du métronome
   * @param {Function} options.ensureAudioReady - S'assure que l'audio est prêt
   */
  constructor(options = {}) {
    super();

    /** @type {Function} Getter pour le métronome */
    this._getMetronome = options.getMetronome || (() => null);

    /** @type {Function} S'assurer que l'audio est prêt */
    this._ensureAudioReady = options.ensureAudioReady || (async () => {});

    /** @type {HTMLElement|null} Container de la question */
    this._container = null;

    /** @type {Object|null} État du rythme en cours */
    this._state = null;

    // Bind des méthodes pour les event listeners
    this._handleTap = this._handleTap.bind(this);
  }

  // --------------------------------------------------------------------------
  // Accesseurs
  // --------------------------------------------------------------------------

  /**
   * Retourne vrai si un exercice de rythme est en cours.
   * @returns {boolean}
   */
  get isRunning() {
    return this._state?.started === true;
  }

  /**
   * Retourne l'état actuel.
   * @returns {Object|null}
   */
  get state() {
    return this._state;
  }

  // --------------------------------------------------------------------------
  // Affichage
  // --------------------------------------------------------------------------

  /**
   * Affiche une question de rythme.
   *
   * @param {Object} question - Question de rythme
   * @param {HTMLElement} container - Container DOM
   */
  show(question, container) {
    this._container = container;
    container.innerHTML = '';

    const beatDuration = 60000 / question.tempo;

    // Construire la piste de rythme
    const rhythmContainer = document.createElement('div');
    rhythmContainer.className = 'rhythm-container';

    // Créer les cellules de beats
    const track = document.createElement('div');
    track.className = 'rhythm-track';
    track.id = 'rhythm-track';

    const cells = [];

    for (let beat = 0; beat < question.beatsPerMeasure; beat++) {
      const cell = document.createElement('div');
      cell.className = 'rhythm-beat';
      cell.dataset.beat = beat;

      // Trouver si une note commence sur ce beat
      const note = question.pattern.find(n => Math.floor(n.startBeat) === beat);

      if (note) {
        cell.dataset.hasNote = 'true';
        cell.dataset.noteIndex = question.pattern.indexOf(note);
        cell.innerHTML = `
          <div class="rhythm-beat-symbol">${DURATION_SYMBOLS[note.duration]}</div>
          <div class="rhythm-beat-label">${DURATION_NAMES[note.duration]}</div>
        `;
      } else {
        cell.innerHTML = `
          <div class="rhythm-beat-symbol" style="opacity: 0.3;">·</div>
          <div class="rhythm-beat-label">-</div>
        `;
      }

      cells.push(cell);
      track.appendChild(cell);
    }

    // Curseur
    const cursor = document.createElement('div');
    cursor.className = 'rhythm-cursor';
    cursor.id = 'rhythm-cursor';
    track.appendChild(cursor);

    // Zone de tap
    const tapZone = document.createElement('div');
    tapZone.className = 'rhythm-tap-zone';
    tapZone.id = 'rhythm-tap-zone';
    tapZone.textContent = 'TAP';

    // Score en temps réel
    const scoreDisplay = document.createElement('div');
    scoreDisplay.className = 'rhythm-score';
    scoreDisplay.id = 'rhythm-score';
    scoreDisplay.innerHTML = `
      <div class="rhythm-score-item">
        <div class="rhythm-score-value" id="rhythm-hits">0</div>
        <div class="rhythm-score-label">Réussis</div>
      </div>
      <div class="rhythm-score-item">
        <div class="rhythm-score-value" id="rhythm-misses">0</div>
        <div class="rhythm-score-label">Manqués</div>
      </div>
    `;

    // Info tempo
    const tempoInfo = document.createElement('div');
    tempoInfo.style.cssText = 'font-size: var(--font-size-sm); color: var(--color-text-muted);';
    tempoInfo.textContent = `Tempo: ${question.tempo} BPM`;

    // Bouton démarrer
    const startBtn = document.createElement('button');
    startBtn.id = 'btn-start-rhythm';
    startBtn.style.cssText = `
      padding: var(--space-sm) var(--space-lg);
      background: var(--color-success);
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: var(--font-size-md);
      color: white;
    `;
    startBtn.textContent = '▶ Démarrer';
    startBtn.addEventListener('click', () => this.start());

    rhythmContainer.appendChild(track);
    rhythmContainer.appendChild(tapZone);
    rhythmContainer.appendChild(scoreDisplay);
    rhythmContainer.appendChild(tempoInfo);
    rhythmContainer.appendChild(startBtn);
    container.appendChild(rhythmContainer);

    // Events tap
    tapZone.addEventListener('mousedown', this._handleTap);
    tapZone.addEventListener('touchstart', this._handleTap);

    // Initialiser l'état
    this._state = {
      pattern: question.pattern,
      beatsPerMeasure: question.beatsPerMeasure,
      tempo: question.tempo,
      beatDuration,
      cells,
      currentBeat: -1,
      hits: 0,
      misses: 0,
      noteResults: new Array(question.pattern.length).fill(null),
      started: false,
      startTime: null,
      animationId: null,
    };
  }

  // --------------------------------------------------------------------------
  // Démarrage
  // --------------------------------------------------------------------------

  /**
   * Démarre l'exercice de rythme avec compte à rebours.
   */
  async start() {
    if (!this._state) {return;}

    // Cacher le bouton démarrer
    const startBtn = document.getElementById('btn-start-rhythm');
    if (startBtn) {startBtn.style.display = 'none';}

    // Initialiser l'audio et le métronome
    try {
      await this._ensureAudioReady();

      const metronome = this._getMetronome();
      if (metronome) {
        metronome.setTempo(this._state.tempo);
        metronome.setTimeSignature(this._state.beatsPerMeasure, 4);
      }
    } catch {
      console.warn('Audio non disponible, mode silencieux');
    }

    // Compte à rebours
    this._countdown(3);
  }

  /**
   * Compte à rebours avant le rythme.
   * @param {number} count - Nombre de temps
   * @private
   */
  _countdown(count) {
    const feedbackContainer = document.getElementById('feedback-container');
    const beatDuration = this._state.beatDuration;

    if (count > 0) {
      if (feedbackContainer) {
        feedbackContainer.innerHTML = `
          <div style="font-size: 3rem; font-weight: bold; color: var(--color-accent);">
            ${count}
          </div>
        `;
      }
      // Jouer un tick
      const metronome = this._getMetronome();
      if (metronome?._clickSynth) {
        metronome._playClick(count === 1);
      }
      setTimeout(() => this._countdown(count - 1), beatDuration);
    } else {
      if (feedbackContainer) {
        feedbackContainer.innerHTML = `
          <div style="font-size: 2rem; font-weight: bold; color: var(--color-success);">
            GO!
          </div>
        `;
      }
      setTimeout(() => {
        if (feedbackContainer) {feedbackContainer.innerHTML = '';}
        this._startPlayback();
      }, 300);
    }
  }

  /**
   * Démarre la lecture du rythme avec curseur.
   * @private
   */
  _startPlayback() {
    this._state.started = true;
    this._state.startTime = Date.now();
    this._state.currentBeat = -1;

    // Démarrer le métronome
    const metronome = this._getMetronome();
    if (metronome) {
      metronome.start();
    }

    this.emit('rhythm-started', {});

    // Animation du curseur
    this._animateCursor();
  }

  // --------------------------------------------------------------------------
  // Animation
  // --------------------------------------------------------------------------

  /**
   * Anime le curseur et gère le timing.
   * @private
   */
  _animateCursor() {
    if (!this._state?.started) {return;}

    const { beatDuration, beatsPerMeasure, cells } = this._state;
    const elapsed = Date.now() - this._state.startTime;
    const totalDuration = beatDuration * beatsPerMeasure;

    // Position du curseur (0 à 100%)
    const progress = Math.min(elapsed / totalDuration, 1);
    const cursor = document.getElementById('rhythm-cursor');
    const track = document.getElementById('rhythm-track');

    if (cursor && track) {
      const trackWidth = track.offsetWidth - 4; // -4 pour la largeur du curseur
      cursor.style.left = `${progress * trackWidth}px`;
    }

    // Déterminer le beat actuel
    const currentBeat = Math.floor((elapsed / beatDuration));

    // Nouveau beat ?
    if (currentBeat !== this._state.currentBeat && currentBeat < beatsPerMeasure) {
      this._state.currentBeat = currentBeat;

      // Mettre à jour les cellules
      cells.forEach((cell, i) => {
        cell.classList.remove('active');
        if (i === currentBeat) {
          cell.classList.add('active');
        }
      });

      // Vérifier les notes manquées du beat précédent
      if (currentBeat > 0) {
        this._checkMissedNotes(currentBeat - 1);
      }
    }

    // Continuer ou terminer
    if (progress < 1) {
      this._state.animationId = requestAnimationFrame(() => this._animateCursor());
    } else {
      // Vérifier le dernier beat
      this._checkMissedNotes(beatsPerMeasure - 1);
      this._end();
    }
  }

  /**
   * Vérifie les notes manquées sur un beat.
   * @param {number} beat - Numéro du beat
   * @private
   */
  _checkMissedNotes(beat) {
    const { pattern, noteResults, cells } = this._state;

    pattern.forEach((note, i) => {
      if (Math.floor(note.startBeat) === beat && noteResults[i] === null) {
        // Note manquée
        noteResults[i] = false;
        this._state.misses++;
        this._updateScore();

        // Feedback visuel
        const cell = cells[beat];
        if (cell) {
          cell.classList.add('miss');
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // Interaction
  // --------------------------------------------------------------------------

  /**
   * Gère un tap de l'utilisateur.
   * @param {Event} event - Événement
   * @private
   */
  _handleTap(event) {
    if (event) {
      event.preventDefault();
    }

    // Feedback visuel du tap
    const tapZone = document.getElementById('rhythm-tap-zone');
    if (tapZone) {
      tapZone.classList.add('pressed');
      setTimeout(() => tapZone.classList.remove('pressed'), 100);
    }

    if (!this._state?.started) {
      // Si pas démarré, démarrer l'exercice
      const startBtn = document.getElementById('btn-start-rhythm');
      if (startBtn && startBtn.style.display !== 'none') {
        this.start();
      }
      return;
    }

    const { beatDuration, pattern, noteResults, cells, startTime } = this._state;
    const tapTime = Date.now() - startTime;
    const tolerance = beatDuration / 3; // Tolérance généreuse

    // Chercher la note la plus proche non encore tapée
    let bestMatch = null;
    let bestDiff = Infinity;

    pattern.forEach((note, i) => {
      if (noteResults[i] !== null) {return;} // Déjà traité

      const noteTime = note.startBeat * beatDuration;
      const diff = Math.abs(tapTime - noteTime);

      if (diff < bestDiff && diff <= tolerance) {
        bestDiff = diff;
        bestMatch = i;
      }
    });

    if (bestMatch !== null) {
      // Hit !
      noteResults[bestMatch] = true;
      this._state.hits++;

      // Feedback visuel
      const note = pattern[bestMatch];
      const cell = cells[Math.floor(note.startBeat)];
      if (cell) {
        cell.classList.add('hit');
      }
    }
    // Note: on ne compte pas les taps en trop pour être plus indulgent

    this._updateScore();
    this.emit('tap', { hit: bestMatch !== null });
  }

  /**
   * Gère les raccourcis clavier (barre d'espace).
   * @param {KeyboardEvent} event - Événement
   */
  handleKeydown(event) {
    if (event.key === ' ' && this._state) {
      event.preventDefault();
      this._handleTap(null);
    }
  }

  /**
   * Met à jour l'affichage du score.
   * @private
   */
  _updateScore() {
    const hitsEl = document.getElementById('rhythm-hits');
    const missesEl = document.getElementById('rhythm-misses');

    if (hitsEl) {hitsEl.textContent = this._state.hits;}
    if (missesEl) {missesEl.textContent = this._state.misses;}
  }

  // --------------------------------------------------------------------------
  // Fin
  // --------------------------------------------------------------------------

  /**
   * Termine l'exercice de rythme.
   * @private
   */
  _end() {
    if (!this._state) {return;}

    // Arrêter
    this._state.started = false;
    if (this._state.animationId) {
      cancelAnimationFrame(this._state.animationId);
    }

    const metronome = this._getMetronome();
    if (metronome) {
      metronome.stop();
    }

    // Calculer le résultat
    const { hits, pattern } = this._state;
    const total = pattern.length;
    const accuracy = total > 0 ? hits / total : 0;
    const isCorrect = accuracy >= 0.7;

    // Émettre l'événement de fin
    this.emit('rhythm-ended', {
      hits,
      total,
      accuracy,
      isCorrect,
    });
  }

  /**
   * Affiche le feedback de fin.
   *
   * @param {boolean} isCorrect - Si le résultat est correct
   * @param {number} accuracy - Taux de réussite (0-1)
   * @param {number} hits - Nombre de hits
   * @param {number} total - Nombre total de notes
   */
  showEndFeedback(isCorrect, accuracy, hits, total) {
    const feedbackContainer = document.getElementById('feedback-container');
    if (feedbackContainer) {
      const percent = Math.round(accuracy * 100);
      feedbackContainer.innerHTML = `
        <div style="
          padding: var(--space-md);
          background: rgba(${isCorrect ? '76, 175, 80' : '244, 67, 54'}, 0.1);
          border-radius: var(--radius-md);
          text-align: center;
        ">
          <div style="font-size: 2rem;">${isCorrect ? '✓' : '✗'}</div>
          <div style="color: var(--color-${isCorrect ? 'success' : 'error'}); font-weight: bold;">
            ${percent}% - ${hits}/${total} notes
          </div>
        </div>
      `;
    }
  }

  // --------------------------------------------------------------------------
  // Nettoyage
  // --------------------------------------------------------------------------

  /**
   * Arrête et nettoie le contrôleur.
   */
  stop() {
    if (this._state) {
      this._state.started = false;
      if (this._state.animationId) {
        cancelAnimationFrame(this._state.animationId);
      }
    }

    const metronome = this._getMetronome();
    if (metronome) {
      metronome.stop();
    }

    this._state = null;
  }

  /**
   * Nettoie les ressources.
   */
  dispose() {
    this.stop();
    this._container = null;
    super.dispose();
  }
}

export default RhythmController;
