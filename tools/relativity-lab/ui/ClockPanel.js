/**
 * ClockPanel.js - Oscilloscope des horloges lumineuses
 *
 * Affiche l'évolution temporelle des horloges H et V de chaque observateur.
 * La dilatation du temps est visible par la différence de fréquence.
 */

/**
 * Panneau oscilloscope des horloges
 */
export class ClockPanel {
  /** @type {HTMLElement} */
  container;

  /** @type {CanvasRenderingContext2D} */
  ctx;

  /** @type {HTMLCanvasElement} */
  canvas;

  /** @type {number} ID de l'animation frame */
  animationId = null;

  /** @type {object} Données actuelles */
  currentData = null;

  /** @type {boolean} Panneau visible */
  visible = true;

  /** @type {Map<string, Array>} Historique des phases par observateur */
  phaseHistory = new Map();

  /** @type {number} Nombre de points dans l'historique */
  historyLength = 3000; // ~50 secondes à 60fps

  /** @type {number} Fenêtre temporelle affichée (secondes de temps propre du ref) */
  timeWindow = 30;

  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this.container = container;
    this.#createElements();
    this.#startAnimation();
  }

  #createElements() {
    this.container.innerHTML = `
      <div class="panel-header" data-drag-handle>
        <span class="panel-title">Oscilloscope</span>
        <div class="oscillo-controls">
          <select id="oscillo-timewindow" class="oscillo-select" title="Fenêtre temporelle">
            <option value="10">10s</option>
            <option value="30" selected>30s</option>
            <option value="60">1min</option>
            <option value="120">2min</option>
          </select>
          <button class="panel-close" title="Masquer">&times;</button>
        </div>
      </div>
      <div class="oscillo-hint">Phase des horloges H/V dans le temps</div>
      <div class="oscillo-canvas-wrapper">
        <canvas id="oscillo-canvas"></canvas>
      </div>
      <div class="oscillo-legend" id="oscillo-legend"></div>
    `;

    this.canvas = this.container.querySelector('#oscillo-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Redimensionner le canvas
    this.#resizeCanvas();
    window.addEventListener('resize', () => this.#resizeCanvas());

    // Bouton fermer
    this.container.querySelector('.panel-close').addEventListener('click', () => {
      this.hide();
    });

    // Sélecteur de fenêtre temporelle
    this.container.querySelector('#oscillo-timewindow').addEventListener('change', (e) => {
      this.timeWindow = parseInt(e.target.value);
    });
  }

  #resizeCanvas() {
    const wrapper = this.container.querySelector('.oscillo-canvas-wrapper');
    if (!wrapper) {return;}

    // Forcer un reflow pour obtenir les bonnes dimensions
    const rect = wrapper.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {return;}

    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    this.ctx.scale(dpr, dpr);
  }

  /**
   * Met à jour les données
   * @param {object} data - Données de getDisplayData()
   */
  update(data) {
    const isFirstUpdate = !this.currentData;
    this.currentData = data;
    this.#recordPhases(data);
    this.#updateLegend(data);

    // Resize au premier update pour s'assurer que le canvas a la bonne taille
    if (isFirstUpdate) {
      requestAnimationFrame(() => this.#resizeCanvas());
    }
  }

  /**
   * Enregistre les phases actuelles dans l'historique
   */
  #recordPhases(data) {
    const me = data.observers.find(o => o.id === data.referenceId);
    if (!me) {return;}

    const refTime = me.properTime;

    for (const obs of data.observers) {
      if (!this.phaseHistory.has(obs.id)) {
        this.phaseHistory.set(obs.id, []);
      }

      const history = this.phaseHistory.get(obs.id);

      // Calculer la phase (0-1) basée sur le temps propre
      const period = obs.clockPeriod || 10; // T₀ = 2L/c
      const phaseH = (obs.properTime % period) / period;
      const phaseV = ((obs.properTime + period / 4) % period) / period; // Décalé de 90°

      history.push({
        refTime,
        phaseH,
        phaseV,
        properTime: obs.properTime,
      });

      // Garder seulement les points récents
      while (history.length > this.historyLength) {
        history.shift();
      }
    }
  }

  /**
   * Met à jour la légende
   */
  #updateLegend(data) {
    const legend = this.container.querySelector('#oscillo-legend');
    if (!legend || !data.observers) {return;}

    legend.innerHTML = data.observers.map((obs, i) => {
      const color = this.#getObserverColor(i);
      const isRef = obs.id === data.referenceId;
      return `
        <span class="oscillo-legend-item" style="border-color: ${color}">
          <span class="oscillo-legend-color" style="background: ${color}"></span>
          ${obs.name}${isRef ? ' (ref)' : ''}
        </span>
      `;
    }).join('');
  }

  /**
   * Démarre l'animation
   */
  #startAnimation() {
    const animate = () => {
      if (this.visible && this.currentData) {
        this.#draw();
      }
      this.animationId = requestAnimationFrame(animate);
    };
    animate();
  }

  /**
   * Dessine l'oscilloscope
   */
  #draw() {
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    // Trouver le temps de référence actuel
    const me = this.currentData.observers.find(o => o.id === this.currentData.referenceId);
    if (!me) {return;}

    const currentRefTime = me.properTime;
    // Échelle temporelle FIXE : timeWindow secondes = largeur totale
    // Les traces apparaissent depuis la droite et scrollent vers la gauche
    const endTime = currentRefTime;
    const startTime = currentRefTime - this.timeWindow;

    // Effacer
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    this.ctx.fillRect(0, 0, w, h);

    // Grille avec labels temporels (échelle fixe)
    this.#drawGrid(w, h, startTime, endTime);

    // Dessiner les traces pour chaque observateur
    const observers = this.currentData.observers;
    const margin = 4;
    const traceHeight = (h - margin * 2) / observers.length;

    observers.forEach((obs, i) => {
      const history = this.phaseHistory.get(obs.id);
      if (!history || history.length < 2) {return;}

      const y0 = margin + i * traceHeight;
      const color = this.#getObserverColor(i);

      // Dessiner la trace H (ligne pleine) - utilise 45% de l'espace
      this.#drawTrace(history, 'phaseH', startTime, currentRefTime, w, y0 + 2, traceHeight * 0.42, color, false);

      // Dessiner la trace V (ligne pointillée) - commence à 50%, utilise 45%
      this.#drawTrace(history, 'phaseV', startTime, currentRefTime, w, y0 + traceHeight * 0.5, traceHeight * 0.42, color, true);

      // Nom de l'observateur (en haut à gauche de sa zone)
      this.ctx.fillStyle = color;
      this.ctx.font = '9px sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(obs.name, 3, y0 + 9);
    });

    // Ligne du temps présent
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.setLineDash([2, 2]);
    this.ctx.beginPath();
    this.ctx.moveTo(w - 1, 0);
    this.ctx.lineTo(w - 1, h);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  /**
   * Dessine la grille de fond avec labels temporels
   */
  #drawGrid(w, h, startTime, endTime) {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 1;

    const timeSpan = endTime - startTime;

    // Lignes verticales (temps) avec labels
    const numVLines = 6;
    this.ctx.font = '9px sans-serif';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.textAlign = 'center';

    for (let i = 0; i <= numVLines; i++) {
      const x = (i / numVLines) * w;
      const t = startTime + (i / numVLines) * timeSpan;

      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, h);
      this.ctx.stroke();

      // Label temporel en bas (seulement si >= 0)
      if (t >= 0 && i > 0) {
        this.ctx.fillText(`${t.toFixed(0)}s`, x, h - 3);
      }
    }

    // Ligne verticale à t=0 si visible (plus visible)
    if (startTime < 0 && endTime > 0) {
      const x0 = (-startTime / timeSpan) * w;
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.beginPath();
      this.ctx.moveTo(x0, 0);
      this.ctx.lineTo(x0, h);
      this.ctx.stroke();
      this.ctx.fillText('0s', x0, h - 3);
    }

    // Lignes horizontales
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    const numHLines = 4;
    for (let i = 0; i <= numHLines; i++) {
      const y = (i / numHLines) * h;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
      this.ctx.stroke();
    }
  }

  /**
   * Dessine une trace
   */
  #drawTrace(history, phaseKey, startTime, endTime, w, y0, amplitude, color, dashed) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1.5;

    if (dashed) {
      this.ctx.setLineDash([4, 4]);
    }

    this.ctx.beginPath();
    let started = false;
    const timeSpan = endTime - startTime;

    for (const point of history) {
      // Ne pas dessiner les points avant t=0 ou hors fenêtre
      if (point.refTime < 0 || point.refTime < startTime) {continue;}
      if (point.refTime > endTime) {continue;}

      const x = ((point.refTime - startTime) / timeSpan) * w;
      // Convertir la phase (0-1) en onde triangulaire (photon qui rebondit)
      const phase = point[phaseKey];
      const wave = phase < 0.5 ? phase * 2 : 2 - phase * 2;
      const y = y0 + amplitude * (1 - wave);

      if (!started) {
        this.ctx.moveTo(x, y);
        started = true;
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  /**
   * Couleur par index d'observateur
   */
  #getObserverColor(index) {
    const colors = [
      '#ffffff', // Lab - blanc
      '#ff6b6b', // Alice - rouge
      '#4fc3f7', // Bob - bleu
      '#4ade80', // Charlie - vert
      '#fbbf24', // Jaune
      '#a78bfa', // Violet
    ];
    return colors[index % colors.length];
  }

  show() {
    this.visible = true;
    this.container.style.display = '';
  }

  hide() {
    this.visible = false;
    this.container.style.display = 'none';
  }

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.#resizeCanvas);
  }
}
