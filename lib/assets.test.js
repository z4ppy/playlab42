/**
 * Tests unitaires pour lib/assets.js
 * AssetLoader - Chargeur d'assets pour les jeux
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AssetLoader } from './assets.js';

describe('AssetLoader', () => {
  let loader;
  let originalImage;
  let originalAudio;
  let originalAudioElement;
  let originalFetch;

  beforeEach(() => {
    // Sauvegarder les originaux
    originalImage = global.Image;
    originalAudio = global.Audio;
    originalAudioElement = global.HTMLAudioElement;
    originalFetch = global.fetch;

    // Mock Image
    global.Image = class MockImage {
      constructor() {
        this.src = '';
        this.onload = null;
        this.onerror = null;
        setTimeout(() => {
          if (this.src && !this.src.includes('error')) {
            if (this.onload) {this.onload();}
          } else if (this.src.includes('error')) {
            if (this.onerror) {this.onerror();}
          }
        }, 0);
      }
    };

    // Mock Audio : un vrai sous-type de HTMLAudioElement, comme dans un navigateur
    global.HTMLAudioElement = class HTMLAudioElement {};
    global.Audio = class MockAudio extends global.HTMLAudioElement {
      constructor() {
        super();
        this.src = '';
        this.oncanplaythrough = null;
        this.onerror = null;
        this.paused = false;
      }

      load() {
        setTimeout(() => {
          if (this.src && !this.src.includes('error')) {
            if (this.oncanplaythrough) {this.oncanplaythrough();}
          } else if (this.src.includes('error')) {
            if (this.onerror) {this.onerror();}
          }
        }, 0);
      }

      pause() {
        this.paused = true;
      }

      cloneNode() {
        const clone = new MockAudio();
        clone.src = this.src;
        return clone;
      }
    };

    // Mock fetch
    global.fetch = jest.fn();

    // Mock structuredClone
    global.structuredClone = jest.fn((obj) => JSON.parse(JSON.stringify(obj)));

    loader = new AssetLoader('test-game', 'https://example.com/');
  });

  afterEach(() => {
    loader.dispose();
    global.Image = originalImage;
    global.Audio = originalAudio;
    global.HTMLAudioElement = originalAudioElement;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // Constructeur
  // ===========================================================================
  describe('constructor()', () => {
    it('utilise par défaut la racine relative au module partagé', async () => {
      const defaultLoader = new AssetLoader('my-game');
      const image = await defaultLoader.loadImage('sprite.png');
      expect(image.src).toBe(new URL('../games/my-game/sprite.png', import.meta.url).href);
      defaultLoader.dispose();
    });

    it('résout les assets dans un déploiement sous un chemin préfixé', async () => {
      const nestedLoader = new AssetLoader('test-game', 'https://example.com/playlab42/');
      const image = await nestedLoader.loadImage('./images/../sprite.png');
      const audio = await nestedLoader.loadAudio('sounds/play.mp3');
      global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ level: 1 }) });
      await nestedLoader.loadJSON('data/config.json');
      expect(image.src).toBe('https://example.com/playlab42/games/test-game/sprite.png');
      expect(audio.src).toBe('https://example.com/playlab42/games/test-game/sounds/play.mp3');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/playlab42/games/test-game/data/config.json',
        { signal: expect.any(AbortSignal) },
      );
      nestedLoader.dispose();
    });

    it.each([
      '/absolute/path.png',
      '//cdn.example.com/image.png',
      'https://cdn.example.com/image.png',
      'data:image/png;base64,AA==',
      'blob:https://example.com/image',
    ])('conserve un chemin absolu ou une URL spéciale : %s', async (src) => {
      const image = await loader.loadImage(src);
      expect(image.src).toBe(src);
    });
    it('initialise avec le nom du jeu', () => {
      const myLoader = new AssetLoader('my-game');
      // Le basePath est privé, on vérifie indirectement via loadImage
      expect(myLoader).toBeDefined();
    });
  });

  // ===========================================================================
  // loadImage()
  // ===========================================================================
  describe('loadImage()', () => {
    it('charge une image et la met en cache', async () => {
      const img = await loader.loadImage('sprite.png');

      expect(img).toBeInstanceOf(global.Image);
      expect(img.src).toBe('https://example.com/games/test-game/sprite.png');
    });

    it('retourne l\'image depuis le cache si déjà chargée', async () => {
      const img1 = await loader.loadImage('sprite.png');
      const img2 = await loader.loadImage('sprite.png');

      expect(img1).toBe(img2);
    });

    it('gère les chemins absolus', async () => {
      const img = await loader.loadImage('/absolute/path.png');

      expect(img.src).toBe('/absolute/path.png');
    });

    it('gère les URLs HTTP', async () => {
      const img = await loader.loadImage('https://example.com/image.png');

      expect(img.src).toBe('https://example.com/image.png');
    });

    it('rejette si l\'image ne charge pas', async () => {
      await expect(loader.loadImage('error.png')).rejects.toThrow('Failed to load image');
    });
  });

  // ===========================================================================
  // loadAudio()
  // ===========================================================================
  describe('loadAudio()', () => {
    it('charge un audio et le met en cache', async () => {
      const audio = await loader.loadAudio('sound.mp3');

      expect(audio).toBeInstanceOf(global.Audio);
    });

    it('retourne un clone depuis le cache si déjà chargé', async () => {
      const audio1 = await loader.loadAudio('sound.mp3');
      const audio2 = await loader.loadAudio('sound.mp3');

      // Les deux doivent avoir le même src mais être des instances différentes
      expect(audio1.src).toBe(audio2.src);
    });

    it('rejette si l\'audio ne charge pas', async () => {
      await expect(loader.loadAudio('error.mp3')).rejects.toThrow('Failed to load audio');
    });

    it('rejette explicitement un clone qui n\'est pas un HTMLAudioElement, sans mettre en cache', async () => {
      const MockAudio = global.Audio;
      MockAudio.prototype.cloneNode = function cloneNode() {
        return { pause() {}, play() {}, src: this.src };
      };
      await expect(loader.loadAudio('fake-clone.mp3')).rejects.toThrow('not an audio element');
      expect(loader.getAudio('fake-clone.mp3')).toBeNull();
    });

    it('accepte un clone d\'un autre contexte via le constructeur de sa fenêtre', async () => {
      class ForeignAudioElement { pause() {} }
      global.Audio.prototype.cloneNode = function cloneNode() {
        const clone = new ForeignAudioElement();
        clone.src = this.src;
        clone.ownerDocument = { defaultView: { HTMLAudioElement: ForeignAudioElement } };
        return clone;
      };
      const clone = await loader.loadAudio('foreign.mp3');
      expect(clone).toBeInstanceOf(ForeignAudioElement);
    });

    it('rejette un clone au simple pause() même avec play/src, faute d\'identité audio', async () => {
      global.Audio.prototype.cloneNode = function cloneNode() {
        return { ownerDocument: { defaultView: { HTMLAudioElement: class Other {} } }, pause() {}, play() {}, src: '' };
      };
      await expect(loader.loadAudio('duck.mp3')).rejects.toThrow('not an audio element');
    });

    it('rejette depuis le cache et retire une entrée dont le clone est invalide', async () => {
      await loader.loadAudio('cached.mp3');
      global.Audio.prototype.cloneNode = () => ({ pause() {} });
      await expect(loader.loadAudio('cached.mp3')).rejects.toThrow('not an audio element');
      expect(loader.getAudio('cached.mp3')).toBeNull();
    });
  });

  // ===========================================================================
  // loadJSON()
  // ===========================================================================
  describe('loadJSON()', () => {
    it('charge et parse un fichier JSON', async () => {
      const mockData = { name: 'test', value: 42 };
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const data = await loader.loadJSON('config.json');

      expect(data).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/games/test-game/config.json', {
        signal: expect.any(AbortSignal),
      });
    });

    it('retourne un clone depuis le cache si déjà chargé', async () => {
      const mockData = { name: 'test' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const data1 = await loader.loadJSON('config.json');
      const data2 = await loader.loadJSON('config.json');

      // structuredClone est appelé, donc les objets sont différents
      expect(data1).toEqual(data2);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Un seul appel
    });

    it('rejette si le fetch échoue', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
      });

      await expect(loader.loadJSON('notfound.json')).rejects.toThrow('Failed to load JSON');
    });
  });

  // ===========================================================================
  // preload()
  // ===========================================================================
  describe('preload()', () => {
    it('précharge plusieurs assets', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });

      const manifest = [
        { type: 'image', src: 'img1.png' },
        { type: 'image', src: 'img2.png' },
        { type: 'json', src: 'data.json' },
      ];

      const results = await loader.preload(manifest);

      expect(results.loaded).toHaveLength(3);
      expect(results.failed).toHaveLength(0);
    });

    it('rapporte les assets qui échouent', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const manifest = [
        { type: 'image', src: 'good.png' },
        { type: 'image', src: 'error.png' }, // Échouera
        { type: 'json', src: 'data.json' },
      ];

      const results = await loader.preload(manifest);

      expect(results.loaded).toContain('good.png');
      expect(results.loaded).toContain('data.json');
      expect(results.failed.some((f) => f.src === 'error.png')).toBe(true);
    });

    it('appelle onProgress avec la progression', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const manifest = [
        { type: 'image', src: 'img1.png' },
        { type: 'json', src: 'data.json' },
      ];

      const onProgress = jest.fn();
      await loader.preload(manifest, onProgress);

      expect(onProgress).toHaveBeenCalledWith(0.5);
      expect(onProgress).toHaveBeenCalledWith(1);
    });

    it('gère les types d\'asset inconnus', async () => {
      const manifest = [
        { type: 'unknown', src: 'file.xyz' },
      ];

      const results = await loader.preload(manifest);

      expect(results.failed).toHaveLength(1);
      expect(results.failed[0].error).toContain('Unknown asset type');
    });

    it('précharge les fichiers audio', async () => {
      const manifest = [
        { type: 'audio', src: 'sound.mp3' },
      ];

      const results = await loader.preload(manifest);

      expect(results.loaded).toContain('sound.mp3');
    });
  });

  // ===========================================================================
  // getImage()
  // ===========================================================================
  describe('getImage()', () => {
    it('retourne l\'image si déjà chargée', async () => {
      await loader.loadImage('sprite.png');

      const img = loader.getImage('sprite.png');

      expect(img).toBeInstanceOf(global.Image);
    });

    it('retourne undefined si non chargée', () => {
      const img = loader.getImage('notloaded.png');

      expect(img).toBeUndefined();
    });
  });

  // ===========================================================================
  // getAudio()
  // ===========================================================================
  describe('getAudio()', () => {
    it('retourne un clone de l\'audio si déjà chargé', async () => {
      await loader.loadAudio('sound.mp3');

      const audio = loader.getAudio('sound.mp3');

      expect(audio).toBeInstanceOf(global.Audio);
    });

    it('retourne null si non chargé', () => {
      const audio = loader.getAudio('notloaded.mp3');

      expect(audio).toBeNull();
    });
  });

  // ===========================================================================
  // getData()
  // ===========================================================================
  describe('getData()', () => {
    it('retourne un clone des données si déjà chargées', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ key: 'value' }),
      });

      await loader.loadJSON('config.json');
      const data = loader.getData('config.json');

      expect(data).toEqual({ key: 'value' });
    });

    it('retourne null si non chargé', () => {
      const data = loader.getData('notloaded.json');

      expect(data).toBeNull();
    });
  });

  // ===========================================================================
  // dispose()
  // ===========================================================================
  describe('dispose()', () => {
    it('arrête tous les clones fournis par loadAudio, y compris depuis le cache', async () => {
      const first = await loader.loadAudio('sound.mp3');
      const cached = await loader.loadAudio('sound.mp3');
      const clone = loader.getAudio('sound.mp3');
      expect(first).not.toBe(cached);
      loader.dispose();
      for (const audio of [first, cached, clone]) {
        expect(audio.paused).toBe(true);
        expect(audio.src).toBe('');
      }
      const fresh = await loader.loadAudio('sound.mp3');
      expect(fresh.src).toBe('https://example.com/games/test-game/sound.mp3');
    });

    it('annule les chargements image/audio et retire leurs callbacks', async () => {
      let image;
      let audio;
      global.Image = class {
        constructor() { image = this; }
      };
      global.Audio = class {
        constructor() { audio = this; }
        load() {}
        pause() {}
      };
      const imagePromise = loader.loadImage('pending.png');
      const audioPromise = loader.loadAudio('pending.mp3');
      const imageResult = expect(imagePromise).rejects.toThrow('Asset loading disposed');
      const audioResult = expect(audioPromise).rejects.toThrow('Asset loading disposed');
      loader.dispose();
      await Promise.all([imageResult, audioResult]);
      expect(image.onload).toBeNull();
      expect(image.onerror).toBeNull();
      expect(audio.oncanplaythrough).toBeNull();
      expect(audio.onerror).toBeNull();
      expect(image.src).toBe('');
      expect(audio.src).toBe('');
      expect(loader.getImage('pending.png')).toBeUndefined();
    });

    it('annule le JSON en cours et empêche une réponse tardive de repeupler le cache', async () => {
      let resolveJSON;
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => new Promise(resolve => { resolveJSON = resolve; }),
      });
      const pending = loader.loadJSON('pending.json');
      await Promise.resolve();
      const signal = global.fetch.mock.calls[0][1].signal;
      const result = expect(pending).rejects.toThrow('Asset loading disposed');
      loader.dispose();
      expect(signal.aborted).toBe(true);
      resolveJSON({ late: true });
      await result;
      expect(loader.getData('pending.json')).toBeNull();
    });

    it('ne notifie pas la progression après dispose', async () => {
      const onProgress = jest.fn();
      const pending = loader.preload([{ type: 'image', src: 'pending.png' }], onProgress);
      loader.dispose();
      const result = await pending;
      expect(result.failed).toHaveLength(1);
      expect(onProgress).not.toHaveBeenCalled();
    });
    it('arrête tous les audios et vide les caches', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await loader.loadImage('img.png');
      await loader.loadAudio('sound.mp3');
      await loader.loadJSON('data.json');

      // Obtenir un clone audio pour vérifier qu'il est bien arrêté
      const audioClone = loader.getAudio('sound.mp3');

      loader.dispose();

      // Vérifier que l'audio clone a été mis en pause
      expect(audioClone.paused).toBe(true);

      // Après dispose, les caches doivent être vides
      expect(loader.getImage('img.png')).toBeUndefined();
      expect(loader.getAudio('sound.mp3')).toBeNull();
      expect(loader.getData('data.json')).toBeNull();
    });
  });
});
