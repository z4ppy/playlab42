const shortcuts = {
  ArrowLeft: viewer => viewer.prev(),
  ArrowRight: viewer => viewer.next(),
  Escape: viewer => viewer.menuOpen ? viewer.toggleMenu(false) : viewer.close(),
  m: viewer => viewer.toggleMenu(),
  Home: viewer => viewer.goTo(0),
  End: viewer => viewer.goTo(viewer.slides.length - 1),
};

function isEditable(target) {
  return Boolean(target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
}

/** Boucle uniquement les commandes visibles du plan mobile. */
function trapMenuFocus(event, sidebar) {
  const buttons = [...sidebar.querySelectorAll('button:not(:disabled)')]
    .filter(button => button.getClientRects().length > 0);
  const first = buttons[0];
  const last = buttons.at(-1);
  const boundary = event.shiftKey ? first : last;
  if (first && (!sidebar.contains(document.activeElement) || document.activeElement === boundary)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}

/** Préserve les raccourcis du navigateur et toute saisie éditable. */
export function handleViewerKeydown(viewer, event) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) { return; }
  if (event.key === 'Tab' && viewer.menuOpen && window.innerWidth <= 768) {
    trapMenuFocus(event, viewer.el.sidebar);
    return;
  }
  if (isEditable(event.target)) { return; }
  if (!Object.hasOwn(shortcuts, event.key)) { return; }
  event.preventDefault();
  shortcuts[event.key](viewer);
}
