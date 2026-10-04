/**
 * AssetLoader - Chargeur d'assets pour les jeux
 * Gère le chargement et le cache des images, sons et données JSON
 *
 * @see openspec/specs/gamekit/spec.md
 */

/**
 * Vérifie qu'un nœud cloné est un vrai HTMLAudioElement, y compris d'un autre
 * contexte (iframe) grâce au constructeur de sa fenêtre.
 * @param {Node} node - Résultat de cloneNode().
 * @returns {node is HTMLAudioElement}
 */
function isAudioElement(node) {
  const AudioElement = node.ownerDocument?.defaultView?.HTMLAudioElement ?? globalThis.HTMLAudioElement;
  return typeof AudioElement === 'function' && node instanceof AudioElement;
}

export class AssetLoader {
  #basePath;
  /** @type {Map<string, HTMLImageElement>} */
  #images = new Map();
  /** @type {Map<string, HTMLAudioElement>} */
  #audio = new Map();
  #data = new Map();
  /** @type {HTMLAudioElement[]} */
  #audioInstances = [];
  #pending = new Set();
  #generation = 0;

  /**
   * Crée un nouveau chargeur d'assets pour un jeu.
   * @param {string} gameName - Identifiant du jeu
   * @param {string|URL} [siteURL] - Racine du site (par défaut relative au SDK)
   */
  constructor(gameName, siteURL = new URL('../', import.meta.url)) {
    this.#basePath = new URL(`games/${gameName}/`, siteURL);
  }

  /**
   * Résout un chemin relatif en chemin absolu.
   * @param {string} src - Chemin relatif
   * @returns {string}
   */
  #resolvePath(src) {
    // Si le chemin est déjà absolu, le retourner tel quel
    if (src.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(src)) {
      return src;
    }
    return new URL(src, this.#basePath).href;
  }

  /**
   * Charge une image.
   * @param {string} src - Chemin vers l'image (relatif au dossier du jeu)
   * @returns {Promise<HTMLImageElement>}
   */
  loadImage(src) {
    const fullPath = this.#resolvePath(src);

    // Vérifier le cache
    const cached = this.#images.get(fullPath);
    if (cached) {
      return Promise.resolve(cached);
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
        this.#pending.delete(cancel);
      };
      const cancel = () => {
        cleanup();
        img.src = '';
        reject(new Error(`Asset loading disposed: ${fullPath}`));
      };
      this.#pending.add(cancel);
      img.onload = () => {
        cleanup();
        this.#images.set(fullPath, img);
        resolve(img);
      };
      img.onerror = () => {
        cleanup();
        reject(new Error(`Failed to load image: ${fullPath}`));
      };
      img.src = fullPath;
    });
  }

  /**
   * Charge un fichier audio.
   * @param {string} src - Chemin vers le fichier audio (relatif au dossier du jeu)
   * @returns {Promise<HTMLAudioElement>}
   */
  loadAudio(src) {
    const fullPath = this.#resolvePath(src);

    // Vérifier le cache
    const cached = this.#audio.get(fullPath);
    if (cached) {
      try {
        return Promise.resolve(this.#cloneAudio(cached));
      } catch (error) {
        this.#audio.delete(fullPath);
        return Promise.reject(error);
      }
    }

    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const cleanup = () => {
        audio.oncanplaythrough = null;
        audio.onerror = null;
        this.#pending.delete(cancel);
      };
      const cancel = () => {
        cleanup();
        audio.pause();
        audio.src = '';
        reject(new Error(`Asset loading disposed: ${fullPath}`));
      };
      this.#pending.add(cancel);
      audio.oncanplaythrough = () => {
        cleanup();
        try {
          const clone = this.#cloneAudio(audio);
          this.#audio.set(fullPath, audio);
          resolve(clone);
        } catch (error) {
          reject(error);
        }
      };
      audio.onerror = () => {
        cleanup();
        reject(new Error(`Failed to load audio: ${fullPath}`));
      };
      audio.src = fullPath;
      audio.load();
    });
  }

  /**
   * Charge et parse un fichier JSON.
   * @template T
   * @param {string} src - Chemin vers le fichier JSON (relatif au dossier du jeu)
   * @returns {Promise<T>}
   */
  async loadJSON(src) {
    const fullPath = this.#resolvePath(src);

    // Vérifier le cache
    if (this.#data.has(fullPath)) {
      return structuredClone(this.#data.get(fullPath));
    }

    const generation = this.#generation;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    this.#pending.add(cancel);
    try {
      const response = await fetch(fullPath, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to load JSON: ${fullPath}`);
      }

      const data = await response.json();
      if (generation !== this.#generation) {
        throw new Error(`Asset loading disposed: ${fullPath}`);
      }
      this.#data.set(fullPath, data);
      return structuredClone(data);
    } finally {
      this.#pending.delete(cancel);
    }
  }

  /**
   * Précharge plusieurs assets avec suivi de progression.
   * @param {Array<{type: 'image'|'audio'|'json', src: string}>} manifest
   * @param {(progress: number) => void} [onProgress] - Callback de progression (0-1)
   * @returns {Promise<{loaded: string[], failed: Array<{src: string, error: string}>}>}
   */
  async preload(manifest, onProgress) {
    const generation = this.#generation;
    /** @type {{loaded: string[], failed: Array<{src: string, error: string}>}} */
    const results = {
      loaded: [],
      failed: [],
    };

    let completed = 0;
    const total = manifest.length;

    const updateProgress = () => {
      completed++;
      if (onProgress && generation === this.#generation) {
        onProgress(completed / total);
      }
    };

    const loadPromises = manifest.map(async ({ type, src }) => {
      try {
        switch (type) {
          case 'image':
            await this.loadImage(src);
            break;
          case 'audio':
            await this.loadAudio(src);
            break;
          case 'json':
            await this.loadJSON(src);
            break;
          default:
            throw new Error(`Unknown asset type: ${type}`);
        }
        results.loaded.push(src);
      } catch (error) {
        results.failed.push({
          src,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        updateProgress();
      }
    });

    await Promise.all(loadPromises);
    return results;
  }

  /**
   * Récupère une image déjà chargée.
   * @param {string} src - Chemin de l'image
   * @returns {HTMLImageElement|undefined}
   */
  getImage(src) {
    const fullPath = this.#resolvePath(src);
    return this.#images.get(fullPath);
  }

  /**
   * Récupère un clone d'un audio déjà chargé.
   * Permet la lecture simultanée de plusieurs instances.
   * @param {string} src - Chemin de l'audio
   * @returns {HTMLAudioElement|null}
   */
  getAudio(src) {
    const fullPath = this.#resolvePath(src);
    const original = this.#audio.get(fullPath);
    return original ? this.#cloneAudio(original) : null;
  }

  /**
   * Clone un audio chargé et le suit pour dispose().
   * @param {HTMLAudioElement} original - Audio du cache
   * @returns {HTMLAudioElement}
   */
  #cloneAudio(original) {
    const clone = original.cloneNode();
    if (!isAudioElement(clone)) {
      throw new TypeError('Audio clone is not an audio element');
    }
    this.#audioInstances.push(clone);
    return clone;
  }

  /**
   * Récupère un clone des données JSON déjà chargées.
   * @template T
   * @param {string} src - Chemin du fichier JSON
   * @returns {T|null}
   */
  getData(src) {
    const fullPath = this.#resolvePath(src);
    const data = this.#data.get(fullPath);
    return data ? structuredClone(data) : null;
  }

  /**
   * Libère toutes les ressources et arrête tous les sons.
   */
  dispose() {
    this.#generation++;
    for (const cancel of this.#pending) {
      cancel();
    }
    this.#pending.clear();

    // Arrêter tous les audios en cours
    for (const audio of this.#audioInstances) {
      audio.pause();
      audio.src = '';
    }
    for (const audio of this.#audio.values()) {
      audio.pause();
      audio.src = '';
    }

    // Vider les caches
    for (const image of this.#images.values()) {
      image.src = '';
    }
    this.#images.clear();
    this.#audio.clear();
    this.#data.clear();
    this.#audioInstances = [];
  }
}

// Export par défaut pour compatibilité
export default AssetLoader;
