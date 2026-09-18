/**
 * @jest-environment jsdom
 *
 * Tests: app/catalogue.js - createCardElement with hash links
 * @see openspec/changes/extend-hash-routing-games-tools/specs/router-games-tools/spec.md
 */

import { jest, describe, it, expect } from '@jest/globals';

// Mock de cloneTemplate avant l'import de catalogue.js (ESM : unstable_mockModule
// + import dynamique, cf. lib/parcours/__tests__/ParcoursNavigation.unit.test.js).
// On conserve les autres exports réels de lib/dom.js, utilisés ailleurs dans le
// graphe d'imports de catalogue.js.
const actualDom = await import('../lib/dom.js');

jest.unstable_mockModule('../lib/dom.js', () => ({
  ...actualDom,
  cloneTemplate: (templateId) => {
    const template = document.createElement('template');

    if (templateId === 'card-template') {
      template.innerHTML = `
        <div class="card">
          <div class="card-thumb"></div>
          <h3></h3>
          <p></p>
          <div class="card-tags"></div>
        </div>
      `;
    } else if (templateId === 'tag-template') {
      template.innerHTML = '<span class="card-tag"></span>';
    }

    // Même contrat que le vrai cloneTemplate : le contenu d'un <template> vit
    // dans .content, pas dans ses childNodes.
    return template.content.cloneNode(true);
  },
}));

// Import dynamique après le mock
const { createCardElement } = await import('./catalogue.js');

describe('catalogue: createCardElement with hash links', () => {
  const mockGame = {
    id: 'tictactoe',
    name: 'Tic-Tac-Toe',
    description: 'The classic morpion',
    icon: '⭕',
    path: 'games/tictactoe/index.html',
    tags: ['strategy', 'classic'],
  };

  const mockTool = {
    id: 'json-formatter',
    name: 'JSON Formatter',
    description: 'Format and validate JSON',
    icon: '{}',
    path: 'tools/json-formatter/index.html',
    tags: ['utility'],
  };

  describe('Game card', () => {
    it('creates a link with href #/games/:id', () => {
      const fragment = createCardElement(mockGame, 'game');
      const link = fragment.querySelector('a.card-link');

      expect(link).not.toBeNull();
      expect(link.href).toContain('#/games/tictactoe');
    });

    it('sets data attributes on link', () => {
      const fragment = createCardElement(mockGame, 'game');
      const link = fragment.querySelector('a.card-link');

      expect(link.dataset.id).toBe('tictactoe');
      expect(link.dataset.type).toBe('game');
    });

    it('displays game icon and name', () => {
      const fragment = createCardElement(mockGame, 'game');
      const title = fragment.querySelector('h3');

      expect(title.textContent).toContain('⭕');
      expect(title.textContent).toContain('Tic-Tac-Toe');
    });

    it('displays description', () => {
      const fragment = createCardElement(mockGame, 'game');
      const desc = fragment.querySelector('p');

      expect(desc.textContent).toBe('The classic morpion');
    });

    it('renders tags', () => {
      const fragment = createCardElement(mockGame, 'game');
      const tags = fragment.querySelectorAll('.card-tag');

      expect(tags.length).toBe(2);
      expect(tags[0].textContent).toBe('strategy');
      expect(tags[1].textContent).toBe('classic');
    });
  });

  describe('Tool card', () => {
    it('creates a link with href #/tools/:id', () => {
      const fragment = createCardElement(mockTool, 'tool');
      const link = fragment.querySelector('a.card-link');

      expect(link).not.toBeNull();
      expect(link.href).toContain('#/tools/json-formatter');
    });

    it('sets data attributes on link', () => {
      const fragment = createCardElement(mockTool, 'tool');
      const link = fragment.querySelector('a.card-link');

      expect(link.dataset.id).toBe('json-formatter');
      expect(link.dataset.type).toBe('tool');
    });

    it('displays tool icon and name', () => {
      const fragment = createCardElement(mockTool, 'tool');
      const title = fragment.querySelector('h3');

      expect(title.textContent).toContain('{}');
      expect(title.textContent).toContain('JSON Formatter');
    });
  });

  describe('Hash format', () => {
    it('generates correct hash for game with hyphens: #/games/card-game', () => {
      const game = { ...mockGame, id: 'card-game' };
      const fragment = createCardElement(game, 'game');
      const link = fragment.querySelector('a.card-link');

      expect(link.href).toContain('#/games/card-game');
    });

    it('generates correct hash for tool with hyphens: #/tools/neural-style', () => {
      const tool = { ...mockTool, id: 'neural-style' };
      const fragment = createCardElement(tool, 'tool');
      const link = fragment.querySelector('a.card-link');

      expect(link.href).toContain('#/tools/neural-style');
    });

    it('generates correct hash for game with numbers: #/games/game2048', () => {
      const game = { ...mockGame, id: 'game2048' };
      const fragment = createCardElement(game, 'game');
      const link = fragment.querySelector('a.card-link');

      expect(link.href).toContain('#/games/game2048');
    });
  });

  describe('Vignette', () => {
    it('dérive le chemin de la vignette depuis le path (jeu)', () => {
      const fragment = createCardElement(mockGame, 'game');
      const img = fragment.querySelector('.card-thumb img');

      expect(img).not.toBeNull();
      expect(img.getAttribute('src')).toBe('games/tictactoe/thumb.png');
      expect(img.alt).toBe('Tic-Tac-Toe');
    });

    it('dérive le chemin de la vignette depuis le path (tool)', () => {
      const fragment = createCardElement(mockTool, 'tool');
      const img = fragment.querySelector('.card-thumb img');

      expect(img.getAttribute('src')).toBe('tools/json-formatter/index-thumb.png');
    });

    it('déclare lazy/async et les dimensions intrinsèques 380x180', () => {
      const fragment = createCardElement(mockGame, 'game');
      const img = fragment.querySelector('.card-thumb img');

      // jsdom ne reflète pas loading/decoding en attributs HTML : on vérifie
      // la propriété IDL, que les navigateurs et jsdom exposent tous les deux.
      expect(img.loading).toBe('lazy');
      expect(img.decoding).toBe('async');
      expect(img.getAttribute('width')).toBe('380');
      expect(img.getAttribute('height')).toBe('180');
    });
  });

  describe('Fallback behavior', () => {
    it("remplace la vignette en erreur par l'icône de l'item", () => {
      const fragment = createCardElement(mockGame, 'game');
      const thumb = fragment.querySelector('.card-thumb');
      const img = thumb.querySelector('img');

      img.onerror();

      expect(thumb.textContent).toBe('⭕');
      expect(thumb.querySelector('img')).toBeNull();
    });

    it("utilise l'icône jeu par défaut si l'item n'en a pas", () => {
      const game = { ...mockGame, icon: undefined };
      const fragment = createCardElement(game, 'game');
      const thumb = fragment.querySelector('.card-thumb');

      thumb.querySelector('img').onerror();

      expect(thumb.textContent).toBe('🎮');
    });

    it("utilise l'icône tool par défaut si l'item n'en a pas", () => {
      const tool = { ...mockTool, icon: undefined };
      const fragment = createCardElement(tool, 'tool');
      const thumb = fragment.querySelector('.card-thumb');

      thumb.querySelector('img').onerror();

      expect(thumb.textContent).toBe('🔧');
    });

    it('handles missing tags gracefully', () => {
      const game = { ...mockGame, tags: undefined };
      const fragment = createCardElement(game, 'game');
      const tags = fragment.querySelectorAll('.card-tag');

      expect(tags.length).toBe(0);
    });
  });
});
