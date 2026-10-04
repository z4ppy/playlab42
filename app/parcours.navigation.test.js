/**
 * @jest-environment jsdom
 *
 * Contrats de navigation des parcours : chargement du catalogue, ouverture du
 * viewer et restitution du focus à la fermeture.
 */
import { readFileSync } from 'node:fs';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const viewers = [];
class FakeViewer {
  constructor(container, options) {
    this.container = container;
    this.options = options;
    this.load = jest.fn();
    viewers.push(this);
  }
}
jest.unstable_mockModule('../lib/parcours-viewer.js', () => ({ ParcoursViewer: FakeViewer }));

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const { state, setState } = await import('./state.js');
const { el } = await import('./dom-cache.js');
const { loadParcoursCatalogue, openEpic, closeParcours, renderParcours } = await import('./parcours.js');

const epics = [
  { id: 'a', title: 'Alpha', description: 'Premier', path: 'a', slideCount: 2, hierarchy: ['dev'] },
  { id: 'b', title: 'Bêta', description: 'Second', path: 'b', slideCount: 2, hierarchy: ['dev'] },
];
const originalFetch = globalThis.fetch;

beforeEach(() => {
  localStorage.clear();
  viewers.length = 0;
  document.activeElement?.blur();
  setState({ activeTab: 'parcours', currentView: 'catalogue', parcoursCatalogue: { epics },
    parcoursCategory: null, activeFilter: '', parcoursViewer: null });
  el.search.value = '';
  el.viewCatalogue.classList.add('active');
  el.viewParcours.classList.remove('active');
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('chargement du catalogue parcours', () => {
  it('range le JSON reçu dans l’état', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ epics: [] }) }));
    await loadParcoursCatalogue();
    expect(globalThis.fetch).toHaveBeenCalledWith('./data/parcours.json');
    expect(state.parcoursCatalogue).toEqual({ epics: [] });
  });

  it.each([
    ['réponse HTTP en erreur', () => Promise.resolve({ ok: false }), 'Catalogue parcours introuvable'],
    ['réseau en échec', () => Promise.reject(new Error('réseau coupé')), 'réseau coupé'],
  ])('signale %s et vide le catalogue', async (_name, fetcher, message) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.fetch = jest.fn(fetcher);
    await loadParcoursCatalogue();
    expect(state.parcoursCatalogue).toBeNull();
    expect(warn).toHaveBeenCalledWith('Catalogue parcours non disponible:', message);
  });
});

describe('ouverture et fermeture du viewer', () => {
  it('bascule les vues, crée un unique viewer et charge l’epic demandé', () => {
    openEpic('a', 'slide-2');
    expect(el.viewCatalogue.classList.contains('active')).toBe(false);
    expect(el.viewParcours.classList.contains('active')).toBe(true);
    expect(state.currentView).toBe('parcours');
    expect(viewers).toHaveLength(1);
    expect(viewers[0].container).toBe(el.viewParcours);
    expect(viewers[0].load).toHaveBeenCalledWith('a', 'slide-2');
    openEpic('b');
    expect(viewers).toHaveLength(1);
    expect(viewers[0].load).toHaveBeenLastCalledWith('b', null);
  });

  it('journalise le changement de slide et ferme via le rappel du viewer', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    openEpic('a');
    viewers[0].options.onSlideChange({ title: 'Intro' }, 0);
    expect(log).toHaveBeenCalledWith('[Portal] Slide 1: Intro');
    viewers[0].options.onClose();
    expect(state.currentView).toBe('catalogue');
    expect(el.viewCatalogue.classList.contains('active')).toBe(true);
    expect(el.viewParcours.classList.contains('active')).toBe(false);
  });

  it('rend le focus à la carte d’origine, même remplacée par un rendu différé', () => {
    renderParcours();
    el.parcoursCategoriesExpanded.querySelector('[data-epic-id="b"]').focus();
    openEpic('b');
    renderParcours();
    closeParcours();
    expect(document.activeElement.dataset.epicId).toBe('b');
    expect(document.activeElement.isConnected).toBe(true);
  });

  it('retombe sur la recherche quand aucune carte ne correspond', () => {
    openEpic('inconnu');
    closeParcours();
    expect(document.activeElement).toBe(el.search);
  });

  it('conserve le focus de retour quand un epic est rouvert depuis le viewer', () => {
    renderParcours();
    el.parcoursCategoriesExpanded.querySelector('[data-epic-id="a"]').focus();
    openEpic('a');
    openEpic('b');
    closeParcours();
    expect(document.activeElement.dataset.epicId).toBe('a');
  });

  it('ferme sans rendu quand le catalogue est absent', () => {
    setState({ parcoursCatalogue: null });
    el.cardsParcours.textContent = 'inchangé';
    closeParcours();
    expect(el.cardsParcours.textContent).toBe('inchangé');
    expect(el.viewCatalogue.classList.contains('active')).toBe(true);
  });
});
