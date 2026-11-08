/**
 * Défilement synchronisé entre la zone de saisie et l'aperçu (vue côte à côte).
 *
 * La position d'une ligne source dans la zone de saisie dépend du retour à
 * la ligne automatique : on la mesure dans un miroir invisible qui reprend la
 * largeur et la typographie de la zone, une ligne par élément. Les mesures
 * sont mises en cache jusqu'au prochain changement de texte ou de largeur.
 *
 * @module ui/scroll-sync
 */

import { buildScrollMap } from '../scroll-map.js';

/** Propriétés copiées de la zone de saisie vers le miroir. */
const MIRRORED = [
  'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'tabSize',
  'whiteSpace', 'overflowWrap', 'wordBreak',
];

/** Mesure la position verticale de chaque ligne logique d'une zone de saisie. */
export class LineMeasurer {
  /** @param {HTMLTextAreaElement} textarea */
  constructor(textarea) {
    this.textarea = textarea;
    this.mirror = textarea.ownerDocument.createElement('div');
    this.mirror.setAttribute('aria-hidden', 'true');
    this.mirror.className = 'mde-mirror';
    textarea.ownerDocument.body.append(this.mirror);
    this.cacheKey = '';
    /** @type {number[]} */
    this.tops = [];
  }

  /**
   * Haut de chaque ligne (index 0 = ligne 1), en pixels depuis le haut du contenu.
   * @returns {number[]}
   */
  lineTops() {
    const { textarea, mirror } = this;
    const key = `${textarea.clientWidth}:${textarea.value}`;
    if (key === this.cacheKey) {
      return this.tops;
    }
    const style = getComputedStyle(textarea);
    for (const property of MIRRORED) {
      mirror.style[property] = style[property];
    }
    // La barre de défilement de la zone réduit sa largeur utile.
    mirror.style.width = `${textarea.clientWidth}px`;
    mirror.style.borderRightWidth = '0px';
    mirror.style.borderLeftWidth = '0px';
    const fragment = textarea.ownerDocument.createDocumentFragment();
    const rows = textarea.value.split('\n').map((line) => {
      const row = textarea.ownerDocument.createElement('div');
      row.textContent = line || ' ';
      fragment.append(row);
      return row;
    });
    mirror.replaceChildren(fragment);
    this.tops = rows.map((row) => row.offsetTop);
    mirror.replaceChildren();
    this.cacheKey = key;
    return this.tops;
  }

  /**
   * @param {number} line - Ligne source (1 = première).
   * @returns {number}
   */
  topOf(line) {
    const tops = this.lineTops();
    return tops[Math.min(Math.max(line - 1, 0), tops.length - 1)] ?? 0;
  }
}

/** Couple la zone de saisie et l'aperçu. */
export class ScrollSync {
  /**
   * @param {HTMLTextAreaElement} editor
   * @param {HTMLElement} previewPane - Élément qui défile.
   * @param {() => boolean} isActive - Synchroniser seulement en vue côte à côte.
   */
  constructor(editor, previewPane, isActive) {
    this.editor = editor;
    this.pane = previewPane;
    this.isActive = isActive;
    this.measurer = new LineMeasurer(editor);
    /** @type {import('../scroll-map.js').ScrollMap|null} */
    this.map = null;
    /** Élément dont on ignore le prochain événement de défilement (provoqué par nous). */
    /** @type {HTMLElement|null} */
    this.echo = null;
    editor.addEventListener('scroll', () => this.follow(editor), { passive: true });
    previewPane.addEventListener('scroll', () => this.follow(previewPane), { passive: true });
  }

  /** À appeler après un rendu ou un redimensionnement. */
  invalidate() {
    this.map = null;
  }

  /** @returns {import('../scroll-map.js').ScrollMap} */
  scrollMap() {
    if (this.map) {
      return this.map;
    }
    const paneTop = this.pane.getBoundingClientRect().top - this.pane.scrollTop;
    /** @type {Array<[number, number]>} */
    const anchors = [];
    for (const element of this.pane.querySelectorAll('[data-line]')) {
      const line = Number(element.getAttribute('data-line'));
      anchors.push([this.measurer.topOf(line), element.getBoundingClientRect().top - paneTop]);
    }
    this.map = buildScrollMap(
      anchors,
      this.editor.scrollHeight - this.editor.clientHeight,
      this.pane.scrollHeight - this.pane.clientHeight,
    );
    return this.map;
  }

  /**
   * Répercute le défilement d'un côté sur l'autre.
   * @param {HTMLElement} source
   */
  follow(source) {
    if (this.echo === source) {
      this.echo = null;
      return;
    }
    if (!this.isActive()) {
      return;
    }
    const fromEditor = source === this.editor;
    const target = fromEditor ? this.pane : this.editor;
    const map = this.scrollMap();
    const y = fromEditor ? map.toPreview(source.scrollTop) : map.toEditor(source.scrollTop);
    if (Math.abs(target.scrollTop - y) >= 1) {
      this.echo = target;
      target.scrollTop = y;
      // Si le navigateur n'émet pas d'événement (valeur bornée), on oublie l'écho.
      requestAnimationFrame(() => {
        if (this.echo === target) {
          this.echo = null;
        }
      });
    }
  }
}
