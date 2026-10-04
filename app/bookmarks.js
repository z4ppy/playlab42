/**
 * Bibliothèque éditoriale de ressources externes.
 * @module app/bookmarks
 */

import { state, setState } from './state.js';
import { el } from './dom-cache.js';
import { cloneTemplate, create } from '../lib/dom.js';
import { matchesQuery, renderTagFilters, setDiscoveryCount, setDiscoveryMessage } from '../lib/catalogue-ui.js';

/**
 * Charge le catalogue sans confondre une erreur réseau avec un catalogue vide.
 * @returns {Promise<void>}
 */
export async function loadBookmarksCatalogue() {
  try {
    const response = await fetch('./data/bookmarks.json');
    if (!response.ok) { throw new Error('Catalogue des liens indisponible'); }
    const catalogue = await response.json();
    if (!Array.isArray(catalogue.categories) || catalogue.categories.some(category => !Array.isArray(category.bookmarks))) {
      throw new Error('Catalogue des liens invalide');
    }
    setState({ bookmarksCatalogue: catalogue });
  } catch (error) {
    console.warn('Catalogue bookmarks non disponible:', error.message);
    setState({ bookmarksCatalogue: null });
  }
}

/**
 * Filtre une catégorie par tag et mots, y compris son domaine et son intitulé.
 * @param {Object} category - Catégorie du catalogue
 * @returns {Object[]} Ressources correspondantes
 */
function filterBookmarks(category) {
  return category.bookmarks.filter(bookmark =>
    (!state.bookmarkTagFilter || bookmark.tags?.includes(state.bookmarkTagFilter)) &&
    matchesQuery(
      el.search.value,
      bookmark.title, bookmark.displayTitle,
      bookmark.description, bookmark.displayDescription,
      bookmark.domain, category.label, ...(bookmark.tags || []),
    ),
  );
}

/**
 * Crée une carte avec description permanente et lien externe natif.
 * @param {Object} bookmark - Ressource
 * @returns {DocumentFragment} Carte prête à insérer
 */
function createBookmarkItemElement(bookmark) {
  const fragment = cloneTemplate('bookmark-item-template');
  const link = fragment.querySelector('a');
  link.href = bookmark.url;
  link.target = '_blank';
  link.rel = 'noopener';
  fragment.querySelector('.bookmark-icon')?.remove();
  fragment.querySelector('.bookmark-title').textContent = bookmark.title || bookmark.displayTitle;
  fragment.querySelector('.bookmark-description').textContent =
    bookmark.description || bookmark.displayDescription || '';
  fragment.querySelector('.bookmark-domain').textContent = bookmark.domain || new URL(bookmark.url).hostname;
  link.appendChild(create('span', { class: 'bookmark-external' }, ['Nouvelle fenêtre ↗']));
  return fragment;
}

/**
 * Crée une section éditoriale adressable au clavier par la navigation.
 * @param {Object} category - Catégorie du catalogue
 * @param {Object[]} bookmarks - Ressources filtrées
 * @param {string} id - Identifiant de la section
 * @returns {DocumentFragment} Section prête à insérer
 */
function createBookmarkCategoryElement(category, bookmarks, id) {
  const fragment = cloneTemplate('bookmark-category-template');
  const container = fragment.querySelector('.bookmark-category');
  container.id = id;
  const heading = fragment.querySelector('.bookmark-category-title');
  heading.id = `${id}-title`;
  heading.tabIndex = -1;
  container.setAttribute('role', 'region');
  container.setAttribute('aria-labelledby', heading.id);
  fragment.querySelector('.bookmark-category-icon')?.remove();
  fragment.querySelector('.bookmark-category-label').textContent = category.label;
  fragment.querySelector('.bookmark-category-count').textContent = `${bookmarks.length} lien${bookmarks.length > 1 ? 's' : ''}`;
  const list = fragment.querySelector('.bookmark-list');
  for (const bookmark of bookmarks) {
    list.appendChild(createBookmarkItemElement(bookmark));
  }
  return fragment;
}

/**
 * Ancien contrat de preview : les descriptions sont maintenant dans les cartes.
 * Les appels historiques ne doivent plus ouvrir de panneau flottant.
 */
export function showBookmarkPreview() {
  hideBookmarkPreview();
}

/**
 * Masque une éventuelle preview héritée du portail.
 */
export function hideBookmarkPreview() {
  el.bookmarkPreview?.classList.remove('visible');
  el.bookmarkPreview?.setAttribute('aria-hidden', 'true');
}

/**
 * Rend les filtres de tags du catalogue (aucun tag si le catalogue est absent).
 * @param {Object|null} catalogue - Catalogue chargé
 */
function renderBookmarkFilters(catalogue) {
  renderTagFilters(
    el.bookmarkFilters,
    (catalogue?.tags || []).map(tag => ({ ...tag, label: tag.label || tag.id })),
    state.bookmarkTagFilter,
    { allLabel: 'Tous les liens' },
  );
}

/**
 * Crée le lien de navigation d'une catégorie ; le fragment reste natif mais le titre reçoit le focus.
 * @param {Object} category - Catégorie du catalogue
 * @param {string} id - Identifiant de la section
 * @param {HTMLDetailsElement} disclosure - Menu de navigation à replier au clic
 * @returns {HTMLAnchorElement} Lien prêt à insérer
 */
function createBookmarkNavigationLink(category, id, disclosure) {
  const link = create('a', { href: `#${id}-title`, class: 'bookmark-navigation-link' }, [category.label]);
  link.addEventListener('click', () => {
    // Le fragment reste natif ; le titre devient aussi la destination clavier.
    disclosure.open = false;
    document.getElementById(`${id}-title`)?.focus({ preventScroll: true });
  });
  return link;
}

/**
 * Construit la navigation et les sections des catégories qui contiennent des ressources visibles.
 * @param {Object[]} categories - Catégories du catalogue
 * @returns {{disclosure: HTMLElement, sections: DocumentFragment, totalVisible: number}} Rendu et total
 */
function buildBookmarkSections(categories) {
  const navigation = create('nav', { class: 'bookmark-navigation', 'aria-label': 'Catégories de liens' });
  const disclosure = create('details', { class: 'bookmark-navigation-disclosure' }, [
    create('summary', {}, ['Aller à une catégorie']), navigation,
  ]);
  const sections = document.createDocumentFragment();
  let totalVisible = 0;
  for (const [index, category] of categories.entries()) {
    const bookmarks = filterBookmarks(category);
    if (!bookmarks.length) { continue; }
    const id = `bookmark-category-${category.id || index}`;
    navigation.appendChild(createBookmarkNavigationLink(category, id, disclosure));
    sections.appendChild(createBookmarkCategoryElement(category, bookmarks, id));
    totalVisible += bookmarks.length;
  }
  return { disclosure, sections, totalVisible };
}

/**
 * Choisit le message affiché quand aucune ressource n'est visible.
 * @param {Object|null} catalogue - Catalogue chargé
 * @returns {string} Message vide adapté à la cause
 */
function bookmarksEmptyMessage(catalogue) {
  if (!catalogue) { return 'Les liens sont momentanément indisponibles. Réessayez en rechargeant la page.'; }
  const totalAvailable = catalogue.categories.reduce((sum, category) => sum + category.bookmarks.length, 0);
  return totalAvailable
    ? 'Aucun lien ne correspond à cette sélection. Modifiez la recherche ou réinitialisez les filtres.'
    : 'Aucun lien disponible pour le moment.';
}

/**
 * Met à jour le message vide ; l'indisponibilité est annoncée comme une alerte.
 * @param {Object|null} catalogue - Catalogue chargé
 * @param {number} totalVisible - Nombre de ressources affichées
 */
function updateBookmarksEmptyState(catalogue, totalVisible) {
  el.emptyBookmarks.textContent = bookmarksEmptyMessage(catalogue);
  el.emptyBookmarks.classList.toggle('visible', totalVisible === 0);
  if (catalogue) { el.emptyBookmarks.removeAttribute('role'); }
  else { el.emptyBookmarks.setAttribute('role', 'alert'); }
}

/**
 * Affiche les catégories et toutes les ressources correspondantes.
 */
export function renderBookmarks() {
  hideBookmarkPreview();
  el.bookmarkTree.textContent = '';
  const catalogue = state.bookmarksCatalogue;
  renderBookmarkFilters(catalogue);

  const { disclosure, sections, totalVisible } = buildBookmarkSections(catalogue?.categories || []);
  if (totalVisible) {
    el.bookmarkTree.append(disclosure, sections);
  }
  updateBookmarksEmptyState(catalogue, totalVisible);
  if (state.activeTab !== 'bookmarks') { return; }
  if (catalogue) { setDiscoveryCount(totalVisible, 'liens'); }
  else { setDiscoveryMessage('Liens indisponibles'); }
}

/**
 * Sélectionne un tag sans déplacer le focus du contrôle actif.
 * @param {string|null} tagId - Tag ou absence de filtre
 */
export function selectBookmarkTag(tagId) {
  setState({ bookmarkTagFilter: tagId || null });
  renderBookmarks();
}
