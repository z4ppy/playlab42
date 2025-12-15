/**
 * Playlab42 - Utilitaires DOM
 * Helpers légers pour manipuler le DOM sans framework
 */

/**
 * Raccourci pour querySelector
 * @param {string} sel - Sélecteur CSS
 * @param {Document|Element} ctx - Contexte (défaut: document)
 * @returns {Element|null}
 */
export const $ = (sel, ctx = document) => ctx.querySelector(sel);

/**
 * Raccourci pour querySelectorAll (retourne un Array)
 * @param {string} sel - Sélecteur CSS
 * @param {Document|Element} ctx - Contexte (défaut: document)
 * @returns {Element[]}
 */
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/**
 * Crée un élément DOM avec attributs et enfants
 * @param {string} tag - Nom de la balise
 * @param {Object} attrs - Attributs (class, id, data-*, etc.)
 * @param {(string|Element)[]} children - Enfants (texte ou éléments)
 * @returns {Element}
 * @example
 * create('button', { class: 'btn', 'data-id': '42' }, ['Cliquer'])
 */
export function create(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      el.setAttribute(key, value);
    }
  }

  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }

  return el;
}

/**
 * Raccourci pour addEventListener
 * @param {Element} el - Élément cible
 * @param {string} event - Nom de l'événement
 * @param {Function} handler - Handler
 * @param {Object} opts - Options (capture, passive, once)
 * @returns {Function} - Fonction pour retirer le listener
 */
export function on(el, event, handler, opts = {}) {
  el.addEventListener(event, handler, opts);
  return () => el.removeEventListener(event, handler, opts);
}

/**
 * Délégation d'événement
 * @param {Element} el - Élément parent
 * @param {string} event - Nom de l'événement
 * @param {string} selector - Sélecteur des éléments cibles
 * @param {Function} handler - Handler (reçoit l'élément cible et l'événement)
 * @returns {Function} - Fonction pour retirer le listener
 */
export function delegate(el, event, selector, handler) {
  const delegatedHandler = (e) => {
    const target = e.target.closest(selector);
    if (target && el.contains(target)) {
      handler(target, e);
    }
  };
  el.addEventListener(event, delegatedHandler);
  return () => el.removeEventListener(event, delegatedHandler);
}

/**
 * Échappe les caractères HTML dangereux (anti-XSS)
 * @param {string} str - Chaîne à échapper
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') {return '';}

  // Utiliser createElement si disponible (navigateur)
  if (typeof document !== 'undefined' && document.createElement) {
    try {
      const div = document.createElement('div');
      div.textContent = str;
      const result = div.innerHTML;
      // Si innerHTML est vide ou égal à textContent, le mock ne fonctionne pas correctement
      if (!result || result === str) {
        throw new Error('Mock DOM detected, using fallback');
      }
      return result;
    } catch {
      // Fallback si le mock DOM ne fonctionne pas
    }
  }

  // Fallback pour environnements sans DOM (Node.js, tests)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Clone un template HTML par son ID
 * @param {string} id - ID du template (sans #)
 * @returns {DocumentFragment}
 */
export function cloneTemplate(id) {
  const template = document.getElementById(id);
  if (!template) {
    console.warn(`Template #${id} introuvable`);
    return document.createDocumentFragment();
  }
  return template.content.cloneNode(true);
}

/**
 * Clone un template et remplit les données
 * @param {string} id - ID du template
 * @param {Object} data - Données à injecter { sélecteur: valeur }
 * @returns {DocumentFragment}
 * @example
 * fillTemplate('card-template', {
 *   'h3': 'Titre',
 *   'p': 'Description',
 *   '.thumb': { src: 'image.png', alt: 'Image' }
 * })
 */
export function fillTemplate(id, data) {
  const fragment = cloneTemplate(id);

  for (const [selector, value] of Object.entries(data)) {
    const el = fragment.querySelector(selector);
    if (!el) {continue;}

    if (typeof value === 'string') {
      el.textContent = value;
    } else if (typeof value === 'object' && value !== null) {
      for (const [attr, attrValue] of Object.entries(value)) {
        if (attr === 'textContent' || attr === 'innerText') {
          el.textContent = attrValue;
        } else if (attr === 'innerHTML') {
          el.innerHTML = attrValue;
        } else if (attr === 'class') {
          el.className = attrValue;
        } else {
          el.setAttribute(attr, attrValue);
        }
      }
    }
  }

  return fragment;
}

/**
 * Exécute une fonction après que le DOM soit prêt
 * @param {Function} fn - Fonction à exécuter
 */
export function ready(fn) {
  if (document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

/**
 * Crée un debouncer
 * @param {Function} fn - Fonction à debouncer
 * @param {number} delay - Délai en ms
 * @returns {Function}
 */
export function debounce(fn, delay = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
