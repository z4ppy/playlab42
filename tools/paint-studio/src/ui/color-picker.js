/**
 * Sélecteur de couleur maison : carré saturation / valeur, curseurs de teinte
 * et d'opacité, saisie hexadécimale et couleurs récentes.
 *
 * L'état interne est en TSV : on peut ainsi désaturer jusqu'au gris puis
 * revenir sans perdre la teinte choisie (ce que ne permettrait pas un état RVB).
 */

import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, toCss } from '../core/color.js';
import { context2d } from './canvas-surface.js';

export class ColorPicker {
  /**
   * @param {{sv: HTMLCanvasElement, marker: HTMLElement, hue: HTMLInputElement, alpha: HTMLInputElement, hex: HTMLInputElement, recent: HTMLElement, preview: HTMLElement}} elements
   * @param {{onInput: (c: any) => void, onCommit: (c: any) => void}} callbacks
   *   onInput : aperçu continu ; onCommit : choix terminé (rejoint les récentes)
   */
  constructor(elements, callbacks) {
    this.el = elements;
    this.callbacks = callbacks;
    this.hsv = { h: 0, s: 0, v: 0 };
    this.alpha = 255;
    this.dragging = false;
    this.bind();
  }

  bind() {
    const { sv, hue, alpha, hex, recent } = this.el;
    sv.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      sv.setPointerCapture?.(e.pointerId);
      this.pickSv(e);
    });
    sv.addEventListener('pointermove', (e) => {
      if (this.dragging) {
        this.pickSv(e);
      }
    });
    for (const type of ['pointerup', 'pointercancel']) {
      sv.addEventListener(type, () => this.endDrag());
    }
    sv.addEventListener('keydown', (e) => this.onSvKey(e));
    hue.addEventListener('input', () => this.update({ h: Number(hue.value) }));
    alpha.addEventListener('input', () => this.update({}, Math.round((Number(alpha.value) * 255) / 100)));
    for (const input of [hue, alpha]) {
      input.addEventListener('change', () => this.callbacks.onCommit(this.color));
    }
    hex.addEventListener('change', () => this.onHex());
    recent.addEventListener('click', (e) => {
      const button = /** @type {HTMLElement} */ (e.target).closest('[data-color]');
      const color = button && hexToRgb(button.getAttribute('data-color') ?? '');
      if (color) {
        this.setColor(color);
        this.callbacks.onCommit(this.color);
      }
    });
  }

  /** Couleur courante en RVBA. */
  get color() {
    return { ...hsvToRgb(this.hsv), a: this.alpha };
  }

  /**
   * Affiche une couleur sans émettre d'événement (changement venu d'ailleurs).
   * La teinte est conservée pour un gris (saturation nulle).
   * @param {{r: number, g: number, b: number, a?: number}} color
   */
  setColor(color) {
    const hsv = rgbToHsv(color);
    this.hsv = hsv.s === 0 ? { ...hsv, h: this.hsv.h } : hsv;
    this.alpha = color.a ?? 255;
    this.render();
  }

  /** Modifie une partie de l'état puis prévient l'éditeur. */
  update(partial, alpha = this.alpha) {
    this.hsv = { ...this.hsv, ...partial };
    this.alpha = alpha;
    this.render();
    this.callbacks.onInput(this.color);
  }

  pickSv(e) {
    const box = this.el.sv.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const v = 1 - Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));
    this.update({ s, v });
  }

  endDrag() {
    if (this.dragging) {
      this.dragging = false;
      this.callbacks.onCommit(this.color);
    }
  }

  /** Flèches au clavier sur le carré : saturation (gauche/droite) et valeur (haut/bas). */
  onSvKey(e) {
    const steps = { ArrowLeft: ['s', -1], ArrowRight: ['s', 1], ArrowUp: ['v', 1], ArrowDown: ['v', -1] };
    const step = steps[e.key];
    if (!step) {
      return;
    }
    e.preventDefault();
    const [axis, sign] = step;
    this.update({ [axis]: Math.min(1, Math.max(0, this.hsv[axis] + sign * 0.02)) });
    this.callbacks.onCommit(this.color);
  }

  onHex() {
    const parsed = hexToRgb(this.el.hex.value);
    this.el.hex.setAttribute('aria-invalid', String(!parsed));
    if (!parsed) {
      return;
    }
    this.setColor(parsed);
    this.callbacks.onInput(this.color);
    this.callbacks.onCommit(this.color);
  }

  /** Met à jour carré, repère, curseurs, champ hexadécimal et aperçu. */
  render() {
    const { sv, marker, hue, alpha, hex, preview } = this.el;
    this.paintSquare();
    marker.style.left = `${this.hsv.s * 100}%`;
    marker.style.top = `${(1 - this.hsv.v) * 100}%`;
    hue.value = String(Math.round(this.hsv.h));
    alpha.value = String(Math.round((this.alpha * 100) / 255));
    alpha.setAttribute('aria-valuetext', `${alpha.value} %`);
    const color = this.color;
    if (document.activeElement !== hex) {
      hex.value = rgbToHex(color);
      hex.removeAttribute('aria-invalid');
    }
    // Couleurs dynamiques transmises au CSS (dégradé d'opacité, aperçu).
    const opaque = toCss({ ...color, a: 255 });
    alpha.style.setProperty('--ps-alpha-color', opaque);
    preview.style.setProperty('--ps-preview', toCss(color));
    sv.setAttribute('aria-valuetext', `Saturation ${Math.round(this.hsv.s * 100)} %, valeur ${Math.round(this.hsv.v * 100)} %`);
  }

  /** Carré : teinte pure, dégradé blanc horizontal puis noir vertical. */
  paintSquare() {
    const { sv } = this.el;
    const size = Math.max(1, Math.round(sv.clientWidth || 200));
    if (sv.width !== size) {
      sv.width = size;
      sv.height = size;
    }
    const ctx = context2d(sv);
    ctx.fillStyle = toCss(hsvToRgb({ h: this.hsv.h, s: 1, v: 1 }));
    ctx.fillRect(0, 0, size, size);
    const white = ctx.createLinearGradient(0, 0, size, 0);
    white.addColorStop(0, '#ffffff');
    white.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = white;
    ctx.fillRect(0, 0, size, size);
    const black = ctx.createLinearGradient(0, 0, 0, size);
    black.addColorStop(0, 'rgba(0, 0, 0, 0)');
    black.addColorStop(1, '#000000');
    ctx.fillStyle = black;
    ctx.fillRect(0, 0, size, size);
  }

  /**
   * Affiche les couleurs récentes.
   * @param {string[]} colors - Hexadécimales
   */
  renderRecent(colors) {
    const buttons = colors.map((hex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'swatch-btn';
      button.dataset.color = hex;
      button.style.setProperty('--ps-swatch', hex);
      button.setAttribute('aria-label', `Couleur récente ${hex}`);
      button.title = hex;
      return button;
    });
    this.el.recent.replaceChildren(...buttons);
  }
}
