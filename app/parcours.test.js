/**
 * @jest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const { setState } = await import('./state.js');
const { el } = await import('./dom-cache.js');
const { renderParcours, selectParcoursCategory, createEpicCardElement, closeParcours } = await import('./parcours.js');

const epics = [
  { id: 'intro', title: 'Découvrir PlayLab42', description: 'Créer ensemble', hierarchy: ['playlab42'],
    tags: ['contribution'], duration: '15 min', slideCount: 3, structure: [{ type: 'section' }] },
  { id: 'algo', title: 'Complexité', description: 'Évaluer les algorithmes', hierarchy: ['dev'],
    tags: ['développement'], duration: '30 min', slideCount: 6, author: { name: 'Émilie' } },
  { id: 'other', title: 'Hors catégorie', description: 'Une source réelle', slideCount: 2 },
];

describe('collections pédagogiques éditoriales', () => {
  beforeEach(() => {
    localStorage.clear();
    document.activeElement?.blur();
    setState({
      activeTab: 'parcours', activeFilter: '', parcoursCategory: null, currentView: 'catalogue',
      parcoursCatalogue: {
        epics, taxonomy: { hierarchy: [{ id: 'playlab42', label: 'PlayLab42' }, { id: 'dev', label: 'Développement' }] },
        featured: { recent: [epics[1]], pinned: [epics[0]] },
      },
    });
    el.search.value = '';
  });

  it('présente toutes les sources sans doublons ni catégories répétées', () => {
    renderParcours();
    expect(el.parcoursCategoriesExpanded.querySelectorAll('.category-section')).toHaveLength(1);
    expect(el.parcoursCategoriesExpanded.querySelectorAll('.epic-card')).toHaveLength(3);
    expect(el.catalogueStatus.textContent).toBe('3 parcours');
    expect(el.parcoursCategoryFilters.querySelector('[data-category="autres"]')).not.toBeNull();
    expect(el.parcoursCategoriesExpanded.textContent).toContain('Tous les parcours');
  });

  it('ne vole pas le compteur de la section active pendant un chargement concurrent', () => {
    setState({ activeTab: 'games' });
    el.catalogueStatus.textContent = '5 jeux';
    renderParcours();
    expect(el.catalogueStatus.textContent).toBe('5 jeux');
    setState({ parcoursCatalogue: null });
    renderParcours();
    expect(el.catalogueStatus.textContent).toBe('5 jeux');
  });

  it('distingue indisponibilite, catalogue vide et recherche sans resultat', () => {
    setState({ parcoursCatalogue: null });
    renderParcours();
    expect(el.emptyParcours.getAttribute('role')).toBe('alert');
    expect(el.emptyParcours.textContent).toContain('Impossible');
    expect(el.catalogueStatus.textContent).toBe('Parcours indisponibles');
    setState({ parcoursCatalogue: { epics: [] } });
    renderParcours();
    expect(el.emptyParcours.hasAttribute('role')).toBe(false);
    expect(el.emptyParcours.textContent).toContain('pour le moment');
    expect(el.catalogueStatus.textContent).toBe('0 parcours');
    setState({ parcoursCatalogue: { epics } });
    el.search.value = 'sans-correspondance';
    renderParcours();
    expect(el.emptyParcours.textContent).toContain('ne correspond');
    expect(el.catalogueStatus.textContent).toBe('0 parcours');
  });

  it('remonte une lecture commencée sans masquer les autres parcours', () => {
    localStorage.setItem('parcours-progress', JSON.stringify({
      algo: { visited: ['a'], current: 'a' },
      intro: { visited: ['a', 'b', 'c'], current: 'c' },
    }));
    renderParcours();
    const continuing = el.parcoursCategoriesExpanded.querySelector('[data-collection="continue"]');
    expect(continuing.querySelectorAll('.epic-card')).toHaveLength(1);
    expect(continuing.querySelector('.epic-card').dataset.epicId).toBe('algo');
    expect(continuing.textContent).toContain('Continuer · 17 % parcouru');
    expect(el.parcoursCategoriesExpanded.querySelectorAll('.epic-card')).toHaveLength(3);
    expect(el.parcoursCategoriesExpanded.querySelector('.completed').textContent).toContain('Terminé · Relire');
  });

  it('combine recherche multi-mots sans accents, auteur et catégorie', () => {
    el.search.value = 'EMILIE evaluer';
    renderParcours();
    expect(el.cardsParcours.querySelectorAll('.epic-card')).toHaveLength(1);
    selectParcoursCategory('playlab42');
    expect(el.cardsParcours.querySelectorAll('.epic-card')).toHaveLength(0);
    expect(el.emptyParcours.classList.contains('visible')).toBe(true);
    expect(el.catalogueStatus.textContent).toBe('0 parcours');
  });

  it('préserve le bouton de filtre et son focus', () => {
    renderParcours();
    const button = el.parcoursCategoryFilters.querySelector('[data-category="dev"]');
    button.focus();
    selectParcoursCategory('dev');
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(el.cardsParcours.querySelectorAll('.epic-card')).toHaveLength(1);
  });

  it('attribue des IDs accessibles uniques même à deux instances du même epic', () => {
    const host = document.createElement('div');
    host.append(createEpicCardElement(epics[0]), createEpicCardElement(epics[0]));
    const titles = [...host.querySelectorAll('.epic-title')];
    expect(titles[0].id).not.toBe(titles[1].id);
    for (const card of host.querySelectorAll('.epic-card')) {
      expect(host.querySelector(`#${card.getAttribute('aria-labelledby')}`).textContent).toBe(epics[0].title);
    }
    expect(host.querySelector('.epic-slides').textContent).toBe('1 chapitre · 3 étapes');
  });

  it('préserve une carte focalisée lors du rerendu différé et actualise après fermeture', () => {
    renderParcours();
    el.parcoursCategoriesExpanded.querySelector('[data-epic-id="algo"]').focus();
    renderParcours();
    expect(document.activeElement.dataset.epicId).toBe('algo');
    localStorage.setItem('parcours-progress', JSON.stringify({ algo: { visited: ['a'], current: 'a' } }));
    closeParcours();
    expect(el.parcoursCategoriesExpanded.querySelector('[data-collection="continue"]')).not.toBeNull();
  });
});

describe('vignette animée des epics', () => {
  // Faux Image : jsdom ne charge pas les images, on déclenche onload à la main
  const preloads = [];
  class FakeImage { constructor() {preloads.push(this);} }
  const realImage = window.Image;
  beforeEach(() => { preloads.length = 0; window.Image = FakeImage; });
  afterEach(() => { window.Image = realImage; });

  const withThumbnail = { ...epics[1], thumbnail: './parcours/epics/algo/thumbnail.jpg' };

  it('anime la carte au focus quand le build a repéré une variante', () => {
    const fragment = createEpicCardElement({ ...withThumbnail, thumbnailAnimated: './parcours/epics/algo/thumbnail.anim.webp' });
    const card = fragment.querySelector('.epic-card');
    const img = fragment.querySelector('.epic-thumb img');

    card.dispatchEvent(new FocusEvent('focusin'));
    expect(preloads).toHaveLength(1);
    preloads[0].onload();
    expect(img.getAttribute('src')).toBe('./parcours/epics/algo/thumbnail.anim.webp');
  });

  it('laisse la vignette fixe sans variante animée', () => {
    const fragment = createEpicCardElement(withThumbnail);
    fragment.querySelector('.epic-card').dispatchEvent(new FocusEvent('focusin'));
    expect(preloads).toHaveLength(0);
    expect(fragment.querySelector('.epic-thumb img').getAttribute('src')).toBe('./parcours/epics/algo/thumbnail.jpg');
  });
});
