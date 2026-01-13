/**
 * DraggablePanel.js - Rend un panneau déplaçable
 *
 * Utilisation :
 *   makeDraggable(element, storageKey)
 *
 * Le panneau doit avoir un élément avec [data-drag-handle] pour la poignée.
 * La position est sauvegardée dans localStorage si storageKey est fourni.
 */

/**
 * Rend un élément déplaçable
 * @param {HTMLElement} element - L'élément à rendre déplaçable
 * @param {string} [storageKey] - Clé localStorage pour persister la position
 */
export function makeDraggable(element, storageKey = null) {
  const handle = element.querySelector('[data-drag-handle]') || element;

  let isDragging = false;
  let startX, startY;
  let initialLeft, initialTop;

  // Restaurer la position sauvegardée
  if (storageKey) {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const { left, top } = JSON.parse(saved);
        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
        element.style.right = 'auto';
        element.style.bottom = 'auto';
      } catch {
        // Ignorer les erreurs de parsing
      }
    }
  }

  handle.style.cursor = 'grab';

  const onMouseDown = (e) => {
    // Ignorer si c'est un élément interactif
    if (e.target.tagName === 'SELECT' ||
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'BUTTON' ||
        e.target.closest('button')) {
      return;
    }

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = element.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    handle.style.cursor = 'grabbing';
    element.style.transition = 'none';

    e.preventDefault();
  };

  const onMouseMove = (e) => {
    if (!isDragging) {return;}

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    let newLeft = initialLeft + deltaX;
    let newTop = initialTop + deltaY;

    // Contraindre à la fenêtre
    const maxLeft = window.innerWidth - element.offsetWidth;
    const maxTop = window.innerHeight - element.offsetHeight;

    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    element.style.left = `${newLeft}px`;
    element.style.top = `${newTop}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
  };

  const onMouseUp = () => {
    if (!isDragging) {return;}

    isDragging = false;
    handle.style.cursor = 'grab';
    element.style.transition = '';

    // Sauvegarder la position
    if (storageKey) {
      const rect = element.getBoundingClientRect();
      localStorage.setItem(storageKey, JSON.stringify({
        left: rect.left,
        top: rect.top,
      }));
    }
  };

  // Touch support
  const onTouchStart = (e) => {
    if (e.touches.length !== 1) {return;}
    const touch = e.touches[0];
    onMouseDown({ clientX: touch.clientX, clientY: touch.clientY, target: e.target, preventDefault: () => e.preventDefault() });
  };

  const onTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) {return;}
    const touch = e.touches[0];
    onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    e.preventDefault();
  };

  const onTouchEnd = () => {
    onMouseUp();
  };

  // Event listeners
  handle.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  handle.addEventListener('touchstart', onTouchStart, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);

  // Retourner une fonction de nettoyage
  return () => {
    handle.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    handle.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  };
}
