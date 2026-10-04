import { jest } from '@jest/globals';
import { createThreeBoundary } from './three-boundary.js';
import { createOrbitControlsBoundary } from './three-addons-boundary.js';

/** Installe les frontières Three locales ; à appeler avant d'importer le code testé. */
export async function mockThreeBoundary() {
  const Shared = await import('three');
  const THREE = createThreeBoundary(Shared);
  const addons = createOrbitControlsBoundary(THREE);
  jest.unstable_mockModule('three', () => THREE);
  jest.unstable_mockModule('three/addons/controls/OrbitControls.js', () => addons);
  return { THREE, OrbitControls: addons.OrbitControls };
}
