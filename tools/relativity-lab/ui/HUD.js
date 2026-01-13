/**
 * HUD.js - Vue depuis l'observateur de référence (version compacte)
 *
 * Affiche uniquement ce que l'observateur SAIT :
 * - Son temps propre τ
 * - Ce qu'il a reçu de chaque autre observateur (ticks H/V)
 */

/**
 * Gestionnaire du HUD
 */
export class HUD {
  /** @type {HTMLElement} */
  container;

  /** @type {Function} Callback pour changer de référentiel */
  onReferenceChange = null;

  /**
   * @param {HTMLElement} container
   * @param {Function} onReferenceChange - (observerId) => void
   */
  constructor(container, onReferenceChange = null) {
    this.container = container;
    this.onReferenceChange = onReferenceChange;
    this.#createElements();
  }

  #createElements() {
    this.container.innerHTML = `
      <div class="panel-header" data-drag-handle>
        <span class="panel-title">Mon Référentiel</span>
        <div class="hud-state" id="hud-state">⏸ Pause</div>
      </div>

      <div class="hud-section">
        <div class="hud-label">Point de vue</div>
        <select id="hud-ref-select" class="hud-select"></select>
      </div>

      <div class="hud-divider"></div>

      <div class="hud-section">
        <div class="hud-label">Je suis</div>
        <div class="hud-my-name" id="hud-my-name">—</div>
      </div>

      <div class="hud-section hud-row">
        <div>
          <div class="hud-label">Temps propre</div>
          <div class="hud-my-tau" id="hud-my-tau">τ = 0.00 s</div>
        </div>
        <div>
          <div class="hud-label">Vitesse CMB</div>
          <div class="hud-my-cmb" id="hud-my-cmb">0% c</div>
        </div>
      </div>

      <div class="hud-section">
        <div class="hud-label">Masse</div>
        <div class="hud-my-mass" id="hud-my-mass">1000 kg</div>
      </div>

      <div class="hud-divider"></div>

      <div class="hud-section">
        <div class="hud-label">Ce que j'ai reçu</div>
        <div id="hud-received" class="hud-received-list"></div>
      </div>

      <div class="hud-help">
        <div>Espace : Play/Pause | R : Reset</div>
      </div>
    `;

    // Event listener pour le select
    const select = this.container.querySelector('#hud-ref-select');
    select.addEventListener('change', (e) => {
      if (this.onReferenceChange) {
        this.onReferenceChange(e.target.value);
      }
    });
  }

  /**
   * Met à jour l'affichage
   * @param {object} data - Données de getDisplayData()
   */
  update(data) {
    // État play/pause
    const stateEl = this.container.querySelector('#hud-state');
    const isRunning = data.state === 'running';
    stateEl.textContent = isRunning ? '▶ Running' : '⏸ Pause';
    stateEl.className = `hud-state ${isRunning ? 'hud-state--running' : ''}`;

    // Mettre à jour le select
    this.#updateSelect(data.observers, data.referenceId);

    // Trouver MOI (l'observateur de référence)
    const me = data.observers.find(o => o.id === data.referenceId);
    if (!me) return;

    // Mon nom
    this.container.querySelector('#hud-my-name').textContent = me.name;

    // Mon temps propre
    this.container.querySelector('#hud-my-tau').textContent = `τ = ${me.properTime.toFixed(2)} s`;

    // Ma vitesse CMB
    const vCMB = me.vCMB || 0;
    this.container.querySelector('#hud-my-cmb').textContent = `${(vCMB * 100).toFixed(1)}% c`;

    // Ma masse
    const mass = me.mass || 1000;
    const massDisplay = mass >= 1000 ? `${(mass / 1000).toFixed(2)} T` : `${mass.toFixed(0)} kg`;
    this.container.querySelector('#hud-my-mass').textContent = massDisplay;

    // Ce que j'ai reçu de chaque autre observateur
    this.#updateReceived(me, data.observers);
  }

  /**
   * Met à jour le select des observateurs
   */
  #updateSelect(observers, currentId) {
    const select = this.container.querySelector('#hud-ref-select');

    // Ne reconstruire que si nécessaire
    if (select.options.length !== observers.length) {
      select.innerHTML = observers.map(o =>
        `<option value="${o.id}">${this.#escapeHtml(o.name)}</option>`
      ).join('');
    }

    // Mettre à jour la valeur sélectionnée
    if (select.value !== currentId) {
      select.value = currentId;
    }
  }

  /**
   * Met à jour l'affichage de ce que j'ai reçu (version compacte)
   */
  #updateReceived(me, allObservers) {
    const container = this.container.querySelector('#hud-received');
    const others = allObservers.filter(o => o.id !== me.id);

    if (others.length === 0) {
      container.innerHTML = '<div class="hud-no-received">Aucun autre observateur</div>';
      return;
    }

    const receivedTicks = me.receivedTicks || {};
    const pingTracker = me.pingTracker || {};

    container.innerHTML = others.map(other => {
      const ticks = receivedTicks[other.id] || { H: 0, V: 0 };
      const ping = pingTracker[other.id];

      // Distance estimée
      let distanceStr = '—';
      if (ping && ping.estimatedDistance > 0) {
        const dist = ping.estimatedDistance;
        if (dist < 60) {
          distanceStr = `${dist.toFixed(1)} ls`;
        } else if (dist < 3600) {
          distanceStr = `${(dist / 60).toFixed(1)} lm`;
        } else {
          distanceStr = `${(dist / 3600).toFixed(2)} lh`;
        }
      }

      // Gamma inféré
      let gammaStr = '';
      if (ping && ping.inferredGamma > 1.001) {
        gammaStr = `<span class="hud-inferred-gamma">γ=${ping.inferredGamma.toFixed(2)}</span>`;
      }

      return `
        <div class="hud-received-item">
          <span class="hud-received-name">${this.#escapeHtml(other.name)}</span>
          <span class="hud-received-ticks">
            <span class="hud-tick hud-tick--h">H:${ticks.H}</span>
            <span class="hud-tick hud-tick--v">V:${ticks.V}</span>
          </span>
          <span class="hud-received-distance">${distanceStr}</span>
          ${gammaStr}
        </div>
      `;
    }).join('');
  }

  #escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  dispose() {
    // Rien à nettoyer
  }
}
