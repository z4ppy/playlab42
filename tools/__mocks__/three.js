/**
 * Mock minimal de Three.js pour les tests
 *
 * Implémente uniquement les classes/méthodes utilisées dans les tests.
 * Ajouter des méthodes au besoin.
 */

/**
 * Mock de THREE.Vector3
 */
export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  divideScalar(s) {
    return this.multiplyScalar(1 / s);
  }

  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v) {
    const ax = this.x, ay = this.y, az = this.z;
    const bx = v.x, by = v.y, bz = v.z;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  normalize() {
    const len = this.length();
    if (len > 0) {
      this.divideScalar(len);
    }
    return this;
  }

  negate() {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }

  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }

  distanceToSquared(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }

  equals(v) {
    return v.x === this.x && v.y === this.y && v.z === this.z;
  }

  toArray() {
    return [this.x, this.y, this.z];
  }
}

/**
 * Mock de THREE.Color
 */
export class Color {
  constructor(r = 0, g = 0, b = 0) {
    if (typeof r === 'string') {
      this.setStyle(r);
    } else if (typeof r === 'number' && g === undefined) {
      this.setHex(r);
    } else {
      this.r = r;
      this.g = g;
      this.b = b;
    }
  }

  setHex(hex) {
    this.r = ((hex >> 16) & 255) / 255;
    this.g = ((hex >> 8) & 255) / 255;
    this.b = (hex & 255) / 255;
    return this;
  }

  setStyle(style) {
    // Simplifié : supporte #rrggbb
    if (style.startsWith('#')) {
      this.setHex(parseInt(style.slice(1), 16));
    }
    return this;
  }

  getHex() {
    return (
      (Math.round(this.r * 255) << 16) |
      (Math.round(this.g * 255) << 8) |
      Math.round(this.b * 255)
    );
  }
}

// Constantes
export const SRGBColorSpace = 'srgb';
export const LinearSRGBColorSpace = 'srgb-linear';

// Classes géométriques (stubs)
export class SphereGeometry {
  constructor() {
    this.dispose = () => {};
  }
}

export class BoxGeometry {
  constructor() {
    this.dispose = () => {};
  }
}

export class ConeGeometry {
  constructor() {
    this.dispose = () => {};
  }
}

export class BufferGeometry {
  constructor() {
    this.attributes = { position: { array: [], needsUpdate: false } };
  }
  setFromPoints() { return this; }
  dispose() {}
}

// Matériaux (stubs)
export class MeshBasicMaterial {
  constructor() {
    this.dispose = () => {};
  }
}

export class MeshStandardMaterial {
  constructor() {
    this.dispose = () => {};
  }
}

export class LineBasicMaterial {
  constructor() {
    this.dispose = () => {};
  }
}

export class SpriteMaterial {
  constructor() {
    this.dispose = () => {};
  }
}

// Objets 3D (stubs)
export class Object3D {
  constructor() {
    this.position = new Vector3();
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = new Vector3(1, 1, 1);
    this.children = [];
    this.visible = true;
    this.name = '';
  }
  add(obj) { this.children.push(obj); }
  remove(obj) {
    const idx = this.children.indexOf(obj);
    if (idx !== -1) {this.children.splice(idx, 1);}
  }
  traverse(fn) {
    fn(this);
    this.children.forEach(c => c.traverse?.(fn));
  }
  getObjectByName(name) {
    if (this.name === name) {return this;}
    for (const child of this.children) {
      const found = child.getObjectByName?.(name);
      if (found) {return found;}
    }
    return null;
  }
}

export class Mesh extends Object3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
  }
}

export class Line extends Object3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
  }
}

export class Sprite extends Object3D {
  constructor(material) {
    super();
    this.material = material;
  }
}

export class Group extends Object3D {}

export class Scene extends Object3D {
  constructor() {
    super();
    this.background = null;
    this.fog = null;
  }
}

// Lumières (stubs)
export class AmbientLight extends Object3D {}
export class DirectionalLight extends Object3D {}

// Camera (stub)
export class PerspectiveCamera extends Object3D {
  constructor() {
    super();
    this.aspect = 1;
    this.fov = 75;
  }
  lookAt() {}
  updateProjectionMatrix() {}
}

// Renderer (stub)
export class WebGLRenderer {
  constructor() {
    this.domElement = { addEventListener: () => {}, style: {} };
  }
  setSize() {}
  setPixelRatio() {}
  render() {}
  dispose() {}
}

// Textures (stubs)
export class CanvasTexture {}
export class Texture {}

// Helpers (stubs)
export class GridHelper extends Object3D {}
export class AxesHelper extends Object3D {}

// Fog
export class Fog {
  constructor(color, near, far) {
    this.color = new Color(color);
    this.near = near;
    this.far = far;
  }
}

// Quaternion (stub minimal)
export class Quaternion {
  setFromUnitVectors() { return this; }
}
