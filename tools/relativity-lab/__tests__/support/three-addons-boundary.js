/** OrbitControls observable : cible vectorielle réelle, mises à jour comptées. */
export function createOrbitControlsBoundary(THREE) {
  class OrbitControls {
    static instances = [];

    constructor(camera, domElement) {
      this.camera = camera;
      this.domElement = domElement;
      this.target = new THREE.Vector3();
      this.updates = 0;
      this.disposed = false;
      OrbitControls.instances.push(this);
    }

    update() { this.updates += 1; }
    dispose() { this.disposed = true; }
  }
  return { OrbitControls };
}
