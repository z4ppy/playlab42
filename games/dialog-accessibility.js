/**
 * Suit l'ouverture d'une modale CSS et assure focus, Échap et boucle Tab.
 * @param {HTMLElement} overlay Conteneur de la modale.
 * @param {{openClass: string, onClose: Function}} options Classe visible et fermeture.
 * @returns {Function} Nettoyage des écouteurs.
 */
export function observeDialog(overlay, { openClass, onClose }) {
  let opened = false;
  let previousFocus = null;
  let pendingFocus = null;
  let awaitingFocus = false;
  const focusable = () => [...overlay.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
    .filter(element => {
      if (element.closest('[hidden], [aria-hidden="true"]')) {return false;}
      for (let ancestor = element; ancestor && overlay.contains(ancestor); ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (style.display === 'none' || style.visibility === 'hidden') {return false;}
      }
      return true;
    });
  const focusInitial = () => {
    if (!awaitingFocus || !overlay.classList.contains(openClass)) {return;}
    if (!overlay.contains(document.activeElement)) {
      focusable()[0]?.focus();
    }
    awaitingFocus = !overlay.contains(document.activeElement);
  };
  const cancelPendingFocus = () => {
    if (pendingFocus !== null) {
      cancelAnimationFrame(pendingFocus);
      pendingFocus = null;
    }
  };
  const sync = () => {
    const visible = overlay.classList.contains(openClass);
    overlay.setAttribute('aria-hidden', String(!visible));
    if (visible && !opened) {
      previousFocus = document.activeElement;
      awaitingFocus = true;
      focusInitial();
      if (awaitingFocus) {
        // Le premier RAF peut preceder la transition de visibility.
        pendingFocus = requestAnimationFrame(() => {
          pendingFocus = null;
          focusInitial();
        });
      }
    } else if (!visible && opened) {
      awaitingFocus = false;
      cancelPendingFocus();
      if (overlay.contains(document.activeElement)) {previousFocus?.focus();}
    }
    opened = visible;
  };
  const trapTab = (event) => {
    const items = focusable();
    const first = items[0];
    const last = items[items.length - 1];
    if (!items.length) { event.preventDefault(); return; }
    if (!overlay.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const keydown = (event) => {
    if (!overlay.classList.contains(openClass)) {return;}
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === 'Tab') {
      trapTab(event);
    }
  };
  const observer = new MutationObserver(sync);
  observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('keydown', keydown, true);
  overlay.addEventListener('transitionstart', focusInitial);
  overlay.addEventListener('transitionend', focusInitial);
  sync();
  return () => {
    observer.disconnect();
    awaitingFocus = false;
    cancelPendingFocus();
    document.removeEventListener('keydown', keydown, true);
    overlay.removeEventListener('transitionstart', focusInitial);
    overlay.removeEventListener('transitionend', focusInitial);
  };
}
