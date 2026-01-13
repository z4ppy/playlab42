/**
 * MotorPanel.js - Panneau de contrôle du moteur à photons
 *
 * Permet de contrôler la poussée de l'observateur de référence :
 * - Direction de poussée (X, Y, Z)
 * - Magnitude d'impulsion (masse à brûler)
 * - Boutons +/- pour poussée continue
 * - Affichage de la masse restante
 */

import * as THREE from 'three';
import * as Physics from '../src/Physics.js';

/**
 * Panneau de contrôle moteur pour l'observateur de référence
 */
export class MotorPanel {
  /** @type {HTMLElement} Conteneur principal */
  container;

  /** @type {Function} Callback pour appliquer une poussée */
  onThrust;

  /** @type {object} Configuration actuelle */
  config = {
    directionX: 1,
    directionY: 0,
    directionZ: 0,
    impulseAmount: 10, // kg à brûler par impulsion
  };

  /** @type {boolean} Poussée continue active */
  isBurning = false;

  /** @type {string} Direction de poussée continue ('forward' | 'backward' | null) */
  burnDirection = null;

  /**
   * @param {HTMLElement} container - Conteneur DOM
   * @param {Function} onThrust - Callback (direction: Vector3, deltaMass: number) => void
   */
  constructor(container, onThrust) {
    this.container = container;
    this.onThrust = onThrust;
    this.#createElements();
    this.#setupEventListeners();
  }

  /**
   * Crée la structure HTML du panneau
   */
  #createElements() {
    this.container.innerHTML = `
      <div class="motor-panel-header" data-drag-handle>
        <div class="motor-panel-title">Moteur à photons</div>
        <div class="motor-panel-status" id="motor-status">Prêt</div>
      </div>

      <div class="motor-panel-section">
        <div class="motor-panel-label">Masse restante</div>
        <div class="motor-panel-mass">
          <span class="motor-mass-value" id="motor-mass">1000</span>
          <span class="motor-mass-unit">kg</span>
          <div class="motor-mass-bar">
            <div class="motor-mass-fill" id="motor-mass-fill" style="width: 100%"></div>
          </div>
        </div>
      </div>

      <div class="motor-panel-section">
        <div class="motor-panel-label">Direction de poussée</div>
        <div class="motor-direction-controls">
          <div class="motor-direction-row">
            <label>X:</label>
            <input type="range" id="motor-dir-x" min="-1" max="1" step="0.1" value="1">
            <span id="motor-dir-x-val">1.0</span>
          </div>
          <div class="motor-direction-row">
            <label>Y:</label>
            <input type="range" id="motor-dir-y" min="-1" max="1" step="0.1" value="0">
            <span id="motor-dir-y-val">0.0</span>
          </div>
          <div class="motor-direction-row">
            <label>Z:</label>
            <input type="range" id="motor-dir-z" min="-1" max="1" step="0.1" value="0">
            <span id="motor-dir-z-val">0.0</span>
          </div>
        </div>
        <div class="motor-direction-presets">
          <button class="motor-preset" data-dir="1,0,0" title="Avant (+X)">→</button>
          <button class="motor-preset" data-dir="-1,0,0" title="Arrière (-X)">←</button>
          <button class="motor-preset" data-dir="0,1,0" title="Haut (+Y)">↑</button>
          <button class="motor-preset" data-dir="0,-1,0" title="Bas (-Y)">↓</button>
        </div>
      </div>

      <div class="motor-panel-section">
        <div class="motor-panel-label">Impulsion (kg à brûler)</div>
        <div class="motor-impulse-controls">
          <input type="range" id="motor-impulse" min="1" max="100" step="1" value="10">
          <span id="motor-impulse-val">10 kg</span>
        </div>
        <div class="motor-impulse-info">
          <span>Δv estimé: </span>
          <span id="motor-delta-v">~0.01% c</span>
        </div>
      </div>

      <div class="motor-panel-section">
        <div class="motor-panel-label">Contrôles</div>
        <div class="motor-thrust-controls">
          <button class="motor-thrust-btn motor-thrust-btn--backward" id="motor-backward" title="Freiner">
            ◀◀ Freiner
          </button>
          <button class="motor-thrust-btn motor-thrust-btn--fire" id="motor-fire" title="Impulsion unique">
            🔥 Fire
          </button>
          <button class="motor-thrust-btn motor-thrust-btn--forward" id="motor-forward" title="Accélérer">
            Accélérer ▶▶
          </button>
        </div>
      </div>

      <div class="motor-panel-section motor-panel-section--small">
        <div class="motor-panel-label">Historique</div>
        <div class="motor-history" id="motor-history">
          <div class="motor-history-empty">Aucune impulsion</div>
        </div>
      </div>
    `;
  }

  /**
   * Configure les event listeners
   */
  #setupEventListeners() {
    // Sliders de direction
    ['x', 'y', 'z'].forEach(axis => {
      const slider = this.container.querySelector(`#motor-dir-${axis}`);
      const display = this.container.querySelector(`#motor-dir-${axis}-val`);
      slider.addEventListener('input', () => {
        const value = parseFloat(slider.value);
        this.config[`direction${axis.toUpperCase()}`] = value;
        display.textContent = value.toFixed(1);
        this.#updateDeltaVEstimate();
      });
    });

    // Presets de direction
    this.container.querySelectorAll('.motor-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const [x, y, z] = btn.dataset.dir.split(',').map(Number);
        this.#setDirection(x, y, z);
      });
    });

    // Slider d'impulsion
    const impulseSlider = this.container.querySelector('#motor-impulse');
    const impulseDisplay = this.container.querySelector('#motor-impulse-val');
    impulseSlider.addEventListener('input', () => {
      this.config.impulseAmount = parseInt(impulseSlider.value);
      impulseDisplay.textContent = `${this.config.impulseAmount} kg`;
      this.#updateDeltaVEstimate();
    });

    // Bouton Fire (impulsion unique)
    const fireBtn = this.container.querySelector('#motor-fire');
    fireBtn.addEventListener('click', () => this.#fireImpulse());

    // Boutons poussée continue
    const forwardBtn = this.container.querySelector('#motor-forward');
    const backwardBtn = this.container.querySelector('#motor-backward');

    // Mouse down/up pour poussée continue
    forwardBtn.addEventListener('mousedown', () => this.#startBurn('forward'));
    forwardBtn.addEventListener('mouseup', () => this.#stopBurn());
    forwardBtn.addEventListener('mouseleave', () => this.#stopBurn());

    backwardBtn.addEventListener('mousedown', () => this.#startBurn('backward'));
    backwardBtn.addEventListener('mouseup', () => this.#stopBurn());
    backwardBtn.addEventListener('mouseleave', () => this.#stopBurn());

    // Touch events pour mobile
    forwardBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.#startBurn('forward'); });
    forwardBtn.addEventListener('touchend', () => this.#stopBurn());

    backwardBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.#startBurn('backward'); });
    backwardBtn.addEventListener('touchend', () => this.#stopBurn());
  }

  /**
   * Définit la direction de poussée
   */
  #setDirection(x, y, z) {
    this.config.directionX = x;
    this.config.directionY = y;
    this.config.directionZ = z;

    // Mettre à jour les sliders
    this.container.querySelector('#motor-dir-x').value = x;
    this.container.querySelector('#motor-dir-y').value = y;
    this.container.querySelector('#motor-dir-z').value = z;

    // Mettre à jour les affichages
    this.container.querySelector('#motor-dir-x-val').textContent = x.toFixed(1);
    this.container.querySelector('#motor-dir-y-val').textContent = y.toFixed(1);
    this.container.querySelector('#motor-dir-z-val').textContent = z.toFixed(1);

    this.#updateDeltaVEstimate();
  }

  /**
   * Met à jour l'estimation du delta-v
   */
  #updateDeltaVEstimate() {
    const deltaVEl = this.container.querySelector('#motor-delta-v');
    const massEl = this.container.querySelector('#motor-mass');
    const currentMass = parseFloat(massEl.textContent) || 1000;

    if (this.config.impulseAmount >= currentMass) {
      deltaVEl.textContent = 'Pas assez de masse';
      return;
    }

    const deltaV = Physics.photonRocketDeltaV(currentMass, currentMass - this.config.impulseAmount);
    deltaVEl.textContent = `~${(deltaV * 100).toFixed(3)}% c`;
  }

  /**
   * Exécute une impulsion unique
   */
  #fireImpulse() {
    const direction = new THREE.Vector3(
      this.config.directionX,
      this.config.directionY,
      this.config.directionZ
    );

    if (direction.lengthSq() < 0.01) {
      this.#showStatus('Direction invalide', 'error');
      return;
    }

    direction.normalize();

    if (this.onThrust) {
      this.onThrust(direction, this.config.impulseAmount);
    }

    this.#showStatus('Impulsion !', 'success');
  }

  /**
   * Démarre la poussée continue
   */
  #startBurn(direction) {
    this.isBurning = true;
    this.burnDirection = direction;

    const statusEl = this.container.querySelector('#motor-status');
    statusEl.textContent = direction === 'forward' ? '🔥 Accélération...' : '🔥 Freinage...';
    statusEl.className = 'motor-panel-status motor-panel-status--burning';
  }

  /**
   * Arrête la poussée continue
   */
  #stopBurn() {
    this.isBurning = false;
    this.burnDirection = null;

    const statusEl = this.container.querySelector('#motor-status');
    statusEl.textContent = 'Prêt';
    statusEl.className = 'motor-panel-status';
  }

  /**
   * Appelé à chaque frame pour la poussée continue
   * @returns {{direction: THREE.Vector3, deltaMass: number}|null}
   */
  getContinuousThrust() {
    if (!this.isBurning || !this.burnDirection) return null;

    let direction = new THREE.Vector3(
      this.config.directionX,
      this.config.directionY,
      this.config.directionZ
    );

    if (direction.lengthSq() < 0.01) return null;

    direction.normalize();

    // Inverser pour freinage
    if (this.burnDirection === 'backward') {
      direction.negate();
    }

    // Poussée continue : petite quantité par frame
    const deltaMass = Math.max(0.1, this.config.impulseAmount / 60); // ~60fps

    return { direction, deltaMass };
  }

  /**
   * Affiche un message de status temporaire
   */
  #showStatus(message, type = 'info') {
    const statusEl = this.container.querySelector('#motor-status');
    statusEl.textContent = message;
    statusEl.className = `motor-panel-status motor-panel-status--${type}`;

    setTimeout(() => {
      if (!this.isBurning) {
        statusEl.textContent = 'Prêt';
        statusEl.className = 'motor-panel-status';
      }
    }, 1000);
  }

  /**
   * Met à jour l'affichage avec les données de l'observateur
   * @param {object} observerData - Données de l'observateur de référence
   */
  update(observerData) {
    if (!observerData) return;

    // Masse
    const massEl = this.container.querySelector('#motor-mass');
    const massFillEl = this.container.querySelector('#motor-mass-fill');
    massEl.textContent = observerData.mass.toFixed(0);

    const massPercent = (observerData.mass / observerData.initialMass) * 100;
    massFillEl.style.width = `${massPercent}%`;

    // Couleur de la barre selon la masse restante
    if (massPercent < 20) {
      massFillEl.style.background = 'var(--color-error)';
    } else if (massPercent < 50) {
      massFillEl.style.background = 'var(--color-warning)';
    } else {
      massFillEl.style.background = 'var(--color-success)';
    }

    // Historique
    this.#updateHistory(observerData.accelerationHistory);

    // Mettre à jour l'estimation
    this.#updateDeltaVEstimate();
  }

  /**
   * Met à jour l'historique des impulsions
   */
  #updateHistory(history) {
    const historyEl = this.container.querySelector('#motor-history');

    if (!history || history.length === 0) {
      historyEl.innerHTML = '<div class="motor-history-empty">Aucune impulsion</div>';
      return;
    }

    // Afficher les 5 dernières impulsions
    const recent = history.slice(-5).reverse();
    historyEl.innerHTML = recent.map(h => `
      <div class="motor-history-item">
        <span class="motor-history-tau">τ=${h.tau.toFixed(2)}s</span>
        <span class="motor-history-dv">Δv=${(h.deltaV * 100).toFixed(2)}%c</span>
        <span class="motor-history-mass">-${h.deltaMass.toFixed(1)}kg</span>
      </div>
    `).join('');
  }
}
