/**
 * Contrôles de découverte partagés entre les catalogues du portail.
 * @module lib/catalogue-ui
 */

function normalize(text) {
  return String(text ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * Nom d'auteur affichable, que l'auteur soit un texte ou un objet {name}.
 * Le défaut « Anonyme » du build des parcours n'est pas une attribution.
 * @param {{author?: string|{name?: string}}} entry - Jeu, outil ou parcours
 * @returns {string} Nom, ou chaîne vide si l'auteur est inconnu
 */
export function authorName(entry) {
  const author = entry?.author;
  const name = String((typeof author === 'object' ? author?.name : author) ?? '').trim();
  return name.toLowerCase() === 'anonyme' ? '' : name;
}

/**
 * Affiche « Par <auteur> » dans l'élément, ou le masque si l'auteur est inconnu.
 * @param {HTMLElement} target - Élément de la carte
 * @param {{author?: string|{name?: string}}} entry - Jeu, outil ou parcours
 */
export function renderAuthor(target, entry) {
  const name = authorName(entry);
  target.textContent = name ? `Par ${name}` : '';
  target.hidden = !name;
}

/**
 * Recherche chaque mot de la requête dans les champs fournis.
 * @param {string} query - Requête
 * @param {...string} texts - Champs recherchables
 * @returns {boolean} Vrai si tous les mots correspondent
 */
export function matchesQuery(query, ...texts) {
  const haystack = normalize(texts.join(' '));
  return normalize(query).trim().split(/\s+/u).every(word => haystack.includes(word));
}

/**
 * Aligne un bouton de filtre sur sa définition et sa position dans le conteneur.
 * @param {HTMLElement} container - Conteneur des filtres
 * @param {HTMLButtonElement} button - Bouton existant ou nouveau
 * @param {{id: string, label: string, count?: number}} tag - Filtre représenté
 * @param {number} index - Position attendue
 * @param {{attribute: string, selectedId: string}} view - Attribut dataset et filtre sélectionné
 */
function syncFilterButton(container, button, tag, index, { attribute, selectedId }) {
  button.type = 'button';
  button.dataset[attribute] = tag.id;
  button.className = 'filter';
  const selected = tag.id === selectedId;
  button.classList.toggle('active', selected);
  button.setAttribute('aria-pressed', String(selected));
  button.textContent = tag.count === undefined ? tag.label : `${tag.label} (${tag.count})`;
  if (container.children[index] !== button) {
    container.insertBefore(button, container.children[index] || null);
  }
}

/**
 * Redonne le focus au filtre équivalent (ou au filtre actif) si le rendu l'a fait perdre.
 * @param {HTMLElement} container - Conteneur des filtres
 * @param {HTMLElement} focused - Bouton qui avait le focus
 * @param {string} attribute - Attribut dataset identifiant le filtre
 */
function restoreFilterFocus(container, focused, attribute) {
  if (document.activeElement === focused) { return; }
  const focusedId = focused.dataset[attribute];
  const target = Array.from(container.children).find(button => button.dataset[attribute] === focusedId);
  (target || container.querySelector('.filter.active'))?.focus({ preventScroll: true });
}

/**
 * Met à jour les filtres sans perdre le contrôle utilisé au clavier.
 * @param {HTMLElement} container - Conteneur des filtres
 * @param {Array<{id: string, label: string, count?: number}>} tags - Filtres disponibles
 * @param {string|null} activeTag - Filtre sélectionné
 * @param {Object} options - Attribut dataset et libellé sans filtre
 */
export function renderTagFilters(container, tags, activeTag, { attribute = 'tag', allLabel = 'Tous' } = {}) {
  const focused = container.contains(document.activeElement) ? document.activeElement : null;
  const existing = new Map(Array.from(container.querySelectorAll('.filter'), button => [
    button.dataset[attribute], button,
  ]));
  const filters = [{ id: '', label: allLabel }, ...tags];
  const view = { attribute, selectedId: activeTag || '' };

  for (const [index, tag] of filters.entries()) {
    const button = existing.get(tag.id) || document.createElement('button');
    syncFilterButton(container, button, tag, index, view);
    existing.delete(tag.id);
  }
  for (const button of existing.values()) { button.remove(); }
  if (focused) { restoreFilterFocus(container, focused, attribute); }
}

// Dimensions intrinsèques des vignettes : standard de fait du dépôt 380x180
// (ratio 19/9, cf. --thumb-ratio dans style.css). Posées en attributs width/
// height sur les <img> pour réserver la place avant chargement (anti-CLS) ;
// le rendu final reste piloté par le CSS (width/height 100% + object-fit).
const THUMB_WIDTH = 380;
const THUMB_HEIGHT = 180;

/**
 * Chemin conventionnel de la vignette d'un jeu ou d'un outil, relatif à la racine du site.
 * Un jeu place `thumb.png` à côté de sa page ; un outil, `<page>-thumb.png`.
 * Partagé par le portail et par le build des cartes de partage.
 * @param {'game'|'tool'} type - Nature de l'entrée du catalogue
 * @param {{path: string}} item - Entrée du catalogue, avec le chemin de sa page
 * @returns {string} Chemin de la vignette, qui peut ne pas exister
 */
export function thumbnailPath(type, item) {
  return type === 'game'
    ? item.path.replace('index.html', 'thumb.png')
    : item.path.replace('.html', '-thumb.png');
}

/**
 * Chemin de la variante animée d'une vignette : même nom, extension `.anim.webp`.
 * Exemple : `games/dames/thumb.png` → `games/dames/thumb.anim.webp`.
 * @param {string} path - Chemin de la vignette fixe
 * @returns {string} Chemin de la variante animée, qui peut ne pas exister
 */
export function animatedThumbnailPath(path) {
  return path.replace(/\.[a-z\d]+$/i, '.anim.webp');
}

/**
 * Ajoute à une vignette une image paresseuse qui cède la place à un texte de repli si elle échoue.
 * @param {HTMLElement} thumb - Conteneur de la vignette
 * @param {{src: string, alt: string, fallback: string}} image - Source, texte alternatif et repli (emoji)
 * @returns {HTMLImageElement} Image ajoutée, pour y brancher une éventuelle animation
 */
export function appendThumbnailImage(thumb, { src, alt, fallback }) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.width = THUMB_WIDTH;
  img.height = THUMB_HEIGHT;
  img.onerror = () => {
    // Repli : l'emoji remplace l'image cassée dans le conteneur
    thumb.textContent = fallback;
  };
  thumb.appendChild(img);
  return img;
}

/**
 * Annonce les résultats du catalogue actif et rend son filtre visible même replié.
 * @param {number} count - Nombre de résultats visibles
 * @param {string} noun - Libellé, généralement au pluriel
 */
export function setDiscoveryCount(count, noun) {
  const singular = { parcours: 'parcours', outils: 'outil', jeux: 'jeu', ressources: 'ressource', liens: 'lien' };
  setDiscoveryMessage(`${count} ${count === 1 ? (singular[noun] || noun) : noun}`);
}

/**
 * Annonce un état sans le présenter comme un résultat vide.
 * @param {string} message - État explicite du catalogue actif
 */
export function setDiscoveryMessage(message) {
  const status = document.getElementById('catalogue-status');
  if (!status) { return; }
  status.textContent = message;
  updateDiscoveryControls();
}

/**
 * Synchronise le résumé des filtres et l'action de réinitialisation.
 */
export function updateDiscoveryControls() {
  const options = document.getElementById('discovery-options');
  if (!options) { return; }
  const group = Array.from(options.querySelector('.discovery-filter-groups').children)
    .find(container => !container.hidden);
  const active = group?.querySelector('.filter.active');
  const filtered = Boolean(active && (active.dataset.tag || active.dataset.category));
  document.getElementById('discovery-filter-label').textContent = filtered
    ? `Filtre : ${active.textContent}` : 'Affiner la sélection';
  const search = document.getElementById('search');
  document.getElementById('btn-reset-discovery').hidden = !filtered && !search.value.trim();
}
