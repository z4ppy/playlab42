/**
 * Simulation.js - Gestionnaire principal de la simulation relativiste
 *
 * Gère l'état global de la simulation :
 * - Liste des observateurs (incluant le Lab)
 * - Signaux broadcast (sphères en expansion à c)
 * - Temps lab et référentiel d'observation
 * - Options de visualisation
 */

import * as THREE from 'three';
import { Observer } from './Observer.js';
import { PhotonPool } from './PhotonBroadcast.js';
import { dopplerFactor, lightReceptionDelay } from './Physics.js';

/** Pas fixe du laboratoire ; un reste inférieur à ce pas attend la frame suivante. */
export const FIXED_STEP = 1 / 60;

/**
 * États possibles de la simulation
 */
export const SimulationState = {
  PAUSED: 'paused',
  RUNNING: 'running',
};

/**
 * Gestionnaire de simulation relativiste
 */
export class Simulation {
  /** @type {Observer[]} Liste des observateurs */
  observers = [];

  /** @type {PhotonBroadcast[]} Signaux broadcast (sphères en expansion) */
  signals = [];

  /** @type {number} Temps lab actuel */
  labTime = 0;

  /** @type {string} État de la simulation */
  state = SimulationState.PAUSED;

  /** @type {number} Multiplicateur de vitesse de simulation */
  timeScale = 1.0;

  /** @type {Observer|null} Observateur de référence (référentiel d'observation) */
  referenceObserver = null;

  /** @type {boolean} Émettre automatiquement des photons à chaque tick */
  autoEmitPhotons = true;

  /** @type {THREE.Scene} Scène Three.js */
  scene;

  /** @type {PhotonPool} Pool de signaux */
  signalPool;

  // === Options de visualisation ===

  /** @type {boolean} Afficher les signaux (sphères) - caché par défaut */
  showSignals = false;

  /** @type {number} Distance max de propagation des signaux (paramétrable) */
  maxSignalRadius = 1e6; // 1 million d'unités par défaut

  /** @type {Set<string>} Sources visibles (IDs des observateurs dont on voit les émissions) */
  visibleSources = new Set();

  /** @type {boolean} Afficher toutes les sources */
  showAllSources = true;

  // === Callbacks ===

  /** @type {Function[]} Callbacks appelés à chaque update */
  #updateCallbacks = [];

  /** @type {Function[]} Callbacks appelés lors de la réception d'un photon */
  #receptionCallbacks = [];

  /** @type {number} Compteur pour générer des IDs uniques */
  #nextObserverId = 1;

  #accumulator = 0;

  /** @type {((dtLab: number) => void)|null} Commande moteur à chaque pas lab */
  beforeStep = null;

  /**
   * @param {THREE.Scene} scene - Scène Three.js
   */
  constructor(scene) {
    this.scene = scene;
    this.signalPool = new PhotonPool();
  }

  /**
   * Ajoute un observateur à la simulation
   * @param {string} name - Nom de l'observateur
   * @param {THREE.Vector3} position - Position initiale
   * @param {THREE.Vector3} velocity - Vitesse initiale (fraction de c)
   * @param {object} options - Options supplémentaires
   * @returns {Observer}
   */
  addObserver(name, position, velocity = new THREE.Vector3(), options = {}) {
    const id = options.id || `obs-${this.#nextObserverId++}`;
    if (this.getObserver(id)) {throw new RangeError('Identifiant d’observateur déjà utilisé.');}
    const observer = new Observer(id, name, position, velocity, options);

    this.observers.push(observer);
    this.scene.add(observer.mesh);

    // Ajouter aux sources visibles par défaut
    this.visibleSources.add(id);

    // Le premier observateur devient la référence par défaut
    if (this.observers.length === 1) {
      this.referenceObserver = observer;
    }
    observer.refreshVisuals();
    this.refresh();
    return observer;
  }

  /**
   * Retire un observateur de la simulation
   * @param {string} observerId - ID de l'observateur
   */
  removeObserver(observerId) {
    // Empêcher la suppression du Lab
    if (observerId === 'lab') {return;}

    const index = this.observers.findIndex(o => o.id === observerId);
    if (index === -1) {return;}

    const observer = this.observers[index];
    this.scene.remove(observer.mesh);
    observer.dispose();
    this.observers.splice(index, 1);

    // Retirer des sources visibles
    this.visibleSources.delete(observerId);

    // Si c'était le référentiel, choisir le premier disponible
    if (this.referenceObserver === observer) {
      this.referenceObserver = this.observers[0] || null;
    }
    for (const signal of this.signals) {
      signal.targetIds.delete(observerId);
      if ([...signal.targetIds].every(id => signal.receivedBy.has(id))) {signal.active = false;}
    }
    this.#pruneInactive();
    this.refresh();
  }

  /**
   * Retourne un observateur par son ID
   * @param {string} observerId
   * @returns {Observer|undefined}
   */
  getObserver(observerId) {
    return this.observers.find(o => o.id === observerId);
  }

  /**
   * Change le référentiel d'observation
   * @param {string|null} observerId - ID de l'observateur ou null pour le lab
   */
  setReferenceFrame(observerId) {
    if (observerId === null) {
      this.referenceObserver = this.getObserver('lab') || this.observers[0] || null;
    } else {
      const observer = this.getObserver(observerId);
      if (!observer) {throw new RangeError('Observateur de référence inconnu.');}
      this.referenceObserver = observer;
    }
    this.refresh();
  }

  /**
   * Émet un signal broadcast depuis un observateur
   *
   * Simplifié : on n'émet que des sphères en expansion (PhotonBroadcast).
   * La détection de réception se fait quand la sphère atteint un observateur.
   * Plus besoin de calculer des trajectoires de photons individuels.
   *
   * @param {Observer} observer - Observateur émetteur
   * @param {'H' | 'V'} clockType - Type d'horloge
   * @param {number} tickNumber - Numéro du tick
   */
  emitPhoton(observer, clockType, tickNumber, event = {}) {
    if (this.observers.length < 2) {return;}
    const color = clockType === 'H' ? 0xff6b6b : 0x4ade80;

    // Émettre un signal broadcast (sphère en expansion à c)
    const signal = this.signalPool.acquire({
      sourceId: observer.id,
      clockType,
      tickNumber,
      origin: event.origin || observer.position.clone(),
      emissionLabTime: event.labTime ?? this.labTime,
      emissionProperTime: event.properTime ?? observer.properTime,
      emissionVelocity: observer.velocity.clone(),
      color,
      maxRadius: this.maxSignalRadius,
      lightweight: !this.showSignals, // Mode léger si signaux non affichés
    });

    // Définir le nombre de cibles (tous sauf l'émetteur)
    // Le signal sera désactivé quand tous les observateurs l'auront reçu
    signal.setTargetCount(this.observers.length - 1);
    signal.targetIds = new Set(this.observers.filter(o => o !== observer).map(o => o.id));

    this.signals.push(signal);
    this.scene.add(signal.mesh);

    // Appliquer la visibilité
    this.#updateVisibility();
  }

  /**
   * Définit la visibilité d'une source
   * @param {string} sourceId - ID de l'observateur
   * @param {boolean} visible
   */
  setSourceVisibility(sourceId, visible) {
    if (visible) {
      this.visibleSources.add(sourceId);
    } else {
      this.visibleSources.delete(sourceId);
    }
    this.#updateVisibility();
  }

  /**
   * Met à jour la visibilité de tous les signaux
   */
  #updateVisibility() {
    for (const signal of this.signals) {
      const sourceVisible = this.showAllSources || this.visibleSources.has(signal.sourceId);
      const visible = this.showSignals && sourceVisible;
      if (visible && signal.lightweight) {
        this.scene.remove(signal.mesh);
        signal.enableMesh();
        this.scene.add(signal.mesh);
        signal.update(this.labTime);
      }
      signal.mesh.visible = visible && signal.active;
    }
  }

  /** Actualise les panneaux et les options, même en pause. */
  refresh() {
    this.#updateVisibility();
    for (const callback of this.#updateCallbacks) {callback(this);}
  }

  /**
   * Démarre la simulation
   */
  play() {
    this.state = SimulationState.RUNNING;
    this.refresh();
  }

  /**
   * Met en pause la simulation
   */
  pause() {
    this.state = SimulationState.PAUSED;
    this.refresh();
  }

  /**
   * Bascule entre play et pause
   */
  toggle() {
    if (this.state === SimulationState.RUNNING) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Réinitialise la simulation
   */
  reset() {
    this.labTime = 0;
    this.#accumulator = 0;
    this.state = SimulationState.PAUSED;

    // Réinitialiser les observateurs
    for (const observer of this.observers) {
      observer.reset();
    }

    // Supprimer tous les signaux
    for (const signal of this.signals) {
      this.scene.remove(signal.mesh);
      signal.dispose();
    }
    this.signals = [];
    this.refresh();
  }

  /**
   * Met à jour la simulation pour un delta temps réel
   * @param {number} deltaTime - Delta temps réel en secondes
   */
  update(deltaTime) {
    if (this.state !== SimulationState.RUNNING) {return;}
    if (!Number.isFinite(deltaTime) || deltaTime < 0 ||
        !Number.isFinite(this.timeScale) || this.timeScale <= 0) {
      throw new RangeError('Delta temps et multiplicateur doivent être finis et positifs.');
    }
    this.#accumulator += Math.min(deltaTime, 0.1) * Math.min(this.timeScale, 100);
    while (this.#accumulator + 1e-12 >= FIXED_STEP) {
      this.#step(FIXED_STEP);
      this.#accumulator = Math.max(0, this.#accumulator - FIXED_STEP);
    }
    this.refresh();
  }

  /**
   * Avance un segment inertiel après l'éventuelle impulsion instantanée.
   * @param {number} dtLab
   */
  #step(dtLab) {
    this.beforeStep?.(dtLab);
    const startTime = this.labTime;
    this.labTime += dtLab;

    // Mettre à jour les observateurs
    for (const observer of this.observers) {
      const { ticksH, ticksV } = observer.update(dtLab);

      // Émettre des photons si une horloge a tické
      if (this.autoEmitPhotons) {
        for (const [type, ticks, clock] of [['H', ticksH, observer.clockH], ['V', ticksV, observer.clockV]]) {
          ticks.forEach((properOffset, index) => {
            const labOffset = Math.min(dtLab, Math.max(0, properOffset * observer.gamma));
            const tickNumber = clock.tickCount - ticks.length + index + 1;
            this.emitPhoton(observer, type, tickNumber, {
              labTime: startTime + labOffset,
              properTime: tickNumber * clock.period,
              origin: observer.position.clone().sub(observer.velocity.clone().multiplyScalar(dtLab - labOffset)),
            });
          });
        }
      }
    }

    // Tester avant expiration pour conserver une réception dans le dernier segment.
    this.#checkReceptions(startTime);
    for (const signal of this.signals) {signal.update(this.labTime);}

    // Nettoyer les éléments inactifs
    this.#pruneInactive();
  }

  /**
   * Vérifie si des signaux atteignent des observateurs
   *
   * Les signaux broadcast (sphères en expansion) sont utilisés pour
   * détecter les réceptions. Pas besoin de photons individuels.
   */
  #checkReceptions(startTime) {
    for (const signal of this.signals) {
      if (!signal.active) {continue;}

      for (const observer of this.observers) {
        if (!signal.targetIds.has(observer.id) || signal.receivedBy.has(observer.id)) {continue;}
        const segmentStart = Math.max(startTime, signal.emissionLabTime);
        const startPosition = observer.position.clone().sub(observer.velocity.clone().multiplyScalar(this.labTime - segmentStart));
        const delay = lightReceptionDelay(startPosition.clone().sub(signal.origin), observer.velocity,
          segmentStart - signal.emissionLabTime);
        if (delay !== null && delay <= this.labTime - segmentStart + 1e-10) {
          const receptionTime = segmentStart + delay;
          const lightTravelTime = receptionTime - signal.emissionLabTime;
          if (lightTravelTime > signal.maxRadius) {continue;}
          signal.receivedBy.add(observer.id);
          const position = startPosition.add(observer.velocity.clone().multiplyScalar(delay));
          const direction = position.clone().sub(signal.origin).normalize();
          const factor = dopplerFactor(signal.emissionVelocity, observer.velocity, direction);
          const receptionTau = observer.properTime - (this.labTime - receptionTime) / observer.gamma;

          // Enregistrer le tick reçu dans l'observateur
          observer.recordReceivedTick(
            signal.sourceId,
            signal.clockType,
            signal.tickNumber,
            factor,
            signal.emissionProperTime,
            lightTravelTime,
            receptionTau,
          );

          const reception = {
            type: 'signal',
            photon: signal.getPayload(),
            dopplerFactor: factor,
            lightTravelTime,
            receiver: {
              id: observer.id,
              properTime: receptionTau,
              position,
            },
          };

          for (const callback of this.#receptionCallbacks) {
            callback(reception);
          }
        }
      }
      if ([...signal.targetIds].every(id => signal.receivedBy.has(id))) {signal.active = false;}
    }
  }

  /**
   * Supprime les signaux inactifs
   */
  #pruneInactive() {
    const activeSignals = [];
    for (const signal of this.signals) {
      if (signal.active) {
        activeSignals.push(signal);
      } else {
        this.scene.remove(signal.mesh);
        this.signalPool.release(signal);
      }
    }
    this.signals = activeSignals;
  }

  /**
   * Ajoute un callback appelé à chaque mise à jour
   * @param {Function} callback
   * @returns {Function} Fonction pour retirer le callback
   */
  onUpdate(callback) {
    this.#updateCallbacks.push(callback);
    return () => {
      const index = this.#updateCallbacks.indexOf(callback);
      if (index !== -1) {
        this.#updateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Ajoute un callback appelé lors de la réception d'un photon
   * @param {Function} callback
   * @returns {Function} Fonction pour retirer le callback
   */
  onPhotonReception(callback) {
    this.#receptionCallbacks.push(callback);
    return () => {
      const index = this.#receptionCallbacks.indexOf(callback);
      if (index !== -1) {
        this.#receptionCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Retourne les données pour l'affichage
   * @returns {object}
   */
  getDisplayData() {
    return {
      labTime: this.labTime,
      state: this.state,
      timeScale: this.timeScale,
      referenceId: this.referenceObserver?.id || null,
      observers: this.observers.map(o => o.getDisplayData()),
      signalCount: this.signals.length,
    };
  }

  /**
   * Retourne la liste des référentiels disponibles
   * @returns {Array<{id: string, name: string}>}
   */
  getAvailableFrames() {
    const frames = [];
    for (const observer of this.observers) {
      frames.push({ id: observer.id, name: observer.name });
    }
    return frames;
  }

  /**
   * Libère toutes les ressources
   */
  dispose() {
    this.pause();
    this.beforeStep = null;
    this.referenceObserver = null;
    // Supprimer les observateurs
    for (const observer of this.observers) {
      this.scene.remove(observer.mesh);
      observer.dispose();
    }
    this.observers = [];

    // Supprimer les signaux
    for (const signal of this.signals) {
      this.scene.remove(signal.mesh);
      signal.dispose();
    }
    this.signals = [];

    // Vider les callbacks
    this.#updateCallbacks = [];
    this.#receptionCallbacks = [];
  }
}
