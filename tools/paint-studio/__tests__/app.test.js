/**
 * @jest-environment jsdom
 *
 * Interface complète sous jsdom : outils, calques, couleurs, sélection,
 * historique, fichiers, gestes et sauvegarde automatique. Le contexte 2D est
 * simulé (voir helpers/fake-browser.js) : les pixels de fillRect, drawImage
 * sans mise à l'échelle et putImageData sont réels, les tracés vectoriels non.
 */
import { readFileSync } from 'node:fs';
import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { canvasPixel, installFakeBrowser, pointer } from './helpers/fake-browser.js';
import { createFakeIndexedDb } from './helpers/fake-indexeddb.js';

installFakeBrowser();
globalThis.indexedDB = createFakeIndexedDb();
jest.spyOn(console, 'warn').mockImplementation(() => {});
HTMLAnchorElement.prototype.click = jest.fn();

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

const { App } = await import('../src/ui/app.js');
const { serializeDocument } = await import('../src/ui/files.js');

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));
/** Attend (2 s au plus) qu'une condition asynchrone devienne vraie : robuste sous charge, contrairement à un délai fixe. */
const until = async (check) => {
  for (let i = 0; i < 100 && !check(); i++) {
    await flush();
  }
};
const $ = (selector) => document.querySelector(selector);
const RED = { r: 255, g: 0, b: 0, a: 255 };
const BLUE = { r: 0, g: 0, b: 255, a: 255 };

let app;
let editor;
let view;

/** Coordonnées écran d'un point document (vue courante). */
function screen(x, y) {
  return { x: editor.view.x + x * editor.view.scale, y: editor.view.y + y * editor.view.scale };
}

/** Geste complet sur la zone de dessin, en coordonnées document. */
function gesture(points, init = {}) {
  const [first, ...rest] = points;
  view.dispatchEvent(pointer('pointerdown', { ...screen(...first), ...init }));
  for (const point of rest) {
    view.dispatchEvent(pointer('pointermove', { ...screen(...point), ...init }));
  }
  const last = points[points.length - 1];
  view.dispatchEvent(pointer('pointerup', { ...screen(...last), ...init }));
}

function key(value, init = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...init }));
}

const layerPixel = (x, y, layer = editor.doc.activeLayer) => canvasPixel(layer.surface.canvas, x, y);

/** Nouveau petit document (rapide sous le contexte simulé). */
async function freshDocument(white = true) {
  editor.setDocument(editor.blankDocument(40, 30, white));
  editor.colors.primary = { ...RED };
  await flush();
}

async function answerDialog(value, run) {
  globalThis.__dialogAnswer = value;
  run();
  await flush();
  globalThis.__dialogAnswer = undefined;
}

beforeAll(async () => {
  app = new App();
  editor = app.editor;
  view = $('#view');
  await app.start();
});

beforeEach(async () => {
  await freshDocument();
  editor.setTool('pencil');
  editor.setSetting('pencil', 'size', 1);
});

describe('démarrage et barre d\'outils', () => {
  it('crée un bouton par outil et sélectionne au clic', async () => {
    const buttons = document.querySelectorAll('#toolbar [data-tool]');
    expect(buttons).toHaveLength(12);
    $('#toolbar [data-tool="brush"] .ps-tool-icon').click();
    await flush();
    expect(editor.tool.id).toBe('brush');
    expect($('#toolbar [data-tool="brush"]').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('#tool-options input[type="range"]').length).toBeGreaterThanOrEqual(4);
    expect($('#app').dataset.ready).toBe('true');
  });

  it('modifie un réglage depuis la barre d\'options', async () => {
    editor.setTool('fill');
    await flush();
    const range = $('#tool-options input[data-option="tolerance"]');
    range.value = '100';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    range.dispatchEvent(new Event('change', { bubbles: true }));
    expect(editor.settingsFor('fill').tolerance).toBe(100);
    expect(range.parentElement.querySelector('output').value).toBe('100');
    const toggle = $('#tool-options input[data-option="sampleAll"]');
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    expect(editor.settingsFor('fill').sampleAll).toBe(true);
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });

  it('affiche un conseil pour l\'outil Main et une liste pour les formes', async () => {
    editor.setTool('hand');
    await flush();
    expect($('#tool-options .options-hint')).not.toBeNull();
    editor.setTool('rect');
    await flush();
    const select = $('#tool-options select[data-option="fillMode"]');
    select.value = 'both';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(editor.settingsFor('rect').fillMode).toBe('both');
  });
});

describe('dessin et historique', () => {
  it('trace au crayon, annule et rétablit', async () => {
    gesture([[2, 2], [10, 2]]);
    expect(layerPixel(6, 2)).toEqual([255, 0, 0, 255]);
    await flush();
    expect($('#btn-undo').disabled).toBe(false);
    expect($('#btn-undo').title).toContain('Crayon');
    key('z', { ctrlKey: true });
    expect(layerPixel(6, 2)).toEqual([255, 255, 255, 255]);
    key('Z', { ctrlKey: true, shiftKey: true });
    expect(layerPixel(6, 2)).toEqual([255, 0, 0, 255]);
    await flush();
    $('#btn-undo').click();
    await flush();
    $('#btn-redo').click();
    expect(layerPixel(6, 2)).toEqual([255, 0, 0, 255]);
  });

  it('dessine avec la couleur secondaire au bouton droit', () => {
    editor.colors.secondary = { ...BLUE };
    gesture([[3, 3], [3, 4]], { button: 2 });
    expect(layerPixel(3, 3)).toEqual([0, 0, 255, 255]);
  });

  it('gomme (et pinceau) passent par le calque en cours sans erreur', () => {
    for (const tool of ['brush', 'eraser']) {
      editor.setTool(tool);
      gesture([[5, 5], [15, 8], [25, 12]], { type: 'pen', pressure: 0.7 });
      expect(editor.pending.active).toBe(false);
    }
  });

  it('trace les formes avec contraintes et annule au second doigt', () => {
    for (const tool of ['line', 'rect', 'ellipse']) {
      editor.setTool(tool);
      gesture([[5, 5], [20, 12]], { shift: true });
    }
    editor.setTool('rect');
    editor.toolDown({ x: 2, y: 2, pressure: 1, pointerType: 'touch' });
    editor.toolMove({ x: 9, y: 9, pressure: 1, pointerType: 'touch' });
    editor.toolCancel();
    expect(editor.pending.active).toBe(false);
  });

  it('remplit au pot de peinture, sur le calque ou l\'image fusionnée', () => {
    gesture([[0, 10], [39, 10]]);
    editor.colors.primary = { ...BLUE };
    editor.setTool('fill');
    gesture([[5, 5]]);
    expect(layerPixel(5, 5)).toEqual([0, 0, 255, 255]);
    expect(layerPixel(5, 20)).toEqual([255, 255, 255, 255]);
    editor.setSetting('fill', 'sampleAll', true);
    editor.colors.primary = { r: 0, g: 255, b: 0, a: 255 };
    gesture([[5, 20]]);
    expect(layerPixel(5, 25)).toEqual([0, 255, 0, 255]);
    editor.setSetting('fill', 'sampleAll', false);
    gesture([[-5, -5]]);
  });

  it('prélève une couleur à la pipette', () => {
    gesture([[4, 4], [4, 5]]);
    editor.colors.primary = { ...BLUE };
    editor.setTool('eyedropper');
    gesture([[4, 4], [4, 5]]);
    expect(editor.colors.primary).toEqual(RED);
    expect(editor.recentColors[0]).toBe('#ff0000');
    editor.setSetting('eyedropper', 'sampleAll', false);
    gesture([[200, 200]]);
    expect(editor.colors.primary).toEqual(RED);
  });

  it('place un texte via le dialogue', async () => {
    editor.setTool('text');
    $('#text-input').value = 'Salut\nPaint';
    const before = editor.history.entries.length;
    await answerDialog('ok', () => gesture([[3, 3]]));
    expect(editor.history.entries.length).toBeGreaterThanOrEqual(before);
    await answerDialog('cancel', () => gesture([[3, 3]]));
  });

  it('refuse de dessiner sur un calque verrouillé ou masqué', () => {
    const layer = editor.doc.activeLayer;
    layer.locked = true;
    gesture([[2, 2], [5, 2]]);
    expect(layerPixel(3, 2)).toEqual([255, 255, 255, 255]);
    expect($('#toast').textContent).toContain('verrouillé');
    layer.locked = false;
    layer.visible = false;
    gesture([[2, 2], [5, 2]]);
    expect($('#toast').textContent).toContain('masqué');
    layer.visible = true;
  });
});

describe('sélection', () => {
  beforeEach(() => {
    gesture([[4, 4], [8, 4]]);
  });

  it('sélectionne, déplace et annule le déplacement', () => {
    editor.setTool('select');
    gesture([[3, 3], [10, 6]]);
    expect(editor.selection.rect).toEqual({ x: 3, y: 3, width: 7, height: 3 });
    gesture([[5, 4], [5, 14]]);
    expect(layerPixel(5, 4)).toEqual([0, 0, 0, 0]);
    expect(layerPixel(5, 14)).toEqual([255, 0, 0, 255]);
    key('z', { ctrlKey: true });
    expect(layerPixel(5, 4)).toEqual([255, 0, 0, 255]);
    expect(layerPixel(5, 14)).toEqual([255, 255, 255, 255]);
    // Un appui hors de la sélection la retire.
    gesture([[30, 25]]);
    expect(editor.selection.rect).toBeNull();
  });

  it('copie, colle, valide, efface et coupe', async () => {
    editor.setTool('select');
    gesture([[3, 3], [10, 6]]);
    key('c', { ctrlKey: true });
    app.runCommand('copy');
    app.runCommand('paste');
    await until(() => editor.selection.floating !== null);
    expect(editor.selection.floating).not.toBeNull();
    key('Enter');
    await flush();
    expect(editor.selection.floating).toBeNull();
    expect(editor.history.peekLabels().undo).toBe('Coller');
    gesture([[30, 25]]);
    gesture([[3, 3], [10, 6]]);
    key('Delete');
    expect(layerPixel(5, 4)).toEqual([0, 0, 0, 0]);
    key('z', { ctrlKey: true });
    app.runCommand('cut');
    expect(layerPixel(5, 4)).toEqual([0, 0, 0, 0]);
    app.runCommand('paste');
    await flush();
    app.runCommand('delete-selection');
    expect(editor.selection.rect).toBeNull();
  });

  it('déplace tout le calque avec l\'outil Déplacer et annule au second doigt', () => {
    editor.setTool('move');
    gesture([[0, 0], [2, 0]]);
    expect(layerPixel(6, 4)).toEqual([255, 0, 0, 255]);
    expect(layerPixel(0, 4)).toEqual([0, 0, 0, 0]);
    editor.toolDown({ x: 0, y: 0 });
    editor.toolMove({ x: 5, y: 5 });
    editor.toolCancel();
    expect(layerPixel(6, 4)).toEqual([255, 0, 0, 255]);
  });

  it('gère tout sélectionner, désélectionner et Échap', async () => {
    key('a', { ctrlKey: true });
    expect(editor.selection.rect).toEqual({ x: 0, y: 0, width: 40, height: 30 });
    key('Escape');
    expect(editor.selection.rect).toBeNull();
    editor.setTool('move');
    editor.toolDown({ x: 1, y: 1 });
    editor.toolMove({ x: 3, y: 3 });
    expect(editor.selection.floating).not.toBeNull();
    key('Escape');
    expect(editor.selection.floating).toBeNull();
    expect(layerPixel(4, 4)).toEqual([255, 0, 0, 255]);
    key('a', { ctrlKey: true });
    key('d', { ctrlKey: true });
    expect(editor.selection.rect).toBeNull();
    app.runCommand('paste');
    await flush();
  });

  it('colle une image du presse-papiers système dans un nouveau calque', async () => {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    event.clipboardData = { files: [new File(['x'], 'a.png', { type: 'image/png' })] };
    document.dispatchEvent(event);
    await until(() => editor.doc.layers.length === 2);
    expect(editor.doc.layers).toHaveLength(2);
    const empty = new Event('paste', { bubbles: true });
    empty.clipboardData = { files: [] };
    editor.selection.clipboard = null;
    document.dispatchEvent(empty);
    expect($('#toast').textContent).toContain('Rien à coller');
  });
});

describe('calques', () => {
  const click = (selector) => $(selector).click();

  it('ajoute, duplique, déplace, fusionne, aplatit et supprime par les boutons', async () => {
    click('[data-layer-action="add"]');
    click('[data-layer-action="duplicate"]');
    await flush();
    expect(editor.doc.layers.map((l) => l.name)).toEqual(['Fond', 'Calque 2', 'Calque 2 (copie)']);
    expect(document.querySelectorAll('#layer-list .layer-row')).toHaveLength(3);
    click('[data-layer-action="down"]');
    click('[data-layer-action="up"]');
    click('[data-layer-action="merge"]');
    await flush();
    expect(editor.doc.layers).toHaveLength(2);
    click('[data-layer-action="flatten"]');
    await flush();
    expect(editor.doc.layers).toHaveLength(1);
    expect($('[data-layer-action="delete"]').disabled).toBe(true);
    click('[data-layer-action="add"]');
    await flush();
    click('[data-layer-action="delete"]');
    expect(editor.doc.layers).toHaveLength(1);
    app.layerAction('inconnue');
  });

  it('renomme, règle l\'opacité (aperçu puis étape) et le mode', () => {
    const name = $('#layer-name');
    name.value = '  Papier ';
    name.dispatchEvent(new Event('change'));
    expect(editor.doc.activeLayer.name).toBe('Papier');
    name.value = '';
    name.dispatchEvent(new Event('change'));
    expect(editor.doc.activeLayer.name).toBe('Papier');
    const opacity = $('#layer-opacity');
    opacity.value = '40';
    opacity.dispatchEvent(new Event('input'));
    expect(editor.doc.activeLayer.opacity).toBe(0.4);
    const steps = editor.history.entries.length;
    opacity.dispatchEvent(new Event('change'));
    expect(editor.history.entries.length).toBe(steps + 1);
    key('z', { ctrlKey: true });
    expect(editor.doc.activeLayer.opacity).toBe(1);
    const blend = $('#layer-blend');
    blend.value = 'multiply';
    blend.dispatchEvent(new Event('change'));
    expect(editor.doc.activeLayer.blend).toBe('multiply');
  });

  it('bascule visibilité et verrou et change de calque actif depuis la liste', async () => {
    app.layerAction('add');
    await flush();
    const rows = () => document.querySelectorAll('#layer-list .layer-row');
    rows()[1].querySelector('[data-action="toggle-visible"]').click();
    expect(editor.doc.layers[0].visible).toBe(false);
    await flush();
    rows()[1].querySelector('[data-action="toggle-lock"]').click();
    expect(editor.doc.layers[0].locked).toBe(true);
    await flush();
    rows()[1].querySelector('[data-action="select"]').click();
    expect(editor.doc.activeLayer.name).toBe('Fond');
    app.layerRowAction('absent', 'select');
  });

  it('signale la limite de calques', () => {
    for (let i = 0; i < 40; i++) {
      app.layerAction('add');
    }
    expect($('#toast').textContent).toContain('Limite');
  });
});

describe('couleurs', () => {
  it('saisit une couleur hexadécimale, refuse une valeur invalide', () => {
    const hex = $('#hex-input');
    hex.value = '#00ff00';
    hex.dispatchEvent(new Event('change'));
    expect(editor.colors.primary).toEqual({ r: 0, g: 255, b: 0, a: 255 });
    hex.value = 'vert';
    hex.dispatchEvent(new Event('change'));
    expect(hex.getAttribute('aria-invalid')).toBe('true');
  });

  it('règle teinte, opacité et carré (pointeur et clavier)', () => {
    const hue = $('#hue-range');
    hue.value = '240';
    hue.dispatchEvent(new Event('input'));
    hue.dispatchEvent(new Event('change'));
    const alpha = $('#alpha-range');
    alpha.value = '50';
    alpha.dispatchEvent(new Event('input'));
    expect(editor.colors.primary.a).toBe(128);
    const sv = $('#sv-canvas');
    sv.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
    sv.dispatchEvent(pointer('pointerdown', { x: 100, y: 0 }));
    sv.dispatchEvent(pointer('pointermove', { x: 100, y: 0 }));
    sv.dispatchEvent(pointer('pointerup', { x: 100, y: 0 }));
    expect(editor.colors.primary).toMatchObject({ r: 0, g: 0, b: 255 });
    sv.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    sv.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(editor.colors.primary.b).toBeLessThan(255);
  });

  it('change de cible, inverse, réinitialise et choisit une couleur récente', async () => {
    $('#target-secondary').click();
    expect(app.colorTarget).toBe('secondary');
    $('#target-primary').click();
    editor.colors.primary = { ...RED };
    $('#btn-swap').click();
    expect(editor.colors.secondary).toEqual(RED);
    key('x');
    key('d');
    expect(editor.colors.primary).toEqual({ r: 0, g: 0, b: 0, a: 255 });
    editor.rememberColor('secondary');
    await flush();
    $('#recent-colors [data-color]').click();
    expect(editor.colors.primary).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    $('#btn-default-colors').click();
  });
});

describe('commandes, vue et tiroirs', () => {
  it('zoome, ajuste, affiche la grille et règle la taille au clavier', () => {
    $('#zoom-in').click();
    $('#zoom-out').click();
    key('+');
    key('-');
    key('1', { ctrlKey: true });
    expect(editor.view.scale).toBe(1);
    $('#zoom-fit').click();
    app.runCommand('toggle-grid');
    app.runCommand('toggle-grid');
    editor.setTool('brush');
    key(']');
    expect(editor.settingsFor('brush').size).toBe(20);
    key('[');
    key('é', { code: 'Digit5' });
    expect(editor.settingsFor('brush').opacity).toBe(50);
    editor.setTool('text');
    key(']');
    key('u');
    expect(editor.tool.id).toBe('rect');
    key('u');
    expect(editor.tool.id).toBe('ellipse');
    key('q');
    app.runCommand('inconnue');
  });

  it('dessine la vue avec grille, sélection et curseur', () => {
    editor.setView({ scale: 10, x: 0, y: 0 });
    editor.selection.setRect({ x: 1, y: 1, width: 3, height: 3 });
    editor.setTool('brush');
    editor.setHover({ x: 2, y: 2 });
    editor.renderer.documentDirty = true;
    editor.renderer.render();
    editor.renderer.refreshTheme();
    expect(editor.renderer.compositeCtx.calls.length).toBeGreaterThan(0);
  });

  it('ouvre, ferme et alterne les tiroirs', () => {
    $('#btn-colors').click();
    expect($('#app').dataset.drawer).toBe('color');
    $('#btn-layers').click();
    expect($('#app').dataset.drawer).toBe('layers');
    expect($('#btn-layers').getAttribute('aria-expanded')).toBe('true');
    key('Escape');
    expect($('#app').dataset.drawer).toBe('none');
    $('#btn-file').click();
    $('#drawer-file [data-close-drawer]').click();
    expect($('#app').dataset.drawer).toBe('none');
    $('#btn-file').click();
    $('#btn-file').click();
    expect($('#app').dataset.drawer).toBe('none');
  });

  it('ignore les raccourcis dans un champ et gère Espace pour la vue', () => {
    $('#layer-name').dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
    key(' ', { code: 'Space' });
    expect(editor.spaceHeld).toBe(true);
    const x = editor.view.x;
    gesture([[5, 5], [10, 5]]);
    expect(editor.view.x).not.toBe(x);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    expect(editor.spaceHeld).toBe(false);
    key(' ', { code: 'Space' });
    window.dispatchEvent(new Event('blur'));
    expect(editor.spaceHeld).toBe(false);
  });

  it('laisse Entrée et Espace activer les boutons au clavier', () => {
    const press = (target, init) => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    };
    const button = $('#btn-file');
    // Bouton atteint au clavier (Tab), et non cliqué à la souris.
    press(button, { key: 'Tab' });
    button.focus();
    expect(press(button, { key: 'Enter' }).defaultPrevented).toBe(false);
    expect(press(button, { key: ' ', code: 'Space' }).defaultPrevented).toBe(false);
    expect(editor.spaceHeld).toBe(false);
    const pencil = $('[data-tool="pencil"]');
    expect(press(pencil, { key: 'Enter' }).defaultPrevented).toBe(false);
    // Hors de tout contrôle, Espace reste le déplacement temporaire de la vue.
    expect(press(document.body, { key: ' ', code: 'Space' }).defaultPrevented).toBe(true);
    expect(editor.spaceHeld).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    // Les autres raccourcis restent actifs depuis un bouton.
    expect(press(button, { key: 'b' }).defaultPrevented).toBe(true);
    expect(editor.tool.id).toBe('brush');
  });

  it('ne cède pas Espace au bouton cliqué à la souris : la vue se déplace', () => {
    const press = (target, type, init) => {
      const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    };
    const pencil = $('[data-tool="pencil"]');
    const layers = editor.doc.layers.length;
    // Clic souris sur un outil puis tracé : le tracé libère le focus du bouton.
    pencil.dispatchEvent(pointer('pointerdown', { x: 0, y: 0 }));
    pencil.focus();
    pencil.click();
    gesture([[5, 5], [8, 5]]);
    expect(document.activeElement).toBe(document.body);
    // Clic souris sur « + Nouveau », qui garde le focus, puis Espace + glisser.
    const add = $('[data-layer-action="add"]');
    add.dispatchEvent(pointer('pointerdown', { x: 0, y: 0 }));
    add.focus();
    add.click();
    expect(editor.doc.layers.length).toBe(layers + 1);
    const cursor = editor.history.cursor;
    const x = editor.view.x;
    expect(press(add, 'keydown', { key: ' ', code: 'Space' }).defaultPrevented).toBe(true);
    expect(editor.spaceHeld).toBe(true);
    gesture([[5, 5], [15, 5]]);
    expect(editor.view.x).not.toBe(x);
    expect(editor.history.cursor).toBe(cursor);
    // Le relâchement ne clique pas le bouton.
    expect(press(add, 'keyup', { key: ' ', code: 'Space' }).defaultPrevented).toBe(true);
    expect(editor.spaceHeld).toBe(false);
    expect(editor.doc.layers.length).toBe(layers + 1);
    // Tab rend Entrée et Espace aux boutons atteints au clavier.
    press(add, 'keydown', { key: 'Tab' });
    expect(press(add, 'keydown', { key: ' ', code: 'Space' }).defaultPrevented).toBe(false);
    expect(editor.spaceHeld).toBe(false);
  });

  it('valide la sélection collée avec Entrée, même focus sur « Coller »', async () => {
    editor.setTool('pencil');
    gesture([[4, 4], [8, 4]]);
    editor.setTool('select');
    gesture([[3, 3], [10, 6]]);
    app.runCommand('copy');
    // Atteint au clavier : Entrée active nativement « Coller » tant que rien ne flotte.
    $('#app').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    await until(() => $('#tool-options [data-command="paste"]') !== null);
    const paste = $('#tool-options [data-command="paste"]');
    paste.focus();
    const enter = () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      paste.dispatchEvent(event);
      return event;
    };
    expect(enter().defaultPrevented).toBe(false);
    paste.click();
    await until(() => editor.selection.floating !== null);
    expect(editor.selection.floating).not.toBeNull();
    expect(enter().defaultPrevented).toBe(true);
    await flush();
    expect(editor.selection.floating).toBeNull();
    expect(editor.history.peekLabels().undo).toBe('Coller');
  });

  it('place le focus dans le tiroir ouvert et le rend au bouton à la fermeture', () => {
    $('#btn-file').focus();
    $('#btn-file').click();
    expect($('#drawer-file').contains(document.activeElement)).toBe(true);
    key('Escape');
    expect(document.activeElement).toBe($('#btn-file'));
    $('#btn-layers').click();
    expect($('#drawer-layers').contains(document.activeElement)).toBe(true);
    $('#btn-layers').click();
    expect(document.activeElement).toBe($('#btn-layers'));
    expect($('#app').dataset.drawer).toBe('none');
    // Échap depuis un champ du tiroir le referme aussi.
    $('#btn-colors').click();
    $('#hex-input').focus();
    $('#hex-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect($('#app').dataset.drawer).toBe('none');
    expect(document.activeElement).toBe($('#btn-colors'));
    // Fermeture alors que le focus est ailleurs : il n'est pas déplacé.
    $('#btn-colors').click();
    $('#theme-toggle').focus();
    app.closeDrawers();
    expect(document.activeElement).toBe($('#theme-toggle'));
  });

  it('donne un nom accessible à chaque curseur et à chaque case', async () => {
    for (const tool of ['brush', 'rect', 'text', 'fill']) {
      editor.setTool(tool);
      await flush();
      for (const input of document.querySelectorAll('#tool-options input[type="range"]')) {
        expect(input.getAttribute('aria-label')).toMatch(/\S/);
      }
      // Cases : étiquetées par leur <label> (sans <output> qui le capterait).
      for (const input of document.querySelectorAll('#tool-options input[type="checkbox"]')) {
        expect(input.labels[0].textContent).toMatch(/\S/);
      }
    }
    editor.setTool('rect');
    await flush();
    expect($('[data-option="constrain"]').getAttribute('aria-label')).toBe('Contraindre (carré, cercle, 45°, comme Maj)');
    expect($('[data-option="size"]').getAttribute('aria-label')).toBe('Taille');
    // Libellé contenant un <output> : l'étiquette irait à l'output, d'où l'aria-label.
    expect($('#layer-opacity').getAttribute('aria-label')).toBe('Opacité du calque');
    expect($('#export-quality').getAttribute('aria-label')).toBe('Qualité');
  });

  it('signale les options hors champ par un fondu', async () => {
    const bar = $('#tool-options');
    Object.defineProperty(bar, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(bar, 'clientWidth', { configurable: true, value: 360 });
    editor.setTool('brush');
    await flush();
    expect(bar.classList.contains('ps-options--more')).toBe(true);
    Object.defineProperty(bar, 'scrollLeft', { configurable: true, value: 540 });
    bar.dispatchEvent(new Event('scroll'));
    expect(bar.classList.contains('ps-options--more')).toBe(false);
    delete bar.scrollWidth;
    delete bar.clientWidth;
    delete bar.scrollLeft;
    window.dispatchEvent(new Event('resize'));
    expect(bar.classList.contains('ps-options--more')).toBe(false);
  });

  it('crée un document, redimensionne le canevas et affiche l\'aide', async () => {
    $('#new-preset').value = '64x64';
    $('#new-preset').dispatchEvent(new Event('change'));
    $('#new-width').dispatchEvent(new Event('input'));
    $('#new-background').value = 'transparent';
    await answerDialog('ok', () => app.runCommand('new'));
    expect([editor.doc.width, editor.doc.height]).toEqual([64, 64]);
    await answerDialog('ok', () => {
      editor.selection.setRect({ x: 0, y: 0, width: 2, height: 2 });
      $('#resize-width').value = '50';
      app.runCommand('resize');
    });
    await answerDialog('cancel', () => app.runCommand('resize'));
    await answerDialog('cancel', () => app.runCommand('new'));
    await answerDialog('ok', () => app.runCommand('help'));
    expect(document.querySelectorAll('#shortcut-list dt').length).toBeGreaterThan(20);
    expect(document.querySelectorAll('#resize-anchor input')).toHaveLength(9);
  });
});

describe('affichage', () => {
  it('ne recompose que la zone touchée pendant un geste', () => {
    editor.setDocument(editor.blankDocument(200, 150, true));
    editor.setView({ scale: 1, x: 0, y: 0 });
    editor.setTool('pencil');
    editor.setSetting('pencil', 'size', 2);
    const { renderer } = editor;
    view.dispatchEvent(pointer('pointerdown', screen(10, 10)));
    renderer.composeDocument();
    view.dispatchEvent(pointer('pointermove', screen(14, 10)));
    const area = renderer.composeDocument();
    expect(area.width * area.height).toBeLessThan(100);
    expect(area.width * area.height).toBeGreaterThan(0);
    // L'image composée montre déjà le tracé en cours.
    expect(canvasPixel(renderer.composite, 13, 10)).toEqual([255, 0, 0, 255]);
    expect(canvasPixel(renderer.composite, 100, 100)).toEqual([255, 255, 255, 255]);
    // Rien de neuf : rien à recomposer.
    expect(renderer.needsCompose).toBe(false);
    view.dispatchEvent(pointer('pointerup', screen(14, 10)));
    expect(renderer.needsCompose).toBe(true);
    expect(renderer.composeDocument()).toEqual({ x: 0, y: 0, width: 200, height: 150 });
  });

  it('recompose l\'ancienne et la nouvelle position d\'une forme', () => {
    editor.setDocument(editor.blankDocument(200, 150, true));
    editor.setView({ scale: 1, x: 0, y: 0 });
    editor.setTool('rect');
    const { renderer } = editor;
    view.dispatchEvent(pointer('pointerdown', screen(10, 10)));
    view.dispatchEvent(pointer('pointermove', screen(120, 100)));
    renderer.composeDocument();
    view.dispatchEvent(pointer('pointermove', screen(20, 20)));
    const area = renderer.composeDocument();
    // L'aperçu précédent (jusqu'à 120, 100) doit être effacé de l'image composée.
    expect(area.x + area.width).toBeGreaterThanOrEqual(120);
    expect(area.y + area.height).toBeGreaterThanOrEqual(100);
    view.dispatchEvent(pointer('pointerup', screen(20, 20)));
  });
});

describe('gestes', () => {
  it('pince à deux doigts : annule le tracé et zoome', () => {
    const scale = editor.view.scale;
    view.dispatchEvent(pointer('pointerdown', { id: 1, type: 'touch', ...screen(2, 2) }));
    view.dispatchEvent(pointer('pointermove', { id: 1, type: 'touch', ...screen(6, 2) }));
    view.dispatchEvent(pointer('pointerdown', { id: 2, type: 'touch', ...screen(12, 2) }));
    view.dispatchEvent(pointer('pointermove', { id: 2, type: 'touch', ...screen(30, 2) }));
    view.dispatchEvent(pointer('pointerup', { id: 1, type: 'touch', ...screen(6, 2) }));
    view.dispatchEvent(pointer('pointermove', { id: 2, type: 'touch', ...screen(31, 2) }));
    view.dispatchEvent(pointer('pointerup', { id: 2, type: 'touch', ...screen(30, 2) }));
    expect(editor.view.scale).toBeGreaterThan(scale);
    expect(layerPixel(4, 2)).toEqual([255, 255, 255, 255]);
  });

  it('ignore la paume pendant un tracé au stylet', () => {
    view.dispatchEvent(pointer('pointerdown', { id: 5, type: 'pen', ...screen(2, 2) }));
    view.dispatchEvent(pointer('pointerdown', { id: 6, type: 'touch', ...screen(20, 20) }));
    view.dispatchEvent(pointer('pointermove', { id: 5, type: 'pen', ...screen(9, 2) }));
    view.dispatchEvent(pointer('pointerup', { id: 6, type: 'touch', ...screen(20, 20) }));
    view.dispatchEvent(pointer('pointerup', { id: 5, type: 'pen', ...screen(9, 2) }));
    expect(layerPixel(6, 2)).toEqual([255, 0, 0, 255]);
  });

  it('donne la priorité au stylet sur une paume posée avant lui', () => {
    // La paume commence un tracé, puis le stylet arrive : le tracé de la paume
    // est annulé sans trace et ses mouvements suivants sont ignorés.
    view.dispatchEvent(pointer('pointerdown', { id: 7, type: 'touch', ...screen(2, 20) }));
    view.dispatchEvent(pointer('pointermove', { id: 7, type: 'touch', ...screen(9, 20) }));
    view.dispatchEvent(pointer('pointerdown', { id: 8, type: 'pen', ...screen(2, 2) }));
    view.dispatchEvent(pointer('pointermove', { id: 7, type: 'touch', ...screen(12, 20) }));
    view.dispatchEvent(pointer('pointermove', { id: 8, type: 'pen', ...screen(9, 2) }));
    view.dispatchEvent(pointer('pointerup', { id: 7, type: 'touch', ...screen(12, 20) }));
    view.dispatchEvent(pointer('pointerup', { id: 8, type: 'pen', ...screen(9, 2) }));
    expect(layerPixel(6, 2)).toEqual([255, 0, 0, 255]);
    expect(layerPixel(6, 20)).toEqual([255, 255, 255, 255]);
  });

  it('déplace la vue (bouton du milieu, outil Main), zoome à la molette, annule sur pointercancel', () => {
    const x = editor.view.x;
    gesture([[5, 5], [8, 5]], { button: 1 });
    expect(editor.view.x).not.toBe(x);
    editor.setTool('hand');
    gesture([[5, 5], [5, 9]]);
    const scale = editor.view.scale;
    view.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 10, clientY: 10, cancelable: true }));
    view.dispatchEvent(new WheelEvent('wheel', { deltaY: 3, deltaMode: 1, ctrlKey: true, cancelable: true }));
    expect(editor.view.scale).not.toBe(scale);
    editor.setTool('pencil');
    view.dispatchEvent(pointer('pointerdown', { ...screen(2, 2) }));
    view.dispatchEvent(pointer('pointercancel', { ...screen(2, 2) }));
    view.dispatchEvent(pointer('pointerleave', { ...screen(2, 2) }));
    view.dispatchEvent(pointer('pointerdown', { ...screen(2, 2), button: 4 }));
    view.dispatchEvent(pointer('pointerup', { id: 99, ...screen(2, 2) }));
    view.dispatchEvent(new MouseEvent('contextmenu', { cancelable: true }));
    expect(editor.hover).toBeNull();
  });

  it('suit le redimensionnement de la zone d\'affichage', () => {
    globalThis.__resize([{ contentRect: { width: 500, height: 320 } }]);
    expect(editor.screen).toEqual({ width: 500, height: 320 });
  });
});

describe('fichiers et sauvegarde automatique', () => {
  it('enregistre, rouvre un projet et refuse un fichier invalide', async () => {
    app.layerAction('add');
    const json = serializeDocument(editor.doc);
    app.runCommand('save');
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    const input = $('#file-open');
    Object.defineProperty(input, 'files', { configurable: true, value: [new File([json], 'p.paint.json', { type: 'application/json' })] });
    input.dispatchEvent(new Event('change'));
    await until(() => $('#toast').textContent.includes('ouvert'));
    expect(editor.doc.layers).toHaveLength(2);
    expect($('#toast').textContent).toContain('ouvert');
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['{}'], 'x.json', { type: 'application/json' })] });
    input.dispatchEvent(new Event('change'));
    await until(() => $('#toast').textContent.includes('pas un projet'));
    expect($('#toast').textContent).toContain('pas un projet');
    // Corps des images altéré, en-têtes intacts : le décodage échoue.
    const broken = json.replaceAll('AAAA"', 'BBBB"');
    Object.defineProperty(input, 'files', { configurable: true, value: [new File([broken], 'b.paint.json')] });
    input.dispatchEvent(new Event('change'));
    await until(() => $('#toast').textContent.includes('illisible'));
    expect($('#toast').textContent).toContain('illisible');
  });

  it('ouvre une image comme document et importe une image en calque', async () => {
    const input = $('#file-open');
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['x'], 'photo.png', { type: 'image/png' })] });
    input.dispatchEvent(new Event('change'));
    await until(() => editor.doc.width === 30);
    expect([editor.doc.width, editor.doc.height]).toEqual([30, 20]);
    expect(editor.doc.layers[0].name).toBe('photo');
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['x'], 'notes.txt', { type: 'text/plain' })] });
    input.dispatchEvent(new Event('change'));
    await until(() => $('#toast').textContent.includes('non reconnu'));
    expect($('#toast').textContent).toContain('non reconnu');
    const importer = $('#file-import');
    Object.defineProperty(importer, 'files', { configurable: true, value: [new File(['x'], 'motif.png', { type: 'image/png' })] });
    importer.dispatchEvent(new Event('change'));
    await until(() => editor.doc.activeLayer.name === 'motif');
    expect(editor.doc.activeLayer.name).toBe('motif');
    key('z', { ctrlKey: true });
    expect(editor.doc.layers).toHaveLength(1);
  });

  it('compte dans l\'historique la mémoire réellement retenue par un import', async () => {
    const before = editor.history.usedBytes;
    const importer = $('#file-import');
    Object.defineProperty(importer, 'files', { configurable: true, value: [new File(['x'], 'petit.png', { type: 'image/png' })] });
    importer.dispatchEvent(new Event('change'));
    await until(() => editor.doc.activeLayer.name === 'petit');
    const entry = editor.history.entries[editor.history.cursor - 1];
    // Instantané du calque entier (40 × 30), pas de l'image importée (30 × 20).
    expect(entry.bytes).toBe(entry.snapshot.buffer.data.byteLength);
    expect(entry.bytes).toBe(editor.doc.width * editor.doc.height * 4);
    expect(editor.history.usedBytes - before).toBe(entry.bytes);
  });

  it('refuse d\'enregistrer un projet trop lourd pour être rouvert', async () => {
    const spy = jest.spyOn(JSON, 'stringify').mockImplementation(() => {
      throw new RangeError('Invalid string length');
    });
    HTMLAnchorElement.prototype.click.mockClear();
    app.runCommand('save');
    await flush();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect($('#toast').textContent).toContain('trop lourd');
    await app.autosave.save();
    expect($('#autosave-status').textContent).toContain('suspendue');
    spy.mockRestore();
  });

  it('prévient quand la sauvegarde automatique ne peut pas être restaurée', async () => {
    globalThis.indexedDB.stores.get('kv').set('autosave-project', '{"format":"playlab42-paint-studio","version":1,"width":16,"height":16,"layers":[]}');
    expect(await app.autosave.restore()).toBe(false);
    expect($('#toast').textContent).toContain('non restaurée');
  });

  it('refuse un projet dont une image est plus grande que déclaré', async () => {
    const { pngHeaderDataUrl } = await import('./helpers/fake-browser.js');
    const layer = { name: 'Fond', visible: true, locked: false, opacity: 1, blend: 'source-over', image: `${pngHeaderDataUrl(16000, 16000)}AAAA` };
    const bomb = JSON.stringify({ format: 'playlab42-paint-studio', version: 1, width: 16, height: 16, activeLayer: 0, layers: [layer] });
    const input = $('#file-open');
    Object.defineProperty(input, 'files', { configurable: true, value: [new File([bomb], 'bombe.paint.json', { type: 'application/json' })] });
    input.dispatchEvent(new Event('change'));
    await until(() => $('#toast').textContent.includes('16000'));
    expect($('#toast').textContent).toContain('16000 × 16000 px au lieu de 16 × 16');
    expect(editor.doc.width).not.toBe(16);
  });

  it('accepte le glisser-déposer', async () => {
    const stage = $('#stage');
    stage.dispatchEvent(new Event('dragover', { cancelable: true }));
    expect($('#drop-hint').hidden).toBe(false);
    stage.dispatchEvent(new Event('dragleave'));
    const drop = new Event('drop', { cancelable: true });
    drop.dataTransfer = { files: [new File(['x'], 'd.png', { type: 'image/png' }), new File([serializeDocument(editor.doc)], 'd.paint.json')] };
    stage.dispatchEvent(drop);
    await flush();
    expect($('#drop-hint').hidden).toBe(true);
  });

  it('exporte en PNG et JPEG, signale un format non pris en charge', async () => {
    for (const format of ['png', 'jpeg', 'webp']) {
      $('#export-format').value = format;
      $('#export-format').dispatchEvent(new Event('change'));
      $('#export-quality').dispatchEvent(new Event('input'));
      await answerDialog('ok', () => app.runCommand('export'));
    }
    expect($('#toast').textContent).toContain('WEBP non pris en charge');
    await answerDialog('cancel', () => app.runCommand('export'));
  });

  it('sauvegarde automatiquement et restaure le projet et les préférences', async () => {
    gesture([[1, 1], [3, 1]]);
    await app.autosave.save();
    expect($('#autosave-status').textContent).toContain('Sauvegarde automatique à');
    editor.setSetting('brush', 'size', 33);
    editor.recentColors = ['#123456'];
    app.schedulePreferences();
    await new Promise((resolve) => setTimeout(resolve, 600));
    const second = new App();
    await second.start();
    expect(second.editor.doc.width).toBe(editor.doc.width);
    expect(second.editor.settingsFor('brush').size).toBe(33);
    expect(second.editor.recentColors).toEqual(['#123456']);
    globalThis.indexedDB.stores.get('kv').set('autosave-project', '{corrompu');
    expect(await second.autosave.restore()).toBe(false);
  });

  it('colle depuis le presse-papiers système via le bouton', async () => {
    editor.selection.clipboard = null;
    navigator.clipboard = { read: () => Promise.resolve([{ types: ['image/png'], getType: () => Promise.resolve(new Blob(['x'], { type: 'image/png' })) }]) };
    const layers = editor.doc.layers.length;
    app.runCommand('paste');
    await until(() => editor.doc.layers.length === layers + 1);
    expect(editor.doc.layers.length).toBe(layers + 1);
    navigator.clipboard = { read: () => Promise.resolve([{ types: ['text/plain'] }]) };
    app.runCommand('paste');
    await flush();
    expect($('#toast').textContent).toContain('pas d\'image');
    navigator.clipboard = { read: () => Promise.reject(new Error('refus')) };
    app.runCommand('paste');
    await until(() => $('#toast').textContent.includes('refusé'));
    expect($('#toast').textContent).toContain('refusé');
    delete navigator.clipboard;
  });
});
