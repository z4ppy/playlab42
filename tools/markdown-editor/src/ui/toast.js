/**
 * Message éphémère accessible (role="status"), avec action facultative.
 *
 * Le minuteur est suspendu tant que le message a le focus ou est survolé
 * (WCAG 2.2.1) ; s'il disparaît alors qu'il contenait le focus, celui-ci
 * revient à l'élément qui l'avait avant, ou à la zone de saisie (WCAG 2.4.3).
 *
 * @module ui/toast
 */

const DURATION_MS = 5000;

export class Toast {
  /**
   * @param {HTMLElement} root - Conteneur du message.
   * @param {HTMLElement} text - Zone de texte.
   * @param {HTMLButtonElement} action - Bouton d'action.
   * @param {() => HTMLElement|null} [fallbackFocus] - Destination du focus si
   *   l'élément d'origine n'est plus disponible.
   */
  constructor(root, text, action, fallbackFocus = () => null) {
    this.root = root;
    this.text = text;
    this.action = action;
    this.fallbackFocus = fallbackFocus;
    /** @type {(() => void)|null} */
    this.onAction = null;
    this.timer = 0;
    this.duration = DURATION_MS;
    /** @type {Set<string>} Raisons de suspension en cours (focus, pointeur). */
    this.holds = new Set();
    /** @type {HTMLElement|null} Élément qui avait le focus avant d'entrer dans le message. */
    this.returnFocus = null;
    action.addEventListener('click', () => {
      const callback = this.onAction;
      this.hide();
      callback?.();
    });
    root.addEventListener('focusin', (event) => {
      const from = event.relatedTarget;
      if (from instanceof HTMLElement && !root.contains(from)) {
        this.returnFocus = from;
      }
      this.hold('focus');
    });
    root.addEventListener('focusout', (event) => {
      if (!(event.relatedTarget instanceof Node && root.contains(event.relatedTarget))) {
        this.release('focus');
      }
    });
    root.addEventListener('pointerenter', () => this.hold('pointer'));
    root.addEventListener('pointerleave', () => this.release('pointer'));
  }

  /**
   * @param {string} message
   * @param {{ label: string, run: () => void }} [action]
   */
  show(message, action) {
    this.text.textContent = message;
    this.onAction = action ? action.run : null;
    this.action.hidden = !action;
    this.action.textContent = action ? action.label : '';
    this.root.hidden = false;
    this.duration = action ? DURATION_MS * 2 : DURATION_MS;
    this.schedule();
  }

  /** (Re)lance le minuteur, sauf si le message est suspendu. */
  schedule() {
    clearTimeout(this.timer);
    if (!this.root.hidden && this.holds.size === 0) {
      this.timer = window.setTimeout(() => this.hide(), this.duration);
    }
  }

  /** @param {string} reason */
  hold(reason) {
    this.holds.add(reason);
    clearTimeout(this.timer);
  }

  /** @param {string} reason */
  release(reason) {
    if (this.holds.delete(reason)) {
      this.schedule();
    }
  }

  hide() {
    clearTimeout(this.timer);
    const doc = this.root.ownerDocument;
    const hadFocus = this.root.contains(doc.activeElement);
    this.root.hidden = true;
    this.onAction = null;
    this.holds.clear();
    if (hadFocus) {
      const target = this.returnFocus?.isConnected ? this.returnFocus : this.fallbackFocus();
      target?.focus({ preventScroll: true });
    }
    this.returnFocus = null;
  }
}
