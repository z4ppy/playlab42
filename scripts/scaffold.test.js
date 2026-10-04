import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, scaffold } from './scaffold.js';
import { validateEpicFields, extractSlideIds } from './parcours-utils.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let root;

beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'playlab-scaffold-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

/** @param {string} directory Dossier. @returns {Object} Fichiers triés et contenus. */
function snapshot(directory) {
  const files = {};
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      for (const [path, content] of Object.entries(snapshot(join(directory, entry.name)))) {
        files[`${entry.name}/${path}`] = content;
      }
    } else {
      files[entry.name] = readFileSync(join(directory, entry.name), 'utf8');
    }
  }
  return files;
}

describe('Générateur de contributions', () => {
  test.each([
    ['game', 'games', 'game.json'],
    ['tool', 'tools', 'tool.json'],
    ['epic', 'parcours/epics', 'epic.json'],
  ])('génère un %s complet et reproductible dans sa destination', (type, directory, manifest) => {
    const args = [type, 'exemple-kit', '--title', 'Écrire <sans HTML> & "sans danger"'];
    const destination = scaffold(args, { root });
    expect(destination).toBe(join(root, directory, 'exemple-kit'));
    const content = snapshot(destination);
    const data = JSON.parse(content[manifest]);
    expect(data.id).toBe('exemple-kit');
    expect(data.title || data.name).toBe(args[3]);
    const html = Object.entries(content).filter(([path]) => path.endsWith('.html'));
    expect(html.length).toBeGreaterThan(0);
    for (const [, source] of html) {
      expect(source).toContain('Écrire &lt;sans HTML&gt; &amp; &quot;sans danger&quot;');
      expect(source).not.toContain('<sans HTML>');
      expect(source).toContain('/lib/ui.css');
      expect(source).toContain('/lib/theme.css');
      expect(source).toContain('/lib/components.css');
      expect(source).toContain('class="ui-card');
    }
    const markup = html.map(([, source]) => source).join('\n');
    expect(markup).toContain('class="ui-button');
    expect(markup).toContain('class="ui-field');
    expect(markup).toContain('class="ui-status');
    expect(Object.keys(content).some(path => path.endsWith('.tpl'))).toBe(false);
    const secondRoot = join(root, 'seconde-racine');
    mkdirSync(secondRoot);
    expect(snapshot(scaffold(args, { root: secondRoot }))).toEqual(content);
    if (type === 'epic') {
      expect(validateEpicFields(data).errors).toEqual([]);
      for (const id of extractSlideIds(data.content)) {
        expect(JSON.parse(content[`slides/${id}/slide.json`]).id).toBe(id);
        expect(content[`slides/${id}/index.html`]).toContain('await initSlide()');
        expect(content[`slides/${id}/index.html`]).toContain('id="standalone-navigation" aria-label="Navigation du parcours" hidden');
        expect(content[`slides/${id}/index.html`]).toContain('if (window.parent === window)');
      }
    }
  });

  test.each([
    [], ['game', 'test'], ['unknown', 'test', '--title', 'Titre'],
    ['tool', '../sortie', '--title', 'Titre'],
    ['tool', '/tmp/sortie', '--title', 'Titre'],
    ['epic', 'a/b', '--title', 'Titre'],
    ['game', 'a\\b', '--title', 'Titre'],
    ['game', 'A-b', '--title', 'Titre'],
    ['game', 'a--b', '--title', 'Titre'],
    ['game', '-a', '--title', 'Titre'],
    ['game', 'a-', '--title', 'Titre'],
    ['game', 'a'.repeat(65), '--title', 'Titre'],
    ['game', 'test', '--name', 'Titre'],
    ['game', 'test', '--title', ''],
    ['game', 'test', '--title', '   '],
    ['game', 'test', '--title', ' Titre'],
    ['game', 'test', '--title', 'Titre\nsuite'],
    ['game', 'test', '--title', 'a'.repeat(121)],
    ['game', 'test', '--title', 'Titre', '--force'],
  ])('refuse les arguments invalides sans écrire : %j', (...args) => {
    expect(() => scaffold(args, { root })).toThrow();
    expect(readdirSync(root)).toEqual([]);
  });

  test('accepte les limites documentées', () => {
    expect(parseArgs(['game', 'a'.repeat(64), '--title', 'a'.repeat(120)]).id).toHaveLength(64);
  });

  test.each([
    [['unknown', '../invalid', '--title', ''], 'Type invalide : choisir game, tool ou epic.'],
    [['tool', '../invalid', '--title', ''], 'Identifiant invalide :'],
    [['tool', 'valid', '--title', null], 'Titre invalide :'],
    [['tool', 'valid', '--title', '\u0000'], 'Titre invalide :'],
  ])('préserver la priorité et le message des arguments invalides : %j', (args, message) => {
    expect(() => scaffold(args, { root, templates: join(root, 'absent') })).toThrow(message);
    expect(readdirSync(root)).toEqual([]);
  });

  test('refuser un gabarit vide ou inattendu avant de préparer la destination', () => {
    const templates = join(root, 'gabarits');
    mkdirSync(join(templates, 'tool'), { recursive: true });
    const args = ['tool', 'test', '--title', 'Titre'];
    expect(() => scaffold(args, { root, templates })).toThrow('Gabarit vide :');
    expect(existsSync(join(root, 'tools'))).toBe(false);
    writeFileSync(join(templates, 'tool', 'unexpected.txt'), 'ne pas publier');
    expect(() => scaffold(args, { root, templates })).toThrow('Gabarit inattendu : unexpected.txt.');
    expect(existsSync(join(root, 'tools'))).toBe(false);
  });

  test('refuser un parent non répertoire sans modifier ses octets', () => {
    writeFileSync(join(root, 'tools'), 'fichier existant');
    expect(() => scaffold(['tool', 'test', '--title', 'Titre'], { root })).toThrow('Destination non sûre :');
    expect(readFileSync(join(root, 'tools'), 'utf8')).toBe('fichier existant');
  });

  test('ne remplace jamais une contribution existante, même vide', () => {
    const args = ['tool', 'existant', '--title', 'Titre'];
    const destination = scaffold(args, { root });
    const before = snapshot(destination);
    expect(() => scaffold(args, { root })).toThrow(/Collision/);
    expect(snapshot(destination)).toEqual(before);
    mkdirSync(join(root, 'tools', 'vide'));
    expect(() => scaffold(['tool', 'vide', '--title', 'Titre'], { root })).toThrow(/Collision/);
  });

  test.each(['html', 'json'])('refuse la collision avec un outil plat .%s', extension => {
    mkdirSync(join(root, 'tools'));
    const path = join(root, 'tools', `existant.${extension}`);
    writeFileSync(path, 'contenu utilisateur');
    expect(() => scaffold(['tool', 'existant', '--title', 'Titre'], { root })).toThrow(/Collision/);
    expect(readFileSync(path, 'utf8')).toBe('contenu utilisateur');
    expect(existsSync(join(root, 'tools', 'existant'))).toBe(false);
  });

  test.each(['tools', 'parcours', 'parcours/epics'])('refuse un lien symbolique dans %s', directory => {
    const elsewhere = join(root, 'ailleurs');
    mkdirSync(elsewhere);
    mkdirSync(dirname(join(root, directory)), { recursive: true });
    symlinkSync(elsewhere, join(root, directory));
    const type = directory === 'tools' ? 'tool' : 'epic';
    expect(() => scaffold([type, 'test', '--title', 'Titre'], { root })).toThrow(/non sûre/);
    expect(readdirSync(elsewhere)).toEqual([]);
  });

  test('détecte un lien cassé dans la destination', () => {
    mkdirSync(join(root, 'games'));
    symlinkSync(join(root, 'absent'), join(root, 'games', 'test'));
    expect(() => scaffold(['game', 'test', '--title', 'Titre'], { root })).toThrow(/Collision/);
  });

  test('valide tous les gabarits avant de créer le dossier final', () => {
    const templates = join(root, 'gabarits');
    mkdirSync(join(templates, 'tool'), { recursive: true });
    writeFileSync(join(templates, 'tool', 'index.html.tpl'), '<h1>{{TITLE_HTML}}</h1>');
    writeFileSync(join(templates, 'tool', 'tool.json.tpl'), '{"invalid":');
    expect(() => scaffold(['tool', 'test', '--title', 'Titre'], { root, templates })).toThrow();
    expect(existsSync(join(root, 'tools'))).toBe(false);
    writeFileSync(join(templates, 'tool', 'tool.json.tpl'), '{"id":"{{INCONNUE}}"}');
    expect(() => scaffold(['tool', 'test', '--title', 'Titre'], { root, templates })).toThrow(/Variable inconnue/);
    expect(existsSync(join(root, 'tools'))).toBe(false);
  });

  test('les gabarits ne sont pas des modules ou tests de production', () => {
    const files = snapshot(join(ROOT, 'templates'));
    expect(Object.keys(files).every(path => path.endsWith('.tpl'))).toBe(true);
  });

  test('le moteur et le bot générés exécutent une vraie partie déterministe', () => {
    const destination = scaffold(['game', 'test', '--title', 'Titre'], { root });
    mkdirSync(join(root, 'lib'));
    copyFileSync(join(ROOT, 'lib', 'seeded-random.js'), join(root, 'lib', 'seeded-random.js'));
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    const code = `
      import assert from 'node:assert/strict';
      import { Engine } from ${JSON.stringify(pathToFileURL(join(destination, 'engine.js')).href)};
      import { PrudentBot } from ${JSON.stringify(pathToFileURL(join(destination, 'bots/prudent.js')).href)};
      const engine = new Engine();
      const bot = new PrudentBot();
      function play() {
        let state = engine.init({ seed: 42, playerIds: ['a', 'b'] });
        while (!engine.isGameOver(state)) {
          const player = engine.getCurrentPlayer(state);
          const previous = JSON.stringify(state);
          const action = bot.chooseAction(engine.getPlayerView(state, player), engine.getValidActions(state, player));
          const next = engine.applyAction(state, action, player);
          assert.equal(JSON.stringify(state), previous);
          state = next;
        }
        assert.equal(state.remaining, 0);
        assert.equal(engine.getWinners(state).length, 1);
        assert.deepEqual(engine.getValidActions(state, 'a'), []);
        return state;
      }
      assert.deepEqual(play(), play());
    `;
    // Ce processus n'est lancé que par Jest dans le runner Docker du parent.
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', cwd: root });
    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    const generatedTests = spawnSync(process.execPath, [
      '--experimental-vm-modules',
      join(ROOT, 'node_modules/jest/bin/jest.js'),
      '--runInBand',
      '--config',
      JSON.stringify({ rootDir: root, testEnvironment: 'node', testMatch: ['**/engine.test.js'], transform: {} }),
    ], { encoding: 'utf8', cwd: root });
    expect(generatedTests.error).toBeUndefined();
    if (generatedTests.status !== 0) {
      throw new Error(`Tests du moteur généré en échec : ${generatedTests.stderr}\n${generatedTests.stdout}`);
    }
    expect(generatedTests.status).toBe(0);
  });

  test('la CLI affiche une erreur exploitable et échoue pour une entrée invalide', () => {
    const result = spawnSync(process.execPath, [join(ROOT, 'scripts', 'scaffold.js'), 'tool', '../interdit', '--title', 'Titre'], {
      encoding: 'utf8', cwd: root,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Scaffold : Identifiant invalide/);
    expect(readdirSync(root)).toEqual([]);
  });

  test('le module peut être importé depuis une entrée standard sans lancer la CLI', () => {
    const code = `import { scaffold } from ${JSON.stringify(pathToFileURL(join(ROOT, 'scripts', 'scaffold.js')).href)}; console.log(typeof scaffold);`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-'], {
      input: code, encoding: 'utf8', cwd: root,
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('function');
    expect(readdirSync(root)).toEqual([]);
  });

  test('la CLI génère depuis sa racine et refuse ensuite de remplacer ses fichiers', () => {
    mkdirSync(join(root, 'scripts', 'lib'), { recursive: true });
    copyFileSync(join(ROOT, 'scripts', 'scaffold.js'), join(root, 'scripts', 'scaffold.js'));
    copyFileSync(join(ROOT, 'scripts', 'lib', 'build-utils.js'), join(root, 'scripts', 'lib', 'build-utils.js'));
    cpSync(join(ROOT, 'templates'), join(root, 'templates'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    const elsewhere = join(root, 'autre-dossier');
    mkdirSync(elsewhere);
    const args = [join(root, 'scripts', 'scaffold.js'), 'tool', 'outil-cli', '--title', 'Un vrai outil'];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: elsewhere });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(join(root, 'tools', 'outil-cli'));
    expect(existsSync(join(root, 'tools', 'outil-cli', 'index.html'))).toBe(true);
    expect(readdirSync(elsewhere)).toEqual([]);
    const before = snapshot(join(root, 'tools', 'outil-cli'));
    const collision = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: elsewhere });
    expect(collision.status).toBe(1);
    expect(collision.stderr).toContain('Collision');
    expect(snapshot(join(root, 'tools', 'outil-cli'))).toEqual(before);
  });
});
