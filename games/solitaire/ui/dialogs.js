/**
 * Fenêtres modales (options, aide, victoire) sur le module partagé
 * `games/dialog-accessibility.js` : focus initial, boucle Tab, Échap et
 * retour du focus sont gérés une seule fois pour tous les jeux.
 *
 * @module games/solitaire/ui/dialogs
 */

import { observeDialog } from '../../dialog-accessibility.js';
import { getTheme, setTheme } from '../../../lib/theme.js';

const OPEN = 'is-open';

/** Une modale : ouverture, fermeture et clic sur le fond. */
class Modal {
  /** @param {HTMLElement} overlay */
  constructor(overlay) {
    this.overlay = overlay;
    this.stopObserving = observeDialog(overlay, { openClass: OPEN, onClose: () => this.close() });
    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        this.close();
      }
    });
  }

  open() {
    this.overlay.classList.add(OPEN);
  }

  close() {
    this.overlay.classList.remove(OPEN);
  }

  get isOpen() {
    return this.overlay.classList.contains(OPEN);
  }
}

/**
 * @typedef {Object} DialogHandlers
 * @property {() => import('./progress.js').DEFAULT_SETTINGS} settings - Réglages actuels
 * @property {(options: {settings: object, seed: number|null}) => void} deal - Distribuer avec ces options
 * @property {() => string} statsText - Bilan affiché dans l'aide
 * @property {() => void} newDeal
 * @property {() => void} replay
 */

export class SolitaireDialogs {
  /**
   * @param {Document} doc
   * @param {DialogHandlers} handlers
   */
  constructor(doc, handlers) {
    this.doc = doc;
    this.handlers = handlers;
    const $ = id => doc.getElementById(id);
    this.options = new Modal($('dialog-options'));
    this.help = new Modal($('dialog-help'));
    this.victory = new Modal($('dialog-victory'));
    this.form = $('options-form');
    this.form.addEventListener('submit', event => this.#submit(event));
    $('opt-theme').addEventListener('change', event => setTheme(event.target.value));
    $('options-close').addEventListener('click', () => this.options.close());
    $('help-close').addEventListener('click', () => this.help.close());
    $('victory-close').addEventListener('click', () => this.victory.close());
    $('victory-new').addEventListener('click', () => this.#then(this.victory, handlers.newDeal));
    $('victory-replay').addEventListener('click', () => this.#then(this.victory, handlers.replay));
  }

  /** Une modale est-elle ouverte (les raccourcis de jeu sont alors suspendus) ? */
  get anyOpen() {
    return [this.options, this.help, this.victory].some(modal => modal.isOpen);
  }

  openOptions() {
    const settings = this.handlers.settings();
    this.form.elements.draw.value = String(settings.drawCount);
    this.doc.getElementById('opt-winnable').checked = settings.winnableOnly;
    this.doc.getElementById('opt-autofinish').checked = settings.autoFinish;
    this.doc.getElementById('opt-theme').value = getTheme();
    this.options.open();
  }

  openHelp() {
    this.doc.getElementById('help-stats').textContent = this.handlers.statsText();
    this.help.open();
  }

  /** @param {string} summary - Bilan de la donne gagnée */
  openVictory(summary) {
    this.doc.getElementById('victory-summary').textContent = summary;
    this.victory.open();
  }

  /** Ferme toutes les modales (nouvelle donne, démontage). */
  closeAll() {
    [this.options, this.help, this.victory].forEach(modal => modal.close());
  }

  dispose() {
    [this.options, this.help, this.victory].forEach(modal => modal.stopObserving());
  }

  #then(modal, action) {
    modal.close();
    action();
  }

  #submit(event) {
    event.preventDefault();
    const raw = this.doc.getElementById('opt-deal').value.trim();
    const seed = raw === '' ? null : Number(raw);
    const input = this.doc.getElementById('opt-deal');
    if (seed !== null && !(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff)) {
      input.setCustomValidity('Entier de 0 à 4 294 967 295.');
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    this.options.close();
    this.handlers.deal({
      settings: {
        drawCount: Number(this.form.elements.draw.value),
        winnableOnly: this.doc.getElementById('opt-winnable').checked,
        autoFinish: this.doc.getElementById('opt-autofinish').checked,
      },
      seed,
    });
  }
}
