/**
 * Tests: app/catalogue.js - createCardElement with hash links
 * @see openspec/changes/extend-hash-routing-games-tools/specs/router-games-tools/spec.md
 */

import { createCardElement } from './catalogue.js';

// Mock cloneTemplate
jest.mock('../lib/dom.js', () => ({
  cloneTemplate: (templateId) => {
    const template = document.createElement('template');

    if (templateId === 'card-template') {
      template.innerHTML = `
        <a class="card-link">
          <div class="card">
            <div class="card-thumb"></div>
            <h3></h3>
            <p></p>
            <div class="card-tags"></div>
          </div>
        </a>
      `;
    } else if (templateId === 'tag-template') {
      template.innerHTML = '<span class="card-tag"></span>';
    }

    const fragment = document.createDocumentFragment();
    while (template.firstChild) {
      fragment.appendChild(template.firstChild);
    }
    return fragment;
  },
}));

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

  describe('Fallback behavior', () => {
    it('uses default game icon if none provided', () => {
      const game = { ...mockGame, icon: undefined };
      const fragment = createCardElement(game, 'game');
      const title = fragment.querySelector('h3');

      expect(title.textContent).toContain('🎮');
    });

    it('uses default tool icon if none provided', () => {
      const tool = { ...mockTool, icon: undefined };
      const fragment = createCardElement(tool, 'tool');
      const title = fragment.querySelector('h3');

      expect(title.textContent).toContain('🔧');
    });

    it('handles missing tags gracefully', () => {
      const game = { ...mockGame, tags: undefined };
      const fragment = createCardElement(game, 'game');
      const tags = fragment.querySelectorAll('.card-tag');

      expect(tags.length).toBe(0);
    });
  });
});
