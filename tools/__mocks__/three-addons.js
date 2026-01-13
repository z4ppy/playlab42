/**
 * Mock des addons Three.js pour les tests
 */

// OrbitControls (stub)
export class OrbitControls {
  constructor() {
    this.target = { set: () => {}, copy: () => {}, lerp: () => {} };
    this.enableDamping = false;
    this.dampingFactor = 0;
    this.minDistance = 0;
    this.maxDistance = 100;
    this.maxPolarAngle = Math.PI;
    this.enableZoom = true;
  }
  update() {}
  dispose() {}
}
