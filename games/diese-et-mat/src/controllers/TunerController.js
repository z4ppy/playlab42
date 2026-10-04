/**
 * TunerController - Contrôleur de l'accordeur chromatique
 *
 * Gère l'analyse audio du microphone et l'affichage de la note détectée.
 *
 * @module controllers/TunerController
 */

import EventEmitter from '../utils/EventEmitter.js';
import { hidePanel, isPanelVisible, showPanel } from './panel-visibility.js';

// ============================================================================
// Classe TunerController
// ============================================================================

/**
 * Contrôleur de l'accordeur chromatique.
 * Utilise l'autocorrélation pour détecter la fréquence fondamentale.
 */
export class TunerController extends EventEmitter {
  /**
   * Crée un nouveau contrôleur d'accordeur.
   *
   * @param {Object} elements - Références aux éléments DOM
   * @param {HTMLElement} elements.overlay - Overlay du tuner
   * @param {HTMLElement} elements.toggle - Bouton toggle
   * @param {HTMLElement} elements.note - Affichage de la note
   * @param {HTMLElement} elements.octave - Affichage de l'octave
   * @param {HTMLElement} elements.frequency - Affichage de la fréquence
   * @param {HTMLElement} elements.cents - Affichage des cents
   * @param {HTMLElement} elements.indicator - Indicateur de justesse
   * @param {HTMLElement} elements.status - Statut
   * @param {HTMLElement} elements.graph - Canvas du graphe
   * @param {HTMLElement} elements.graphRange - Affichage de la plage du graphe
   * @param {HTMLElement} elements.history - Historique des notes
   * @param {HTMLElement} elements.liveDot - Indicateur live
   * @param {Object} options - Options
   * @param {Function} options.formatNote - Fonction de formatage des notes
   */
  constructor(elements, options = {}) {
    super();

    /** @type {Object} Références aux éléments DOM */
    this.elements = elements;

    /** @type {Function} Fonction de formatage des notes */
    this.formatNote = options.formatNote || ((note) => note);

    /** @type {boolean} Panel initialisé */
    this._initialized = false;

    /** @type {boolean} Accordeur actif */
    this._active = false;

    /** @type {MediaStream|null} Stream audio du micro */
    this._stream = null;

    /** @type {AudioContext|null} Contexte audio */
    this._audioContext = null;

    /** @type {AnalyserNode|null} Analyseur */
    this._analyser = null;

    /** @type {Float32Array|null} Buffer audio */
    this._buffer = null;

    /** @type {Array} Historique des fréquences pour le graphe */
    this._frequencyHistory = [];

    /** @type {number} Longueur max de l'historique des fréquences */
    this._maxHistoryLength = 200;

    /** @type {Array} Historique des notes détectées */
    this._noteHistory = [];

    /** @type {number} Longueur max de l'historique des notes */
    this._maxNoteHistory = 10;

    /** @type {string|null} Dernière note détectée */
    this._lastNoteName = null;
  }

  // --------------------------------------------------------------------------
  // Cycle de vie
  // --------------------------------------------------------------------------

  /**
   * Affiche le panel accordeur.
   */
  show() {
    showPanel(this);
  }

  /**
   * Cache le panel accordeur.
   */
  hide() {
    hidePanel(this);
    this.stop();
  }

  /**
   * Retourne si le panel est visible.
   * @returns {boolean}
   */
  isVisible() {
    return isPanelVisible(this);
  }

  /**
   * Initialise le panel (une seule fois).
   * @private
   */
  _init() {
    if (this._initialized) {
      return;
    }

    // Bouton toggle
    this.elements.toggle?.addEventListener('click', () => {
      this.toggle();
    });

    this._initialized = true;
  }

  // --------------------------------------------------------------------------
  // Contrôle
  // --------------------------------------------------------------------------

  /**
   * Toggle l'accordeur.
   */
  async toggle() {
    if (this._active) {
      this.stop();
    } else {
      await this.start();
    }
  }

  /**
   * Démarre l'accordeur.
   */
  async start() {
    try {
      // Demander l'accès au micro
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Créer le contexte audio
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this._analyser = this._audioContext.createAnalyser();
      this._analyser.fftSize = 4096;

      const source = this._audioContext.createMediaStreamSource(this._stream);
      source.connect(this._analyser);

      this._active = true;
      this._buffer = new Float32Array(this._analyser.fftSize);

      // Réinitialiser les historiques
      this._frequencyHistory = [];
      this._noteHistory = [];
      this._lastNoteName = null;

      // Initialiser le graphe
      this._initGraph();

      // Mettre à jour l'UI
      this._updateUI(true);

      // Démarrer l'analyse
      this._loop();

      this.emit('started');
    } catch (error) {
      console.error('Erreur accès micro:', error);
      this._updateStatus('Accès micro refusé', true);
      this.emit('error', error);
    }
  }

  /**
   * Arrête l'accordeur.
   */
  stop() {
    this._active = false;

    // Arrêter le stream
    if (this._stream) {
      this._stream.getTracks().forEach(track => track.stop());
      this._stream = null;
    }

    // Fermer le contexte audio
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }

    // Réinitialiser les historiques
    this._frequencyHistory = [];
    this._noteHistory = [];
    this._lastNoteName = null;

    // Effacer le graphe
    this._clearGraph();

    // Effacer l'historique affiché
    if (this.elements.history) {
      this.elements.history.innerHTML = '';
    }

    this._updateUI(false);
    this.emit('stopped');
  }

  // --------------------------------------------------------------------------
  // Boucle d'analyse
  // --------------------------------------------------------------------------

  /**
   * Boucle d'analyse audio.
   * @private
   */
  _loop() {
    if (!this._active) {return;}

    // Récupérer les données audio
    this._analyser.getFloatTimeDomainData(this._buffer);

    // Détecter la fréquence (autocorrélation)
    const frequency = this._detectPitch(this._buffer, this._audioContext.sampleRate);

    // Ajouter à l'historique des fréquences
    this._frequencyHistory.push(frequency > 0 ? frequency : null);
    if (this._frequencyHistory.length > this._maxHistoryLength) {
      this._frequencyHistory.shift();
    }

    // Dessiner le graphe
    this._drawGraph();

    // Mettre à jour l'indicateur live
    this._updateLiveIndicator(frequency > 0);

    if (frequency > 0) {
      // Convertir en note
      const noteData = this._frequencyToNote(frequency);
      this._updateDisplay(noteData, frequency);

      // Ajouter à l'historique des notes si c'est une nouvelle note
      this._addToNoteHistory(noteData);

      this.emit('noteDetected', { ...noteData, frequency });
    } else {
      // Pas de signal clair
      this._updateDisplay(null, 0);
    }

    // Continuer la boucle
    requestAnimationFrame(() => this._loop());
  }

  // --------------------------------------------------------------------------
  // Détection de pitch
  // --------------------------------------------------------------------------

  /**
   * Détecte la fréquence par autocorrélation.
   * @param {Float32Array} buffer - Buffer audio
   * @param {number} sampleRate - Taux d'échantillonnage
   * @returns {number} Fréquence détectée ou -1
   * @private
   */
  _detectPitch(buffer, sampleRate) {
    const SIZE = buffer.length;

    // Vérifier qu'il y a du signal
    let rms = 0;
    for (let i = 0; i < SIZE; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / SIZE);

    if (rms < 0.01) {return -1;} // Trop silencieux

    // Autocorrélation
    const correlations = new Float32Array(SIZE);
    for (let lag = 0; lag < SIZE; lag++) {
      let sum = 0;
      for (let i = 0; i < SIZE - lag; i++) {
        sum += buffer[i] * buffer[i + lag];
      }
      correlations[lag] = sum;
    }

    // Trouver le premier pic après le lag 0
    const minLag = Math.floor(sampleRate / 1000); // Min ~1000 Hz
    const maxLag = Math.floor(sampleRate / 50);   // Max ~50 Hz

    let bestLag = -1;
    let bestCorr = 0;
    let foundPeak = false;

    for (let lag = minLag; lag < maxLag && lag < SIZE; lag++) {
      if (correlations[lag] > bestCorr) {
        bestCorr = correlations[lag];
        bestLag = lag;
        foundPeak = true;
      } else if (foundPeak && correlations[lag] < bestCorr * 0.9) {
        // On a dépassé le pic
        break;
      }
    }

    if (bestLag === -1 || bestCorr < correlations[0] * 0.5) {
      return -1;
    }

    return sampleRate / bestLag;
  }

  /**
   * Convertit une fréquence en note.
   * @param {number} frequency - Fréquence en Hz
   * @returns {Object} {note, octave, cents, exactFrequency}
   * @private
   */
  _frequencyToNote(frequency) {
    const A4 = 440;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Calcul du nombre de demi-tons depuis A4
    const semitonesFromA4 = 12 * Math.log2(frequency / A4);
    const roundedSemitones = Math.round(semitonesFromA4);

    // Calcul de la note et de l'octave
    const noteIndex = ((roundedSemitones % 12) + 12 + 9) % 12; // +9 car A est à l'index 9
    const octave = 4 + Math.floor((roundedSemitones + 9) / 12);

    // Calcul des cents
    const exactFrequency = A4 * Math.pow(2, roundedSemitones / 12);
    const cents = Math.round(1200 * Math.log2(frequency / exactFrequency));

    return {
      note: noteNames[noteIndex],
      octave: octave,
      cents: cents,
      exactFrequency: exactFrequency,
    };
  }

  // --------------------------------------------------------------------------
  // Graphe
  // --------------------------------------------------------------------------

  /**
   * Initialise le graphe.
   * @private
   */
  _initGraph() {
    const canvas = this.elements.graph;
    if (!canvas) {return;}

    // Adapter la résolution au devicePixelRatio
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Dessiner le fond
    this._drawGraph();
  }

  /**
   * Efface le graphe.
   * @private
   */
  _clearGraph() {
    const canvas = this.elements.graph;
    if (!canvas) {return;}

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (this.elements.graphRange) {
      this.elements.graphRange.textContent = '-- Hz';
    }
  }

  /**
   * Dessine le graphe de fréquence.
   * @private
   */
  _drawGraph() {
    const canvas = this.elements.graph;
    if (!canvas) {return;}

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Effacer
    ctx.clearRect(0, 0, width, height);

    // Fond
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-bg-secondary').trim() || '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    const history = this._frequencyHistory;
    if (history.length < 2) {return;}

    // Calculer min/max pour l'échelle
    const validFreqs = history.filter(f => f !== null && f > 0);
    if (validFreqs.length === 0) {return;}

    const minFreq = Math.min(...validFreqs) * 0.9;
    const maxFreq = Math.max(...validFreqs) * 1.1;

    // Mettre à jour l'affichage de la plage
    if (this.elements.graphRange) {
      this.elements.graphRange.textContent =
        `${Math.round(minFreq)}-${Math.round(maxFreq)} Hz`;
    }

    // Dessiner les lignes de référence (notes)
    this._drawGraphNoteLines(ctx, width, height, minFreq, maxFreq);

    // Dessiner la courbe
    ctx.beginPath();
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-accent').trim() || '#6366f1';
    ctx.lineWidth = 2;

    let started = false;
    for (let i = 0; i < history.length; i++) {
      const freq = history[i];
      const x = (i / (this._maxHistoryLength - 1)) * width;

      if (freq !== null && freq > 0) {
        const y = height - ((freq - minFreq) / (maxFreq - minFreq)) * height;

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }

    ctx.stroke();

    // Point actuel (dernier point)
    const lastFreq = history[history.length - 1];
    if (lastFreq !== null && lastFreq > 0) {
      const x = width;
      const y = height - ((lastFreq - minFreq) / (maxFreq - minFreq)) * height;

      ctx.beginPath();
      ctx.arc(x - 4, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
  }

  /**
   * Dessine les lignes de référence des notes sur le graphe.
   * @param {CanvasRenderingContext2D} ctx - Contexte canvas
   * @param {number} width - Largeur
   * @param {number} height - Hauteur
   * @param {number} minFreq - Fréquence min
   * @param {number} maxFreq - Fréquence max
   * @private
   */
  _drawGraphNoteLines(ctx, width, height, minFreq, maxFreq) {
    const A4 = 440;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-border').trim() || '#333';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    ctx.font = '10px sans-serif';
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-text-muted').trim() || '#666';

    // Dessiner des lignes pour chaque note dans la plage
    for (let semitone = -48; semitone <= 48; semitone++) {
      const freq = A4 * Math.pow(2, semitone / 12);
      if (freq < minFreq || freq > maxFreq) {continue;}

      const y = height - ((freq - minFreq) / (maxFreq - minFreq)) * height;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      // Label de la note (seulement les notes naturelles)
      const noteIndex = ((semitone % 12) + 12 + 9) % 12;
      const noteName = noteNames[noteIndex];
      if (!noteName.includes('#')) {
        const octave = 4 + Math.floor((semitone + 9) / 12);
        const displayNote = this.formatNote(noteName, true, octave);
        ctx.fillText(displayNote, 4, y - 2);
      }
    }

    ctx.setLineDash([]);
  }

  // --------------------------------------------------------------------------
  // Historique des notes
  // --------------------------------------------------------------------------

  /**
   * Ajoute une note à l'historique.
   * @param {Object} noteData - Données de la note
   * @private
   */
  _addToNoteHistory(noteData) {
    const noteName = `${noteData.note}${noteData.octave}`;

    // Ne pas ajouter si c'est la même note que la précédente
    if (noteName === this._lastNoteName) {return;}

    this._lastNoteName = noteName;

    // Ajouter à l'historique
    this._noteHistory.unshift({
      note: noteData.note,
      octave: noteData.octave,
      cents: noteData.cents,
      timestamp: Date.now(),
    });

    // Limiter la taille
    if (this._noteHistory.length > this._maxNoteHistory) {
      this._noteHistory.pop();
    }

    // Mettre à jour l'affichage
    this._updateHistoryDisplay();
  }

  /**
   * Met à jour l'affichage de l'historique des notes.
   * @private
   */
  _updateHistoryDisplay() {
    const container = this.elements.history;
    if (!container) {return;}

    container.innerHTML = this._noteHistory.map(item => {
      let statusClass = 'in-tune';
      if (Math.abs(item.cents) > 5) {
        statusClass = item.cents < 0 ? 'flat' : 'sharp';
      }

      const sign = item.cents > 0 ? '+' : '';
      const displayNote = this.formatNote(item.note);

      return `
        <div class="tuner-history-note ${statusClass}">
          <span class="note-name">${displayNote}</span>
          <span class="note-octave">${item.octave}</span>
          <span class="note-cents">${sign}${item.cents}</span>
        </div>
      `;
    }).join('');
  }

  // --------------------------------------------------------------------------
  // Mise à jour de l'UI
  // --------------------------------------------------------------------------

  /**
   * Met à jour l'affichage principal.
   * @param {Object|null} noteData - Données de la note détectée
   * @param {number} frequency - Fréquence brute
   * @private
   */
  _updateDisplay(noteData, frequency) {
    const { note: noteEl, octave: octaveEl, frequency: freqEl, cents: centsEl, indicator } = this.elements;

    if (!noteData) {
      if (noteEl) {
        noteEl.textContent = '-';
        noteEl.className = 'tuner-note';
      }
      if (octaveEl) {octaveEl.textContent = '';}
      if (freqEl) {freqEl.textContent = '-- Hz';}
      if (centsEl) {centsEl.textContent = '-- cents';}
      if (indicator) {indicator.style.left = '50%';}
      return;
    }

    // Note (avec la notation choisie par l'utilisateur)
    if (noteEl) {
      noteEl.textContent = this.formatNote(noteData.note);
      // Couleur selon justesse
      noteEl.className = 'tuner-note';
      if (Math.abs(noteData.cents) <= 5) {
        noteEl.classList.add('in-tune');
      } else if (noteData.cents < 0) {
        noteEl.classList.add('flat');
      } else {
        noteEl.classList.add('sharp');
      }
    }

    // Octave
    if (octaveEl) {
      octaveEl.textContent = noteData.octave;
    }

    // Fréquence
    if (freqEl) {
      freqEl.textContent = `${frequency.toFixed(1)} Hz`;
    }

    // Cents
    if (centsEl) {
      const sign = noteData.cents > 0 ? '+' : '';
      centsEl.textContent = `${sign}${noteData.cents} cents`;
    }

    // Indicateur
    if (indicator) {
      // Clamp entre -50 et +50 cents
      const clampedCents = Math.max(-50, Math.min(50, noteData.cents));
      const percent = 50 + (clampedCents / 50) * 50;
      indicator.style.left = `${percent}%`;
    }
  }

  /**
   * Met à jour l'UI globale de l'accordeur.
   * @param {boolean} active - Accordeur actif
   * @private
   */
  _updateUI(active) {
    const { toggle: btn, status, liveDot } = this.elements;

    if (btn) {
      btn.classList.toggle('active', active);
      const icon = btn.querySelector('.tuner-btn-icon');
      const text = btn.querySelector('.tuner-btn-text');
      if (icon) {icon.textContent = active ? '⏹' : '🎤';}
      if (text) {text.textContent = active ? 'Arrêter' : 'Activer le micro';}
    }

    if (status) {
      status.textContent = active ? 'Écoute en cours...' : 'Cliquez pour démarrer';
      status.className = 'tuner-status';
      if (active) {status.classList.add('active');}
    }

    // Live indicator
    if (liveDot) {
      liveDot.classList.toggle('active', active);
      if (!active) {
        liveDot.classList.remove('detecting');
      }
    }
  }

  /**
   * Met à jour l'indicateur live.
   * @param {boolean} detecting - Son détecté
   * @private
   */
  _updateLiveIndicator(detecting) {
    const liveDot = this.elements.liveDot;
    if (liveDot) {
      liveDot.classList.toggle('detecting', detecting);
    }
  }

  /**
   * Met à jour le statut.
   * @param {string} message - Message
   * @param {boolean} isError - Est une erreur
   * @private
   */
  _updateStatus(message, isError = false) {
    const status = this.elements.status;
    if (status) {
      status.textContent = message;
      status.className = 'tuner-status';
      if (isError) {status.classList.add('error');}
    }
  }

  // --------------------------------------------------------------------------
  // Nettoyage
  // --------------------------------------------------------------------------

  /**
   * Nettoie les ressources.
   */
  dispose() {
    this.stop();
    super.dispose();
  }
}

export default TunerController;
