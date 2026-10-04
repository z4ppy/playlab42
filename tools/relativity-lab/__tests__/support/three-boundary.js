/**
 * Frontière Three.js locale aux tests Relativity : étend le mock partagé avec
 * un renderer à canvas DOM réel et Vector3.lerp. Le mock partagé est injecté
 * car son chemin est justement celui que Jest substitue au module `three`.
 */
export function createThreeBoundary(Shared) {
  class Vector3 extends Shared.Vector3 {
    lerp(target, alpha) {
      this.x += (target.x - this.x) * alpha;
      this.y += (target.y - this.y) * alpha;
      this.z += (target.z - this.z) * alpha;
      return this;
    }
  }

  class WebGLRenderer extends Shared.WebGLRenderer {
    constructor(options) {
      super(options);
      this.options = options;
      this.domElement = document.createElement('canvas');
      this.size = null;
      this.pixelRatio = null;
      this.rendered = [];
      this.disposed = false;
    }

    setSize(width, height) { this.size = [width, height]; }
    setPixelRatio(ratio) { this.pixelRatio = ratio; }
    render(scene, camera) { this.rendered.push([scene, camera]); }
    dispose() { this.disposed = true; }
  }

  class PerspectiveCamera extends Shared.PerspectiveCamera {
    constructor(fov, aspect, near, far) {
      super();
      this.fov = fov;
      this.aspect = aspect;
      this.near = near;
      this.far = far;
      this.position = new Vector3();
      this.projectionUpdates = 0;
    }

    updateProjectionMatrix() { this.projectionUpdates += 1; }
  }

  class Mesh extends Shared.Mesh {
    constructor(geometry, material) {
      super(geometry, material);
      this.quaternion = new Shared.Quaternion();
    }
  }

  return { ...Shared, Vector3, WebGLRenderer, PerspectiveCamera, Mesh };
}
