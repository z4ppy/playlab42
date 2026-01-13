/**
 * DopplerGraph.js - Visualisation de l'historique des réceptions avec effet Doppler
 *
 * Affiche une timeline des signaux reçus par l'observateur de référence :
 * - Axe horizontal : temps propre τ
 * - Chaque ligne : une source (observateur émetteur)
 * - Points colorés : ticks H/V reçus avec couleur Doppler
 *   - Rouge/orange : redshift (source s'éloigne)
 *   - Vert : neutre
 *   - Bleu/cyan : blueshift (source s'approche)
 */

/**
 * Convertit un facteur Doppler en couleur CSS
 * @param {number} dopplerFactor - Facteur Doppler (>1 = blueshift, <1 = redshift)
 * @returns {string} Couleur CSS
 */
function dopplerToColor(dopplerFactor) {
  // dopplerFactor = 1 : neutre (vert)
  // dopplerFactor > 1 : blueshift (cyan → bleu)
  // dopplerFactor < 1 : redshift (jaune → rouge)

  if (dopplerFactor >= 1) {
    // Blueshift : vert → cyan → bleu
    const t = Math.min(1, (dopplerFactor - 1) * 2);
    const r = Math.round(74 * (1 - t));
    const g = Math.round(222 - t * 100);
    const b = Math.round(128 + t * 127);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Redshift : vert → jaune → orange → rouge
    const t = Math.min(1, (1 - dopplerFactor) * 2);
    const r = Math.round(74 + t * 181);
    const g = Math.round(222 - t * 150);
    const b = Math.round(128 * (1 - t));
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/**
 * Panneau de visualisation Doppler
 */
export class DopplerGraph {
  /** @type {HTMLElement} Conteneur principal */
  container;

  /** @type {HTMLCanvasElement} Canvas pour le graphique */
  canvas;

  /** @type {CanvasRenderingContext2D} Contexte 2D */
  ctx;

  /** @type {number} Largeur du canvas */
  width = 0;

  /** @type {number} Hauteur du canvas */
  height = 0;

  /** @type {number} Fenêtre temporelle à afficher (en secondes de temps propre) */
  timeWindow = 10;

  /** @type {string} Mode de fenêtre temporelle */
  timeWindowMode = 'auto'; // 'auto', '10s', '1m', '10m', '1h'

  /** @type {Map<string, {name: string, color: string}>} Info sur les sources */
  sourceInfo = new Map();

  /**
   * @param {HTMLElement} container - Conteneur DOM
   */
  constructor(container) {
    this.container = container;
    this.#createElements();
    this.#setupResizeObserver();
  }

  /**
   * Crée la structure HTML
   */
  #createElements() {
    this.container.innerHTML = `
      <div class="doppler-graph-header" data-drag-handle>
        <div class="doppler-graph-title">Réceptions Doppler</div>
        <select class="doppler-graph-timewindow" id="doppler-timewindow">
          <option value="auto">Auto</option>
          <option value="10">10s</option>
          <option value="60">1min</option>
          <option value="600">10min</option>
          <option value="3600">1h</option>
        </select>
      </div>
      <div class="doppler-graph-legend">
        <span class="doppler-legend-item doppler-legend--red">Redshift</span>
        <span class="doppler-legend-item doppler-legend--green">Neutre</span>
        <span class="doppler-legend-item doppler-legend--blue">Blueshift</span>
      </div>
      <div class="doppler-graph-canvas-wrapper">
        <canvas class="doppler-graph-canvas"></canvas>
      </div>
    `;

    this.canvas = this.container.querySelector('.doppler-graph-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Event listener pour le sélecteur de fenêtre temporelle
    const select = this.container.querySelector('#doppler-timewindow');
    select.addEventListener('change', (e) => {
      this.timeWindowMode = e.target.value;
      if (this.timeWindowMode !== 'auto') {
        this.timeWindow = parseInt(this.timeWindowMode);
      }
    });

    this.#resize();
  }

  /**
   * Configure l'observation du redimensionnement
   */
  #setupResizeObserver() {
    const resizeObserver = new ResizeObserver(() => {
      this.#resize();
    });
    resizeObserver.observe(this.container);
  }

  /**
   * Redimensionne le canvas
   */
  #resize() {
    const wrapper = this.container.querySelector('.doppler-graph-canvas-wrapper');
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.scale(dpr, dpr);
  }

  /**
   * Met à jour le graphique avec les données de l'observateur
   * @param {object} displayData - Données de getDisplayData()
   * @param {object[]} allObservers - Tous les observateurs
   */
  update(displayData, allObservers) {
    // Trouver l'observateur de référence
    const me = allObservers.find(o => o.id === displayData.referenceId);
    if (!me) return;

    // Mettre à jour les infos des sources
    this.sourceInfo.clear();
    for (const obs of allObservers) {
      if (obs.id !== me.id) {
        this.sourceInfo.set(obs.id, {
          name: obs.name,
          color: `#${(obs.color || 0x4fc3f7).toString(16).padStart(6, '0')}`,
        });
      }
    }

    // Auto-adapter la fenêtre temporelle
    if (this.timeWindowMode === 'auto') {
      this.#autoAdjustTimeWindow(me.properTime);
    }

    // Dessiner le graphique
    this.#draw(me, displayData.referenceId);
  }

  /**
   * Ajuste automatiquement la fenêtre temporelle
   * @param {number} currentTau - Temps propre actuel
   */
  #autoAdjustTimeWindow(currentTau) {
    // Adapter la fenêtre selon la durée de simulation
    if (currentTau < 30) {
      this.timeWindow = 10; // 10 secondes
    } else if (currentTau < 180) {
      this.timeWindow = 30; // 30 secondes
    } else if (currentTau < 600) {
      this.timeWindow = 60; // 1 minute
    } else if (currentTau < 3600) {
      this.timeWindow = 300; // 5 minutes
    } else if (currentTau < 86400) {
      this.timeWindow = 1800; // 30 minutes
    } else {
      this.timeWindow = 7200; // 2 heures
    }
  }

  /**
   * Dessine le graphique
   * @param {object} me - Données de l'observateur de référence
   * @param {string} referenceId - ID de référence
   */
  #draw(me, referenceId) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Effacer
    ctx.clearRect(0, 0, w, h);

    // Fond
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, w, h);

    const receptionHistory = me.receptionHistory || [];
    if (receptionHistory.length === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('En attente de réceptions...', w / 2, h / 2);
      return;
    }

    // Calculer la plage de temps
    const currentTau = me.properTime;
    const tauMin = Math.max(0, currentTau - this.timeWindow);
    const tauMax = currentTau;

    // Marges
    const marginLeft = 60;
    const marginRight = 10;
    const marginTop = 10;
    const marginBottom = 25;
    const graphW = w - marginLeft - marginRight;
    const graphH = h - marginTop - marginBottom;

    // Obtenir les sources uniques
    const sources = [...this.sourceInfo.keys()];
    if (sources.length === 0) return;

    const rowHeight = graphH / sources.length;

    // Dessiner les noms des sources à gauche
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < sources.length; i++) {
      const sourceId = sources[i];
      const info = this.sourceInfo.get(sourceId);
      const y = marginTop + i * rowHeight + rowHeight / 2;

      // Ligne de fond pour cette source
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(marginLeft, marginTop + i * rowHeight, graphW, rowHeight);

      // Nom
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(info?.name || sourceId, marginLeft - 5, y);
    }

    // Dessiner l'axe du temps
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginLeft, h - marginBottom);
    ctx.lineTo(w - marginRight, h - marginBottom);
    ctx.stroke();

    // Graduation du temps
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const timeRange = tauMax - tauMin;
    const numTicks = 5;
    for (let i = 0; i <= numTicks; i++) {
      const tau = tauMin + (timeRange * i) / numTicks;
      const x = marginLeft + (graphW * i) / numTicks;

      ctx.beginPath();
      ctx.moveTo(x, h - marginBottom);
      ctx.lineTo(x, h - marginBottom + 3);
      ctx.stroke();

      ctx.fillText(this.#formatTime(tau), x, h - marginBottom + 5);
    }

    // Dessiner les réceptions
    for (const event of receptionHistory) {
      // Vérifier si dans la fenêtre de temps
      if (event.tau < tauMin || event.tau > tauMax) continue;

      // Trouver l'index de la source
      const sourceIndex = sources.indexOf(event.sourceId);
      if (sourceIndex === -1) continue;

      // Position
      const x = marginLeft + ((event.tau - tauMin) / timeRange) * graphW;
      const y = marginTop + sourceIndex * rowHeight + rowHeight / 2;

      // Couleur Doppler
      const color = dopplerToColor(event.dopplerFactor);

      if (event.aggregated) {
        // Événement agrégé : dessiner une barre
        const barWidth = Math.max(2, (event.bucketSize / timeRange) * graphW);
        const barHeight = Math.min(rowHeight - 4, event.tickNumber * 2);

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(x - barWidth / 2, y - barHeight / 2, barWidth, barHeight);
        ctx.globalAlpha = 1;

        // Bordure
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - barWidth / 2, y - barHeight / 2, barWidth, barHeight);
      } else {
        // Événement simple : dessiner un point
        // Décalage vertical selon le type d'horloge
        const yOffset = event.clockType === 'H' ? -4 : 4;

        ctx.beginPath();
        ctx.arc(x, y + yOffset, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Contour selon le type d'horloge
        ctx.strokeStyle = event.clockType === 'H' ? 'rgba(255, 107, 107, 0.8)' : 'rgba(74, 222, 128, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Ligne "maintenant"
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    const nowX = marginLeft + graphW;
    ctx.moveTo(nowX, marginTop);
    ctx.lineTo(nowX, h - marginBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label "maintenant"
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('τ', nowX - 3, marginTop + 5);
  }

  /**
   * Définit la fenêtre temporelle
   * @param {number} seconds
   */
  setTimeWindow(seconds) {
    this.timeWindow = Math.max(1, seconds);
  }

  /**
   * Formate un temps pour l'affichage
   * @param {number} seconds - Temps en secondes
   * @returns {string} Temps formaté
   */
  #formatTime(seconds) {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    } else if (seconds < 3600) {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}m${s}s`;
    } else if (seconds < 86400) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return `${h}h${m}m`;
    } else {
      const d = Math.floor(seconds / 86400);
      const h = Math.floor((seconds % 86400) / 3600);
      return `${d}j${h}h`;
    }
  }
}
