/**
 * Observer.js - Observateur avec horloges à photon
 *
 * Représente un observateur dans la simulation de relativité restreinte.
 * Chaque observateur possède :
 * - Une position et une vitesse
 * - Un temps propre τ accumulé
 * - Deux horloges à photon (H horizontale, V verticale)
 */

import * as THREE from 'three';
import * as Physics from './Physics.js';

/** Couleurs prédéfinies pour les observateurs */
const OBSERVER_COLORS = [
  0x4fc3f7, // Bleu clair
  0xff6b6b, // Rouge corail
  0x4ade80, // Vert
  0xfbbf24, // Jaune
  0xa78bfa, // Violet
  0xf472b6, // Rose
];

/**
 * Représente une horloge à photon (light clock)
 */
class LightClock {
  /** @type {'H' | 'V'} Orientation de l'horloge */
  orientation;

  /** @type {number} Nombre de ticks accomplis */
  tickCount = 0;

  /** @type {number} Phase du photon [0, 1] */
  phase = 0;

  /** @type {number} Distance entre les miroirs */
  mirrorDistance;

  /** @type {number} Période propre T₀ = 2L/c */
  period;

  /** @type {THREE.Group} Groupe 3D de l'horloge */
  mesh;

  /** @type {THREE.Mesh} Photon interne animé */
  photonMesh;

  /** @type {number} Couleur de l'horloge */
  color;

  /**
   * @param {'H' | 'V'} orientation
   * @param {number} mirrorDistance
   * @param {number} color
   */
  constructor(orientation, mirrorDistance, color) {
    this.orientation = orientation;
    this.mirrorDistance = mirrorDistance;
    this.period = Physics.lightClockPeriod(mirrorDistance);
    this.color = color;
    this.mesh = this.#createMesh();
  }

  /**
   * Crée la représentation 3D de l'horloge
   * @returns {THREE.Group}
   */
  #createMesh() {
    const group = new THREE.Group();
    const isHorizontal = this.orientation === 'H';

    // Direction du bras
    const direction = isHorizontal
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);

    // Ligne du bras (tube fin)
    const points = [
      new THREE.Vector3(0, 0, 0),
      direction.clone().multiplyScalar(this.mirrorDistance),
    ];
    const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
      color: this.color,
      opacity: 0.6,
      transparent: true,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    group.add(line);

    // Miroir au départ (base)
    const mirror1 = this.#createMirror();
    mirror1.position.set(0, 0, 0);
    if (isHorizontal) {
      mirror1.rotation.z = Math.PI / 2;
    }
    group.add(mirror1);

    // Miroir à la fin
    const mirror2 = this.#createMirror();
    mirror2.position.copy(direction.clone().multiplyScalar(this.mirrorDistance));
    if (isHorizontal) {
      mirror2.rotation.z = Math.PI / 2;
    }
    group.add(mirror2);

    // Photon (sphère brillante)
    const photonGeom = new THREE.SphereGeometry(0.04, 16, 16);
    const photonMat = new THREE.MeshBasicMaterial({
      color: this.color,
    });
    this.photonMesh = new THREE.Mesh(photonGeom, photonMat);
    group.add(this.photonMesh);

    return group;
  }

  /**
   * Crée un miroir rectangulaire
   * @returns {THREE.Mesh}
   */
  #createMirror() {
    const geom = new THREE.BoxGeometry(0.08, 0.15, 0.02);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.8,
      roughness: 0.2,
    });
    return new THREE.Mesh(geom, mat);
  }

  /**
   * Met à jour l'horloge pour un delta temps propre
   * @param {number} dtProper - Delta temps propre
   * @returns {boolean} True si un tick a été accompli
   */
  update(dtProper) {
    const previousPhase = this.phase;
    this.phase += dtProper / this.period;

    let ticked = false;

    // Vérifier si on a franchi un tick (phase = 1)
    while (this.phase >= 1) {
      this.phase -= 1;
      this.tickCount++;
      ticked = true;
    }

    // Animer le photon
    // Phase 0 → 0.5 : aller, 0.5 → 1 : retour
    const t = this.phase < 0.5 ? this.phase * 2 : (1 - this.phase) * 2;
    const currentLen = this.getCurrentLength();
    const pos = t * currentLen;

    if (this.orientation === 'H') {
      this.photonMesh.position.set(pos, 0, 0);
    } else {
      this.photonMesh.position.set(0, pos, 0);
    }

    return ticked;
  }

  /**
   * Réinitialise l'horloge
   */
  reset() {
    this.tickCount = 0;
    this.phase = 0;
    this.photonMesh.position.set(0, 0, 0);
  }

  /**
   * Applique la contraction de Lorentz au bras de l'horloge
   * @param {number} contractionFactor - Facteur de contraction (0-1, 1 = pas de contraction)
   */
  setContraction(contractionFactor) {
    // Limiter le facteur entre 0.1 et 1 pour éviter les artefacts visuels
    const factor = Math.max(0.1, Math.min(1, contractionFactor));

    // Longueur contractée
    const contractedLength = this.mirrorDistance * factor;

    // Mettre à jour la ligne (bras)
    const line = this.mesh.children[0];
    if (line && line.geometry) {
      const positions = line.geometry.attributes.position.array;
      if (this.orientation === 'H') {
        positions[3] = contractedLength; // x du point final
      } else {
        positions[4] = contractedLength; // y du point final
      }
      line.geometry.attributes.position.needsUpdate = true;
    }

    // Mettre à jour la position du miroir final
    const mirror2 = this.mesh.children[2];
    if (mirror2) {
      if (this.orientation === 'H') {
        mirror2.position.x = contractedLength;
      } else {
        mirror2.position.y = contractedLength;
      }
    }

    // Stocker pour l'animation du photon
    this.currentLength = contractedLength;
  }

  /**
   * Retourne la longueur actuelle (contractée ou non)
   * @returns {number}
   */
  getCurrentLength() {
    return this.currentLength !== undefined ? this.currentLength : this.mirrorDistance;
  }
}

/**
 * Représente un observateur dans la simulation
 */
export class Observer {
  /** @type {string} Identifiant unique */
  id;

  /** @type {string} Nom affiché */
  name;

  /** @type {number} Couleur de l'observateur */
  color;

  /** @type {number} Masse initiale en kg (défaut 1000 kg = 1 tonne) */
  initialMass;

  /** @type {number} Masse actuelle en kg */
  mass;

  /** @type {THREE.Vector3} Vitesse par rapport au CMB */
  velocityCMB;

  /** @type {Array<{tau: number, deltaMass: number, deltaV: THREE.Vector3, direction: THREE.Vector3}>} Historique d'accélération */
  accelerationHistory = [];

  /** @type {THREE.Vector3} Position initiale (pour reset) */
  initialPosition;

  /** @type {THREE.Vector3} Vitesse initiale (pour reset) */
  initialVelocity;

  /** @type {THREE.Vector3} Position actuelle */
  position;

  /** @type {THREE.Vector3} Vitesse actuelle (en fraction de c) */
  velocity;

  /** @type {number} Temps propre τ accumulé */
  properTime = 0;

  /** @type {LightClock} Horloge horizontale */
  clockH;

  /** @type {LightClock} Horloge verticale */
  clockV;

  /** @type {Map<string, {H: number, V: number, lastReceivedAt: number}>} Ticks reçus par source */
  receivedTicks = new Map();

  /** @type {Array<{tau: number, sourceId: string, clockType: string, tickNumber: number, dopplerFactor: number, emissionTau: number, lightTravelTime: number}>} Historique des réceptions */
  receptionHistory = [];

  /** @type {Map<string, {lastPingSent: number, lastPongReceived: number, roundTripTime: number, estimatedDistance: number}>} Suivi des pings pour chaque observateur */
  pingTracker = new Map();

  /** @type {Map<string, number>} Temps propre de mon dernier tick envoyé */
  lastEmissionTau = 0;

  /** @type {THREE.Group} Groupe 3D contenant tout */
  mesh;

  /** @type {THREE.Mesh} Corps de l'observateur */
  bodyMesh;

  /** @type {number} Distance des miroirs des horloges */
  armLength;

  /** @type {number} Index de l'observateur (pour couleur) */
  static #colorIndex = 0;

  /**
   * @param {string} id - Identifiant unique
   * @param {string} name - Nom affiché
   * @param {THREE.Vector3} position - Position initiale
   * @param {THREE.Vector3} velocity - Vitesse initiale (fraction de c)
   * @param {object} options - Options supplémentaires
   */
  constructor(id, name, position, velocity = new THREE.Vector3(), options = {}) {
    this.id = id;
    this.name = name;
    // armLength contrôle la période des horloges : T = 2L/c
    // Avec armLength = 5 et c = 1, période = 10 secondes (1 émission toutes les 10s)
    this.armLength = options.armLength || 5;

    // Couleur automatique ou spécifiée
    this.color = options.color || OBSERVER_COLORS[Observer.#colorIndex % OBSERVER_COLORS.length];
    Observer.#colorIndex++;

    // Masse (défaut 1000 kg = 1 tonne)
    this.initialMass = options.mass || 1000;
    this.mass = this.initialMass;

    // Positions et vitesses
    this.initialPosition = position.clone();
    this.initialVelocity = velocity.clone();
    this.position = position.clone();
    this.velocity = velocity.clone();

    // Vitesse par rapport au CMB (initialement = vitesse initiale, tous au repos CMB au départ)
    this.velocityCMB = velocity.clone();

    // Historique d'accélération
    this.accelerationHistory = [];

    // Horloges à photon
    this.clockH = new LightClock('H', this.armLength, 0xff6b6b);
    this.clockV = new LightClock('V', this.armLength, 0x4ade80);

    // Créer la représentation 3D
    this.mesh = this.#createMesh();
  }

  /**
   * Crée la représentation 3D complète de l'observateur
   * @returns {THREE.Group}
   */
  #createMesh() {
    const group = new THREE.Group();

    // Corps de l'observateur (sphère principale)
    const bodyGeom = new THREE.SphereGeometry(0.2, 32, 32);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.color,
      metalness: 0.3,
      roughness: 0.7,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    group.add(this.bodyMesh);

    // Indicateur de direction (cône pointant dans la direction de la vitesse)
    const coneGeom = new THREE.ConeGeometry(0.08, 0.2, 8);
    const coneMat = new THREE.MeshStandardMaterial({
      color: this.color,
      metalness: 0.3,
      roughness: 0.7,
    });
    const cone = new THREE.Mesh(coneGeom, coneMat);
    cone.rotation.z = -Math.PI / 2; // Pointe vers +X par défaut
    cone.position.x = 0.25;
    cone.name = 'directionCone';
    group.add(cone);

    // Ajouter les horloges
    // Horloge H : décalée légèrement vers l'arrière
    this.clockH.mesh.position.set(-0.1, 0, 0.15);
    group.add(this.clockH.mesh);

    // Horloge V : à côté
    this.clockV.mesh.position.set(-0.1, 0, -0.15);
    group.add(this.clockV.mesh);

    // Label avec le nom (sprite)
    const label = this.#createLabel();
    label.position.y = 0.5;
    group.add(label);

    // Positionner le groupe
    group.position.copy(this.position);

    return group;
  }

  /**
   * Crée un label textuel au-dessus de l'observateur
   * @returns {THREE.Sprite}
   */
  #createLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Fond semi-transparent
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.roundRect(0, 0, 256, 64, 8);
    ctx.fill();

    // Texte
    ctx.fillStyle = '#' + this.color.toString(16).padStart(6, '0');
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.name, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1, 0.25, 1);
    return sprite;
  }

  /**
   * Retourne le facteur γ actuel
   * @returns {number}
   */
  get gamma() {
    return Physics.gammaFromVelocity(this.velocity);
  }

  /**
   * Retourne la vitesse en fraction de c
   * @returns {number}
   */
  get beta() {
    return this.velocity.length();
  }

  /**
   * Met à jour l'observateur pour un delta temps lab
   * @param {number} dtLab - Delta temps dans le référentiel lab
   * @param {THREE.Vector3} referenceVelocity - Vitesse du référentiel d'observation
   * @returns {{tickedH: boolean, tickedV: boolean}} Indique si les horloges ont tické
   */
  update(dtLab, referenceVelocity = new THREE.Vector3()) {
    // Calculer le temps propre écoulé
    const dtProper = Physics.properTimeDelta(dtLab, this.beta);
    this.properTime += dtProper;

    // Mettre à jour la position
    const displacement = this.velocity.clone().multiplyScalar(dtLab);
    this.position.add(displacement);
    this.mesh.position.copy(this.position);

    // Mettre à jour les horloges (en temps propre)
    const tickedH = this.clockH.update(dtProper);
    const tickedV = this.clockV.update(dtProper);

    // Orienter l'indicateur de direction selon la vitesse
    if (this.velocity.lengthSq() > 0.0001) {
      const cone = this.mesh.getObjectByName('directionCone');
      if (cone) {
        const dir = this.velocity.clone().normalize();
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
        cone.position.copy(dir.multiplyScalar(0.25));
      }
    }

    // Appliquer la contraction des longueurs visuelle
    this.#applyLengthContraction(referenceVelocity);

    return { tickedH, tickedV };
  }

  /**
   * Applique visuellement la contraction des longueurs
   * @param {THREE.Vector3} referenceVelocity - Vitesse du référentiel d'observation
   */
  #applyLengthContraction(referenceVelocity) {
    // Vitesse relative par rapport au référentiel d'observation
    const relVelocity = this.velocity.clone().sub(referenceVelocity);
    const relBeta = relVelocity.length();

    if (relBeta < 0.01) {
      // Pas de contraction significative
      this.mesh.scale.set(1, 1, 1);
      // Réinitialiser les horloges à leur longueur propre
      this.clockH.setContraction(1);
      this.clockV.setContraction(1);
      return;
    }

    // Facteur gamma
    const gamma = Physics.gammaFromVelocity(relVelocity);

    // Direction du mouvement relatif (normalisée)
    const dir = relVelocity.clone().normalize();

    // === Contraction des horloges lumineuses ===
    // L'horloge H est orientée selon X, V selon Y
    // La contraction n'affecte que la composante parallèle à la vitesse
    //
    // Pour une horloge dont le bras est dans la direction d_arm :
    // - Composante parallèle à v : |d_arm · dir|
    // - Contraction : 1/γ uniquement pour cette composante
    //
    // Longueur apparente = √( (L·cos²θ/γ²) + (L·sin²θ) )
    //                    = L · √( cos²θ/γ² + sin²θ )
    // où θ est l'angle entre le bras et la direction du mouvement

    // Horloge H (bras selon X local, orienté selon l'axe X global)
    const cosH = Math.abs(dir.x); // projection sur X
    const contractionH = Math.sqrt(cosH * cosH / (gamma * gamma) + (1 - cosH * cosH));

    // Horloge V (bras selon Y local, orienté selon l'axe Y global)
    const cosV = Math.abs(dir.y); // projection sur Y
    const contractionV = Math.sqrt(cosV * cosV / (gamma * gamma) + (1 - cosV * cosV));

    // Appliquer la contraction aux horloges
    this.clockH.setContraction(contractionH);
    this.clockV.setContraction(contractionV);

    // === Contraction du corps de l'observateur ===
    // Contracter seulement le corps (sphère), pas le groupe entier
    // pour éviter la double contraction des horloges
    const contractionFactor = Physics.lengthContraction(1, relBeta);
    const sx = 1 - (1 - contractionFactor) * Math.abs(dir.x);
    const sy = 1 - (1 - contractionFactor) * Math.abs(dir.y);
    const sz = 1 - (1 - contractionFactor) * Math.abs(dir.z);

    // Contracter le corps (sphère)
    if (this.bodyMesh) {
      this.bodyMesh.scale.set(sx, sy, sz);
    }

    // Contracter le cône directionnel
    const cone = this.mesh.getObjectByName('directionCone');
    if (cone) {
      cone.scale.set(sx, sy, sz);
    }

    // Garder le groupe parent à l'échelle 1 (les horloges gèrent leur propre contraction)
    this.mesh.scale.set(1, 1, 1);
  }

  /**
   * Réinitialise l'observateur à son état initial
   */
  reset() {
    this.position.copy(this.initialPosition);
    this.velocity.copy(this.initialVelocity);
    this.velocityCMB.copy(this.initialVelocity);
    this.mass = this.initialMass;
    this.properTime = 0;
    this.mesh.position.copy(this.position);
    this.mesh.scale.set(1, 1, 1);
    this.accelerationHistory = [];

    // Réinitialiser les horloges
    this.clockH.reset();
    this.clockV.reset();
    this.clockH.setContraction(1);
    this.clockV.setContraction(1);

    // Réinitialiser le corps et le cône
    if (this.bodyMesh) {
      this.bodyMesh.scale.set(1, 1, 1);
    }
    const cone = this.mesh.getObjectByName('directionCone');
    if (cone) {
      cone.scale.set(1, 1, 1);
    }

    this.receivedTicks.clear();
    this.receptionHistory = [];
    this.pingTracker.clear();
    this.lastEmissionTau = 0;
  }

  /**
   * Applique une impulsion (fusée à photons)
   * Convertit une partie de la masse en photons pour accélérer
   * @param {THREE.Vector3} direction - Direction de poussée (normalisée)
   * @param {number} deltaMass - Masse à convertir en kg
   * @returns {{success: boolean, deltaV: number, newMass: number}} Résultat
   */
  applyThrust(direction, deltaMass) {
    // Vérifier qu'on a assez de masse
    if (deltaMass <= 0 || deltaMass >= this.mass) {
      return { success: false, deltaV: 0, newMass: this.mass };
    }

    const m0 = this.mass;
    const m1 = this.mass - deltaMass;

    // Équation de la fusée à photons relativiste
    // v_final = c * tanh(ln(m0/m1) + atanh(v_initial/c))
    // Ou en utilisant la rapidité : φ = ln(m0/m1)
    const rapidity = Math.log(m0 / m1);

    // Calculer le delta-v dans la direction donnée
    // deltaV = c * tanh(rapidity) pour une fusée au repos
    // Pour une fusée déjà en mouvement, on utilise l'addition relativiste des vitesses
    const deltaV = Math.tanh(rapidity);

    // Normaliser la direction
    const dir = direction.clone().normalize();

    // Appliquer le delta-v en utilisant l'addition relativiste des vitesses
    const newVelocityCMB = Physics.velocityAddition3D(this.velocityCMB, dir.multiplyScalar(deltaV));

    // Mettre à jour
    this.mass = m1;
    this.velocityCMB.copy(newVelocityCMB);
    this.velocity.copy(newVelocityCMB); // La vitesse locale suit la vitesse CMB

    // Enregistrer dans l'historique
    this.accelerationHistory.push({
      tau: this.properTime,
      deltaMass,
      deltaV,
      direction: direction.clone(),
      massAfter: m1,
      vCMBAfter: newVelocityCMB.length(),
    });

    return { success: true, deltaV, newMass: m1 };
  }

  /**
   * Retourne la magnitude de la vitesse CMB
   * @returns {number}
   */
  get vCMB() {
    return this.velocityCMB.length();
  }

  /**
   * Définit la vitesse de l'observateur
   * @param {THREE.Vector3} velocity
   */
  setVelocity(velocity) {
    this.velocity.copy(velocity);
  }

  /**
   * Définit la position de l'observateur
   * @param {THREE.Vector3} position
   */
  setPosition(position) {
    this.position.copy(position);
    this.mesh.position.copy(position);
  }

  /**
   * Enregistre la réception d'un tick depuis un autre observateur
   * @param {string} sourceId - ID de l'observateur émetteur
   * @param {'H' | 'V'} clockType - Type d'horloge
   * @param {number} tickNumber - Numéro du tick reçu
   * @param {number} dopplerFactor - Facteur Doppler (>1 = blueshift, <1 = redshift)
   * @param {number} emissionTau - Temps propre de l'émetteur au moment de l'émission
   * @param {number} lightTravelTime - Temps de trajet de la lumière (temps lab)
   */
  recordReceivedTick(sourceId, clockType, tickNumber, dopplerFactor = 1.0, emissionTau = 0, lightTravelTime = 0) {
    if (!this.receivedTicks.has(sourceId)) {
      this.receivedTicks.set(sourceId, { H: 0, V: 0, lastReceivedAt: 0 });
    }
    const entry = this.receivedTicks.get(sourceId);
    entry[clockType] = Math.max(entry[clockType], tickNumber);
    entry.lastReceivedAt = this.properTime;

    // Ajouter à l'historique des réceptions
    this.receptionHistory.push({
      tau: this.properTime,
      sourceId,
      clockType,
      tickNumber,
      dopplerFactor,
      emissionTau,
      lightTravelTime,
    });

    // Mettre à jour le ping tracker pour estimation de distance
    this.#updatePingTracker(sourceId, emissionTau, lightTravelTime);

    // Limiter l'historique brut à 500 entrées, puis agréger
    if (this.receptionHistory.length > 500) {
      this.#aggregateHistory();
    }
  }

  /**
   * Met à jour le suivi de ping pour un observateur
   * @param {string} sourceId - ID de la source
   * @param {number} emissionTau - Temps propre d'émission de la source
   * @param {number} lightTravelTime - Temps de trajet lumière
   */
  #updatePingTracker(sourceId, emissionTau, lightTravelTime) {
    if (!this.pingTracker.has(sourceId)) {
      this.pingTracker.set(sourceId, {
        lastPingSent: 0,
        lastPongReceived: this.properTime,
        lastEmissionTau: emissionTau,
        roundTripTime: 0,
        estimatedDistance: lightTravelTime,
        receptionIntervals: [],
        emissionIntervals: [],
        inferredDopplerFactor: 1,
        inferredGamma: 1,
        inferredBeta: 0,
      });
    }

    const tracker = this.pingTracker.get(sourceId);
    const previousReception = tracker.lastPongReceived;
    const previousEmissionTau = tracker.lastEmissionTau || 0;
    tracker.lastPongReceived = this.properTime;
    tracker.lastEmissionTau = emissionTau;

    // Calculer l'intervalle entre réceptions (dans MON temps propre)
    if (previousReception > 0) {
      const receptionInterval = this.properTime - previousReception;
      tracker.receptionIntervals.push(receptionInterval);
      if (tracker.receptionIntervals.length > 10) {
        tracker.receptionIntervals.shift();
      }

      // Calculer l'intervalle d'émission (dans le temps propre de la SOURCE)
      if (previousEmissionTau > 0 && emissionTau > previousEmissionTau) {
        const emissionInterval = emissionTau - previousEmissionTau;
        tracker.emissionIntervals.push(emissionInterval);
        if (tracker.emissionIntervals.length > 10) {
          tracker.emissionIntervals.shift();
        }

        // Inférer le facteur Doppler : ratio des intervalles
        // D = Δt_reception / Δt_emission
        // D > 1 : source s'éloigne (redshift)
        // D < 1 : source s'approche (blueshift)
        tracker.inferredDopplerFactor = receptionInterval / emissionInterval;

        // Calculer gamma et beta à partir du Doppler
        // Pour mouvement radial : D = √((1+β)/(1-β)) où β > 0 = éloignement
        // Donc D² = (1+β)/(1-β)
        // D²(1-β) = 1+β
        // D² - D²β = 1 + β
        // D² - 1 = β(1 + D²)
        // β = (D² - 1) / (D² + 1)
        const D = tracker.inferredDopplerFactor;
        const D2 = D * D;
        tracker.inferredBeta = (D2 - 1) / (D2 + 1);
        tracker.inferredGamma = 1 / Math.sqrt(1 - tracker.inferredBeta * tracker.inferredBeta);

        // Cas limite : si beta calculé est invalide
        if (isNaN(tracker.inferredGamma) || !isFinite(tracker.inferredGamma)) {
          tracker.inferredGamma = 1;
          tracker.inferredBeta = 0;
        }
      }
    }

    // Distance estimée basée sur le temps de trajet lumière
    tracker.estimatedDistance = lightTravelTime;
    tracker.roundTripTime = lightTravelTime * 2;
  }

  /**
   * Agrège l'historique ancien en buckets temporels
   * Garde les données récentes détaillées, agrège les anciennes
   */
  #aggregateHistory() {
    const now = this.properTime;
    const newHistory = [];
    const aggregated = new Map(); // clé = bucket temporel

    for (const event of this.receptionHistory) {
      const age = now - event.tau;

      if (age < 60) {
        // Moins d'1 minute : garder détaillé
        newHistory.push(event);
      } else if (age < 3600) {
        // 1 min à 1 heure : agréger par 10 secondes
        const bucket = Math.floor(event.tau / 10) * 10;
        this.#addToAggregate(aggregated, bucket, event, 10);
      } else if (age < 86400) {
        // 1 heure à 1 jour : agréger par minute
        const bucket = Math.floor(event.tau / 60) * 60;
        this.#addToAggregate(aggregated, bucket, event, 60);
      } else {
        // Plus d'1 jour : agréger par heure
        const bucket = Math.floor(event.tau / 3600) * 3600;
        this.#addToAggregate(aggregated, bucket, event, 3600);
      }
    }

    // Convertir les agrégats en événements moyennés
    for (const [bucket, data] of aggregated) {
      newHistory.push({
        tau: bucket + data.bucketSize / 2, // Centre du bucket
        sourceId: data.sourceId,
        clockType: 'A', // Agrégé
        tickNumber: data.count,
        dopplerFactor: data.dopplerSum / data.count,
        emissionTau: data.emissionTauSum / data.count,
        lightTravelTime: data.lightTravelTimeSum / data.count,
        aggregated: true,
        bucketSize: data.bucketSize,
      });
    }

    // Trier par temps
    newHistory.sort((a, b) => a.tau - b.tau);
    this.receptionHistory = newHistory;
  }

  /**
   * Ajoute un événement à un agrégat
   */
  #addToAggregate(map, bucket, event, bucketSize) {
    const key = `${bucket}-${event.sourceId}`;
    if (!map.has(key)) {
      map.set(key, {
        sourceId: event.sourceId,
        count: 0,
        dopplerSum: 0,
        emissionTauSum: 0,
        lightTravelTimeSum: 0,
        bucketSize,
      });
    }
    const agg = map.get(key);
    agg.count++;
    agg.dopplerSum += event.dopplerFactor;
    agg.emissionTauSum += event.emissionTau || 0;
    agg.lightTravelTimeSum += event.lightTravelTime || 0;
  }

  /**
   * Retourne les données pour l'affichage
   * @returns {object}
   */
  getDisplayData() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      properTime: this.properTime,
      gamma: this.gamma,
      beta: this.beta,
      mass: this.mass,
      initialMass: this.initialMass,
      vCMB: this.vCMB,
      velocityCMB: this.velocityCMB.clone(),
      clockH: this.clockH.tickCount,
      clockV: this.clockV.tickCount,
      clockPeriod: this.clockH.period, // T₀ = 2L/c
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      receivedTicks: Object.fromEntries(this.receivedTicks),
      receptionHistory: [...this.receptionHistory],
      pingTracker: Object.fromEntries(this.pingTracker),
      accelerationHistory: [...this.accelerationHistory],
    };
  }

  /**
   * Libère les ressources
   */
  dispose() {
    // Dispose des géométries et matériaux
    this.mesh.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}
