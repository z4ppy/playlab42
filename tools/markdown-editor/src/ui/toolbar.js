/**
 * Barre d'outils de mise en forme, construite depuis le catalogue de commandes.
 * @module ui/toolbar
 */

import { COMMANDS, shortcutLabel } from '../commands.js';

/**
 * Crée un bouton de barre d'outils.
 * @param {Document} doc
 * @param {{ id: string, label: string, icon: string, hint: string }} spec
 * @returns {HTMLButtonElement}
 */
function toolButton(doc, spec) {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'mde-tool';
  button.dataset.command = spec.id;
  button.setAttribute('aria-label', spec.hint ? `${spec.label} (${spec.hint})` : spec.label);
  button.title = button.getAttribute('aria-label') ?? spec.label;
  const icon = doc.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.className = `mde-tool-icon mde-tool-icon--${spec.id}`;
  icon.textContent = spec.icon;
  button.append(icon);
  return button;
}

/**
 * Remplit la barre d'outils.
 * @param {HTMLElement} toolbar
 * @param {{ mac: boolean, onCommand: (id: string) => void }} options
 */
export function buildToolbar(toolbar, { mac, onCommand }) {
  const doc = toolbar.ownerDocument;
  const history = [
    { id: 'undo', label: 'Annuler', icon: '↶', hint: mac ? '⌘Z' : 'Ctrl+Z' },
    { id: 'redo', label: 'Rétablir', icon: '↷', hint: mac ? '⌘⇧Z' : 'Ctrl+Maj+Z' },
  ];
  const groups = [history, COMMANDS.map((command) => ({ ...command, hint: shortcutLabel(command, mac) }))];
  groups.forEach((group, index) => {
    if (index > 0) {
      const separator = doc.createElement('span');
      separator.className = 'mde-tool-sep';
      separator.setAttribute('aria-hidden', 'true');
      toolbar.append(separator);
    }
    for (const spec of group) {
      toolbar.append(toolButton(doc, spec));
    }
  });
  // Garder le focus (et le clavier virtuel) dans la zone de saisie au toucher.
  toolbar.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' && event.target instanceof Element && event.target.closest('.mde-tool')) {
      event.preventDefault();
    }
  });
  toolbar.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('.mde-tool') : null;
    if (button instanceof HTMLElement && button.dataset.command) {
      onCommand(button.dataset.command);
    }
  });
  enableRovingFocus(toolbar);
}

/**
 * Navigation au clavier dans la barre (flèches, Début, Fin), un seul arrêt de tabulation.
 * @param {HTMLElement} toolbar
 */
function enableRovingFocus(toolbar) {
  const buttons = () => [...toolbar.querySelectorAll('.mde-tool')];
  buttons().forEach((button, index) => button.setAttribute('tabindex', index === 0 ? '0' : '-1'));
  toolbar.addEventListener('keydown', (event) => {
    const list = buttons();
    const current = list.indexOf(/** @type {Element} */ (event.target));
    const moves = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: list.length - 1 };
    if (current < 0 || !(event.key in moves)) {
      return;
    }
    event.preventDefault();
    const next = list[(moves[event.key] + list.length) % list.length];
    list[current].setAttribute('tabindex', '-1');
    next.setAttribute('tabindex', '0');
    /** @type {HTMLElement} */ (next).focus();
  });
}
