import { jest } from '@jest/globals';
import { printDiagnostics } from './lib/build-report.js';
import { validateRequiredFields, validateTagsAndVersion } from './lib/manifest-validation.js';

describe('validateRequiredFields', () => {
  test('rapporte les champs absents ou vides dans l’ordre demandé', () => {
    expect(validateRequiredFields({ name: '', tags: [] }, ['id', 'name', 'tags'])).toEqual([
      "Missing required field 'id'",
      "Missing required field 'name'",
    ]);
  });

  test('contrôle le kebab-case seulement quand l’id existe', () => {
    expect(validateRequiredFields({ id: 'Bad_Id' }, ['id'])).toEqual([
      "'id' must be kebab-case (lowercase letters, numbers, hyphens)",
    ]);
    expect(validateRequiredFields({}, ['id'])).toEqual(["Missing required field 'id'"]);
    expect(validateRequiredFields({ id: 'ok-1' }, ['id'])).toEqual([]);
  });
});

describe('validateTagsAndVersion', () => {
  test.each([
    [{}, []],
    [{ tags: ['a'], version: '1.0.0' }, []],
    [{ tags: 'a' }, ["'tags' must be an array"]],
    [{ version: '1.0' }, ["'version' must be semver format (e.g., '1.0.0')"]],
    [{ tags: {}, version: 'v1' }, ["'tags' must be an array", "'version' must be semver format (e.g., '1.0.0')"]],
  ])('%j', (manifest, expected) => {
    expect(validateTagsAndVersion(manifest)).toEqual(expected);
  });
});

describe('printDiagnostics', () => {
  let log;

  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => log.mockRestore());

  test('ne publie rien quand il n’y a ni avertissement ni erreur', () => {
    expect(printDiagnostics({ warnings: [], errors: [] })).toBe(true);
    expect(log).not.toHaveBeenCalled();
  });

  test('affiche les avertissements sans bloquer', () => {
    expect(printDiagnostics({ warnings: ['a', 'b'], errors: [] })).toBe(true);
    expect(log.mock.calls.map(([line]) => line)).toEqual(['\nWarnings (2):', '  ⚠️  a', '  ⚠️  b']);
  });

  test('affiche avertissements puis erreurs et bloque', () => {
    expect(printDiagnostics({ warnings: ['w'], errors: ['e'] })).toBe(false);
    expect(log.mock.calls.map(([line]) => line)).toEqual([
      '\nWarnings (1):', '  ⚠️  w', '\nErreurs (1):', '  ❌ e',
    ]);
  });
});
