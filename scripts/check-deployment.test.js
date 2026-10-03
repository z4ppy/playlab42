import { jest } from '@jest/globals';
import { checkDeployment } from './check-deployment.js';

describe('Contrôle HTTP de publication', () => {
  const commit = 'a'.repeat(40);
  let payload;
  let request;
  beforeEach(() => {
    payload = {
      'build-info.json': { version: '0.2.0', commit },
      'build-manifest.json': {
        formatVersion: 1, version: '0.2.0', commit,
        inputs: { packageLock: 'b'.repeat(64), ogSnapshot: 'c'.repeat(64) },
        files: [{ path: 'index.html' }],
      },
      'index.html': '<!doctype html><html>Portail</html>',
      'docs/site/index.html': '<html>Guides</html>',
      'data/catalogue.json': { tools: [{ path: 'tools/x/index.html' }], games: [{ path: 'games/x/index.html' }] },
      'data/parcours.json': { epics: [{
        path: './parcours/epics/x',
        structure: [{ type: 'section', children: [{ type: 'slide', id: '01-intro' }] }],
      }] },
      'data/bookmarks.json': { categories: [{ id: 'dev', bookmarks: [] }] },
      'tools/x/index.html': '<html>Outil</html>',
      'games/x/index.html': '<html>Jeu</html>',
      'parcours/epics/x/slides/01-intro/index.html': '<html>Slide</html>',
    };
    request = jest.spyOn(globalThis, 'fetch').mockImplementation(url => {
      const path = new URL(url).pathname.replace('/playlab42/', '');
      return Promise.resolve(new Response(typeof payload[path] === 'string' ? payload[path] : JSON.stringify(payload[path]), {
        status: Object.hasOwn(payload, path) ? 200 : 404,
      }));
    });
  });
  afterEach(() => jest.restoreAllMocks());

  test('vérifier dix ressources sur un sous-chemin Pages, sans slash initial obligatoire', async () => {
    await expect(checkDeployment('https://example.test/playlab42', commit))
      .resolves.toEqual({ version: '0.2.0', commit, checked: 10 });
    expect(request).toHaveBeenCalledTimes(10);
    expect(request.mock.calls.every(([url]) => new URL(url).pathname.startsWith('/playlab42/'))).toBe(true);
  });

  test('refuser une publication qui ne correspond pas au commit validé', async () => {
    await expect(checkDeployment('https://example.test/playlab42/', 'b'.repeat(40)))
      .rejects.toThrow('Commit publié différent');
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('un SHA main publié ne prouve pas la livraison des lots mergés dans une branche intermédiaire', async () => {
    delete payload['build-manifest.json'];
    await expect(checkDeployment('https://example.test/playlab42/', commit))
      .rejects.toThrow('HTTP 404');
  });

  test('vérifier les entrées attendues même après squash, sans exiger l’ancestralité du head de PR', async () => {
    const inputs = { packageLock: 'b'.repeat(64), ogSnapshot: 'c'.repeat(64) };
    await expect(checkDeployment('https://example.test/playlab42/', commit, inputs))
      .resolves.toMatchObject({ commit, checked: 10 });
    payload['build-manifest.json'].inputs.ogSnapshot = 'd'.repeat(64);
    await expect(checkDeployment('https://example.test/playlab42/', commit, inputs))
      .rejects.toThrow('Contenu publié différent');
    delete payload['build-manifest.json'].inputs;
    await expect(checkDeployment('https://example.test/playlab42/', commit, inputs))
      .rejects.toThrow('Contenu publié différent');
  });

  test('refuser une fabrication incohérente avec l’identité ou sans inventaire', async () => {
    const manifest = payload['build-manifest.json'];
    for (const changes of [
      { formatVersion: 2 }, { commit: 'b'.repeat(40) }, { version: 'old' },
      { files: undefined }, { files: [] },
    ]) {
      payload['build-manifest.json'] = { ...manifest, ...changes };
      await expect(checkDeployment('https://example.test/playlab42/', commit))
        .rejects.toThrow('Manifeste de fabrication');
    }
    payload['build-manifest.json'] = null;
    await expect(checkDeployment('https://example.test/playlab42/', commit))
      .rejects.toThrow('Manifeste de fabrication');
  });

  test('accepter la représentation hexadécimale du même SHA sans dépendre de la casse', async () => {
    await expect(checkDeployment('https://example.test/playlab42/', commit.toUpperCase()))
      .resolves.toMatchObject({ commit });
  });

  test('refuser une identité de build ou une structure de parcours mal formée', async () => {
    payload['build-info.json'] = { version: '', commit };
    await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('Identité du build');
    payload['build-info.json'] = { version: '0.2.0', commit };
    payload['data/parcours.json'].epics[0].structure = {};
    await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('Structure du premier parcours');
  });

  test('signaler un JSON invalide, un catalogue vide ou une page indisponible', async () => {
    payload['data/catalogue.json'] = 'not JSON';
    await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('JSON invalide');
    payload['data/catalogue.json'] = { tools: [], games: [] };
    await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('Catalogue invalide ou vide');
    delete payload['index.html'];
    await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('HTTP 404');
  });

  test('refuser un faux document HTML ou une slide invalide', async () => {
    payload['index.html'] = 'erreur renvoyée avec HTTP 200';
    await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('Page HTML invalide');
    payload['index.html'] = '<html>Portail</html>';
    payload['data/parcours.json'].epics[0].structure = [];
    await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('aucune slide valide');
  });

  test('ne jamais suivre un chemin de catalogue hors du site', async () => {
    payload['data/catalogue.json'].tools[0].path = 'https://foreign.test/index.html';
    await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('Ressource hors du site');
    expect(request.mock.calls.every(([url]) => new URL(url).hostname === 'example.test')).toBe(true);
  });

  test('valider les paramètres avant de faire des requêtes', async () => {
    for (const url of ['file:///tmp/site', 'https://u:p@example.test/', 'https://example.test/#x', 'https://example.test/?x']) {
      await expect(checkDeployment(url)).rejects.toThrow('URL de publication invalide');
    }
    await expect(checkDeployment('https://example.test/', 'main')).rejects.toThrow('SHA Git complet');
    expect(request).not.toHaveBeenCalled();
  });

  test('échouer explicitement lorsque le réseau est indisponible', async () => {
    request.mockRejectedValue(new Error('réseau indisponible'));
    await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('réseau indisponible');
  });
});
