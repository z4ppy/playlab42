/**
 * @jest-environment jsdom
 *
 * Contrats limites des contrôles de découverte partagés, sur un vrai DOM.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { matchesQuery, renderTagFilters, setDiscoveryMessage, updateDiscoveryControls } from './catalogue-ui.js';

describe('contrôles de découverte : valeurs absentes et DOM partiel', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('traite une requête ou un champ absent comme vide', () => {
    expect(matchesQuery(undefined, 'x')).toBe(true);
    expect(matchesQuery(null, undefined, null)).toBe(true);
    expect(matchesQuery('absent', undefined)).toBe(false);
  });

  it('ignore l’annonce sans zone de statut et ne touche pas aux contrôles', () => {
    expect(() => setDiscoveryMessage('x')).not.toThrow();
    expect(() => updateDiscoveryControls()).not.toThrow();
  });

  it('résume le filtre actif de la famille visible et active la réinitialisation', () => {
    document.body.innerHTML = `<input id="search"><p id="catalogue-status"></p>
      <details id="discovery-options"><summary><span id="discovery-filter-label"></span></summary>
      <div class="discovery-filter-groups"><div id="g1" hidden><button class="filter active" data-tag="x">X</button></div>
      <div id="g2"><button class="filter active" data-category="c">Cat</button></div></div></details>
      <button id="btn-reset-discovery" hidden></button>`;
    setDiscoveryMessage('1 jeu');
    expect(document.getElementById('catalogue-status').textContent).toBe('1 jeu');
    expect(document.getElementById('discovery-filter-label').textContent).toBe('Filtre : Cat');
    expect(document.getElementById('btn-reset-discovery').hidden).toBe(false);
  });

  it('n’active pas la réinitialisation pour « Tous » sans recherche, mais pour une recherche seule', () => {
    document.body.innerHTML = `<input id="search"><p id="catalogue-status"></p>
      <details id="discovery-options"><span id="discovery-filter-label"></span>
      <div class="discovery-filter-groups"><div><button class="filter active" data-tag="">Tous</button></div></div></details>
      <button id="btn-reset-discovery"></button>`;
    updateDiscoveryControls();
    expect(document.getElementById('discovery-filter-label').textContent).toBe('Affiner la sélection');
    expect(document.getElementById('btn-reset-discovery').hidden).toBe(true);
    document.getElementById('search').value = ' mot ';
    updateDiscoveryControls();
    expect(document.getElementById('btn-reset-discovery').hidden).toBe(false);
  });

  it('crée des boutons natifs et réordonne sans recréer ceux qui existent', () => {
    const container = document.createElement('div');
    document.body.append(container);
    renderTagFilters(container, [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', count: 0 }], 'a', { allLabel: 'Tout' });
    const [all, a, b] = container.children;
    expect([all.textContent, a.textContent, b.textContent]).toEqual(['Tout', 'A', 'B (0)']);
    expect([all.type, all.className, all.dataset.tag]).toEqual(['button', 'filter', '']);
    expect([all.getAttribute('aria-pressed'), a.getAttribute('aria-pressed')]).toEqual(['false', 'true']);
    renderTagFilters(container, [{ id: 'b', label: 'B' }, { id: 'a', label: 'A' }], '');
    expect(Array.from(container.children, button => button.dataset.tag)).toEqual(['', 'b', 'a']);
    expect(container.children[1]).toBe(b);
    expect(container.children[2]).toBe(a);
    expect(all.getAttribute('aria-pressed')).toBe('true');
  });

  it('replace le focus sur le filtre actif quand le bouton focalisé disparaît', () => {
    const container = document.createElement('div');
    document.body.append(container);
    renderTagFilters(container, [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], 'a');
    container.querySelector('[data-tag="b"]').focus();
    renderTagFilters(container, [{ id: 'a', label: 'A' }], 'a');
    expect(document.activeElement).toBe(container.querySelector('.filter.active'));
    expect(document.activeElement.dataset.tag).toBe('a');
  });
});
