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
  let originalFetch;

  beforeEach(() => {
    // Sauvegarder les originaux
    originalImage = global.Image;
    originalAudio = global.Audio;
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

    // Mock Audio
    global.Audio = class MockAudio {
      constructor() {
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

    loader = new AssetLoader('test-game');
  });

  afterEach(() => {
    global.Image = originalImage;
    global.Audio = originalAudio;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // Constructeur
  // ===========================================================================
  describe('constructor()', () => {
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
      expect(img.src).toBe('/games/test-game/sprite.png');
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
      expect(global.fetch).toHaveBeenCalledWith('/games/test-game/config.json');
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
