/**
 * Playlab42 - Identité animée du portail
 *
 * Trois touches légères, sans dépendance :
 * - le titre se « décode » au chargement, comme des tokens qui se résolvent ;
 * - la fiole de l'introduction réagit au clic (changement de teinte et agitation) ;
 * - les cartes reçoivent un halo qui suit le pointeur ;
 * - un reflet traverse le titre à chaque changement d'onglet ;
 * - easter egg : un clic sur la tuile « Pl 42 », ou la frappe de « lab »,
 *   fait déborder la fiole d'étoiles.
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
const SWEEP_DURATION_MS = 1200;
const OVERFLOW_DURATION_MS = 2600;

/**
 * Séquence secrète au clavier. Les chiffres 1 à 4 changent déjà d'onglet
 * (app/keyboard-commands.js) : « 42 » est donc réservé au clic sur la tuile.
 */
export const SECRET_SEQUENCE = ['l', 'a', 'b'];

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
    replayClass(flask, 'is-shaken', SHAKE_DURATION_MS, win);
  }
  return next;
}

/**
 * Rejoue une classe d'animation CSS sur un élément, même si elle est déjà active.
 *
 * @param {Element} element
 * @param {string} className
 * @param {number} duration - Durée avant retrait de la classe (ms)
 * @param {Window} win
 */
function replayClass(element, className, duration, win) {
  element.classList.remove(className);
  // Forcer un recalcul pour rejouer l'animation même sur des déclenchements rapprochés.
  void element.getBoundingClientRect();
  element.classList.add(className);
  win.setTimeout(() => element.classList.remove(className), duration);
}

/**
 * Fait passer un reflet dans le dégradé du titre.
 *
 * @param {Document} [doc=document]
 * @param {Window} [win=window]
 * @returns {boolean} true si le reflet a été lancé
 */
export function sweepTitle(doc = document, win = window) {
  const letters = doc.querySelector('.brand-letters');
  if (!letters || prefersReducedMotion(win)) {
    return false;
  }
  replayClass(letters, 'is-sweeping', SWEEP_DURATION_MS, win);
  return true;
}

/**
 * Fait déborder la fiole : le liquide monte dans le col et une gerbe d'étoiles s'échappe.
 * En mouvement réduit, seule la teinte change (réaction suivante).
 *
 * @param {HTMLElement} flask - Bouton de la fiole
 * @param {Window} [win=window]
 */
export function overflowFlask(flask, win = window) {
  if (prefersReducedMotion(win)) {
    triggerReaction(flask, win);
    return;
  }
  replayClass(flask, 'is-overflowing', OVERFLOW_DURATION_MS, win);
}

/**
 * Crée un détecteur de séquence de touches.
 *
 * Chaque appel reçoit une touche et renvoie true quand la séquence vient d'être
 * complétée. Une pause plus longue que `timeout` entre deux touches recommence
 * la détection ; une touche erronée aussi, sauf si elle commence une nouvelle séquence.
 *
 * @param {string[]} sequence - Touches attendues, dans l'ordre
 * @param {object} [options]
 * @param {number} [options.timeout=1200] - Délai maximal entre deux touches (ms)
 * @param {() => number} [options.now=Date.now] - Horloge injectable pour les tests
 * @returns {(key: string) => boolean}
 */
export function createSequenceDetector(sequence, { timeout = 1200, now = Date.now } = {}) {
  let index = 0;
  let last = -Infinity;
  return key => {
    const time = now();
    if (time - last > timeout) {
      index = 0;
    }
    last = time;
    if (key === sequence[index]) {
      index++;
    } else {
      index = key === sequence[0] ? 1 : 0;
    }
    if (index === sequence.length) {
      index = 0;
      return true;
    }
    return false;
  };
}

/**
 * Indique si une frappe clavier vise un champ de saisie (à ignorer pour l'easter egg).
 *
 * @param {EventTarget|null} target
 * @returns {boolean}
 */
export function isTypingTarget(target) {
  return target instanceof Element
    && (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') !== null);
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
 * Indique si une frappe doit être ignorée par l'easter egg :
 * saisie en cours, touche de modification, ou jeu affiché en plein écran.
 *
 * @param {KeyboardEvent} event
 * @param {Document} doc
 * @returns {boolean}
 */
function shouldIgnoreKey(event, doc) {
  return event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)
    || doc.body.classList.contains('game-active');
}

/**
 * Branche le décodage du titre au chargement et au survol du logo.
 *
 * @param {Document} doc
 * @param {Window} win
 */
function bindTitle(doc, win) {
  const letters = doc.querySelector('.brand-letters');
  if (!letters || prefersReducedMotion(win)) {
    return;
  }
  let stop = playDecode(letters, { win });
  // Rejouer au survol du logo, sans empiler les animations.
  doc.querySelector('.brand')?.addEventListener('pointerenter', () => {
    stop();
    stop = playDecode(letters, { win });
  });
}

/**
 * Branche l'easter egg : clic sur la tuile « Pl 42 » ou frappe de la séquence secrète.
 *
 * @param {Document} doc
 * @param {() => void} celebrate - Effet à déclencher
 */
function bindSecret(doc, celebrate) {
  const secret = createSequenceDetector(SECRET_SEQUENCE);
  doc.addEventListener('keydown', event => {
    if (!shouldIgnoreKey(event, doc) && secret(event.key.toLowerCase())) {
      celebrate();
    }
  });
  doc.querySelector('.brand-mark')?.addEventListener('click', celebrate);
}

/**
 * Branche les animations d'identité sur le portail.
 *
 * @param {Document} [doc=document]
 * @param {Window} [win=window]
 */
export function initBrand(doc = document, win = window) {
  bindTitle(doc, win);

  const flask = doc.querySelector('.hero-flask');
  flask?.addEventListener('click', event => {
    triggerReaction(event.currentTarget, win);
  });

  doc.addEventListener('playlab:tabchange', () => sweepTitle(doc, win));

  bindSecret(doc, () => {
    sweepTitle(doc, win);
    if (flask) {
      overflowFlask(flask, win);
    }
  });

  // Le halo n'a de sens qu'avec un pointeur précis (souris, stylet).
  if (win.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
    doc.querySelector('main')?.addEventListener('pointermove', event => updateSpotlight(event), { passive: true });
  }
}
