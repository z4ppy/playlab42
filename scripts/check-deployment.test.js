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

  test('valider URL et SHA attendu sans requête : protocole, identifiants et sous-chemin', async () => {
    for (const url of ['ftp://example.test/', 'https://user@example.test/', 'https://user:secret@example.test/']) {
      await expect(checkDeployment(url)).rejects.toThrow('URL de publication invalide');
    }
    await expect(checkDeployment('pas une url')).rejects.toThrow('Invalid URL');
    for (const sha of ['', 'a'.repeat(39), 'a'.repeat(41), `${'a'.repeat(39)}g`]) {
      await expect(checkDeployment('https://example.test/', sha)).rejects.toThrow('SHA Git complet');
    }
    expect(request).not.toHaveBeenCalled();
  });

  test('accepter HTTP, une racine sans sous-chemin et normaliser le slash final', async () => {
    request.mockImplementation(url => {
      const path = new URL(url).pathname.slice(1);
      return Promise.resolve(new Response(typeof payload[path] === 'string' ? payload[path] : JSON.stringify(payload[path]),
        { status: Object.hasOwn(payload, path) ? 200 : 404 }));
    });
    await expect(checkDeployment('http://localhost:8080')).resolves.toMatchObject({ checked: 10 });
    expect(request.mock.calls[0][0].href).toBe('http://localhost:8080/build-info.json');
    expect(request.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
    expect(request.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  test('requêter les ressources dans l’ordre contractuel et s’arrêter à la première erreur', async () => {
    await checkDeployment('https://example.test/playlab42/');
    const order = request.mock.calls.map(([url]) => new URL(url).pathname.replace('/playlab42/', ''));
    expect(order).toEqual([
      'build-info.json', 'build-manifest.json', 'index.html', 'docs/site/index.html',
      'data/catalogue.json', 'data/parcours.json', 'data/bookmarks.json',
      'tools/x/index.html', 'games/x/index.html', 'parcours/epics/x/slides/01-intro/index.html',
    ]);
    request.mockClear();
    delete payload['docs/site/index.html'];
    await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('HTTP 404 : https://example.test/playlab42/docs/site/index.html');
    expect(request).toHaveBeenCalledTimes(4);
  });

  test('refuser les chemins de catalogue absents, hors origine ou hors du sous-chemin publié', async () => {
    for (const path of [undefined, '', 42, null]) {
      payload['data/catalogue.json'].tools[0].path = path;
      await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('Chemin de ressource absent');
    }
    for (const path of ['/index.html', '../index.html', '//example.test/x', 'http://example.test/playlab42/x', 'https://example.test:8443/playlab42/x']) {
      payload['data/catalogue.json'].tools[0].path = path;
      await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow(`Ressource hors du site publié : ${path}`);
    }
  });

  test('conserver les chemins relatifs normalisés qui restent sous le sous-chemin', async () => {
    payload['data/catalogue.json'].tools[0].path = 'docs/../tools/x/index.html';
    await expect(checkDeployment('https://example.test/playlab42/')).resolves.toMatchObject({ checked: 10 });
  });

  test('valider l’identité : version, SHA nul pour un build local, SHA mal formé ou absent', async () => {
    payload['build-info.json'] = { version: '0.2.0', commit: null };
    payload['build-manifest.json'].commit = null;
    await expect(checkDeployment('https://example.test/playlab42/')).resolves.toEqual({ version: '0.2.0', commit: null, checked: 10 });
    await expect(checkDeployment('https://example.test/playlab42/', commit)).rejects.toThrow(`attendu ${commit}, reçu null`);
    for (const identity of [null, [], 42, {}, { version: 2, commit }, { version: '1', commit: 'abc' }, { version: '1', commit: 3 }, { version: '1' }]) {
      payload['build-info.json'] = identity;
      await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('Identité du build');
    }
  });

  test('nommer chaque catalogue invalide ou vide', async () => {
    const names = { tools: 'data/catalogue.json', games: 'data/catalogue.json', epics: 'data/parcours.json', categories: 'data/bookmarks.json' };
    for (const [name, file] of Object.entries(names)) {
      const saved = structuredClone(payload[file]);
      for (const bad of [undefined, [], {}]) {
        payload[file] = { ...saved, [name]: bad };
        await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow(`Catalogue invalide ou vide : ${name}`);
      }
      payload[file] = saved;
    }
    payload['data/bookmarks.json'] = null;
    await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('Catalogue invalide ou vide : categories');
  });

  test('chercher la première slide en profondeur, avant les sections suivantes', async () => {
    payload['data/parcours.json'].epics[0].structure = [
      { type: 'section', children: [{ type: 'section', children: [] }, { type: 'section', children: [{ type: 'slide', id: 'profonde' }] }] },
      { type: 'slide', id: 'autre' },
    ];
    payload['parcours/epics/x/slides/profonde/index.html'] = '<html>Profonde</html>';
    await expect(checkDeployment('https://example.test/playlab42/')).resolves.toMatchObject({ checked: 10 });
    expect(request.mock.calls.at(-1)[0].pathname).toBe('/playlab42/parcours/epics/x/slides/profonde/index.html');
  });

  test('refuser les parcours, entrées et identifiants de slide invalides', async () => {
    const epics = payload['data/parcours.json'].epics;
    for (const entry of [null, 'slide', 3]) {
      epics[0].structure = [entry];
      await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('Entrée de parcours invalide');
    }
    for (const id of [undefined, '', 'Majuscule', '-tiret', 'a_b', '../x']) {
      epics[0].structure = [{ type: 'slide', id }];
      await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('aucune slide valide');
    }
    epics[0].structure = [{ type: 'section', children: 'non' }];
    await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('aucune slide valide');
    for (const epic of [undefined, { structure: [] }, { path: 'p' }, { path: 3, structure: [] }]) {
      payload['data/parcours.json'].epics = [epic, ...epics.slice(1)];
      await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow(/Structure du premier parcours|Catalogue invalide/);
    }
  });

  test('signaler un corps JSON ou HTML illisible et conserver la cause réseau', async () => {
    payload['build-info.json'] = '{';
    await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('JSON invalide : https://example.test/playlab42/build-info.json');
    const cause = new Error('ECONNREFUSED');
    request.mockRejectedValue(cause);
    await expect(checkDeployment('https://example.test/playlab42/')).rejects.toMatchObject({
      message: 'Ressource indisponible : https://example.test/playlab42/build-info.json (ECONNREFUSED)', cause,
    });
  });

  test('accepter une page doctype ou html quelle que soit la casse', async () => {
    payload['index.html'] = '<!DOCTYPE HTML>';
    payload['docs/site/index.html'] = '<HTML lang="fr">';
    await expect(checkDeployment('https://example.test/playlab42/')).resolves.toMatchObject({ checked: 10 });
    payload['docs/site/index.html'] = '<htmlx>';
    await expect(checkDeployment('https://example.test/playlab42/')).rejects.toThrow('Page HTML invalide');
  });
});
