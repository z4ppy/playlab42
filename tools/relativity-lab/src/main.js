/**
 * main.js - Point d'entrée du Relativity Lab 3D
 *
 * Initialise et assemble tous les composants :
 * - SceneManager (Three.js)
 * - Simulation (logique relativiste)
 * - HUD (affichage données)
 * - ControlPanel (lil-gui)
 */

import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { Simulation } from './Simulation.js';
import { HUD } from '../ui/HUD.js';
import { ObserverView } from '../ui/ObserverView.js';
import { MotorPanel } from '../ui/MotorPanel.js';
import { DopplerGraph } from '../ui/DopplerGraph.js';
import { ClockPanel } from '../ui/ClockPanel.js';
import { createControlPanel } from '../ui/ControlPanel.js';
import { makeDraggable } from '../ui/DraggablePanel.js';

/**
 * Application principale
 */
class App {
  /** @type {SceneManager} */
  sceneManager;

  /** @type {Simulation} */
  simulation;

  /** @type {HUD} */
  hud;

  /** @type {ObserverView} */
  observerView;

  /** @type {MotorPanel} */
  motorPanel;

  /** @type {DopplerGraph} */
  dopplerGraph;

  /** @type {ClockPanel} */
  clockPanel;

  /** @type {GUI} */
  controlPanel;

  /** @type {number} */
  #lastTime = 0;

  /** @type {boolean} */
  #isRunning = false;

  /** @type {number|null} Frame d'animation planifiée */
  #frameId = null;

  /** Écouteurs globaux et boutons, retirés par dispose() */
  #lifecycle = new AbortController();

  /** @type {MutationObserver|null} */
  #themeObserver = null;

  /** @type {Array<() => void>} Nettoyages des panneaux déplaçables */
  #cleanups = [];

  /** @type {boolean} */
  #disposed = false;

  /**
   * Initialise l'application
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line require-await
  async init() {
    const { canvasContainer, hudContainer } = this.#requireContainers();
    canvasContainer.querySelector('.loading')?.remove();

    this.sceneManager = new SceneManager(canvasContainer);
    this.simulation = new Simulation(this.sceneManager.scene);
    this.#createInitialObservers();

    this.hud = new HUD(hudContainer, (observerId) => this.#changeReferenceFrame(observerId));
    const panelContainers = this.#createPanels();
    this.#makePanelsDraggable(hudContainer, panelContainers);

    this.simulation.onUpdate((sim) => this.#onSimulationUpdate(sim));

    this.#setupPlayButton();
    this.controlPanel = createControlPanel(this.simulation, this.sceneManager, (playing) => {
      this.#updatePlayButton(playing);
    });
    this.#setupKeyboard();
    this.#setupThemeListener();

    this.#updatePanels(this.simulation.getDisplayData());
    console.log('🚀 Relativity Lab initialisé');
  }

  /**
   * Récupère les conteneurs DOM obligatoires
   * @returns {{canvasContainer: HTMLElement, hudContainer: HTMLElement}}
   */
  #requireContainers() {
    const canvasContainer = document.getElementById('canvas-container');
    const hudContainer = document.getElementById('hud');

    if (!canvasContainer || !hudContainer) {
      throw new Error('Conteneurs DOM non trouvés');
    }
    return { canvasContainer, hudContainer };
  }

  /**
   * Change de référentiel depuis le HUD et centre la caméra sur l'observateur
   * @param {string} observerId
   */
  #changeReferenceFrame(observerId) {
    this.simulation.setReferenceFrame(observerId);
    const observer = this.simulation.getObserver(observerId);
    if (observer) {
      this.sceneManager.setTarget(observer.position);
    }
    console.log(`🔄 Référentiel changé vers: ${observerId}`);
  }

  /**
   * Applique une impulsion du panneau moteur à l'observateur de référence
   * @param {THREE.Vector3} direction
   * @param {number} deltaMass
   */
  #applyMotorImpulse(direction, deltaMass) {
    const reference = this.simulation.referenceObserver;
    if (!reference) {return;}

    const result = reference.applyThrust(direction, deltaMass);
    if (result.success) {
      console.log(`🚀 Impulsion: Δv=${(result.deltaV * 100).toFixed(3)}%c, masse=${result.newMass.toFixed(0)}kg`);
    }
  }

  /**
   * Crée les panneaux optionnels présents dans la page
   * @returns {Array<[string, HTMLElement|null]>} Clé de position persistée et conteneur de chaque panneau
   */
  #createPanels() {
    const observerView = document.getElementById('observer-view');
    const motorPanel = document.getElementById('motor-panel');
    const dopplerGraph = document.getElementById('doppler-graph');
    const clockPanel = document.getElementById('clock-panel');

    if (observerView) {this.observerView = new ObserverView(observerView);}
    if (motorPanel) {
      this.motorPanel = new MotorPanel(motorPanel, (direction, deltaMass) => {
        this.#applyMotorImpulse(direction, deltaMass);
      });
    }
    if (dopplerGraph) {this.dopplerGraph = new DopplerGraph(dopplerGraph);}
    if (clockPanel) {this.clockPanel = new ClockPanel(clockPanel);}

    return [
      ['relativity-lab-clock-pos', clockPanel],
      ['relativity-lab-observer-pos', observerView],
      ['relativity-lab-doppler-pos', dopplerGraph],
      ['relativity-lab-motor-pos', motorPanel],
    ];
  }

  /**
   * Rend déplaçables le HUD et les panneaux présents
   * @param {HTMLElement} hudContainer
   * @param {Array<[string, HTMLElement|null]>} panels
   */
  #makePanelsDraggable(hudContainer, panels) {
    const draggables = [['relativity-lab-hud-pos', hudContainer], ...panels];
    for (const [storageKey, element] of draggables) {
      if (element) {
        this.#cleanups.push(makeDraggable(element, storageKey));
      }
    }
  }

  /**
   * Met à jour HUD, vue cockpit, moteur, graphique Doppler et horloges à partir des données d'affichage
   * @param {object} displayData
   */
  #updatePanels(displayData) {
    this.hud.update(displayData);
    this.observerView?.update(displayData, displayData.observers);
    this.#updateMotorPanel(displayData);
    this.dopplerGraph?.update(displayData, displayData.observers);
    this.clockPanel?.update(displayData);
  }

  /**
   * Transmet l'observateur de référence au panneau moteur
   * @param {object} displayData
   */
  #updateMotorPanel(displayData) {
    if (!this.motorPanel) {return;}

    const refObserver = displayData.observers.find(o => o.id === displayData.referenceId);
    if (refObserver) {
      this.motorPanel.update(refObserver);
    }
  }

  /**
   * Met à jour l'affichage à chaque frame et fait suivre la caméra à la référence
   * @param {Simulation} sim
   */
  #onSimulationUpdate(sim) {
    this.#updatePanels(sim.getDisplayData());
    if (sim.referenceObserver) {
      this.sceneManager.setTarget(sim.referenceObserver.position);
    }
  }

  /**
   * Crée les observateurs par défaut
   *
   * Configuration :
   * - Lab : référentiel fixe au centre
   * - Alice : mouvement transversal (axe Y) à 0.3c
   * - Bob : mouvement longitudinal (axe X) à 0.5c
   * - Charlie : mouvement orthogonal (axe Z) à 0.4c
   */
  #createInitialObservers() {
    // Lab : point fixe au centre (référentiel de base)
    this.simulation.addObserver(
      'Lab',
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      { id: 'lab', color: 0xffffff },
    );

    // Alice : mouvement transversal sur l'axe Y
    this.simulation.addObserver(
      'Alice',
      new THREE.Vector3(-2, 0, 0),
      new THREE.Vector3(0, 0.3, 0),  // 30% c transversal
      { color: 0xff6b6b },  // Rouge
    );

    // Bob : mouvement longitudinal sur l'axe X
    this.simulation.addObserver(
      'Bob',
      new THREE.Vector3(3, 0, 0),
      new THREE.Vector3(0.5, 0, 0),  // 50% c longitudinal
      { color: 0x4fc3f7 },  // Bleu
    );

    // Charlie : mouvement orthogonal sur l'axe Z
    this.simulation.addObserver(
      'Charlie',
      new THREE.Vector3(0, 0, 3),
      new THREE.Vector3(0, 0, 0.4),  // 40% c orthogonal
      { color: 0x4ade80 },  // Vert
    );

    // Définir Lab comme référentiel par défaut
    this.simulation.setReferenceFrame('lab');
  }

  /**
   * Configure le gros bouton Play/Pause
   */
  #setupPlayButton() {
    const { signal } = this.#lifecycle;

    document.getElementById('play-button')?.addEventListener('click', () => this.#togglePlayback(), { signal });
    document.getElementById('reset-button')?.addEventListener('click', () => this.#resetSimulation(), { signal });
  }

  /**
   * Bascule lecture/pause et synchronise le bouton
   */
  #togglePlayback() {
    this.simulation.toggle();
    this.#updatePlayButton(this.simulation.state === 'running');
  }

  /**
   * Réinitialise la simulation et le bouton
   */
  #resetSimulation() {
    this.simulation.reset();
    this.#updatePlayButton(false);
  }

  /**
   * Met à jour l'apparence du bouton Play/Pause
   * @param {boolean} playing
   */
  #updatePlayButton(playing) {
    const playBtn = document.getElementById('play-button');
    if (!playBtn) {return;}

    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.setAttribute('aria-label', playing ? 'Mettre en pause la simulation' : 'Lire la simulation');
    playBtn.classList.toggle('play-button--running', playing);

    const icon = playBtn.querySelector('.play-button-icon');
    const text = playBtn.querySelector('.play-button-text');
    if (icon) {icon.textContent = playing ? '⏸' : '▶';}
    if (text) {text.textContent = playing ? 'Pause' : 'Play';}
  }

  /**
   * Configure les raccourcis clavier
   */
  #setupKeyboard() {
    document.addEventListener('keydown', (e) => this.#handleKeydown(e), { signal: this.#lifecycle.signal });
  }

  /**
   * Indique si un raccourci doit être ignoré (saisie, contrôle interactif ou modificateur)
   * @param {KeyboardEvent} e
   * @returns {boolean}
   */
  #isShortcutIgnored(e) {
    const interactive = e.target instanceof Element
      && e.target.closest('input, textarea, select, button, [contenteditable="true"]');
    return Boolean(interactive) || e.altKey || e.ctrlKey || e.metaKey;
  }

  /**
   * Exécute le raccourci correspondant à la touche
   * @param {KeyboardEvent} e
   */
  #handleKeydown(e) {
    if (this.#isShortcutIgnored(e)) {return;}

    if (/^Digit[1-5]$/.test(e.code)) {
      this.#selectFrameByIndex(Number(e.code.slice(-1)) - 1);
      return;
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.#togglePlayback();
        break;
      case 'KeyR':
        this.#resetSimulation();
        break;
      case 'KeyG':
        this.sceneManager.grid.visible = !this.sceneManager.grid.visible;
        break;
      case 'KeyA':
        this.sceneManager.axes.visible = !this.sceneManager.axes.visible;
        break;
    }
  }

  /**
   * Change de référentiel avec les touches 1-5
   * @param {number} index
   */
  #selectFrameByIndex(index) {
    const frames = this.simulation.getAvailableFrames();
    if (index < frames.length) {
      this.simulation.setReferenceFrame(frames[index].id);
    }
  }

  /**
   * Configure l'écoute des changements de thème
   */
  #setupThemeListener() {
    this.#themeObserver = new MutationObserver(() => {
      this.sceneManager.updateTheme();
    });

    this.#themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // Écouter aussi les changements de media query
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', () => {
      this.sceneManager.updateTheme();
    }, { signal: this.#lifecycle.signal });
  }

  /**
   * Démarre la boucle de rendu
   */
  start() {
    if (this.#isRunning) {return;}
    this.#isRunning = true;
    this.#lastTime = performance.now();
    this.#animate();
  }

  /**
   * Boucle d'animation
   */
  #animate = () => {
    if (!this.#isRunning) {return;}

    this.#frameId = requestAnimationFrame(this.#animate);

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.#lastTime) / 1000;
    this.#lastTime = currentTime;

    // Limiter le delta time pour éviter les sauts
    const clampedDelta = Math.min(deltaTime, 0.1);

    this.#applyContinuousThrust();
    this.simulation.update(clampedDelta);
    this.sceneManager.render();
  };

  /**
   * Applique la poussée continue du moteur à l'observateur de référence
   */
  #applyContinuousThrust() {
    const reference = this.simulation.referenceObserver;
    const thrust = reference && this.motorPanel?.getContinuousThrust();
    if (thrust) {
      reference.applyThrust(thrust.direction, thrust.deltaMass);
    }
  }

  /**
   * Arrête la boucle de rendu et annule la frame planifiée
   */
  stop() {
    this.#isRunning = false;
    if (this.#frameId !== null) {
      cancelAnimationFrame(this.#frameId);
      this.#frameId = null;
    }
  }

  /**
   * Libère les ressources ; peut être appelé même si init() a échoué
   */
  dispose() {
    if (this.#disposed) {return;}
    this.#disposed = true;

    this.stop();
    this.#releaseListeners();
    this.#releaseResources();
  }

  /**
   * Retire écouteurs globaux, observateur de thème et panneaux déplaçables
   */
  #releaseListeners() {
    this.#lifecycle.abort();
    this.#themeObserver?.disconnect();
    for (const cleanup of this.#cleanups) {
      cleanup();
    }
    this.#cleanups = [];
    this.motorPanel?.dispose();
    this.dopplerGraph?.dispose();
    this.clockPanel?.dispose();
  }

  /**
   * Libère simulation, scène et panneau de contrôle
   */
  #releaseResources() {
    this.simulation?.dispose();
    this.sceneManager?.dispose();
    this.controlPanel?.destroy();
  }
}

// === Point d'entrée ===

/**
 * Initialise l'application quand le DOM est prêt
 */
function initApp() {
  const app = new App();

  app.init()
    .then(() => {
      app.start();
    })
    .catch((error) => {
      console.error('Erreur d\'initialisation:', error);
      app.dispose();

      // Afficher un message d'erreur à l'utilisateur
      const container = document.getElementById('canvas-container');
      if (container) {
        container.innerHTML = `
          <div role="alert" style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--color-error);
            text-align: center;
            padding: 2rem;
          ">
            <h2>Erreur de chargement</h2>
            <p>${error.message}</p>
            <p style="font-size: 0.8em; opacity: 0.7;">
              Vérifiez la console pour plus de détails.
            </p>
          </div>
        `;
      }
    });

  // Exposer l'app globalement pour le debug
  window.relativityApp = app;
}

// Attendre que le DOM soit prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
