/**
 * Playlab42 - Identité animée du portail
 *
 * Trois touches légères, sans dépendance :
 * - le titre se « décode » au chargement, comme des tokens qui se résolvent ;
 * - la fiole de l'introduction réagit au clic (changement de teinte et agitation) ;
 * - les cartes reçoivent un halo qui suit le pointeur.
 *
 * Tout reste décoratif : le texte réel du titre est porté par un libellé
 * accessible, et rien ne s'anime si l'utilisateur préfère réduire les mouvements.
 */

/** Glyphes affichés pendant le décodage : un clin d'œil au code et à la chimie. */
export const SCRAMBLE_GLYPHS = '01<>{}[]/\\=+*#λΣΔπ∞≈';

/** Nombre de réactions de la fiole avant de revenir à la teinte d'origine. */
export const FLASK_REACTIONS = 4;

const DECODE_DURATION_MS = 900;
const SHAKE_DURATION_MS = 900;

/**
 * Calcule une image du décodage du titre.
 *
 * Les lettres se révèlent de gauche à droite : la lettre i est figée dès que
 * progress atteint (i + 1) / n. Les autres affichent un glyphe aléatoire.
 * Les espaces restent des espaces pour garder la silhouette du mot.
 *
 * @param {string} text - Texte final
 * @param {number} progress - Avancement entre 0 et 1 (borné)
 * @param {() => number} [random=Math.random] - Source aléatoire dans [0, 1)
 * @param {string} [glyphs=SCRAMBLE_GLYPHS] - Glyphes de remplacement
 * @returns {string} Texte de même longueur que `text`
 */
export function scrambleFrame(text, progress, random = Math.random, glyphs = SCRAMBLE_GLYPHS) {
  const clamped = Math.min(1, Math.max(0, progress));
  const chars = [...text];
  return chars.map((char, i) => {
    if (char === ' ' || clamped >= (i + 1) / chars.length) {
      return char;
    }
    return glyphs[Math.floor(random() * glyphs.length) % glyphs.length];
  }).join('');
}

/**
 * Indique si l'utilisateur préfère limiter les animations.
 * @param {Window} win
 * @returns {boolean}
 */
export function prefersReducedMotion(win = window) {
  return Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/**
 * Joue le décodage du titre sur un élément purement visuel.
 *
 * @param {HTMLElement} element - Élément aria-hidden qui affiche le texte
 * @param {object} [options]
 * @param {Window} [options.win=window]
 * @param {() => number} [options.random=Math.random]
 * @param {number} [options.duration=DECODE_DURATION_MS]
 * @returns {() => void} Fonction qui interrompt l'animation et affiche le texte final
 */
export function playDecode(element, { win = window, random = Math.random, duration = DECODE_DURATION_MS } = {}) {
  const text = element.dataset.brandText || element.textContent;
  let frame = 0;
  let start = null;

  const stop = () => {
    win.cancelAnimationFrame(frame);
    element.textContent = text;
    element.classList.remove('is-decoding');
  };

  const step = timestamp => {
    start ??= timestamp;
    const progress = (timestamp - start) / duration;
    element.textContent = scrambleFrame(text, progress, random);
    if (progress < 1) {
      frame = win.requestAnimationFrame(step);
    } else {
      stop();
    }
  };

  // Figer la largeur finale : les glyphes de passage ne doivent pas faire bouger l'en-tête.
  element.style.minWidth = `${element.getBoundingClientRect().width}px`;
  element.classList.add('is-decoding');
  frame = win.requestAnimationFrame(step);
  return stop;
}

/**
 * Passe la fiole à la réaction suivante et la secoue brièvement.
 *
 * La teinte est portée par l'attribut data-reaction, lu par le CSS.
 *
 * @param {HTMLElement} flask - Bouton de la fiole
 * @param {Window} [win=window]
 * @returns {number} Indice de la nouvelle réaction
 */
export function triggerReaction(flask, win = window) {
  const next = (Number(flask.dataset.reaction || 0) + 1) % FLASK_REACTIONS;
  flask.dataset.reaction = String(next);
  if (!prefersReducedMotion(win)) {
    flask.classList.remove('is-shaken');
    // Forcer un recalcul pour rejouer l'animation même sur des clics rapprochés.
    void flask.offsetWidth;
    flask.classList.add('is-shaken');
    win.setTimeout(() => flask.classList.remove('is-shaken'), SHAKE_DURATION_MS);
  }
  return next;
}

/**
 * Place le halo d'une carte sous le pointeur, en coordonnées locales.
 *
 * @param {PointerEvent} event
 * @param {string} [selector='.card, .epic-card']
 */
export function updateSpotlight(event, selector = '.card, .epic-card') {
  const card = event.target instanceof Element ? event.target.closest(selector) : null;
  if (!card) {
    return;
  }
  const rect = card.getBoundingClientRect();
  card.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
  card.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
}

/**
 * Branche les animations d'identité sur le portail.
 *
 * @param {Document} [doc=document]
 * @param {Window} [win=window]
 */
export function initBrand(doc = document, win = window) {
  const letters = doc.querySelector('.brand-letters');
  if (letters && !prefersReducedMotion(win)) {
    let stop = playDecode(letters, { win });
    // Rejouer au survol du logo, sans empiler les animations.
    doc.querySelector('.brand')?.addEventListener('pointerenter', () => {
      stop();
      stop = playDecode(letters, { win });
    });
  }

  doc.querySelector('.hero-flask')?.addEventListener('click', event => {
    triggerReaction(event.currentTarget, win);
  });

  // Le halo n'a de sens qu'avec un pointeur précis (souris, stylet).
  if (win.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
    doc.querySelector('main')?.addEventListener('pointermove', event => updateSpotlight(event), { passive: true });
  }
}
