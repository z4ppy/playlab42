/**
 * Environnement navigateur minimal pour tester l'interface sous jsdom :
 * contexte 2D simulé (pixels réels pour fillRect, drawImage sans mise à
 * l'échelle, getImageData / putImageData), dialogues, images, observateurs.
 * Les dégradés, tracés et textes sont acceptés mais ne dessinent rien.
 */

/** Couleur CSS simple (#rrggbb ou rgba()) en RVBA, null si non reconnue. */
function parseColor(value) {
  const text = String(value);
  const hex = /^#([0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255, 255];
  }
  const rgba = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(text);
  return rgba ? [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Math.round(Number(rgba[4] ?? 1) * 255)] : null;
}

/** Tampon de pixels du canvas, réalloué si sa taille a changé. */
function pixels(canvas) {
  const store = canvas.__pixels;
  if (!store || store.width !== canvas.width || store.height !== canvas.height) {
    canvas.__pixels = { width: canvas.width, height: canvas.height, data: new Uint8ClampedArray(canvas.width * canvas.height * 4) };
  }
  return canvas.__pixels;
}

/** Écrit un pixel selon le mode de composition simulé. */
function plot(ctx, x, y, rgba) {
  const target = pixels(ctx.canvas);
  if (x < 0 || y < 0 || x >= target.width || y >= target.height || rgba[3] === 0) {
    return;
  }
  const i = (y * target.width + x) * 4;
  if (ctx.globalCompositeOperation === 'destination-out') {
    target.data[i + 3] = 0;
    return;
  }
  target.data.set(rgba, i);
}

function createContext(canvas) {
  const ctx = {
    canvas,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000000',
    states: [],
    calls: [],
    save() {
      this.states.push([this.globalAlpha, this.globalCompositeOperation, this.fillStyle]);
    },
    restore() {
      [this.globalAlpha, this.globalCompositeOperation, this.fillStyle] = this.states.pop() ?? [1, 'source-over', '#000000'];
    },
    fillRect(x, y, w, h) {
      const rgba = parseColor(this.fillStyle);
      if (!rgba) {
        return;
      }
      for (let py = Math.max(0, Math.floor(y)); py < Math.min(canvas.height, y + h); py++) {
        for (let px = Math.max(0, Math.floor(x)); px < Math.min(canvas.width, x + w); px++) {
          plot(this, px, py, rgba);
        }
      }
    },
    clearRect(x, y, w, h) {
      const target = pixels(canvas);
      for (let py = Math.max(0, Math.floor(y)); py < Math.min(target.height, y + h); py++) {
        for (let px = Math.max(0, Math.floor(x)); px < Math.min(target.width, x + w); px++) {
          target.data.fill(0, (py * target.width + px) * 4, (py * target.width + px) * 4 + 4);
        }
      }
    },
    drawImage(source, ...args) {
      this.calls.push('drawImage');
      // Formes prises en charge : (x, y) et (sx, sy, w, h, dx, dy, w, h) sans mise à l'échelle.
      const [sx, sy, sw, sh, dx, dy] = args.length === 8 ? args : [0, 0, source?.width, source?.height, args[0], args[1]];
      const scaled = args.length === 8 ? (args[6] !== sw || args[7] !== sh) : (args[2] !== undefined && args[2] !== source?.width);
      if (!source?.__pixels || scaled) {
        return;
      }
      const src = pixels(source);
      this.drawnArea = (this.drawnArea ?? 0) + sw * sh;
      for (let y = Math.max(0, sy); y < Math.min(src.height, sy + sh); y++) {
        for (let x = Math.max(0, sx); x < Math.min(src.width, sx + sw); x++) {
          const i = (y * src.width + x) * 4;
          plot(this, Math.round(dx) + x - sx, Math.round(dy) + y - sy, src.data.subarray(i, i + 4));
        }
      }
    },
    getImageData(x, y, w, h) {
      const src = pixels(canvas);
      const data = new Uint8ClampedArray(w * h * 4);
      for (let row = 0; row < h; row++) {
        const start = ((y + row) * src.width + x) * 4;
        data.set(src.data.subarray(start, start + w * 4), row * w * 4);
      }
      return { width: w, height: h, data };
    },
    putImageData(image, x, y) {
      const target = pixels(canvas);
      for (let row = 0; row < image.height; row++) {
        for (let col = 0; col < image.width; col++) {
          const tx = x + col;
          const ty = y + row;
          if (tx >= 0 && ty >= 0 && tx < target.width && ty < target.height) {
            const i = (row * image.width + col) * 4;
            target.data.set(image.data.subarray(i, i + 4), (ty * target.width + tx) * 4);
          }
        }
      }
    },
    measureText: (text) => ({ width: String(text).length * 10 }),
    createPattern: () => ({}),
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  // Toute autre méthode (tracés, transformations, texte) est acceptée sans effet.
  return new Proxy(ctx, {
    get(target, name) {
      if (name in target) {
        return target[name];
      }
      return () => {};
    },
    set(target, name, value) {
      target[name] = value;
      return true;
    },
  });
}

/**
 * Début de data URL PNG : signature et bloc IHDR (24 octets, 32 caractères base64).
 * @param {number} width
 * @param {number} height
 */
export function pngHeaderDataUrl(width, height) {
  const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];
  for (const value of [width, height]) {
    bytes.push((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
  }
  return `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`;
}

/** Installe les simulations dans l'environnement jsdom courant. */
export function installFakeBrowser() {
  HTMLCanvasElement.prototype.getContext = function getContext() {
    this.__ctx ??= createContext(this);
    pixels(this);
    return this.__ctx;
  };
  // En-tête PNG réel (signature + IHDR aux dimensions du canvas), suivi du marqueur « AAAA » que decode() accepte.
  HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
    return `${pngHeaderDataUrl(this.width, this.height)}AAAA`;
  };
  HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type) {
    callback(type === 'image/webp' ? null : new Blob(['x'], { type: type ?? 'image/png' }));
  };
  // jsdom ne fournit pas Blob.text() : lecture via FileReader.
  Blob.prototype.text ??= function text() {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(this);
    });
  };
  globalThis.ImageData = class {
    constructor(data, width, height) {
      Object.assign(this, { data, width, height });
    }
  };
  HTMLImageElement.prototype.decode = function decode() {
    if (!(this.src.endsWith('AAAA') || this.src.startsWith('blob:'))) {
      return Promise.reject(new Error('illisible'));
    }
    // Dimensions lues dans l'en-tête, comme le ferait le navigateur.
    const head = atob(this.src.slice(22, 54));
    const uint32 = (o) => [0, 1, 2, 3].reduce((v, i) => v * 256 + head.charCodeAt(o + i), 0);
    Object.defineProperty(this, 'width', { configurable: true, value: this.src.startsWith('blob:') ? 30 : uint32(16) });
    Object.defineProperty(this, 'height', { configurable: true, value: this.src.startsWith('blob:') ? 20 : uint32(20) });
    return Promise.resolve();
  };
  globalThis.createImageBitmap = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 30;
    canvas.height = 20;
    // Image opaque (vert) : un import produit de vrais pixels dans le calque.
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, 0, 30, 20);
    return Promise.resolve(canvas);
  };
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
    // Réponse programmée par le test (valeur du bouton), puis fermeture.
    queueMicrotask(() => {
      this.returnValue = globalThis.__dialogAnswer ?? 'cancel';
      this.open = false;
      this.dispatchEvent(new Event('close'));
    });
  };
  globalThis.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
      globalThis.__resize = callback;
    }
    observe() {
      this.callback([{ contentRect: { width: 400, height: 300 } }]);
    }
  };
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  URL.createObjectURL = () => 'blob:fake';
  URL.revokeObjectURL = () => {};
}

/** Pixel RVBA d'un canvas simulé. */
export function canvasPixel(canvas, x, y) {
  const store = pixels(canvas);
  const i = (y * store.width + x) * 4;
  return [...store.data.subarray(i, i + 4)];
}

/**
 * Événement de pointeur (jsdom n'a pas PointerEvent).
 * @param {string} type
 * @param {object} init
 */
export function pointer(type, init) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: init.x, clientY: init.y, button: init.button ?? 0, shiftKey: Boolean(init.shift) });
  Object.defineProperties(event, {
    pointerId: { value: init.id ?? 1 },
    pointerType: { value: init.type ?? 'mouse' },
    pressure: { value: init.pressure ?? 0.5 },
  });
  return event;
}
