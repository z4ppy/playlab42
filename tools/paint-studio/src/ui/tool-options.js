/**
 * Barre d'options contextuelle : réglages de l'outil actif (taille, opacité,
 * dureté, tolérance, style de forme…) et actions de sélection.
 * Chaque contrainte clavier (Maj, Alt) a son équivalent tactile ici.
 */

import { OPTION_DEFS } from '../tools/index.js';

/** Actions de la sélection, accessibles sans clavier. */
const SELECTION_ACTIONS = [
  ['select-all', 'Tout'],
  ['copy', 'Copier'],
  ['cut', 'Couper'],
  ['paste', 'Coller'],
  ['delete-selection', 'Effacer'],
  ['deselect', 'Désélect.'],
];

/** Crée un élément avec classe et texte. */
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

export class ToolOptions {
  /**
   * @param {HTMLElement} container
   * @param {any} app - Application (commandes) ; app.editor donne l'outil et ses réglages
   */
  constructor(container, app) {
    this.container = container;
    this.app = app;
    container.addEventListener('input', (e) => this.onInput(e, false));
    container.addEventListener('change', (e) => this.onInput(e, true));
    container.addEventListener('click', (e) => {
      const button = /** @type {HTMLElement} */ (e.target).closest('button[data-command]');
      if (button) {
        app.runCommand(button.getAttribute('data-command'), null);
      }
    });
    // Indice visible (fondu au bord droit) quand des options sont hors champ.
    container.addEventListener('scroll', () => this.syncOverflow(), { passive: true });
    window.addEventListener('resize', () => this.syncOverflow());
  }

  /** Signale qu'il reste des options à droite (la barre défile horizontalement). */
  syncOverflow() {
    const { container } = this;
    const hidden = container.scrollWidth - container.clientWidth - container.scrollLeft;
    container.classList.toggle('ps-options--more', hidden > 1);
  }

  /** Reconstruit les contrôles pour l'outil actif. */
  render() {
    const tool = this.app.editor.tool;
    const settings = this.app.editor.settingsFor(tool.id);
    const controls = tool.options.map((name) => this.control(name, settings[name]));
    if (controls.length === 0) {
      controls.push(element('p', 'options-hint', 'Glissez pour déplacer la vue ; pincez pour zoomer.'));
    }
    this.container.replaceChildren(...controls);
    this.syncOverflow();
  }

  /** Contrôle d'un réglage selon son type. */
  control(name, value) {
    const def = OPTION_DEFS[name];
    const builders = {
      range: () => this.range(name, def, value),
      toggle: () => this.toggle(name, def, value),
      choice: () => this.choice(name, def, value),
      actions: () => this.actions(),
    };
    return builders[def.type]();
  }

  range(name, def, value) {
    const label = element('label', 'option option--range');
    const caption = element('span', 'option-label', def.label);
    const output = element('output', 'option-value', `${value}${def.unit}`);
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min: String(def.min), max: String(def.max), step: String(def.step), value: String(value) });
    input.className = 'range';
    input.dataset.option = name;
    input.setAttribute('aria-valuetext', `${value}${def.unit}`);
    // L'<output> placé dans le libellé capterait l'étiquette : nom explicite.
    input.setAttribute('aria-label', def.label);
    caption.append(' ', output);
    label.append(caption, input);
    return label;
  }

  toggle(name, def, value) {
    const label = element('label', 'option option--toggle');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(value);
    input.dataset.option = name;
    if (def.hint) {
      // Le nom accessible commence par le libellé visible et garde le détail.
      input.setAttribute('aria-label', `${def.label} (${def.hint})`);
      label.title = def.hint;
    }
    label.append(input, element('span', 'option-label', def.label));
    return label;
  }

  choice(name, def, value) {
    const label = element('label', 'option option--choice');
    const select = document.createElement('select');
    select.className = 'input';
    select.dataset.option = name;
    select.append(...def.choices.map(([id, text]) => new Option(text, id, false, id === value)));
    label.append(element('span', 'option-label', def.label), select);
    return label;
  }

  actions() {
    const group = element('div', 'option option--actions');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Actions de sélection');
    for (const [command, text] of SELECTION_ACTIONS) {
      const button = element('button', 'chip-btn', text);
      button.setAttribute('type', 'button');
      button.dataset.command = command;
      group.append(button);
    }
    return group;
  }

  /**
   * @param {Event} e
   * @param {boolean} final - « change » : valeur définitive
   */
  onInput(e, final) {
    const input = /** @type {HTMLInputElement} */ (e.target);
    const name = input.dataset?.option;
    if (!name) {
      return;
    }
    const value = input.type === 'checkbox' ? input.checked : input.value;
    const stored = this.app.editor.setSetting(this.app.editor.tool.id, name, value, final);
    const def = OPTION_DEFS[name];
    if (def.type === 'range') {
      const output = input.parentElement?.querySelector('output');
      if (output) {
        output.value = `${stored}${def.unit}`;
      }
      input.setAttribute('aria-valuetext', `${stored}${def.unit}`);
    }
  }
}
