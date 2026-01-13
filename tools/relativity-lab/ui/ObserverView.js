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
    if (!data.referenceId) {return;}

    // Trouver l'observateur de référence
    const refObserver = allObservers.find(o => o.id === data.referenceId);
    if (!refObserver) {return;}

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
