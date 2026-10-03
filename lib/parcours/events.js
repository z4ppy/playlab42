function navigateFromMenu(viewer, slideItem) {
  const index = viewer.slides.findIndex(slide => slide.id === slideItem.dataset.slideId);
  if (index < 0) { return; }
  viewer.goTo(index);
  if (window.innerWidth < 1200) { viewer.toggleMenu(false); }
}

function toggleSection(button) {
  const section = button.closest('.pv-menu-section');
  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  section.classList.toggle('collapsed', expanded);
}

function handleMenuClick(viewer, event) {
  const slideItem = event.target.closest('.pv-menu-slide');
  if (slideItem) {
    navigateFromMenu(viewer, slideItem);
    return;
  }
  const toggle = event.target.closest('.pv-menu-toggle');
  if (toggle) { toggleSection(toggle); }
}

/**
 * Lie les commandes au DOM courant et fournit un nettoyage symétrique.
 * Les anciens boutons détachés ne doivent plus piloter un nouvel epic.
 * @returns {Function} Retire tous les listeners locaux et globaux.
 */
export function bindViewerEvents(viewer) {
  const disposers = [];
  const listen = (target, type, handler) => {
    target.addEventListener(type, handler);
    disposers.push(() => target.removeEventListener(type, handler));
  };
  const el = viewer.el;
  listen(document, 'keydown', viewer.handleKeydown);
  listen(window, 'hashchange', viewer.handleHashChange);
  listen(window, 'message', viewer.handleSlideMessage);
  listen(el.btnClose, 'click', () => viewer.close());
  listen(el.btnMenu, 'click', () => viewer.toggleMenu());
  listen(el.btnCloseMenu, 'click', () => viewer.toggleMenu(false));
  listen(el.btnPrev, 'click', () => viewer.prev());
  listen(el.btnNext, 'click', () => viewer.next());
  listen(el.slideFrame, 'load', () => el.loading.classList.add('hidden'));
  listen(el.menu, 'click', event => handleMenuClick(viewer, event));
  return () => disposers.forEach(dispose => dispose());
}
