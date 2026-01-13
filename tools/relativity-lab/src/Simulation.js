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
import { PhotonBroadcast, PhotonPool } from './PhotonBroadcast.js';
import * as Physics from './Physics.js';

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
    const observer = new Observer(id, name, position, velocity, options);

    this.observers.push(observer);
    this.scene.add(observer.mesh);

    // Ajouter aux sources visibles par défaut
    this.visibleSources.add(id);

    // Le premier observateur devient la référence par défaut
    if (this.observers.length === 1) {
      this.referenceObserver = observer;
    }

    return observer;
  }

  /**
   * Retire un observateur de la simulation
   * @param {string} observerId - ID de l'observateur
   */
  removeObserver(observerId) {
    // Empêcher la suppression du Lab
    if (observerId === 'lab') return;

    const index = this.observers.findIndex(o => o.id === observerId);
    if (index === -1) return;

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
      this.referenceObserver = null;
    } else {
      const observer = this.getObserver(observerId);
      if (observer) {
        this.referenceObserver = observer;
      }
    }
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
  emitPhoton(observer, clockType, tickNumber) {
    const color = clockType === 'H' ? 0xff6b6b : 0x4ade80;

    // Émettre un signal broadcast (sphère en expansion à c)
    const signal = this.signalPool.acquire({
      sourceId: observer.id,
      clockType,
      tickNumber,
      origin: observer.position.clone(),
      emissionLabTime: this.labTime,
      emissionProperTime: observer.properTime,
      emissionVelocity: observer.velocity.clone(),
      color,
      maxRadius: this.maxSignalRadius,
      lightweight: !this.showSignals, // Mode léger si signaux non affichés
    });

    // Définir le nombre de cibles (tous sauf l'émetteur)
    // Le signal sera désactivé quand tous les observateurs l'auront reçu
    signal.setTargetCount(this.observers.length - 1);

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
      signal.mesh.visible = this.showSignals && sourceVisible;
    }
  }

  /**
   * Démarre la simulation
   */
  play() {
    this.state = SimulationState.RUNNING;
  }

  /**
   * Met en pause la simulation
   */
  pause() {
    this.state = SimulationState.PAUSED;
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
  }

  /**
   * Met à jour la simulation pour un delta temps réel
   * @param {number} deltaTime - Delta temps réel en secondes
   */
  update(deltaTime) {
    if (this.state !== SimulationState.RUNNING) return;

    // Calculer le delta temps lab
    const dtLab = deltaTime * this.timeScale;
    this.labTime += dtLab;

    // Vitesse du référentiel d'observation
    const refVelocity = this.referenceObserver?.velocity || new THREE.Vector3();

    // Mettre à jour les observateurs
    for (const observer of this.observers) {
      const { tickedH, tickedV } = observer.update(dtLab, refVelocity);

      // Émettre des photons si une horloge a tické
      if (this.autoEmitPhotons) {
        if (tickedH) {
          this.emitPhoton(observer, 'H', observer.clockH.tickCount);
        }
        if (tickedV) {
          this.emitPhoton(observer, 'V', observer.clockV.tickCount);
        }
      }
    }

    // Mettre à jour les signaux
    for (const signal of this.signals) {
      signal.update(this.labTime);
    }

    // Vérifier les réceptions
    this.#checkReceptions();

    // Nettoyer les éléments inactifs
    this.#pruneInactive();

    // Notifier les callbacks
    for (const callback of this.#updateCallbacks) {
      callback(this);
    }
  }

  /**
   * Calcule le facteur Doppler relativiste
   * @param {THREE.Vector3} sourceVelocity - Vitesse de l'émetteur à l'émission
   * @param {THREE.Vector3} receiverVelocity - Vitesse du récepteur à la réception
   * @param {THREE.Vector3} direction - Vecteur unitaire de la source vers le récepteur
   * @returns {number} Facteur Doppler (>1 = blueshift/approche, <1 = redshift/éloignement)
   */
  #calculateDopplerFactor(sourceVelocity, receiverVelocity, direction) {
    // Vitesse relative de la source par rapport au récepteur
    const relativeVelocity = sourceVelocity.clone().sub(receiverVelocity);

    // Composante radiale (négative si source s'approche)
    // direction pointe de la source vers le récepteur
    const radialBeta = relativeVelocity.dot(direction);

    // Facteur Doppler relativiste : f_obs/f_emit = sqrt((1 - β)/(1 + β))
    // où β est positif si la source s'éloigne
    // Notre radialBeta est positif si la source s'éloigne
    const clampedBeta = Math.max(-0.999, Math.min(0.999, radialBeta));
    return Math.sqrt((1 - clampedBeta) / (1 + clampedBeta));
  }

  /**
   * Vérifie si des signaux atteignent des observateurs
   *
   * Les signaux broadcast (sphères en expansion) sont utilisés pour
   * détecter les réceptions. Pas besoin de photons individuels.
   */
  #checkReceptions() {
    for (const signal of this.signals) {
      if (!signal.active) continue;

      for (const observer of this.observers) {
        const received = signal.checkReception(observer.id, observer.position);

        if (received) {
          // Calculer le facteur Doppler
          const source = this.getObserver(signal.sourceId);
          const direction = observer.position.clone().sub(signal.origin).normalize();
          const sourceVelocity = signal.emissionVelocity || (source ? source.velocity : new THREE.Vector3());
          const dopplerFactor = this.#calculateDopplerFactor(sourceVelocity, observer.velocity, direction);

          // Calculer le temps de trajet lumière
          const lightTravelTime = this.labTime - signal.emissionLabTime;

          // Enregistrer le tick reçu dans l'observateur
          observer.recordReceivedTick(
            signal.sourceId,
            signal.clockType,
            signal.tickNumber,
            dopplerFactor,
            signal.emissionProperTime,
            lightTravelTime
          );

          const reception = {
            type: 'signal',
            photon: signal.getPayload(),
            dopplerFactor,
            lightTravelTime,
            receiver: {
              id: observer.id,
              properTime: observer.properTime,
              position: observer.position.clone(),
            },
          };

          for (const callback of this.#receptionCallbacks) {
            callback(reception);
          }
        }
      }
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
