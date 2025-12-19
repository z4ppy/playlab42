/**
 * Tests de la gestion de la progression
 * loadProgress, saveProgress
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ParcoursViewer } from '../../parcours-viewer.js';
import {
  createMockContainer,
  createTestEpic,
  setupGlobalMocks,
  teardownGlobalMocks,
} from '../test-helpers.js';

describe('ParcoursViewer - Progress', () => {
  let mockContainer;
  let viewer;
  let originals;

  beforeEach(() => {
    ({ container: mockContainer } = createMockContainer());
    originals = setupGlobalMocks();
    viewer = new ParcoursViewer(mockContainer);
  });

  afterEach(() => {
    teardownGlobalMocks(originals);
  });

  // =========================================================================
  // loadProgress et saveProgress
  // =========================================================================
  describe('Gestion de la progression', () => {
    beforeEach(() => {
      viewer.epic = createTestEpic();
    });

    describe('loadProgress()', () => {
      it('charge la progression depuis localStorage', () => {
        const savedProgress = {
          'test-epic': { visited: ['slide-1', 'slide-2'], current: 'slide-2' },
        };
        global.localStorage.getItem.mockReturnValue(JSON.stringify(savedProgress));

        viewer.loadProgress();

        expect(viewer.progress).toEqual({ visited: ['slide-1', 'slide-2'], current: 'slide-2' });
      });

      it('initialise une progression vide si rien en storage', () => {
        global.localStorage.getItem.mockReturnValue(null);

        viewer.loadProgress();

        expect(viewer.progress).toEqual({ visited: [], current: null });
      });

      it('initialise une progression vide si l\'epic n\'existe pas', () => {
        const savedProgress = {
          'autre-epic': { visited: ['slide-1'], current: 'slide-1' },
        };
        global.localStorage.getItem.mockReturnValue(JSON.stringify(savedProgress));

        viewer.loadProgress();

        expect(viewer.progress).toEqual({ visited: [], current: null });
      });

      it('gère les erreurs de parsing JSON', () => {
        global.localStorage.getItem.mockReturnValue('invalid json');

        viewer.loadProgress();

        expect(viewer.progress).toEqual({ visited: [], current: null });
      });
    });

    describe('saveProgress()', () => {
      it('sauvegarde la progression dans localStorage', () => {
        viewer.progress = { visited: ['slide-1'], current: 'slide-1' };
        global.localStorage.getItem.mockReturnValue(null);

        viewer.saveProgress();

        expect(global.localStorage.setItem).toHaveBeenCalled();
        const savedData = JSON.parse(global.localStorage.setItem.mock.calls[0][1]);
        expect(savedData['test-epic']).toEqual({ visited: ['slide-1'], current: 'slide-1' });
      });

      it('préserve la progression des autres epics', () => {
        viewer.progress = { visited: ['slide-1'], current: 'slide-1' };
        const existingData = { 'autre-epic': { visited: ['x'], current: 'x' } };
        global.localStorage.getItem.mockReturnValue(JSON.stringify(existingData));

        viewer.saveProgress();

        const savedData = JSON.parse(global.localStorage.setItem.mock.calls[0][1]);
        expect(savedData['autre-epic']).toEqual({ visited: ['x'], current: 'x' });
        expect(savedData['test-epic']).toEqual({ visited: ['slide-1'], current: 'slide-1' });
      });

      it('gère les erreurs de localStorage', () => {
        viewer.progress = { visited: ['slide-1'], current: 'slide-1' };
        global.localStorage.getItem.mockImplementation(() => { throw new Error('Storage error'); });

        // Ne doit pas lever d'exception
        expect(() => viewer.saveProgress()).not.toThrow();
        expect(console.warn).toHaveBeenCalled();
      });
    });
  });
});
