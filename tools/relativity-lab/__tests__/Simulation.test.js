import { jest } from '@jest/globals';
import * as threeBoundary from '../../__mocks__/three.js';

// Compléter uniquement les objets de rendu absents du double Three partagé.
class RenderVector3 extends threeBoundary.Vector3 {
  setScalar(value) {
    return this.set(value, value, value);
  }
}

function renderObject(Base) {
  return class extends Base {
    scale = new RenderVector3(1, 1, 1);
    quaternion = new threeBoundary.Quaternion();
  };
}

jest.unstable_mockModule('three', () => ({
  ...threeBoundary,
  Object3D: renderObject(threeBoundary.Object3D),
  Group: renderObject(threeBoundary.Group),
  Mesh: renderObject(threeBoundary.Mesh),
  Line: renderObject(threeBoundary.Line),
  Sprite: renderObject(threeBoundary.Sprite),
}));

const { Simulation, SimulationState } = await import('../src/Simulation.js');
const { Vector3, Scene } = await import('three');

describe('Simulation réelle : temps, signaux et ressources', () => {
  let simulation;
  let scene;
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

  beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
  });

  afterEach(() => {
    simulation?.dispose();
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
    if (documentDescriptor) {
      Object.defineProperty(globalThis, 'document', documentDescriptor);
    } else {
      delete globalThis.document;
    }
  });

  function createSimulation() {
    scene = new Scene();
    simulation = new Simulation(scene);
    return simulation;
  }

  function addObserver(id, x = 0, speed = 0, options = {}) {
    return simulation.addObserver(id, new Vector3(x, 0, 0), new Vector3(speed, 0, 0), {
      id, color: 0x4fc3f7, ...options,
    });
  }

  function startClock() {
    let previous = Date.now();
    setInterval(() => {
      const now = Date.now();
      simulation.update((now - previous) / 1000);
      previous = now;
    }, 250);
  }

  function watchResources(mesh) {
    const resources = [];
    mesh.traverse(object => {
      for (const resource of [object.geometry, object.material]) {
        if (resource && !resources.includes(resource)) {
          resources.push(resource);
          jest.spyOn(resource, 'dispose');
        }
      }
    });
    return {
      expectDisposed() {
        expect(resources.length).toBeGreaterThan(0);
        for (const resource of resources) {
          expect(resource.dispose).toHaveBeenCalledTimes(1);
        }
        expect(scene.children).not.toContain(mesh);
      },
      expectAlive() {
        for (const resource of resources) {
          expect(resource.dispose).not.toHaveBeenCalled();
        }
        expect(scene.children).toContain(mesh);
      },
    };
  }

  beforeEach(() => {
    // Pas de DOM ni backend canvas : seuls les appels de dessin sont doublés.
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: () => ({
          getContext: () => ({ roundRect() {}, fill() {}, fillText() {} }),
        }),
      },
    });
    createSimulation();
  });

  test('pause, reprise et timeScale suivent une horloge JS déterministe sans rattraper la pause', () => {
    const observer = addObserver('mobile', 2, 0.6);
    simulation.autoEmitPhotons = false;
    const snapshots = [];
    simulation.onUpdate(current => snapshots.push(current.getDisplayData()));
    startClock();

    jest.advanceTimersByTime(1000);
    expect(simulation.labTime).toBe(0);
    expect(observer.properTime).toBe(0);
    expect(snapshots).toHaveLength(0);

    simulation.play();
    jest.advanceTimersByTime(1000);
    expect(simulation.labTime).toBe(1);
    expect(observer.properTime).toBeCloseTo(0.8);
    expect(observer.position.x).toBeCloseTo(2.6);
    expect(observer.mesh.position.x).toBeCloseTo(2.6);
    expect(snapshots).toHaveLength(4);

    simulation.pause();
    jest.advanceTimersByTime(5000);
    expect(simulation.labTime).toBe(1);
    expect(observer.position.x).toBeCloseTo(2.6);
    expect(snapshots).toHaveLength(4);

    simulation.timeScale = 2;
    simulation.toggle();
    jest.advanceTimersByTime(1000);
    expect(simulation.labTime).toBe(3);
    expect(observer.properTime).toBeCloseTo(2.4);
    expect(observer.position.x).toBeCloseTo(3.8);
    expect(snapshots).toHaveLength(8);
    expect(snapshots.at(-1)).toMatchObject({
      labTime: 3, state: SimulationState.RUNNING, timeScale: 2, signalCount: 0,
    });
    simulation.toggle();
    expect(simulation.state).toBe(SimulationState.PAUSED);
  });

  test('émet H/V au tick réel avec les temps, position et vitesse détachés de la source', () => {
    const source = addObserver('source', 2, 0.6, { armLength: 0.5 });
    addObserver('loin', 100);
    simulation.play();
    startClock();
    jest.advanceTimersByTime(1000);
    expect(source.clockH.tickCount).toBe(0);
    expect(simulation.signals).toHaveLength(0);
    jest.advanceTimersByTime(250);

    expect(source.clockH.tickCount).toBe(1);
    expect(source.clockV.tickCount).toBe(1);
    expect(simulation.signals).toHaveLength(2);
    expect(simulation.signals.map(signal => signal.clockType)).toEqual(['H', 'V']);
    for (const signal of simulation.signals) {
      expect(signal).toMatchObject({
        sourceId: 'source', tickNumber: 1, emissionLabTime: 1.25,
        emissionProperTime: 1, targetCount: 1, radius: 0, lightweight: true,
      });
      expect(signal.origin.x).toBeCloseTo(2.75);
      expect(signal.emissionVelocity.x).toBe(0.6);
      expect(scene.children).toContain(signal.mesh);
    }
    source.setPosition(new Vector3(40, 0, 0));
    source.setVelocity(new Vector3());
    expect(simulation.signals[0].origin.x).toBeCloseTo(2.75);
    expect(simulation.signals[0].emissionVelocity.x).toBe(0.6);
    simulation.autoEmitPhotons = false;
    jest.advanceTimersByTime(1000);
    expect(source.clockH.tickCount).toBe(2);
    expect(simulation.signals).toHaveLength(2);
    expect(simulation.signals[0].radius).toBe(1);
  });

  test('réception unique par cible, payload temporel et retrait final via le pool réel', () => {
    simulation.autoEmitPhotons = false;
    simulation.showSignals = true;
    const source = addObserver('source');
    const near = addObserver('proche', 1);
    const far = addObserver('loin', 2);
    const receptions = [];
    simulation.onPhotonReception(event => receptions.push(event));
    simulation.emitPhoton(source, 'H', 7);
    const signal = simulation.signals[0];
    const resources = watchResources(signal.mesh);
    const release = jest.spyOn(simulation.signalPool, 'release');
    simulation.play();
    startClock();

    jest.advanceTimersByTime(750);
    expect(receptions).toHaveLength(0);
    jest.advanceTimersByTime(250);
    expect(receptions).toHaveLength(1);
    expect(receptions[0]).toMatchObject({
      type: 'signal', dopplerFactor: 1, lightTravelTime: 1,
      photon: { sourceId: 'source', clockType: 'H', tickNumber: 7, emissionProperTime: 0 },
      receiver: { id: 'proche', properTime: 1 },
    });
    expect(receptions[0].photon.emissionPosition.toArray()).toEqual([0, 0, 0]);
    expect(receptions[0].receiver.position.toArray()).toEqual([1, 0, 0]);
    expect(near.receivedTicks.get('source')).toEqual({ H: 7, V: 0, lastReceivedAt: 1 });
    expect(near.receptionHistory).toHaveLength(1);
    expect(source.receptionHistory).toHaveLength(0);
    expect(signal.receivedBy).toEqual(new Set(['proche']));
    resources.expectAlive();

    jest.advanceTimersByTime(1000);
    expect(receptions.map(event => event.receiver.id)).toEqual(['proche', 'loin']);
    expect(receptions[1].lightTravelTime).toBe(2);
    expect(far.receptionHistory).toHaveLength(1);
    expect(simulation.signals).toHaveLength(0);
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(signal);
    resources.expectDisposed();
    near.setPosition(new Vector3(10, 0, 0));
    expect(receptions[0].receiver.position.x).toBe(1);
    jest.advanceTimersByTime(2000);
    expect(receptions).toHaveLength(2);
    expect(near.receptionHistory).toHaveLength(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  test('rayon maximal : expire sans réception et libère une seule fois le signal rendu', () => {
    simulation.autoEmitPhotons = false;
    simulation.showSignals = true;
    simulation.maxSignalRadius = 0.5;
    const source = addObserver('source');
    addObserver('loin', 3);
    const receptions = [];
    simulation.onPhotonReception(event => receptions.push(event));
    simulation.emitPhoton(source, 'V', 1);
    const signal = simulation.signals[0];
    const resources = watchResources(signal.mesh);
    simulation.play();
    simulation.update(0.5);
    expect(signal.active).toBe(true);
    expect(signal.mesh.scale.x).toBe(0.5);
    simulation.update(0.25);
    expect(simulation.signals).toHaveLength(0);
    expect(receptions).toHaveLength(0);
    resources.expectDisposed();
    simulation.update(1);
    resources.expectDisposed();
  });

  test('reset conserve les observateurs et callbacks, remet les horloges et permet une nouvelle réception', () => {
    simulation.autoEmitPhotons = false;
    simulation.showSignals = true;
    const source = addObserver('source');
    const receiver = addObserver('cible', 1, 0, { armLength: 0.5 });
    const observerResources = watchResources(receiver.mesh);
    const updates = [];
    const receptions = [];
    const stopUpdates = simulation.onUpdate(current => updates.push(current.labTime));
    const stopReceptions = simulation.onPhotonReception(event => receptions.push(event));
    simulation.emitPhoton(source, 'H', 1);
    simulation.play();
    simulation.update(1);
    expect(receiver.clockH.tickCount).toBe(1);
    expect(receiver.clockV.tickCount).toBe(1);
    simulation.emitPhoton(source, 'V', 2);
    const pendingResources = watchResources(simulation.signals[0].mesh);

    simulation.reset();
    expect(simulation.labTime).toBe(0);
    expect(simulation.state).toBe(SimulationState.PAUSED);
    expect(simulation.signals).toHaveLength(0);
    expect(scene.children).toEqual([source.mesh, receiver.mesh]);
    expect(receiver.properTime).toBe(0);
    expect(receiver.clockH.tickCount).toBe(0);
    expect(receiver.clockV.phase).toBe(0);
    expect(receiver.receivedTicks.size).toBe(0);
    expect(receiver.receptionHistory).toHaveLength(0);
    pendingResources.expectDisposed();
    observerResources.expectAlive();
    simulation.update(10);
    expect(updates).toEqual([1]);
    simulation.emitPhoton(source, 'H', 1);
    simulation.play();
    simulation.update(1);
    expect(updates).toEqual([1, 1]);
    expect(receptions).toHaveLength(2);
    expect(receiver.receptionHistory).toHaveLength(1);
    stopUpdates();
    stopUpdates();
    stopReceptions();
    stopReceptions();
    simulation.emitPhoton(source, 'V', 3);
    simulation.update(1);
    expect(updates).toHaveLength(2);
    expect(receptions).toHaveLength(2);
    expect(receiver.receptionHistory).toHaveLength(2);
  });

  test.each(['update', 'reception'])('un callback %s peut se désabonner sans sauter le callback suivant', (type) => {
    simulation.autoEmitPhotons = false;
    const source = addObserver('source');
    addObserver('cible', 0);
    const events = [];
    const subscribe = callback => type === 'update'
      ? simulation.onUpdate(callback)
      : simulation.onPhotonReception(callback);
    const unsubscribe = subscribe(() => {
      events.push('premier');
      unsubscribe();
    });
    subscribe(() => events.push('second'));
    simulation.play();
    simulation.emitPhoton(source, 'H', 1);
    simulation.update(0.25);
    expect(events).toEqual(['premier', 'second']);
    simulation.emitPhoton(source, 'V', 1);
    simulation.update(0.25);
    expect(events).toEqual(['premier', 'second', 'second']);
  });

  test('suppression et référentiels préservent Lab et nettoient scène, ressources et sources', () => {
    const lab = addObserver('lab');
    const mobile = addObserver('mobile', 2);
    const resources = watchResources(mobile.mesh);
    expect(simulation.getAvailableFrames()).toEqual([
      { id: 'lab', name: 'lab' }, { id: 'mobile', name: 'mobile' },
    ]);
    simulation.setReferenceFrame(null);
    expect(simulation.getDisplayData().referenceId).toBeNull();
    simulation.setReferenceFrame('mobile');
    simulation.setReferenceFrame('inconnu');
    expect(simulation.referenceObserver).toBe(mobile);
    simulation.removeObserver('lab');
    simulation.removeObserver('inconnu');
    expect(simulation.observers).toHaveLength(2);
    simulation.removeObserver('mobile');
    resources.expectDisposed();
    expect(simulation.getObserver('mobile')).toBeUndefined();
    expect(simulation.visibleSources.has('mobile')).toBe(false);
    expect(simulation.referenceObserver).toBe(lab);
    simulation.removeObserver('mobile');
    resources.expectDisposed();
  });

  test('visibilité des signaux dépend des options et des sources sans supprimer la propagation', () => {
    const source = addObserver('source');
    addObserver('cible', 4);
    simulation.showSignals = true;
    simulation.emitPhoton(source, 'H', 1);
    const signal = simulation.signals[0];
    expect(signal.mesh.visible).toBe(true);
    simulation.showAllSources = false;
    simulation.setSourceVisibility(source.id, false);
    expect(signal.mesh.visible).toBe(false);
    expect(simulation.signals).toEqual([signal]);
    simulation.setSourceVisibility(source.id, true);
    expect(signal.mesh.visible).toBe(true);
    simulation.showSignals = false;
    simulation.setSourceVisibility(source.id, true);
    expect(signal.mesh.visible).toBe(false);
  });

  test('dispose nettoie l’état et les callbacks ; une réinitialisation ne réutilise aucune ressource détruite', () => {
    simulation.showSignals = true;
    simulation.autoEmitPhotons = false;
    const source = addObserver('source');
    const observerResources = watchResources(source.mesh);
    simulation.emitPhoton(source, 'H', 1);
    const signalResources = watchResources(simulation.signals[0].mesh);
    const events = [];
    simulation.onUpdate(() => events.push('update'));
    simulation.onPhotonReception(() => events.push('reception'));
    simulation.play();
    simulation.dispose();
    observerResources.expectDisposed();
    signalResources.expectDisposed();
    expect(scene.children).toHaveLength(0);
    expect(simulation.observers).toHaveLength(0);
    expect(simulation.signals).toHaveLength(0);
    expect({
      referenceId: simulation.referenceObserver?.id ?? null,
      visibleSources: [...simulation.visibleSources],
      state: simulation.state,
    }).toEqual({ referenceId: null, visibleSources: [], state: SimulationState.PAUSED });
    simulation.dispose();
    observerResources.expectDisposed();
    signalResources.expectDisposed();
    const fresh = addObserver('nouveau');
    expect(fresh.mesh).not.toBe(source.mesh);
    expect(simulation.referenceObserver).toBe(fresh);
    simulation.reset();
    simulation.play();
    addObserver('cible', 0);
    simulation.emitPhoton(fresh, 'V', 1);
    simulation.update(0.25);
    expect(events).toHaveLength(0);
    expect(simulation.signals).toHaveLength(0);
  });

  test('reset restaure position et vitesse initiales sans recréer les observateurs', () => {
    simulation.autoEmitPhotons = false;
    const mobile = addObserver('mobile', 2, 0.6, { armLength: 0.5 });
    simulation.play();
    simulation.update(1.25);
    expect(mobile.clockH.tickCount).toBe(1);
    expect(mobile.position.x).toBeCloseTo(2.75);
    mobile.setVelocity(new Vector3(0.2, 0, 0));
    simulation.reset();
    expect(simulation.getObserver('mobile')).toBe(mobile);
    expect(mobile.position.toArray()).toEqual([2, 0, 0]);
    expect(mobile.mesh.position.toArray()).toEqual([2, 0, 0]);
    expect(mobile.velocity.toArray()).toEqual([0.6, 0, 0]);
    expect(mobile.properTime).toBe(0);
    expect(mobile.clockH.tickCount).toBe(0);
    expect(mobile.clockH.phase).toBe(0);
    simulation.play();
    simulation.update(1.25);
    expect(mobile.position.x).toBeCloseTo(2.75);
    expect(mobile.clockH.tickCount).toBe(1);
  });

  test('les IDs automatiques restent distincts et retirer le dernier référentiel retourne au lab', () => {
    const first = simulation.addObserver('Alice', new Vector3());
    const second = simulation.addObserver('Bob', new Vector3());
    expect(first.id).not.toBe(second.id);
    expect(simulation.referenceObserver).toBe(first);
    simulation.removeObserver(first.id);
    expect(simulation.referenceObserver).toBe(second);
    simulation.removeObserver(second.id);
    expect(simulation.referenceObserver).toBeNull();
    expect(simulation.getDisplayData().observers).toHaveLength(0);
    expect(scene.children).toHaveLength(0);
  });

  test('la réception garde la vitesse d’émission même après suppression de la source', () => {
    simulation.autoEmitPhotons = false;
    const source = addObserver('source', 0, 0.6);
    const receiver = addObserver('cible', 1);
    const receptions = [];
    simulation.onPhotonReception(event => receptions.push(event));
    simulation.emitPhoton(source, 'H', 1);
    simulation.removeObserver('source');
    simulation.setReferenceFrame(null);
    simulation.play();
    simulation.update(1);
    expect(receptions).toHaveLength(1);
    expect(receptions[0].dopplerFactor).toBeCloseTo(0.5);
    expect(receptions[0].photon.emissionVelocity.x).toBe(0.6);
    expect(receiver.receivedTicks.get('source').H).toBe(1);
    expect(simulation.signals).toHaveLength(0);
  });

  test.each(['update', 'reception'])('les erreurs de callbacks %s restent visibles à l’appelant', (type) => {
    simulation.autoEmitPhotons = false;
    const source = addObserver('source');
    addObserver('cible', 0);
    const error = new Error('échec du consommateur');
    const callback = () => { throw error; };
    if (type === 'update') {
      simulation.onUpdate(callback);
    } else {
      simulation.onPhotonReception(callback);
      simulation.emitPhoton(source, 'H', 1);
    }
    simulation.play();
    expect(() => simulation.update(0.25)).toThrow(error);
    expect(simulation.labTime).toBe(0.25);
  });
});
