/**
 * Application Paint Studio : assemble l'éditeur, l'affichage, les entrées,
 * les panneaux (outils, options, couleurs, calques) et les fichiers.
 */

import { isEditableTarget } from '../../../../lib/dom.js';
import { isNativeActivation, resolveShortcut } from '../core/shortcuts.js';
import { hexToRgb, rgbToHex, toCss } from '../core/color.js';
import { sanitizeOption } from '../tools/index.js';
import { Editor } from './editor.js';
import { Renderer } from './renderer.js';
import { CanvasInput } from './input.js';
import { ColorPicker } from './color-picker.js';
import { LayersPanel } from './layers-panel.js';
import { ToolOptions } from './tool-options.js';
import { createCommands } from './commands.js';
import { placeText, setupDialogs } from './dialogs.js';
import { Autosave, dropFiles, handlePaste, importImageLayer, openFile } from './app-io.js';
import { loadValue, saveValue } from './storage.js';

const PREFS_KEY = 'preferences';
/** Bouton d'ouverture de chaque tiroir (aria-expanded, retour du focus). */
const DRAWER_BUTTONS = { color: 'btn-colors', layers: 'btn-layers', file: 'btn-file' };

/** @param {string} id */
const byId = (id) => /** @type {any} */ (document.getElementById(id));

/** Commandes des boutons de calque : fabrique l'entrée d'historique. */
const LAYER_ACTIONS = {
  add: (doc) => doc.addLayer(),
  duplicate: (doc, layer) => doc.duplicateLayer(layer.id),
  delete: (doc, layer) => doc.removeLayer(layer.id),
  up: (doc, layer) => doc.moveLayer(layer.id, doc.indexOf(layer.id) + 1),
  down: (doc, layer) => doc.moveLayer(layer.id, doc.indexOf(layer.id) - 1),
  merge: (doc, layer) => doc.mergeDown(layer.id),
  flatten: (doc) => doc.flatten(),
};

export class App {
  constructor() {
    this.root = byId('app');
    this.editor = new Editor({ onChange: (changes) => this.onChange(changes), toast: (message) => this.toast(message) });
    const view = byId('view');
    this.editor.renderer = new Renderer(view, this.editor);
    this.editor.documentResized();
    this.input = new CanvasInput(view, this.editor);
    /** @type {'primary'|'secondary'} Couleur modifiée par le sélecteur. */
    this.colorTarget = 'primary';
    this.opacityPreview = null;
    this.toastTimer = 0;
    this.autosave = new Autosave(this);
    this.picker = new ColorPicker({
      sv: byId('sv-canvas'), marker: byId('sv-marker'), hue: byId('hue-range'), alpha: byId('alpha-range'),
      hex: byId('hex-input'), recent: byId('recent-colors'), preview: byId('color-preview'),
    }, {
      onInput: (color) => this.editor.setColor(this.colorTarget, color, { recent: false }),
      onCommit: (color) => this.editor.setColor(this.colorTarget, color),
    });
    this.layersPanel = new LayersPanel({
      list: byId('layer-list'), name: byId('layer-name'), opacity: byId('layer-opacity'),
      opacityValue: byId('layer-opacity-value'), blend: byId('layer-blend'), actions: byId('layer-actions'),
    }, this);
    this.options = new ToolOptions(byId('tool-options'), this);
    this.commands = createCommands(this);
    this.editor.openTextDialog = (point) => placeText(this.editor, point);
    setupDialogs();
    this.buildToolbar();
    this.bindChrome();
    this.bindKeyboard();
    this.bindFiles();
    new ResizeObserver(([entry]) => {
      this.editor.resizeScreen(entry.contentRect.width, entry.contentRect.height);
    }).observe(byId('stage'));
  }

  /** Restaure préférences et dernier dessin, puis affiche tout. */
  async start() {
    await this.restorePreferences();
    const restored = await this.autosave.restore();
    this.picker.setColor(this.editor.colors[this.colorTarget]);
    this.onChange(new Set(['tool', 'colors', 'layers', 'history', 'view', 'settings-ui']));
    this.editor.requestRender();
    if (restored) {
      this.toast('Dessin précédent restauré (sauvegarde automatique).');
    }
    this.root.dataset.ready = 'true';
  }

  // ------------------------------------------------------------ interface

  buildToolbar() {
    const toolbar = byId('toolbar');
    const buttons = this.editor.tools.map((tool) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ps-btn ps-tool';
      button.dataset.tool = tool.id;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `${tool.label} (${tool.key})`);
      button.title = `${tool.label} (${tool.key})`;
      const icon = document.createElement('span');
      icon.className = 'ps-tool-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = tool.icon;
      button.append(icon);
      return button;
    });
    toolbar.replaceChildren(...buttons);
    toolbar.addEventListener('click', (e) => {
      const button = e.target.closest('[data-tool]');
      if (button) {
        this.editor.setTool(button.dataset.tool);
      }
    });
  }

  bindChrome() {
    const clicks = {
      'btn-undo': () => this.runCommand('undo'),
      'btn-redo': () => this.runCommand('redo'),
      'btn-colors': () => this.toggleDrawer('color'),
      'btn-layers': () => this.toggleDrawer('layers'),
      'btn-file': () => this.toggleDrawer('file'),
      'zoom-in': () => this.runCommand('zoom', '1'),
      'zoom-out': () => this.runCommand('zoom', '-1'),
      'zoom-fit': () => this.runCommand('zoom-fit'),
      'btn-swap': () => this.runCommand('swap-colors'),
      'btn-default-colors': () => this.runCommand('default-colors'),
      'target-primary': () => this.setColorTarget('primary'),
      'target-secondary': () => this.setColorTarget('secondary'),
    };
    for (const [id, handler] of Object.entries(clicks)) {
      byId(id).addEventListener('click', handler);
    }
    this.root.addEventListener('click', (e) => {
      const target = e.target.closest('[data-close-drawer], #drawer-file [data-command]');
      if (target?.dataset.command) {
        this.closeDrawers();
        this.runCommand(target.dataset.command);
      } else if (target) {
        this.closeDrawers();
      }
    });
  }

  /**
   * Ouvre un tiroir (un seul à la fois sur petit écran) ou le referme.
   * @param {'color'|'layers'|'file'} name
   */
  toggleDrawer(name) {
    if (this.root.dataset.drawer === name) {
      this.closeDrawers();
      return;
    }
    this.root.dataset.drawer = name;
    this.syncDrawers();
    // Le focus entre dans le tiroir : son contenu suit directement au clavier.
    byId(`drawer-${name}`).querySelector('button')?.focus({ preventScroll: true });
    if (name === 'color') {
      // Le carré n'a sa taille réelle qu'une fois le tiroir affiché.
      requestAnimationFrame(() => this.picker.setColor(this.editor.colors[this.colorTarget]));
    }
  }

  closeDrawers() {
    const open = this.root.dataset.drawer;
    this.root.dataset.drawer = 'none';
    this.syncDrawers();
    // Le focus revient au bouton d'origine s'il était dans le tiroir refermé.
    const drawer = document.getElementById(`drawer-${open}`);
    const active = document.activeElement;
    if (drawer && (active === document.body || drawer.contains(active))) {
      byId(DRAWER_BUTTONS[open]).focus({ preventScroll: true });
    }
  }

  syncDrawers() {
    const open = this.root.dataset.drawer;
    for (const [name, button] of Object.entries(DRAWER_BUTTONS)) {
      byId(button).setAttribute('aria-expanded', String(open === name));
    }
  }

  setColorTarget(which) {
    this.colorTarget = which;
    this.picker.setColor(this.editor.colors[which]);
    this.renderColors();
  }

  /**
   * Met à jour l'interface après des changements de l'éditeur.
   * @param {Set<string>} changes
   */
  onChange(changes) {
    const updates = [
      [['tool', 'settings-ui'], () => this.renderTool()],
      [['colors'], () => this.renderColors()],
      [['layers', 'document'], () => this.layersPanel.render()],
      [['thumbs'], () => this.scheduleThumbs()],
      [['history', 'layers', 'document'], () => this.renderHistory()],
      [['view', 'document'], () => this.renderZoom()],
      [['history', 'document'], () => this.autosave.schedule()],
      [['settings', 'colors'], () => this.schedulePreferences()],
    ];
    for (const [keys, update] of updates) {
      if (keys.some((key) => changes.has(key))) {
        update();
      }
    }
  }

  renderTool() {
    for (const button of byId('toolbar').querySelectorAll('[data-tool]')) {
      button.setAttribute('aria-pressed', String(button.dataset.tool === this.editor.tool.id));
    }
    this.root.dataset.tool = this.editor.tool.id;
    this.options.render();
  }

  renderColors() {
    const { primary, secondary } = this.editor.colors;
    const chips = [['chip-primary', primary], ['chip-secondary', secondary], ['target-primary-chip', primary], ['target-secondary-chip', secondary]];
    for (const [id, color] of chips) {
      byId(id).style.setProperty('--ps-swatch', toCss(color));
    }
    byId('target-primary').setAttribute('aria-pressed', String(this.colorTarget === 'primary'));
    byId('target-secondary').setAttribute('aria-pressed', String(this.colorTarget === 'secondary'));
    byId('btn-colors').setAttribute('aria-label', `Couleurs : principale ${rgbToHex(primary)}, secondaire ${rgbToHex(secondary)}`);
    // Pas de réécriture pendant un réglage : l'aller-retour RVB -> TSV ferait trembler la teinte.
    const target = this.editor.colors[this.colorTarget];
    if (!this.picker.dragging && rgbToHex(this.picker.color) !== rgbToHex(target)) {
      this.picker.setColor(target);
    }
    this.picker.renderRecent(this.editor.recentColors);
  }

  renderHistory() {
    const { history } = this.editor;
    const labels = history.peekLabels();
    const undo = byId('btn-undo');
    const redo = byId('btn-redo');
    undo.disabled = !history.canUndo;
    redo.disabled = !history.canRedo;
    undo.title = labels.undo ? `Annuler : ${labels.undo} (Ctrl+Z)` : 'Rien à annuler';
    redo.title = labels.redo ? `Rétablir : ${labels.redo} (Ctrl+Maj+Z)` : 'Rien à rétablir';
  }

  renderZoom() {
    byId('zoom-value').textContent = `${Math.round(this.editor.view.scale * 100)} %`;
    byId('btn-grid').setAttribute('aria-pressed', String(this.editor.showGrid));
  }

  /** Vignettes des calques : au plus quelques fois par seconde pendant un tracé. */
  scheduleThumbs() {
    clearTimeout(this.thumbTimer);
    this.thumbTimer = setTimeout(() => this.layersPanel.refreshThumbs(), 250);
  }

  /**
   * Message temporaire (annonce aussi aux lecteurs d'écran).
   * @param {string} message
   */
  toast(message) {
    const toast = byId('toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  }

  setStatus(message) {
    byId('autosave-status').textContent = message;
  }

  // ------------------------------------------------------------- commandes

  /**
   * @param {string} name
   * @param {string|null} [arg]
   */
  runCommand(name, arg = null) {
    const command = this.commands[name];
    if (!command) {
      return;
    }
    Promise.resolve(command(arg)).catch((error) => this.toast(`Erreur : ${error.message}`));
  }

  /** Échap : abandonne le déplacement, sinon désélectionne, sinon ferme les tiroirs. */
  escape() {
    const { selection } = this.editor;
    this.editor.toolCancel();
    if (selection.floating) {
      selection.cancelFloating();
    } else if (selection.rect) {
      selection.setRect(null);
    } else {
      this.closeDrawers();
    }
  }

  /** @param {string} action */
  layerAction(action) {
    const create = LAYER_ACTIONS[action];
    if (!create) {
      return;
    }
    this.editor.toolCancel();
    this.editor.selection.commit();
    const done = this.editor.record(create(this.editor.doc, this.editor.doc.activeLayer));
    if (!done && action === 'add') {
      this.toast('Limite de calques atteinte.');
    }
  }

  /**
   * Bouton d'une ligne de calque.
   * @param {string} id
   * @param {string} action - select | toggle-visible | toggle-lock
   */
  layerRowAction(id, action) {
    const { doc } = this.editor;
    const layer = doc.getLayer(id);
    if (!layer) {
      return;
    }
    if (action === 'select') {
      this.editor.selection.commit();
      doc.setActive(id);
      this.editor.notify('layers');
      return;
    }
    const prop = action === 'toggle-visible' ? 'visible' : 'locked';
    this.editor.record(doc.updateLayer(id, { [prop]: !layer[prop] }));
  }

  /** Aperçu de l'opacité pendant le glissement, sans étape d'historique. */
  previewLayerOpacity(opacity) {
    const layer = this.editor.doc.activeLayer;
    this.opacityPreview ??= { id: layer.id, from: layer.opacity };
    layer.opacity = opacity;
    byId('layer-opacity-value').value = `${Math.round(opacity * 100)} %`;
    this.editor.requestRender();
  }

  /** Propriétés du calque actif (nom, opacité, mode) : une étape d'historique. */
  updateActiveLayer(props) {
    const { doc } = this.editor;
    const preview = this.opacityPreview;
    this.opacityPreview = null;
    if (preview) {
      const previewed = doc.getLayer(preview.id);
      if (previewed) {
        previewed.opacity = preview.from;
      }
    }
    if (!this.editor.record(doc.updateLayer(doc.activeLayer.id, props))) {
      this.layersPanel.render();
    }
  }

  // ------------------------------------------------------------- clavier

  bindKeyboard() {
    // Un bouton cliqué à la souris garde le focus : Entrée et Espace ne lui
    // reviennent que s'il a été atteint au clavier (Tab), sinon ils restent
    // des raccourcis (valider, déplacer la vue).
    this.pointerFocus = false;
    document.addEventListener('pointerdown', () => {
      this.pointerFocus = true;
    }, true);
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && this.editor.spaceHeld) {
        // Espace a servi au déplacement : pas de clic natif au relâchement.
        e.preventDefault();
        this.editor.spaceHeld = false;
      }
    });
    window.addEventListener('blur', () => {
      this.editor.spaceHeld = false;
    });
  }

  /** @param {KeyboardEvent} e */
  onKeyDown(e) {
    if (e.key === 'Tab') {
      this.pointerFocus = false;
    }
    if (document.querySelector('dialog[open]')) {
      return;
    }
    if (e.key === 'Escape' && this.root.dataset.drawer !== 'none') {
      // Échap ferme le tiroir ouvert, y compris depuis un de ses champs.
      this.closeDrawers();
      return;
    }
    if (this.leavesKeyToTarget(e)) {
      return;
    }
    if (e.code === 'Space' && !e.repeat) {
      // Espace maintenu : le prochain glisser déplace la vue.
      this.editor.spaceHeld = true;
      e.preventDefault();
      return;
    }
    const shortcut = resolveShortcut(e);
    // Ctrl+V est laissé au navigateur : l'événement « paste » apporte les images du système.
    if (!shortcut || shortcut.command === 'paste') {
      return;
    }
    e.preventDefault();
    this.runCommand(shortcut.command, shortcut.arg);
  }

  /**
   * Vrai si la touche revient à l'élément focalisé : saisie dans un champ, ou
   * Entrée / Espace sur un bouton atteint au clavier (son clic natif ne doit
   * pas être annulé), sauf Entrée qui valide une sélection flottante.
   * @param {KeyboardEvent} e
   */
  leavesKeyToTarget(e) {
    const { target } = e;
    if (isEditableTarget(target)) {
      return true;
    }
    const onControl = !this.pointerFocus && target instanceof Element && target !== document.body && target.id !== 'view';
    return isNativeActivation(e, onControl, Boolean(this.editor.selection.floating));
  }

  // ------------------------------------------------------------- fichiers

  bindFiles() {
    byId('file-open').addEventListener('change', (e) => {
      const [file] = e.target.files;
      if (file) {
        openFile(this, file);
      }
    });
    byId('file-import').addEventListener('change', (e) => {
      for (const file of e.target.files) {
        importImageLayer(this, file, file.name.replace(/\.[^.]+$/, ''));
      }
    });
    document.addEventListener('paste', (e) => {
      if (!isEditableTarget(e.target)) {
        handlePaste(this, e);
      }
    });
    const stage = byId('stage');
    const hint = byId('drop-hint');
    stage.addEventListener('dragover', (e) => {
      e.preventDefault();
      hint.hidden = false;
    });
    stage.addEventListener('dragleave', () => {
      hint.hidden = true;
    });
    stage.addEventListener('drop', (e) => {
      e.preventDefault();
      hint.hidden = true;
      dropFiles(this, [...(e.dataTransfer?.files ?? [])]);
    });
  }

  // --------------------------------------------------------- préférences

  schedulePreferences() {
    clearTimeout(this.prefsTimer);
    this.prefsTimer = setTimeout(() => {
      const { settings, colors, recentColors, showGrid } = this.editor;
      saveValue(PREFS_KEY, { settings, colors, recentColors, showGrid });
    }, 500);
  }

  /** Relit les préférences en validant chaque valeur (stockage modifiable par l'utilisateur). */
  async restorePreferences() {
    const prefs = /** @type {any} */ (await loadValue(PREFS_KEY));
    if (!prefs || typeof prefs !== 'object') {
      return;
    }
    const { editor } = this;
    for (const tool of editor.tools) {
      const saved = prefs.settings?.[tool.id] ?? {};
      for (const name of Object.keys(tool.defaults)) {
        editor.settings[tool.id][name] = sanitizeOption(name, saved[name], tool.defaults[name]);
      }
    }
    this.restoreColors(prefs);
    editor.showGrid = prefs.showGrid !== false;
  }

  /** Couleurs principale, secondaire et récentes sauvegardées (valeurs invalides ignorées). */
  restoreColors(prefs) {
    const { editor } = this;
    for (const which of ['primary', 'secondary']) {
      const saved = prefs.colors?.[which];
      if (saved && typeof saved === 'object') {
        editor.colors[which] = hexToRgb(rgbToHex(saved)) ?? editor.colors[which];
      }
    }
    const recent = Array.isArray(prefs.recentColors) ? prefs.recentColors : [];
    editor.recentColors = recent.filter((hex) => typeof hex === 'string' && hexToRgb(hex)).slice(0, 12);
  }
}
