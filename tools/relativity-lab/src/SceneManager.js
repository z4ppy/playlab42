/**
 * SceneManager.js - Configuration et rendu Three.js
 *
 * Gère la scène 3D, la caméra, les lumières et le rendu.
 * Utilise les variables CSS du thème Playlab42 pour les couleurs.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Gestionnaire de la scène 3D
 */
export class SceneManager {
  /** @type {THREE.Scene} */
  scene;

  /** @type {THREE.PerspectiveCamera} */
  camera;

  /** @type {THREE.WebGLRenderer} */
  renderer;

  /** @type {OrbitControls} */
  controls;

  /** @type {HTMLElement} */
  container;

  /** @type {THREE.GridHelper} */
  grid;

  /** @type {THREE.AxesHelper} */
  axes;

  /** @type {THREE.Group} Groupe contenant axes et labels (suit la cible) */
  axesGroup;

  /** @type {ResizeObserver} */
  #resizeObserver;

  /** @type {number} Distance cible pour le zoom lissé */
  #targetZoom = 0;

  /** @type {number} Vitesse de lissage du zoom */
  #zoomSmoothFactor = 0.1;

  /**
   * @param {HTMLElement} container - Conteneur DOM pour le canvas
   */
  constructor(container) {
    this.container = container;
    this.#setupScene();
    this.#setupCamera();
    this.#setupRenderer();
    this.#setupLights();
    this.#setupGrid();
    this.#setupAxes();
    this.#setupControls();
    this.#setupResize();
  }

  /**
   * Configure la scène Three.js
   */
  #setupScene() {
    this.scene = new THREE.Scene();

    // Couleur de fond depuis les variables CSS du thème
    const bgColor = this.#getCSSColor('--color-bg', '#1a1a2e');
    this.scene.background = new THREE.Color(bgColor);

    // Brouillard pour donner l'illusion d'une grille infinie
    this.scene.fog = new THREE.Fog(bgColor, 30, 120);
  }

  /**
   * Configure la caméra perspective
   */
  #setupCamera() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(8, 6, 8);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Configure le renderer WebGL
   */
  #setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
  }

  /**
   * Configure l'éclairage de la scène
   */
  #setupLights() {
    // Lumière ambiante douce
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    // Lumière directionnelle principale
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(10, 15, 10);
    directional.castShadow = false;
    this.scene.add(directional);

    // Lumière d'appoint (fill light)
    const fill = new THREE.DirectionalLight(0x4fc3f7, 0.3);
    fill.position.set(-5, 5, -5);
    this.scene.add(fill);
  }

  /**
   * Configure la grille de référence "infinie"
   *
   * Utilise une grande grille (200x200) avec un brouillard qui
   * la fait disparaître progressivement, donnant l'illusion d'infini.
   */
  #setupGrid() {
    const gridColor = this.#getCSSColor('--color-border', '#333333');
    const gridColorCenter = this.#getCSSColor('--color-text-muted', '#666666');

    // Grande grille pour l'effet infini
    this.grid = new THREE.GridHelper(200, 200, gridColorCenter, gridColor);
    this.grid.position.y = -0.01;
    this.scene.add(this.grid);
  }

  /**
   * Configure les axes de référence (X=rouge, Y=vert, Z=bleu)
   * Les axes sont dans un groupe qui suit la cible des contrôles.
   */
  #setupAxes() {
    this.axesGroup = new THREE.Group();

    this.axes = new THREE.AxesHelper(3);
    this.axesGroup.add(this.axes);

    // Labels des axes (utilisant des sprites)
    this.#addAxisLabel('X', new THREE.Vector3(3.3, 0, 0), 0xff6b6b);
    this.#addAxisLabel('Y', new THREE.Vector3(0, 3.3, 0), 0x4ade80);
    this.#addAxisLabel('Z', new THREE.Vector3(0, 0, 3.3), 0x60a5fa);

    this.scene.add(this.axesGroup);
  }

  /**
   * Ajoute un label textuel pour un axe
   * @param {string} text
   * @param {THREE.Vector3} position
   * @param {number} color
   */
  #addAxisLabel(text, position, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(0.5, 0.5, 1);
    this.axesGroup.add(sprite);
  }

  /**
   * Configure les contrôles orbitaux avec zoom lissé
   */
  #setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI * 0.9;

    // Désactiver le zoom natif pour le remplacer par un zoom lissé
    this.controls.enableZoom = false;

    // Cible initiale
    this.controls.target.set(0, 0, 0);

    // Initialiser la distance cible
    this.#targetZoom = this.camera.position.distanceTo(this.controls.target);

    // Gérer le zoom manuellement avec lissage
    this.renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();

      // Calculer le delta de zoom (normaliser pour trackpad vs souris)
      const delta = e.deltaY * 0.01;

      // Mettre à jour la distance cible
      this.#targetZoom *= (1 + delta * 0.1);
      this.#targetZoom = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, this.#targetZoom));
    }, { passive: false });
  }

  /**
   * Applique le zoom lissé
   */
  #updateSmoothZoom() {
    const currentDistance = this.camera.position.distanceTo(this.controls.target);
    const diff = this.#targetZoom - currentDistance;

    // Appliquer le lissage si la différence est significative
    if (Math.abs(diff) > 0.001) {
      const direction = this.camera.position.clone().sub(this.controls.target).normalize();
      const newDistance = currentDistance + diff * this.#zoomSmoothFactor;
      this.camera.position.copy(this.controls.target).add(direction.multiplyScalar(newDistance));
    }
  }

  /**
   * Configure le redimensionnement automatique
   */
  #setupResize() {
    this.#resizeObserver = new ResizeObserver(() => {
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;

      if (width === 0 || height === 0) return;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });
    this.#resizeObserver.observe(this.container);
  }

  /**
   * Récupère une couleur CSS depuis le thème
   * @param {string} varName - Nom de la variable CSS
   * @param {string} fallback - Couleur par défaut
   * @returns {string}
   */
  #getCSSColor(varName, fallback) {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    return value || fallback;
  }

  /**
   * Met à jour la couleur de fond selon le thème
   */
  updateTheme() {
    const bgColor = this.#getCSSColor('--color-bg', '#1a1a2e');
    this.scene.background = new THREE.Color(bgColor);
    if (this.scene.fog) {
      this.scene.fog.color = new THREE.Color(bgColor);
    }
  }

  /**
   * Définit la cible des contrôles orbitaux et déplace les axes
   * @param {THREE.Vector3} target
   * @param {boolean} smooth - Si true, anime la transition
   */
  setTarget(target, smooth = true) {
    if (smooth) {
      this.#targetPosition = target.clone();
    } else {
      this.controls.target.copy(target);
      this.axesGroup.position.copy(target);
      this.grid.position.x = target.x;
      this.grid.position.z = target.z;
    }
  }

  /** @type {THREE.Vector3|null} Position cible pour le suivi lissé */
  #targetPosition = null;

  /**
   * Met à jour la position de la cible (suivi lissé de l'observateur)
   */
  #updateTargetFollow() {
    if (!this.#targetPosition) return;

    const smoothFactor = 0.08;

    // Interpoler la position de la cible des contrôles
    this.controls.target.lerp(this.#targetPosition, smoothFactor);

    // Les axes suivent la cible
    this.axesGroup.position.copy(this.controls.target);

    // La grille suit horizontalement (reste au sol)
    this.grid.position.x = this.controls.target.x;
    this.grid.position.z = this.controls.target.z;
  }

  /**
   * Active/désactive la grille
   * @param {boolean} visible
   */
  setGridVisible(visible) {
    this.grid.visible = visible;
  }

  /**
   * Active/désactive les axes
   * @param {boolean} visible
   */
  setAxesVisible(visible) {
    this.axesGroup.visible = visible;
  }

  /**
   * Effectue le rendu d'une frame
   */
  render() {
    this.#updateSmoothZoom();
    this.#updateTargetFollow();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Libère les ressources
   */
  dispose() {
    this.#resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();

    // Supprimer le canvas du DOM
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
