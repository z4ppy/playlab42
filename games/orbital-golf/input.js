/**
 * Visée du golf orbital : modèle pur (lance-pierre, clavier, réglage fin)
 * et capture des pointeurs sur le canvas.
 *
 * Le glissé se fait n'importe où sur le canvas : le tir part à l'opposé du
 * glissé, comme un lance-pierre, et la puissance suit la longueur tirée. Le
 * doigt ne masque donc jamais la balle et le bras de levier reste long.
 */

import { wrapAngle } from './engine/solver.js';

/** Zone morte en px CSS : en dessous, le glissé ne vise rien et un relâcher annule. */
export const DEAD_ZONE = 14;
/**
 * Longueur de glissé qui donne la puissance maximale.
 * @param {number} side - Côté du canvas en px CSS.
 * @returns {number} Tension maximale, entre 110 et 220 px.
 */
export function maxPull(side) {
  return Math.min(220, Math.max(110, 0.35 * side));
}

/** @param {number} power - Puissance. @returns {number} Entier dans [1, 100]. */
export function clampPower(power) {
  return Math.min(100, Math.max(1, Math.round(power)));
}

/**
 * Lance-pierre : le tir part à l'opposé du glissé.
 * @param {number} dx - Déplacement horizontal du doigt depuis l'appui, en px.
 * @param {number} dy - Déplacement vertical, en px (vers le bas positif).
 * @param {number} pull - Tension maximale (voir maxPull).
 * @returns {{angle:number, power:number}|null} Visée, ou null dans la zone morte.
 */
export function aimFromDrag(dx, dy, pull) {
  const distance = Math.hypot(dx, dy);
  if (distance < DEAD_ZONE) { return null; }
  const ratio = Math.min(1, (distance - DEAD_ZONE) / (pull - DEAD_ZONE));
  return {
    angle: wrapAngle(Math.atan2(-dy, -dx) * 1800 / Math.PI),
    power: clampPower(1 + 99 * ratio),
  };
}

/**
 * Réglage fin, partagé par le clavier et les boutons d'ajustement.
 * @param {{angle:number, power:number}} aim - Visée courante.
 * @param {'angle'|'power'} field - Grandeur ajustée.
 * @param {number} step - Pas signé (dixièmes de degré ou points de puissance).
 * @returns {{angle:number, power:number}} Nouvelle visée.
 */
export function nudgeAim(aim, field, step) {
  if (field === 'angle') { return { ...aim, angle: wrapAngle(aim.angle + step) }; }
  return { ...aim, power: clampPower(aim.power + step) };
}

/** Flèches : → tourne dans le sens horaire (angle croissant, y vers le bas). */
const ARROWS = new Map([
  ['ArrowLeft', ['angle', -10, -1]],
  ['ArrowRight', ['angle', 10, 1]],
  ['ArrowUp', ['power', 1, 10]],
  ['ArrowDown', ['power', -1, -10]],
]);

/**
 * Modèle clavier : ←/→ 1° (Maj : 0,1°), ↑/↓ 1 % (Maj : 10 %).
 * @param {{angle:number, power:number}} aim - Visée courante.
 * @param {string} key - `KeyboardEvent.key`.
 * @param {boolean} shift - Touche Maj enfoncée.
 * @returns {{angle:number, power:number}|null} Nouvelle visée, ou null si la touche n'est pas une flèche.
 */
export function aimFromKey(aim, key, shift) {
  const entry = ARROWS.get(key);
  if (!entry) { return null; }
  const [field, normal, fine] = entry;
  return nudgeAim(aim, field, shift ? fine : normal);
}

/**
 * Visée initiale d'un trou : droit vers le trou, puissance moyenne.
 * @param {{x:number,y:number}} ball - Balle.
 * @param {{x:number,y:number}} target - Centre du trou.
 * @returns {{angle:number, power:number}} Visée.
 */
export function aimToward(ball, target) {
  return { angle: wrapAngle(Math.atan2(target.y - ball.y, target.x - ball.x) * 1800 / Math.PI), power: 40 };
}

/** @param {number} angle - Dixièmes de degré. @returns {string} « 12,5° ». */
export function formatAngle(angle) {
  return `${(angle / 10).toFixed(1).replace('.', ',')}°`;
}

/**
 * Capture d'un seul pointeur sur le canvas et traduction en visée.
 * Les callbacks reçoivent des visées déjà bornées ; `pointercancel` et la
 * perte de capture annulent toujours le geste.
 */
export class PointerAim {
  /**
   * @param {HTMLCanvasElement} canvas - Zone de jeu.
   * @param {{onAim:Function, onRelease:Function, onCancel:Function, enabled:() => boolean}} handlers - Callbacks.
   * @param {AbortSignal} signal - Retire tous les écouteurs au démontage.
   */
  constructor(canvas, handlers, signal) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.gesture = null;
    const on = (name, listener) => canvas.addEventListener(name, listener, { signal });
    on('pointerdown', event => this.down(event));
    on('pointermove', event => this.move(event));
    on('pointerup', event => this.up(event));
    on('pointercancel', event => this.abort(event.pointerId));
    on('lostpointercapture', event => this.abort(event.pointerId));
  }

  /** @returns {boolean} Un glissé est en cours. */
  get active() {
    return this.gesture !== null;
  }

  /** @param {PointerEvent} event - Appui primaire uniquement. */
  down(event) {
    if (this.gesture || event.button > 0 || !this.handlers.enabled()) { return; }
    event.preventDefault();
    this.canvas.setPointerCapture?.(event.pointerId);
    this.gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, aim: null };
  }

  /**
   * @param {PointerEvent} event - Événement du pointeur suivi.
   * @returns {{angle:number, power:number}|null} Visée courante du geste.
   */
  track(event) {
    const { x, y } = this.gesture;
    this.gesture.aim = aimFromDrag(event.clientX - x, event.clientY - y, maxPull(this.canvas.clientWidth));
    return this.gesture.aim;
  }

  /** @param {PointerEvent} event - Déplacement. */
  move(event) {
    if (this.gesture?.id !== event.pointerId) { return; }
    this.handlers.onAim(this.track(event));
  }

  /** @param {PointerEvent} event - Relâcher : tir, ou annulation dans la zone morte. */
  up(event) {
    if (this.gesture?.id !== event.pointerId) { return; }
    const aim = this.track(event);
    this.gesture = null;
    if (aim) { this.handlers.onRelease(aim); } else { this.handlers.onCancel(); }
  }

  /** @param {number} [pointerId] - Pointeur interrompu ; sans argument, annule tout geste. */
  abort(pointerId) {
    if (!this.gesture || (pointerId !== undefined && pointerId !== this.gesture.id)) { return; }
    this.gesture = null;
    this.handlers.onCancel();
  }
}
