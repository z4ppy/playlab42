/**
 * Format de projet : sérialisation, version, rejet des fichiers invalides ou malveillants.
 */

import {
  buildProject,
  MAX_PROJECT_CHARS,
  parseProject,
  PROJECT_FORMAT,
  PROJECT_VERSION,
  ProjectFormatError,
  readPngSize,
  stringifyProject,
} from '../src/core/project-format.js';
import { MAX_LAYERS } from '../src/core/document.js';
import { pngHeaderDataUrl } from './helpers/fake-browser.js';

/** PNG aux dimensions du projet de test (64 × 32) : en-tête IHDR réel. */
const PNG = `${pngHeaderDataUrl(64, 32)}AAAA`;

function layer(overrides = {}) {
  return { name: 'Fond', visible: true, locked: false, opacity: 1, blend: 'source-over', image: PNG, ...overrides };
}

function project(overrides = {}) {
  return { format: PROJECT_FORMAT, version: PROJECT_VERSION, width: 64, height: 32, activeLayer: 0, layers: [layer()], ...overrides };
}

const text = (value) => JSON.stringify(value);

describe('aller-retour', () => {
  it('relit à l\'identique un projet construit', () => {
    const built = buildProject({ width: 64, height: 32, activeLayer: 1, layers: [layer(), layer({ name: 'Encre', opacity: 0.4, blend: 'multiply', extra: 'x' })] });
    expect(built.layers[1].extra).toBeUndefined();
    expect(parseProject(text(built))).toEqual(built);
  });

  it('corrige un calque actif hors bornes', () => {
    expect(parseProject(text(project({ activeLayer: 7 }))).activeLayer).toBe(0);
    expect(parseProject(text(project({ activeLayer: 'a' }))).activeLayer).toBe(0);
  });

  it('ne renvoie que des champs reconstruits', () => {
    const raw = text(project({ layers: [layer({ __proto__: { polluted: true }, onload: 'alert(1)' })], script: '<script>' }));
    const parsed = parseProject(raw);
    expect(parsed.script).toBeUndefined();
    expect(parsed.layers[0].onload).toBeUndefined();
    expect({}.polluted).toBeUndefined();
    expect(Object.keys(parsed.layers[0]).sort()).toEqual(['blend', 'image', 'locked', 'name', 'opacity', 'visible']);
  });
});

describe('rejets', () => {
  const rejects = (input, message) => {
    expect(() => parseProject(input)).toThrow(ProjectFormatError);
    expect(() => parseProject(input)).toThrow(message);
  };

  it('refuse ce qui n\'est pas un projet', () => {
    rejects(42, 'texte');
    rejects('{pas du json', 'JSON valide');
    rejects('null', 'pas un projet');
    rejects('[]', 'pas un projet');
    rejects(text({ ...project(), format: 'autre' }), 'pas un projet');
  });

  it('refuse un fichier trop volumineux sans le décoder', () => {
    expect(MAX_PROJECT_CHARS).toBeGreaterThan(1024 * 1024);
    expect(() => parseProject(text(project()), { maxChars: 20 })).toThrow('volumineux');
    expect(() => parseProject('{', { maxChars: 1 })).toThrow('JSON valide');
  });

  it('refuse les versions invalides ou futures', () => {
    rejects(text(project({ version: 0 })), 'Version');
    rejects(text(project({ version: '1' })), 'Version');
    rejects(text(project({ version: PROJECT_VERSION + 1 })), 'plus récente');
  });

  it.each([
    [{ width: 0 }],
    [{ height: 5000 }],
    [{ width: 12.5 }],
    [{ width: '64' }],
  ])('refuse des dimensions invalides %o', (overrides) => {
    rejects(text(project(overrides)), 'Dimensions');
  });

  it('refuse un nombre de calques hors bornes', () => {
    rejects(text(project({ layers: [] })), 'entre 1 et');
    rejects(text(project({ layers: 'Fond' })), 'entre 1 et');
    rejects(text(project({ layers: Array.from({ length: MAX_LAYERS + 1 }, () => layer()) })), 'entre 1 et');
  });

  it.each([
    [null, 'objet attendu'],
    [layer({ name: '' }), 'nom'],
    [layer({ name: 'x'.repeat(65) }), 'nom'],
    [layer({ name: 3 }), 'nom'],
    [layer({ visible: 'oui' }), 'visibilité'],
    [layer({ locked: 1 }), 'verrou'],
    [layer({ opacity: 1.5 }), 'opacité'],
    [layer({ opacity: '1' }), 'opacité'],
    [layer({ blend: 'plasma' }), 'mode de fusion'],
    [layer({ blend: 'constructor' }), 'mode de fusion'],
    [layer({ image: 'https://exemple.test/a.png' }), 'image PNG'],
    [layer({ image: 'data:image/svg+xml;base64,PHN2Zz4=' }), 'image PNG'],
    [layer({ image: 'data:image/png;base64,abc"onerror=' }), 'image PNG'],
    [layer({ image: ['javascript', 'alert(1)'].join(':') }), 'image PNG'],
  ])('refuse le calque %o', (bad, message) => {
    rejects(text(project({ layers: [layer(), bad] })), message);
    rejects(text(project({ layers: [layer(), bad] })), 'Calque 2');
  });
});

describe('dimensions réelles des images (bombe de décompression)', () => {
  it('lit la taille dans l\'en-tête IHDR sans décoder l\'image', () => {
    expect(readPngSize(PNG)).toEqual({ width: 64, height: 32 });
    expect(readPngSize(pngHeaderDataUrl(16000, 16000))).toEqual({ width: 16000, height: 16000 });
    expect(readPngSize('data:image/png;base64,iVBORw0KGgo=')).toBeNull();
    expect(readPngSize('data:image/png;base64,R0lGODlhAQABAAAAACw=AAAAAAAAAAAAAAAAAAAA')).toBeNull();
    expect(readPngSize('data:image/png;base64,@@@@')).toBeNull();
  });

  it('refuse un calque dont l\'image ne fait pas la taille du document', () => {
    const bomb = layer({ image: `${pngHeaderDataUrl(16000, 16000)}AAAA` });
    expect(() => parseProject(text(project({ width: 16, height: 16, layers: [bomb] })))).toThrow('16000 × 16000 px au lieu de 16 × 16');
    expect(() => parseProject(text(project({ layers: [layer(), layer({ image: `${pngHeaderDataUrl(64, 33)}AAAA` })] })))).toThrow('Calque 2');
    expect(() => parseProject(text(project({ layers: [layer({ image: 'data:image/png;base64,iVBORw0KGgo=' })] })))).toThrow('en-tête PNG invalide');
  });
});

describe('enregistrement', () => {
  const built = () => buildProject({ width: 64, height: 32, activeLayer: 0, layers: [layer()] });

  it('produit un texte que parseProject relit', () => {
    expect(parseProject(stringifyProject(built()))).toEqual(built());
  });

  it('refuse d\'écrire un projet qui ne pourrait pas être rouvert', () => {
    const json = stringifyProject(built());
    expect(() => stringifyProject(built(), { maxChars: json.length - 1 })).toThrow(ProjectFormatError);
    expect(() => stringifyProject(built(), { maxChars: json.length - 1 })).toThrow('trop lourd');
    // Même borne à l'écriture et à la lecture : la limite exacte passe des deux côtés.
    expect(parseProject(stringifyProject(built(), { maxChars: json.length }), { maxChars: json.length })).toEqual(built());
  });

  it('transforme le dépassement de taille d\'une chaîne en refus lisible', () => {
    const huge = { toJSON() { throw new RangeError('Invalid string length'); } };
    expect(() => stringifyProject(/** @type {any} */ (huge))).toThrow('trop lourd');
    const broken = { toJSON() { throw new TypeError('autre'); } };
    expect(() => stringifyProject(/** @type {any} */ (broken))).toThrow(TypeError);
  });
});
