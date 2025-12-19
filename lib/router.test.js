/**
 * Tests unitaires pour le module Router
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { _internal, buildUrl, getCurrentRoute } from './router.js';

const { patternToRegex, extractParamNames, parseHash, matchRoute, routes } = _internal;

describe('Router', () => {
  // Mock console.warn pour éviter le bruit dans les tests
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('patternToRegex', () => {
    test('convertit un pattern simple', () => {
      const regex = patternToRegex('/');
      expect(regex.test('/')).toBe(true);
      expect(regex.test('/foo')).toBe(false);
    });

    test('convertit un pattern avec un paramètre', () => {
      const regex = patternToRegex('/games/:id');
      expect(regex.test('/games/checkers')).toBe(true);
      expect(regex.test('/games/tictactoe')).toBe(true);
      expect(regex.test('/games/')).toBe(false);
      expect(regex.test('/games')).toBe(false);
      expect(regex.test('/tools/formatter')).toBe(false);
    });

    test('convertit un pattern avec plusieurs paramètres', () => {
      const regex = patternToRegex('/parcours/:epic/:slide');
      expect(regex.test('/parcours/deep-learning/3')).toBe(true);
      expect(regex.test('/parcours/intro/intro-slide')).toBe(true);
      expect(regex.test('/parcours/deep-learning')).toBe(false);
    });

    test('échappe les caractères spéciaux', () => {
      const regex = patternToRegex('/test.html');
      expect(regex.test('/test.html')).toBe(true);
      expect(regex.test('/testXhtml')).toBe(false);
    });
  });

  describe('extractParamNames', () => {
    test('retourne un tableau vide pour un pattern sans paramètre', () => {
      expect(extractParamNames('/')).toEqual([]);
      expect(extractParamNames('/settings')).toEqual([]);
    });

    test('extrait un seul paramètre', () => {
      expect(extractParamNames('/games/:id')).toEqual(['id']);
    });

    test('extrait plusieurs paramètres', () => {
      expect(extractParamNames('/parcours/:epic/:slide')).toEqual(['epic', 'slide']);
    });

    test('gère les underscores dans les noms', () => {
      expect(extractParamNames('/users/:user_id')).toEqual(['user_id']);
    });
  });

  describe('parseHash', () => {
    test('retourne "/" pour un hash vide', () => {
      expect(parseHash('')).toBe('/');
      expect(parseHash('#')).toBe('/');
      expect(parseHash('#/')).toBe('/');
    });

    test('normalise un hash simple', () => {
      expect(parseHash('#/games/checkers')).toBe('/games/checkers');
      expect(parseHash('#settings')).toBe('/settings');
    });

    test('ajoute le slash initial si manquant', () => {
      expect(parseHash('#games/checkers')).toBe('/games/checkers');
      expect(parseHash('games/checkers')).toBe('/games/checkers');
    });

    test('supprime le slash final', () => {
      expect(parseHash('#/games/')).toBe('/games');
      expect(parseHash('#/parcours/intro/')).toBe('/parcours/intro');
    });

    test('conserve le slash pour la racine', () => {
      expect(parseHash('#/')).toBe('/');
    });
  });

  describe('matchRoute', () => {
    test('matche la route catalogue', () => {
      const result = matchRoute('/');
      expect(result).toEqual({ name: 'catalogue', params: {} });
    });

    test('matche la route game avec paramètre', () => {
      const result = matchRoute('/games/checkers');
      expect(result).toEqual({ name: 'game', params: { id: 'checkers' } });
    });

    test('matche la route tool avec paramètre', () => {
      const result = matchRoute('/tools/json-formatter');
      expect(result).toEqual({ name: 'tool', params: { id: 'json-formatter' } });
    });

    test('matche la route parcours avec un paramètre', () => {
      const result = matchRoute('/parcours/deep-learning');
      expect(result).toEqual({ name: 'parcours', params: { epic: 'deep-learning' } });
    });

    test('matche la route slide avec deux paramètres', () => {
      const result = matchRoute('/parcours/deep-learning/intro');
      expect(result).toEqual({ name: 'slide', params: { epic: 'deep-learning', slide: 'intro' } });
    });

    test('matche la route settings', () => {
      const result = matchRoute('/settings');
      expect(result).toEqual({ name: 'settings', params: {} });
    });

    test('retourne null pour une route inconnue', () => {
      expect(matchRoute('/unknown')).toBeNull();
      expect(matchRoute('/games')).toBeNull();
      expect(matchRoute('/foo/bar/baz/qux')).toBeNull();
    });

    test('décode les paramètres URL-encodés', () => {
      const result = matchRoute('/games/my%20game');
      expect(result).toEqual({ name: 'game', params: { id: 'my game' } });
    });
  });

  describe('buildUrl', () => {
    test('construit une URL pour la route catalogue', () => {
      expect(buildUrl('catalogue')).toBe('#/');
    });

    test('construit une URL pour la route game', () => {
      expect(buildUrl('game', { id: 'checkers' })).toBe('#/games/checkers');
    });

    test('construit une URL pour la route tool', () => {
      expect(buildUrl('tool', { id: 'json-formatter' })).toBe('#/tools/json-formatter');
    });

    test('construit une URL pour la route parcours', () => {
      expect(buildUrl('parcours', { epic: 'deep-learning' })).toBe('#/parcours/deep-learning');
    });

    test('construit une URL pour la route slide', () => {
      expect(buildUrl('slide', { epic: 'deep-learning', slide: '3' })).toBe('#/parcours/deep-learning/3');
    });

    test('construit une URL pour la route settings', () => {
      expect(buildUrl('settings')).toBe('#/settings');
    });

    test('encode les caractères spéciaux', () => {
      expect(buildUrl('game', { id: 'my game' })).toBe('#/games/my%20game');
    });

    test('retourne #/ pour une route inconnue', () => {
      expect(buildUrl('unknown')).toBe('#/');
    });
  });

  describe('routes', () => {
    test('contient toutes les routes attendues', () => {
      const routeNames = routes.map(r => r.name);
      expect(routeNames).toContain('catalogue');
      expect(routeNames).toContain('game');
      expect(routeNames).toContain('tool');
      expect(routeNames).toContain('parcours');
      expect(routeNames).toContain('slide');
      expect(routeNames).toContain('settings');
    });

    test('a les bons patterns', () => {
      const routeMap = Object.fromEntries(routes.map(r => [r.name, r.pattern]));
      expect(routeMap.catalogue).toBe('/');
      expect(routeMap.game).toBe('/games/:id');
      expect(routeMap.tool).toBe('/tools/:id');
      expect(routeMap.parcours).toBe('/parcours/:epic');
      expect(routeMap.slide).toBe('/parcours/:epic/:slide');
      expect(routeMap.settings).toBe('/settings');
    });
  });
});
