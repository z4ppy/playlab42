/**
 * TunerController - Contrôleur de l'accordeur chromatique
 *
 * Gère l'analyse audio du microphone et l'affichage de la note détectée.
 *
 * @module controllers/TunerController
 */

import EventEmitter from '../utils/EventEmitter.js';
import { hidePanel, isPanelVisible, showPanel } from './panel-visibility.js';
import { detectPitch } from './tuner-pitch.js';

/** Classe CSS de justesse selon l'écart en cents. */
function tuningClass(cents) {
  if (Math.abs(cents) <= 5) {return 'in-tune';}
  return cents < 0 ? 'flat' : 'sharp';
}

/** Valeur d'une variable CSS du document, avec repli. */
function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function isAudibleFrequency(freq) {
  return freq !== null && freq > 0;
}

function frequencyToY(freq, { height, minFreq, maxFreq }) {
  return height - ((freq - minFreq) / (maxFreq - minFreq)) * height;
}

/** Point sur la dernière fréquence, à droite du graphe. */
function drawCurrentPoint(ctx, lastFreq, scale) {
  if (!isAudibleFrequency(lastFreq)) {return;}
  ctx.beginPath();
  ctx.arc(scale.width - 4, frequencyToY(lastFreq, scale), 4, 0, Math.PI * 2);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}


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

    /** @type {Object|null} Jeton de la demande de démarrage en cours */
    this._startRequest = null;

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
    // Jeton : un stop() ou un nouveau start() pendant l'attente annule cette demande
    const request = {};
    this._startRequest = request;
    try {
      // Demander l'accès au micro
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this._startRequest !== request) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this._stream = stream;
      this._openAnalyser(stream);
      this._beginListening();
    } catch (error) {
      if (this._startRequest !== request) {return;}
      this._releaseAudioResources();
      console.error('Erreur accès micro:', error);
      this._updateStatus('Accès micro refusé', true);
      this.emit('error', error);
    }
  }

  /**
   * Crée le contexte audio et l'analyseur branchés sur le micro.
   * @param {MediaStream} stream - Flux du micro
   * @private
   */
  _openAnalyser(stream) {
    this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this._analyser = this._audioContext.createAnalyser();
    this._analyser.fftSize = 4096;

    const source = this._audioContext.createMediaStreamSource(stream);
    source.connect(this._analyser);
  }

  /**
   * Passe en écoute : état, UI, boucle d'analyse.
   * @private
   */
  _beginListening() {
    this._active = true;
    this._buffer = new Float32Array(this._analyser.fftSize);

    // Réinitialiser les historiques
    this._frequencyHistory = [];
    this._noteHistory = [];
    this._lastNoteName = null;

    this._initGraph();
    this._updateUI(true);
    this._loop();
    this.emit('started');
  }

  /**
   * Libère le flux du micro et le contexte audio.
   * @private
   */
  _releaseAudioResources() {
    this._active = false;

    if (this._stream) {
      this._stream.getTracks().forEach(track => track.stop());
      this._stream = null;
    }

    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }
  }

  /**
   * Arrête l'accordeur.
   */
  stop() {
    this._startRequest = null;
    this._releaseAudioResources();

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
    return detectPitch(buffer, sampleRate);
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
    const { width, height } = canvas.getBoundingClientRect();

    // Effacer puis fond
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = cssVar('--color-bg-secondary', '#1a1a2e');
    ctx.fillRect(0, 0, width, height);

    const history = this._frequencyHistory;
    if (history.length < 2) {return;}

    const validFreqs = history.filter(isAudibleFrequency);
    if (validFreqs.length === 0) {return;}

    const minFreq = Math.min(...validFreqs) * 0.9;
    const maxFreq = Math.max(...validFreqs) * 1.1;

    if (this.elements.graphRange) {
      this.elements.graphRange.textContent =
        `${Math.round(minFreq)}-${Math.round(maxFreq)} Hz`;
    }

    this._drawGraphNoteLines(ctx, width, height, minFreq, maxFreq);

    const scale = { width, height, minFreq, maxFreq };
    this._drawGraphCurve(ctx, history, scale);
    drawCurrentPoint(ctx, history[history.length - 1], scale);
  }

  /**
   * Trace la courbe de fréquence ; les trous (null/0) sont sautés.
   * @param {CanvasRenderingContext2D} ctx - Contexte canvas
   * @param {Array<number|null>} history - Historique des fréquences
   * @param {Object} scale - {width, height, minFreq, maxFreq}
   * @private
   */
  _drawGraphCurve(ctx, history, scale) {
    ctx.beginPath();
    ctx.strokeStyle = cssVar('--color-accent', '#6366f1');
    ctx.lineWidth = 2;

    let started = false;
    history.forEach((freq, i) => {
      if (!isAudibleFrequency(freq)) {return;}
      const x = (i / (this._maxHistoryLength - 1)) * scale.width;
      const y = frequencyToY(freq, scale);
      if (started) {
        ctx.lineTo(x, y);
      } else {
        ctx.moveTo(x, y);
        started = true;
      }
    });

    ctx.stroke();
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
    if (!noteData) {
      this._resetDisplay();
      return;
    }
    this._renderNote(noteData);
    this._renderReadings(noteData, frequency);
  }

  /**
   * Affiche l'état "aucune note détectée".
   * @private
   */
  _resetDisplay() {
    const { note: noteEl, octave: octaveEl, frequency: freqEl, cents: centsEl, indicator } = this.elements;
    if (noteEl) {
      noteEl.textContent = '-';
      noteEl.className = 'tuner-note';
    }
    if (octaveEl) {octaveEl.textContent = '';}
    if (freqEl) {freqEl.textContent = '-- Hz';}
    if (centsEl) {centsEl.textContent = '-- cents';}
    if (indicator) {indicator.style.left = '50%';}
  }

  /**
   * Affiche la note (notation choisie) colorée selon la justesse.
   * @param {Object} noteData - Données de la note détectée
   * @private
   */
  _renderNote(noteData) {
    const noteEl = this.elements.note;
    if (!noteEl) {return;}
    noteEl.textContent = this.formatNote(noteData.note);
    noteEl.className = 'tuner-note';
    noteEl.classList.add(tuningClass(noteData.cents));
  }

  /**
   * Affiche octave, fréquence, cents et position de l'indicateur.
   * @param {Object} noteData - Données de la note détectée
   * @param {number} frequency - Fréquence brute
   * @private
   */
  _renderReadings(noteData, frequency) {
    const { octave: octaveEl, frequency: freqEl, cents: centsEl, indicator } = this.elements;
    if (octaveEl) {octaveEl.textContent = noteData.octave;}
    if (freqEl) {freqEl.textContent = `${frequency.toFixed(1)} Hz`;}
    if (centsEl) {
      const sign = noteData.cents > 0 ? '+' : '';
      centsEl.textContent = `${sign}${noteData.cents} cents`;
    }
    if (indicator) {
      // Clamp entre -50 et +50 cents
      const clampedCents = Math.max(-50, Math.min(50, noteData.cents));
      indicator.style.left = `${50 + (clampedCents / 50) * 50}%`;
    }
  }

  /**
   * Met à jour l'UI globale de l'accordeur.
   * @param {boolean} active - Accordeur actif
   * @private
   */
  _updateUI(active) {
    this._updateToggleButton(active);
    this._updateStatusLine(active);

    const liveDot = this.elements.liveDot;
    if (liveDot) {
      liveDot.classList.toggle('active', active);
      if (!active) {liveDot.classList.remove('detecting');}
    }
  }

  /**
   * Met à jour le bouton d'activation du micro.
   * @param {boolean} active - Accordeur actif
   * @private
   */
  _updateToggleButton(active) {
    const btn = this.elements.toggle;
    if (!btn) {return;}
    btn.classList.toggle('active', active);
    const icon = btn.querySelector('.tuner-btn-icon');
    const text = btn.querySelector('.tuner-btn-text');
    if (icon) {icon.textContent = active ? '⏹' : '🎤';}
    if (text) {text.textContent = active ? 'Arrêter' : 'Activer le micro';}
  }

  /**
   * Met à jour la ligne de statut.
   * @param {boolean} active - Accordeur actif
   * @private
   */
  _updateStatusLine(active) {
    const status = this.elements.status;
    if (!status) {return;}
    status.textContent = active ? 'Écoute en cours...' : 'Cliquez pour démarrer';
    status.className = 'tuner-status';
    if (active) {status.classList.add('active');}
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
