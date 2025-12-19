/**
 * Tests de la fonction utilitaire initParcoursFromHash
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ParcoursViewer, initParcoursFromHash } from '../../parcours-viewer.js';
import { createMockElement, createTestEpic } from '../test-helpers.js';

describe('initParcoursFromHash()', () => {
  let mockContainer;
  let originalWindow;

  beforeEach(() => {
    mockContainer = createMockElement('div');
    mockContainer.querySelector = () => createMockElement('div');

    originalWindow = global.window;
    global.window = {
      location: {
        hash: '',
        pathname: '/test',
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    global.document = {
      createElement: () => createMockElement('div'),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      head: { appendChild: jest.fn() },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ epics: [createTestEpic()] }),
    });

    // Mock console pour éviter le bruit
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    global.window = originalWindow;
    jest.restoreAllMocks();
  });

  it('retourne null si le hash ne correspond pas', () => {
    global.window.location.hash = '#/other';

    const result = initParcoursFromHash(mockContainer);

    expect(result).toBeNull();
  });

  it('retourne null pour un hash vide', () => {
    global.window.location.hash = '';

    const result = initParcoursFromHash(mockContainer);

    expect(result).toBeNull();
  });

  it('crée un viewer et charge l\'epic', () => {
    global.window.location.hash = '#/parcours/test-epic';

    const result = initParcoursFromHash(mockContainer);

    expect(result).toBeInstanceOf(ParcoursViewer);
  });

  it('passe le slideId au viewer', () => {
    global.window.location.hash = '#/parcours/test-epic/slide-2';

    const result = initParcoursFromHash(mockContainer);

    expect(result).toBeInstanceOf(ParcoursViewer);
  });

  it('passe les options au viewer', () => {
    global.window.location.hash = '#/parcours/test-epic';
    const onClose = jest.fn();

    const result = initParcoursFromHash(mockContainer, { onClose });

    expect(result.options.onClose).toBe(onClose);
  });
});
