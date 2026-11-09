/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { $, on, debounce, escapeHtml } from '../../lib/dom.js';

/**
 * Charge le vrai document et exécute son interface sans les ressources CDN.
 * @param {string} filename - Fichier HTML de l’outil
 * @returns {Document} Document analysé
 */
function loadTool(filename) {
  const html = readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8');
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.body.innerHTML = parsed.body.innerHTML;
  return parsed;
}

/**
 * Laisse les lectures d’images et l’initialisation asynchrones se terminer.
 */
async function flushPromises() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  delete window.mi;
});

describe('JSON Formatter : commandes accessibles', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    const parsed = loadTool('json-formatter.html');
    Object.assign(window, { $, on, debounce, escapeHtml });
    const script = [...parsed.querySelectorAll('script')].find(element => element.textContent.includes('function formatJSON'));
    // Le module DOM réel est injecté ; le reste du script standalone est exécuté tel quel.
    const code = script.textContent.replace(/^\s*import .* from '\.\.\/lib\/dom\.js';/m, '');
    // eslint-disable-next-line no-eval
    window.eval(code);
  });

  test('associe le champ à un label et annonce puis efface les erreurs de syntaxe', () => {
    const input = $('#input');
    expect(input.labels[0].textContent).toBe('Entrée JSON');
    input.value = '{';
    $('#btn-format').click();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect($('#status').getAttribute('role')).toBe('status');
    expect($('#status').textContent).toContain('Invalide');
    input.value = '';
    $('#btn-format').click();
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect($('#output').classList.contains('error')).toBe(false);
  });

  test('minifie la saisie courante, y compris les valeurs JSON falsy, sans réutiliser un ancien résultat', () => {
    $('#input').value = '{"ancien":true}';
    $('#btn-format').click();
    $('#input').value = '{"nouveau":[1,2]}';
    $('#btn-minify').click();
    expect($('#output').textContent).toBe('{"nouveau":[1,2]}');
    for (const value of ['null', 'false', '0']) {
      $('#input').value = value;
      $('#btn-minify').click();
      expect($('#output').textContent).toBe(value);
    }
    $('#input').value = '{';
    $('#btn-minify').click();
    expect($('#output').textContent).toContain('Erreur de syntaxe');
  });

  test('annonce un refus du presse-papiers et garde le résultat sélectionnable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockRejectedValue(new Error('Permission refusée')) },
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    $('#input').value = '123';
    $('#btn-format').click();
    $('#btn-copy').click();
    await flushPromises();
    expect($('#copy-status').textContent).toContain('Copie impossible');
    expect($('#output').getAttribute('tabindex')).toBe('0');
  });

  test('colore les chaînes contenant du HTML sans créer de balises ni altérer leur texte', () => {
    const value = { image: '<img src=x onerror=alert(1)>', message: 'true 42' };
    $('#input').value = JSON.stringify(value);
    $('#btn-format').click();
    expect($('#output').textContent).toBe(JSON.stringify(value, null, 2));
    expect($('#output').querySelector('img')).toBeNull();
    expect($('#output').querySelector('.key').textContent).toBe('"image":');
  });
});

describe('Neural Style : import et résultat au clavier', () => {
  let documentListeners;

  beforeEach(async () => {
    const parsed = loadTool('neural-style.html');
    documentListeners = [];
    const addListener = document.addEventListener.bind(document);
    jest.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
      documentListeners.push([type, listener, options]);
      addListener(type, listener, options);
    });
    window.mi = {
      ArbitraryStyleTransferNetwork: class {
        initialize() { return Promise.resolve(); }
        stylize() { return Promise.resolve({ width: 64, height: 64 }); }
      },
    };
    jest.spyOn(window, 'FileReader').mockImplementation(function () {
      this.readAsDataURL = () => this.onload({ target: { result: 'data:image/png;base64,cGlj' } });
    });
    jest.spyOn(window, 'Image').mockImplementation(() => {
      const image = document.createElement('img');
      image.width = 64;
      image.height = 64;
      Object.defineProperty(image, 'src', {
        set(value) {
          image.setAttribute('src', value);
          queueMicrotask(() => image.onload());
        },
      });
      return image;
    });
    const script = [...parsed.querySelectorAll('script')].find(element => !element.type && !element.src);
    // eslint-disable-next-line no-eval
    window.eval(script.textContent);
    await flushPromises();
  });

  afterEach(() => {
    for (const args of documentListeners) {
      document.removeEventListener(...args);
    }
  });

  test('utilise un vrai bouton pour importer et garde le nom du fichier sélectionné', async () => {
    const zone = $('#contentZone');
    const input = $('#contentInput');
    const openPicker = jest.spyOn(input, 'click').mockImplementation(() => {});
    expect(zone.tagName).toBe('BUTTON');
    zone.focus();
    zone.click();
    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(zone);
    Object.defineProperty(input, 'files', { value: [new File(['image'], 'portrait.png', { type: 'image/png' })] });
    input.dispatchEvent(new Event('change'));
    await flushPromises();
    expect($('#contentFilename').textContent).toBe('portrait.png');
    expect(zone.querySelector('img').alt).toContain('contenu');
    expect(zone.hasAttribute('aria-busy')).toBe(false);
  });

  test('charge une image déposée et synchronise la sélection accessible des styles', async () => {
    const card = $('#sampleStyles button');
    card.click();
    await flushPromises();
    expect(card.getAttribute('aria-pressed')).toBe('true');
    const drop = new Event('drop', { cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', {
      value: { files: [new File(['image'], 'texture.png', { type: 'image/png' })] },
    });
    $('#styleZone').dispatchEvent(drop);
    await flushPromises();
    expect(drop.defaultPrevented).toBe(true);
    expect($('#styleFilename').textContent).toBe('texture.png');
    expect(card.getAttribute('aria-pressed')).toBe('false');
  });

  test('annonce un dépôt incompatible sans remplacer l’image', async () => {
    const drop = new Event('drop', { cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [new File(['texte'], 'notes.txt', { type: 'text/plain' })] } });
    $('#contentZone').dispatchEvent(drop);
    await flushPromises();
    expect($('#status').textContent).toBe('Choisissez un fichier image.');
    expect($('#contentFilename').textContent).toBe('Aucun fichier sélectionné');
  });

  /**
   * Importe une image de contenu et une image de style factices.
   */
  async function importBothImages() {
    for (const kind of ['content', 'style']) {
      const input = $(`#${kind}Input`);
      Object.defineProperty(input, 'files', {
        value: [new File(['image'], `${kind}.png`, { type: 'image/png' })],
      });
      input.dispatchEvent(new Event('change'));
      await flushPromises();
    }
  }

  /**
   * Clique sur Styliser puis attend la pause de rendu et l'inférence simulée.
   */
  async function runStylize() {
    $('#stylizeBtn').click();
    await new Promise(resolve => setTimeout(resolve, 40));
    await flushPromises();
  }

  test('active la stylisation après deux imports puis affiche le résultat téléchargeable', async () => {
    const putImageData = jest.fn();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ putImageData, drawImage: jest.fn() });
    await importBothImages();
    expect($('#stylizeBtn').disabled).toBe(false);
    await runStylize();
    expect(putImageData).toHaveBeenCalledTimes(1);
    expect($('#resultCanvas').style.display).toBe('block');
    expect($('#resultCanvas').width).toBe(64);
    expect($('#downloadBtn').disabled).toBe(false);
    expect($('#status').textContent).toBe('Stylisation terminée !');
    expect($('#resultZone').hasAttribute('aria-busy')).toBe(false);
  });

  test('transmet au modèle les tailles (hauteur) et l’intensité choisies', async () => {
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ putImageData: jest.fn(), drawImage: jest.fn() });
    const stylize = jest.spyOn(window.mi.ArbitraryStyleTransferNetwork.prototype, 'stylize');
    await importBothImages();
    for (const [id, value] of [['contentSize', '384'], ['styleSize', '128'], ['strength', '60']]) {
      $(`#${id}`).value = value;
      $(`#${id}`).dispatchEvent(new Event('input'));
    }
    expect($('#contentSizeValue').textContent).toBe('384 px');
    expect($('#strengthValue').textContent).toBe('60 %');
    await runStylize();
    const [content, style, strength] = stylize.mock.calls[0];
    // Images sources 64×64 : agrandies à la hauteur demandée, ratio conservé
    expect([content.width, content.height]).toEqual([384, 384]);
    expect([style.width, style.height]).toEqual([128, 128]);
    expect(strength).toBeCloseTo(0.6);

    $('#strength').value = '100';
    await runStylize();
    // À 100 %, le modèle n'a pas à calculer le mélange avec le contenu
    expect(stylize.mock.calls[1][2]).toBeUndefined();
  });

  test('garde le style demandé en dernier quand deux vignettes se chargent en parallèle', async () => {
    const [first, second] = $('#sampleStyles').querySelectorAll('button');
    first.click();
    second.click();
    await flushPromises();
    expect(second.getAttribute('aria-pressed')).toBe('true');
    expect(first.getAttribute('aria-pressed')).toBe('false');
    expect(first.classList.contains('loading')).toBe(false);
    expect($('#styleFilename').textContent).toContain(second.querySelector('.style-name').textContent);
  });

  test('ouvre le résultat au clavier, contient le focus puis le restitue à la fermeture', () => {
    const canvas = $('#resultCanvas');
    jest.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,cGlj');
    canvas.style.display = 'block';
    canvas.focus();
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect($('#lightbox').classList.contains('active')).toBe(true);
    expect(document.activeElement).toBe($('#lightboxClose'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe($('#lightboxDownload'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect($('#lightbox').classList.contains('active')).toBe(false);
    expect(document.activeElement).toBe(canvas);
  });
});
