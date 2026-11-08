/**
 * Panneau des calques : liste (du haut vers le bas, comme dans les logiciels
 * de dessin), visibilité, verrou, propriétés du calque actif et actions.
 * Tout se fait par boutons : rien n'exige un glisser précis ou un clavier.
 */

import { BLEND_MODES } from '../core/blend.js';
import { context2d } from './canvas-surface.js';

/** Libellé court d'un mode de fusion. */
const blendLabel = (id) => BLEND_MODES.find((mode) => mode.id === id)?.label ?? id;

export class LayersPanel {
  /**
   * @param {{list: HTMLElement, name: HTMLInputElement, opacity: HTMLInputElement, opacityValue: HTMLOutputElement, blend: HTMLSelectElement, actions: HTMLElement}} el
   * @param {any} app - Application (actions) ; app.editor donne le document
   */
  constructor(el, app) {
    this.el = el;
    this.app = app;
    el.blend.replaceChildren(...BLEND_MODES.map((mode) => new Option(mode.label, mode.id)));
    this.bind();
  }

  bind() {
    const { list, name, opacity, blend, actions } = this.el;
    const app = this.app;
    list.addEventListener('click', (e) => {
      const button = /** @type {HTMLElement} */ (e.target).closest('button[data-action]');
      const row = button?.closest('[data-id]');
      if (button && row) {
        app.layerRowAction(row.getAttribute('data-id'), button.getAttribute('data-action'));
      }
    });
    name.addEventListener('change', () => app.updateActiveLayer({ name: name.value.trim() }));
    // Aperçu pendant le glissement, une seule étape d'historique au relâchement.
    opacity.addEventListener('input', () => app.previewLayerOpacity(Number(opacity.value) / 100));
    opacity.addEventListener('change', () => app.updateActiveLayer({ opacity: Number(opacity.value) / 100 }));
    blend.addEventListener('change', () => app.updateActiveLayer({ blend: blend.value }));
    actions.addEventListener('click', (e) => {
      const button = /** @type {HTMLElement} */ (e.target).closest('button[data-layer-action]');
      if (button) {
        app.layerAction(button.getAttribute('data-layer-action'));
      }
    });
  }

  /** Reconstruit la liste et les propriétés du calque actif. */
  render() {
    const { doc } = this.app.editor;
    const active = doc.activeLayer;
    const rows = [...doc.layers].reverse().map((layer) => this.row(layer, layer === active));
    this.el.list.replaceChildren(...rows);
    this.el.name.value = active.name;
    this.el.opacity.value = String(Math.round(active.opacity * 100));
    this.el.opacityValue.value = `${this.el.opacity.value} %`;
    this.el.blend.value = active.blend;
    this.updateActions();
    this.refreshThumbs();
  }

  /** Active ou grise les actions impossibles (un seul calque, calque du bas…). */
  updateActions() {
    const { doc } = this.app.editor;
    const index = doc.indexOf(doc.activeLayer.id);
    const lower = doc.layers[index - 1];
    const disabled = {
      delete: doc.layers.length <= 1,
      up: index >= doc.layers.length - 1,
      down: index <= 0,
      merge: !lower || lower.locked || !doc.activeLayer.visible,
      flatten: doc.layers.length <= 1,
    };
    for (const button of this.el.actions.querySelectorAll('button[data-layer-action]')) {
      button.toggleAttribute('disabled', Boolean(disabled[button.getAttribute('data-layer-action') ?? '']));
    }
  }

  /**
   * Ligne d'un calque.
   * @param {any} layer
   * @param {boolean} isActive
   */
  row(layer, isActive) {
    const li = document.createElement('li');
    li.className = 'layer-row';
    li.dataset.id = layer.id;
    if (isActive) {
      li.setAttribute('aria-current', 'true');
    }
    const eye = this.toggle('toggle-visible', layer.visible, layer.visible ? '👁' : '◌', `Visibilité de ${layer.name}`);
    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'layer-main';
    main.dataset.action = 'select';
    main.setAttribute('aria-label', `Calque ${layer.name}${isActive ? ' (actif)' : ''}`);
    const thumb = document.createElement('canvas');
    thumb.className = 'layer-thumb';
    thumb.width = 56;
    thumb.height = 42;
    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = layer.name;
    const meta = document.createElement('span');
    meta.className = 'layer-meta';
    meta.textContent = `${Math.round(layer.opacity * 100)} % · ${blendLabel(layer.blend)}`;
    const text = document.createElement('span');
    text.className = 'layer-text';
    text.append(name, meta);
    main.append(thumb, text);
    const lock = this.toggle('toggle-lock', layer.locked, layer.locked ? '🔒' : '🔓', `Verrouiller ${layer.name}`);
    li.append(eye, main, lock);
    return li;
  }

  /** Bouton bascule accessible (aria-pressed). */
  toggle(action, pressed, icon, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'layer-toggle';
    button.dataset.action = action;
    button.setAttribute('aria-pressed', String(pressed));
    button.setAttribute('aria-label', label);
    button.title = label;
    button.textContent = icon;
    return button;
  }

  /** Redessine les vignettes (appel espacé après un tracé). */
  refreshThumbs() {
    const { doc } = this.app.editor;
    for (const canvas of this.el.list.querySelectorAll('canvas.layer-thumb')) {
      const layer = doc.getLayer(canvas.closest('[data-id]')?.getAttribute('data-id') ?? '');
      if (layer) {
        const ctx = context2d(/** @type {HTMLCanvasElement} */ (canvas));
        const scale = Math.min(canvas.width / doc.width, canvas.height / doc.height);
        const w = doc.width * scale;
        const h = doc.height * scale;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(layer.surface.canvas, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      }
    }
  }
}
