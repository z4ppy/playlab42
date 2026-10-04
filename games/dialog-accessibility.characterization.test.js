/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { observeDialog } from './dialog-accessibility.js';

const PAGE = `<button id="open">Ouvrir</button>
<div id="overlay">
  <button id="first">Premier</button>
  <input id="middle">
  <button id="last">Dernier</button>
  <button id="off" disabled>Inactif</button>
  <div aria-hidden="true"><button id="aria">Caché ARIA</button></div>
  <div hidden><button id="hidden">Caché</button></div>
</div>
<button id="outside">Dehors</button>`;

describe('observeDialog : clavier, focus et fermeture', () => {
  let overlay;
  let onClose;
  let cleanup;

  const $ = id => document.getElementById(id);
  function tab(target, shiftKey = false) {
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  }
  async function open() {
    overlay.classList.add('visible');
    await Promise.resolve();
  }

  beforeEach(() => {
    document.body.innerHTML = PAGE;
    overlay = $('overlay');
    onClose = jest.fn();
    cleanup = observeDialog(overlay, { openClass: 'visible', onClose });
  });
  afterEach(() => cleanup());

  it('reflète immédiatement l\'état fermé puis ouvert avec aria-hidden', async () => {
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    await open();
    expect(overlay.getAttribute('aria-hidden')).toBe('false');
  });

  it('Tab ne boucle ni ne bloque sur un élément intermédiaire', async () => {
    await open();
    $('middle').focus();
    const event = tab($('middle'));
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe($('middle'));
  });

  it('Tab sur le dernier contrôle revient au premier, Maj+Tab sur le dernier ne boucle pas', async () => {
    await open();
    $('last').focus();
    expect(tab($('last'), true).defaultPrevented).toBe(false);
    expect(tab($('last')).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe($('first'));
  });

  it('Maj+Tab sur le premier contrôle va au dernier visible et actif', async () => {
    await open();
    expect(document.activeElement).toBe($('first'));
    expect(tab($('first')).defaultPrevented).toBe(false);
    expect(tab($('first'), true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe($('last'));
  });

  it('ramène Tab vers le premier et Maj+Tab vers le dernier lorsque le focus est hors de la modale', async () => {
    await open();
    $('outside').focus();
    expect(tab($('outside')).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe($('first'));
    $('outside').focus();
    expect(tab($('outside'), true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe($('last'));
  });

  it('bloque Tab quand aucun contrôle n\'est focalisable', async () => {
    overlay.innerHTML = '<button disabled>Inactif</button>';
    await open();
    $('outside').focus();
    expect(tab($('outside')).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe($('outside'));
  });

  it('ignore Tab, Échap et les autres touches tant que la modale est fermée', () => {
    $('outside').focus();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    $('outside').dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);
    expect(tab($('outside')).defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Échap ferme, empêche l\'action par défaut et ne se propage pas aux autres écouteurs', async () => {
    await open();
    const later = jest.fn();
    $('first').addEventListener('keydown', later);
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    $('first').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(later).not.toHaveBeenCalled();
  });

  it('laisse passer toute autre touche ouverte sans fermer ni piéger le focus', async () => {
    await open();
    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    $('first').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ne rend le focus au déclencheur que si le focus était dans la modale', async () => {
    $('open').focus();
    await open();
    expect(document.activeElement).toBe($('first'));
    overlay.classList.remove('visible');
    await Promise.resolve();
    expect(document.activeElement).toBe($('open'));

    await open();
    $('outside').focus();
    overlay.classList.remove('visible');
    await Promise.resolve();
    expect(document.activeElement).toBe($('outside'));
  });

  it('une modale ouverte sans élément précédemment focalisé se ferme sans erreur', async () => {
    document.activeElement.blur();
    await open();
    overlay.classList.remove('visible');
    await Promise.resolve();
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
  });

  it('ne déplace pas un focus déjà présent dans la modale à l\'ouverture', async () => {
    $('last').focus();
    await open();
    expect(document.activeElement).toBe($('last'));
  });

  it('une transition sur une modale fermée ne déplace jamais le focus', () => {
    $('outside').focus();
    overlay.dispatchEvent(new Event('transitionend'));
    expect(document.activeElement).toBe($('outside'));
  });

  it('le nettoyage retire clavier et transitions et cesse d\'observer la classe', async () => {
    await open();
    cleanup();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    $('first').dispatchEvent(event);
    expect(onClose).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    overlay.classList.remove('visible');
    await Promise.resolve();
    expect(overlay.getAttribute('aria-hidden')).toBe('false');
    cleanup();
  });
});
