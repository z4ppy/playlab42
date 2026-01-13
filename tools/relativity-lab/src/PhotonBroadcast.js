/**
 * PhotonBroadcast.js - Photons broadcast en expansion sphérique
 *
 * Représente un flash lumineux émis par une horloge à photon.
 * Le photon se propage à la vitesse c dans toutes les directions,
 * formant une sphère en expansion.
 */

import * as THREE from 'three';
import * as Physics from './Physics.js';

/**
 * Représente un photon broadcast (sphère lumineuse en expansion)
 */
export class PhotonBroadcast {
  /** @type {string} Identifiant unique */
  id;

  /** @type {string} ID de l'observateur émetteur */
  sourceId;

  /** @type {'H' | 'V'} Type d'horloge qui a émis ce photon */
  clockType;

  /** @type {number} Numéro du tick */
  tickNumber;

  /** @type {THREE.Vector3} Position d'émission (fixe) */
  origin;

  /** @type {number} Temps lab d'émission */
  emissionLabTime;

  /** @type {number} Temps propre de l'émetteur à l'émission */
  emissionProperTime;

  /** @type {THREE.Vector3} Vitesse de l'émetteur à l'émission */
  emissionVelocity;

  /** @type {number} Rayon actuel de la sphère */
  radius = 0;

  /** @type {THREE.Mesh} Sphère 3D */
  mesh;

  /** @type {boolean} Le photon est-il encore actif ? */
  active = true;

  /** @type {number} Rayon maximum de propagation (en unités de distance) */
  maxRadius;

  /** @type {number} Couleur du photon */
  color;

  /** @type {Set<string>} IDs des observateurs qui ont reçu ce photon */
  receivedBy = new Set();

  /** @type {boolean} Mode léger sans mesh 3D (optimisation mémoire) */
  lightweight = false;

  /**
   * @param {object} params - Paramètres du photon
   * @param {string} params.sourceId - ID de l'émetteur
   * @param {'H' | 'V'} params.clockType - Type d'horloge
   * @param {number} params.tickNumber - Numéro du tick
   * @param {THREE.Vector3} params.origin - Position d'émission
   * @param {number} params.emissionLabTime - Temps lab d'émission
   * @param {number} params.emissionProperTime - Temps propre de l'émetteur
   * @param {THREE.Vector3} params.emissionVelocity - Vitesse de l'émetteur
   * @param {number} [params.color=0xffff00] - Couleur du photon
   * @param {number} [params.maxRadius=1e6] - Rayon max de propagation (distance)
   * @param {boolean} [params.lightweight=false] - Mode léger sans mesh
   */
  constructor({
    sourceId,
    clockType,
    tickNumber,
    origin,
    emissionLabTime,
    emissionProperTime,
    emissionVelocity,
    color = 0xffff00,
    maxRadius = 1e6,
    lightweight = false,
  }) {
    this.id = `${sourceId}-${clockType}-${tickNumber}`;
    this.sourceId = sourceId;
    this.clockType = clockType;
    this.tickNumber = tickNumber;
    this.origin = origin.clone();
    this.emissionLabTime = emissionLabTime;
    this.emissionProperTime = emissionProperTime;
    this.emissionVelocity = emissionVelocity.clone();
    this.color = color;
    this.maxRadius = maxRadius;
    this.lightweight = lightweight;

    // En mode léger, pas de mesh 3D (économie mémoire)
    this.mesh = lightweight ? this.#createDummyMesh() : this.#createMesh();
  }

  /**
   * Crée la représentation 3D de la sphère lumineuse
   * @returns {THREE.Mesh}
   */
  #createMesh() {
    // Sphère wireframe semi-transparente (segments réduits pour performance)
    const geometry = new THREE.SphereGeometry(1, 16, 12);
    const material = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.4,
      wireframe: true,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(this.origin);
    mesh.scale.setScalar(0.001); // Commence très petit

    return mesh;
  }

  /**
   * Crée un mesh factice invisible (mode léger)
   * @returns {THREE.Object3D}
   */
  #createDummyMesh() {
    const obj = new THREE.Object3D();
    obj.visible = false;
    return obj;
  }

  /**
   * Retourne l'âge du photon (temps lab écoulé depuis l'émission)
   * @param {number} currentLabTime - Temps lab actuel
   * @returns {number}
   */
  getAge(currentLabTime) {
    return currentLabTime - this.emissionLabTime;
  }

  /**
   * Met à jour le photon
   * @param {number} currentLabTime - Temps lab actuel
   */
  update(currentLabTime) {
    const age = this.getAge(currentLabTime);

    // Le rayon croît à la vitesse de la lumière
    this.radius = age * Physics.C;

    // Vérifier le rayon maximum
    if (age < 0 || this.radius > this.maxRadius) {
      this.active = false;
      if (this.mesh) this.mesh.visible = false;
      return;
    }

    // En mode léger, pas de mise à jour visuelle
    if (this.lightweight) return;

    this.mesh.scale.setScalar(Math.max(0.001, this.radius));
  }

  /**
   * Vérifie si le photon a atteint un observateur
   * @param {THREE.Vector3} observerPos - Position de l'observateur
   * @returns {boolean}
   */
  hasReached(observerPos) {
    const distance = this.origin.distanceTo(observerPos);
    return this.radius >= distance;
  }

  /** @type {number} Nombre total d'observateurs cibles (excluant l'émetteur) */
  targetCount = 0;

  /**
   * Définit le nombre d'observateurs cibles
   * @param {number} count - Nombre d'observateurs (excluant l'émetteur)
   */
  setTargetCount(count) {
    this.targetCount = count;
  }

  /**
   * Vérifie et enregistre la réception par un observateur
   * @param {string} observerId - ID de l'observateur
   * @param {THREE.Vector3} observerPos - Position de l'observateur
   * @returns {boolean} True si le photon vient d'être reçu
   */
  checkReception(observerId, observerPos) {
    // Ignorer l'émetteur
    if (observerId === this.sourceId) {
      return false;
    }

    // Déjà reçu ?
    if (this.receivedBy.has(observerId)) {
      return false;
    }

    // Vérifier si le front d'onde a atteint l'observateur
    if (this.hasReached(observerPos)) {
      this.receivedBy.add(observerId);

      // Désactiver si tous les observateurs ont reçu le signal
      if (this.targetCount > 0 && this.receivedBy.size >= this.targetCount) {
        this.active = false;
        this.mesh.visible = false;
      }

      return true;
    }

    return false;
  }

  /**
   * Retourne le payload du photon (données transportées)
   * @returns {object}
   */
  getPayload() {
    return {
      sourceId: this.sourceId,
      clockType: this.clockType,
      tickNumber: this.tickNumber,
      emissionProperTime: this.emissionProperTime,
      emissionVelocity: this.emissionVelocity.clone(),
      emissionPosition: this.origin.clone(),
    };
  }

  /**
   * Libère les ressources
   */
  dispose() {
    if (this.mesh) {
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
    }
  }
}

/**
 * Factory de photons (gère la création et la destruction)
 *
 * Note: Le nom "Pool" est conservé pour compatibilité API.
 * Une vraie implémentation avec recyclage d'objets serait une optimisation future
 * si les performances le nécessitent.
 */
export class PhotonPool {
  /**
   * Crée un nouveau photon
   * @param {object} params - Paramètres du photon
   * @returns {PhotonBroadcast}
   */
  acquire(params) {
    return new PhotonBroadcast(params);
  }

  /**
   * Détruit un photon
   * @param {PhotonBroadcast} photon
   */
  release(photon) {
    photon.dispose();
  }
}
