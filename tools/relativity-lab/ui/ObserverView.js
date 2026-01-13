/**
 * ObserverView.js - Vue cockpit depuis l'observateur de référence
 *
 * Affiche ce que "voit" l'observateur sélectionné :
 * - Ses propres horloges H et V (temps propre)
 * - Les horloges reçues des autres observateurs
 */

/**
 * Panneau de vue cockpit pour l'observateur de référence
 */
export class ObserverView {
  /** @type {HTMLElement} Conteneur principal */
  container;

  /** @type {string|null} ID de l'observateur affiché */
  currentObserverId = null;

  /**
   * @param {HTMLElement} container - Conteneur DOM pour la vue
   */
  constructor(container) {
    this.container = container;
    this.#createElements();
  }

  /**
   * Crée la structure HTML initiale
   */
  #createElements() {
    this.container.innerHTML = `
      <div class="observer-view-header" data-drag-handle>
        <div class="observer-view-title">Vue depuis</div>
        <div class="observer-view-name" id="ov-name">—</div>
      </div>

      <div class="observer-view-section">
        <div class="observer-view-label">Mon temps propre</div>
        <div class="observer-view-tau" id="ov-tau">τ = 0.00 s</div>
      </div>

      <div class="observer-view-section">
        <div class="observer-view-label">Mes horloges</div>
        <div class="observer-view-clocks" id="ov-my-clocks">
          <div class="ov-clock ov-clock--h">
            <div class="ov-clock-icon">H</div>
            <div class="ov-clock-value" id="ov-my-h">0</div>
          </div>
          <div class="ov-clock ov-clock--v">
            <div class="ov-clock-icon">V</div>
            <div class="ov-clock-value" id="ov-my-v">0</div>
          </div>
        </div>
      </div>

      <div class="observer-view-divider"></div>

      <div class="observer-view-section">
        <div class="observer-view-label">Horloges reçues</div>
        <div class="observer-view-received" id="ov-received">
          <div class="ov-no-data">Aucun signal reçu</div>
        </div>
      </div>
    `;
  }

  /**
   * Met à jour l'affichage avec les données de l'observateur de référence
   * @param {object} data - Données de getDisplayData() de la simulation
   * @param {Array} allObservers - Liste de tous les observateurs
   */
  update(data, allObservers) {
    if (!data.referenceId) return;

    // Trouver l'observateur de référence
    const refObserver = allObservers.find(o => o.id === data.referenceId);
    if (!refObserver) return;

    this.currentObserverId = refObserver.id;

    // Nom de l'observateur
    const nameEl = this.container.querySelector('#ov-name');
    nameEl.textContent = refObserver.name;

    // Temps propre
    const tauEl = this.container.querySelector('#ov-tau');
    tauEl.textContent = `τ = ${refObserver.properTime.toFixed(2)} s`;

    // Mes horloges
    const myHEl = this.container.querySelector('#ov-my-h');
    const myVEl = this.container.querySelector('#ov-my-v');
    myHEl.textContent = refObserver.clockH;
    myVEl.textContent = refObserver.clockV;

    // Horloges reçues
    this.#updateReceivedClocks(refObserver, allObservers);
  }

  /**
   * Met à jour l'affichage des horloges reçues
   * @param {object} refObserver - Données de l'observateur de référence
   * @param {Array} allObservers - Liste de tous les observateurs
   */
  #updateReceivedClocks(refObserver, allObservers) {
    const receivedEl = this.container.querySelector('#ov-received');
    const receivedTicks = refObserver.receivedTicks || {};

    // Filtrer les autres observateurs (pas soi-même)
    const otherObservers = allObservers.filter(o => o.id !== refObserver.id);

    if (otherObservers.length === 0) {
      receivedEl.innerHTML = '<div class="ov-no-data">Aucun autre observateur</div>';
      return;
    }

    receivedEl.innerHTML = otherObservers.map(obs => {
      const ticks = receivedTicks[obs.id] || { H: 0, V: 0 };
      const hasReceived = ticks.H > 0 || ticks.V > 0;

      return `
        <div class="ov-received-observer ${hasReceived ? '' : 'ov-received-observer--empty'}">
          <div class="ov-received-name">${this.#escapeHtml(obs.name)}</div>
          <div class="ov-received-clocks">
            <div class="ov-clock ov-clock--h ov-clock--small">
              <span class="ov-clock-icon">H</span>
              <span class="ov-clock-value">${ticks.H}</span>
            </div>
            <div class="ov-clock ov-clock--v ov-clock--small">
              <span class="ov-clock-icon">V</span>
              <span class="ov-clock-value">${ticks.V}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Échappe le HTML pour éviter les injections XSS
   * @param {string} str
   * @returns {string}
   */
  #escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

/**
 * Retourne les styles CSS pour ObserverView
 * @returns {string}
 */
export function getObserverViewStyles() {
  return `
    .observer-view {
      position: absolute;
      top: var(--space-md);
      right: var(--space-md);
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: var(--space-md);
      min-width: 220px;
      max-width: 280px;
      font-family: var(--font-family);
      font-size: var(--font-size-sm);
      color: var(--color-text);
      z-index: 100;
      box-shadow: 0 4px 12px var(--color-shadow);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .observer-view-header {
      display: flex;
      align-items: baseline;
      gap: var(--space-xs);
      margin-bottom: var(--space-sm);
    }

    .observer-view-title {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .observer-view-name {
      font-size: var(--font-size-lg);
      font-weight: bold;
      color: var(--color-accent);
    }

    .observer-view-section {
      margin-bottom: var(--space-sm);
    }

    .observer-view-label {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }

    .observer-view-tau {
      font-family: var(--font-mono);
      font-size: var(--font-size-xl);
      font-weight: bold;
    }

    .observer-view-clocks {
      display: flex;
      gap: var(--space-md);
    }

    .observer-view-divider {
      height: 1px;
      background: var(--color-border);
      margin: var(--space-sm) 0;
    }

    .observer-view-received {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }

    /* Horloge individuelle */
    .ov-clock {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      font-family: var(--font-mono);
    }

    .ov-clock--h {
      background: rgba(255, 107, 107, 0.15);
      border: 1px solid rgba(255, 107, 107, 0.3);
    }

    .ov-clock--v {
      background: rgba(74, 222, 128, 0.15);
      border: 1px solid rgba(74, 222, 128, 0.3);
    }

    .ov-clock-icon {
      font-weight: bold;
      font-size: var(--font-size-sm);
    }

    .ov-clock--h .ov-clock-icon {
      color: #ff6b6b;
    }

    .ov-clock--v .ov-clock-icon {
      color: #4ade80;
    }

    .ov-clock-value {
      font-size: var(--font-size-lg);
      font-weight: 600;
    }

    .ov-clock--small {
      padding: 3px 8px;
    }

    .ov-clock--small .ov-clock-icon {
      font-size: var(--font-size-xs);
    }

    .ov-clock--small .ov-clock-value {
      font-size: var(--font-size-sm);
    }

    /* Observateur reçu */
    .ov-received-observer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-xs) var(--space-sm);
      background: var(--color-bg);
      border-radius: var(--radius-sm);
    }

    .ov-received-observer--empty {
      opacity: 0.5;
    }

    .ov-received-name {
      font-weight: 600;
      font-size: var(--font-size-sm);
    }

    .ov-received-clocks {
      display: flex;
      gap: var(--space-xs);
    }

    .ov-no-data {
      font-style: italic;
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
    }
  `;
}
