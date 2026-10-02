/** @jest-environment jsdom */
import { jest } from '@jest/globals';

// Géométries, vecteurs et matériaux réels, même lorsque Jest mappe Three ailleurs.
jest.unstable_mockModule('three', () => import('../../../node_modules/three/build/three.module.js'));
const THREE = await import('three');
const Physics = await import('../src/Physics.js');
const { Simulation, FIXED_STEP } = await import('../src/Simulation.js');
const { Observer } = await import('../src/Observer.js');

const simulations = [];
const vector = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function simulation() {
  const sim = new Simulation(new THREE.Scene());
  simulations.push(sim);
  return sim;
}
function advance(sim, seconds, fps = 60) {
  sim.play();
  for (let i = 0; i < seconds * fps; i++) {sim.update(1 / fps);}
}

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    roundRect() {}, fill() {}, fillText() {},
  });
});
afterEach(() => {
  simulations.splice(0).forEach(sim => sim.dispose());
  jest.restoreAllMocks();
});

describe('Physique intégrée avec Three réel', () => {
  test('Doppler longitudinal, transverse et mouvement commun', () => {
    const n = vector(1);
    expect(Physics.dopplerFactor(vector(0.6), vector(), n)).toBeCloseTo(2, 12);
    expect(Physics.dopplerFactor(vector(-0.6), vector(), n)).toBeCloseTo(0.5, 12);
    expect(Physics.dopplerFactor(vector(0, 0.6), vector(), n)).toBeCloseTo(0.8, 12);
    expect(Physics.dopplerFactor(vector(), vector(0, 0.6), n)).toBeCloseTo(1.25, 12);
    expect(Physics.dopplerFactor(vector(0.5, 0.4), vector(0.5, 0.4), n)).toBeCloseTo(1, 12);
    expect(Physics.dopplerFactor(vector(0.8), vector(-0.8), n)).toBeCloseTo(9, 12);
  });

  test('une impulsion transverse est boostée du repos du véhicule vers le lab', () => {
    const observer = simulation().addObserver('A', vector(), vector(0.6));
    // m0/m1=√3 donne Δv'=0.5 selon Y ; vx=0.6 et vy=0.5/1.25.
    const finalMass = 1000 / Math.sqrt(3);
    expect(observer.applyThrust(vector(0, 1), 1000 - finalMass).success).toBe(true);
    expect(observer.velocity.x).toBeCloseTo(0.6, 12);
    expect(observer.velocity.y).toBeCloseTo(0.4, 12);
    // Le quadrivecteur rayonné est de genre lumière et conserve E,p.
    const emittedEnergy = 1250 - observer.mass * observer.gamma;
    const emittedMomentum = vector(750).sub(observer.velocity.clone().multiplyScalar(observer.mass * observer.gamma));
    expect(emittedEnergy).toBeGreaterThan(0);
    expect(emittedEnergy ** 2 - emittedMomentum.lengthSq()).toBeCloseTo(0, 7);
  });

  test('vitesse éditée, impulsions colinéaires et masse requise signée', () => {
    const observer = simulation().addObserver('A', vector(), vector());
    observer.setVelocity(vector(0.6));
    expect(observer.velocityCMB.x).toBe(0.6);
    observer.applyThrust(vector(1), 100);
    expect(observer.velocity.x).toBeCloseTo(Math.tanh(Math.atanh(0.6) + Math.log(1000 / 900)), 12);
    expect(Physics.photonRocketFuelRequired(1000, -0.5)).toBeCloseTo(Physics.photonRocketFuelRequired(1000, 0.5), 12);
  });

  test('les boosts 3D inverses et les vitesses relatives opposées restent subluminiques', () => {
    for (const [u, boost] of [
      [vector(0.8), vector(-0.8)],
      [vector(0.3, 0.4, 0.5), vector(-0.6, 0.2, 0.1)],
      [vector(0, 0.999), vector(0.999)],
    ]) {
      const transformed = Physics.velocityAddition3D(u, boost);
      expect(transformed.length()).toBeLessThan(1);
      const restored = Physics.velocityAddition3D(transformed, boost.clone().negate());
      expect(restored.x).toBeCloseTo(u.x, 10);
      expect(restored.y).toBeCloseTo(u.y, 10);
      expect(restored.z).toBeCloseTo(u.z, 10);
    }
    expect(Physics.velocityAddition3D(vector(0.8), vector(0.8)).x).toBeCloseTo(0.975609756097561, 12);
  });

  test('la borne numérique refuse une impulsion sans perdre de masse', () => {
    const observer = simulation().addObserver('A', vector(), vector(Physics.MAX_BETA));
    const result = observer.applyThrust(vector(1), 999);
    expect(result.success).toBe(false);
    expect(observer.mass).toBe(1000);
    expect(observer.beta).toBe(Physics.MAX_BETA);
  });

  test.each([
    [vector(), 10], [vector(NaN), 10], [vector(Infinity), 10],
    [vector(1), NaN], [vector(1), Infinity], [vector(1), -1], [vector(1), 1000],
  ])('rejette une impulsion invalide sans modifier état ni masse (%p, %p)', (direction, mass) => {
    const observer = simulation().addObserver('A', vector(), vector(0.2));
    expect(observer.applyThrust(direction, mass).success).toBe(false);
    expect(observer.mass).toBe(1000);
    expect(observer.velocity.x).toBe(0.2);
    expect(observer.accelerationHistory).toHaveLength(0);
  });

  test('rejette les vitesses superluminiques vectorielles et les paramètres non finis', () => {
    expect(() => new Observer('a', 'A', vector(), vector(0.8, 0.8))).toThrow(RangeError);
    expect(() => new Observer('a', 'A', vector(NaN))).toThrow(RangeError);
    expect(() => new Observer('a', 'A', vector(), vector(), { armLength: 0 })).toThrow(RangeError);
    const observer = simulation().addObserver('A', vector(), vector());
    expect(() => observer.setVelocity(vector(Infinity))).toThrow(RangeError);
    expect(() => observer.setVelocity(vector(1))).toThrow(RangeError);
    expect(observer.velocity.length()).toBe(0);
  });

  test('la sélection ne mélange pas contraction mobile et positions lab', () => {
    const sim = simulation();
    const lab = sim.addObserver('Lab', vector(), vector(), { id: 'lab' });
    const observer = sim.addObserver('A', vector(3), vector(0.6, 0.4));
    const end = observer.clockH.mesh.children[2].position.clone();
    const scale = observer.bodyMesh.scale.clone();
    sim.setReferenceFrame(observer.id);
    expect(observer.position.x).toBe(3);
    expect(observer.clockH.mesh.children[2].position.equals(end)).toBe(true);
    expect(observer.bodyMesh.scale.equals(scale)).toBe(true);
    // Une contraction oblique modifie aussi la direction du bras.
    expect(end.y).toBeLessThan(0);
    observer.setVelocity(vector());
    expect(observer.bodyMesh.scale.toArray()).toEqual([1, 1, 1]);
    expect(observer.clockH.mesh.children[2].position.toArray()).toEqual([5, 0, 0]);
    sim.setReferenceFrame(null);
    expect(sim.referenceObserver).toBe(lab);
  });

  describe('trajets des photons internes dans le laboratoire', () => {
    const velocities = [
      ['repos', vector()],
      ['longitudinal +X', vector(0.6)],
      ['longitudinal −X', vector(-0.6)],
      ['longitudinal +Y', vector(0, 0.6)],
      ['longitudinal −Y', vector(0, -0.6)],
      ['transverse +Z', vector(0, 0, 0.6)],
      ['transverse −Z', vector(0, 0, -0.6)],
      ['oblique positif', vector(0.3, 0.4, 0.5)],
      ['oblique négatif', vector(-0.3, -0.4, -0.5)],
    ];

    test.each(velocities)('%s : vitesse vectorielle c à l’aller et au retour pour H/V', (_label, beta) => {
      const sim = simulation();
      for (const orientation of ['H', 'V']) {
        const axis = orientation === 'H' ? vector(1) : vector(0, 1);
        const b = beta.dot(axis);
        for (const sign of [1, -1]) {
          const observer = sim.addObserver('A', vector(), beta, { armLength: 1 });
          const clock = observer[`clock${orientation}`];
          const reflection = 1 + b;
          // Deux points strictement à l'intérieur de chaque segment.
          const qStart = sign === 1 ? reflection / 4 : reflection + (1 - b) / 4;
          const dtLab = observer.gamma * (sign === 1 ? reflection : 1 - b) / 4;
          observer.update(qStart * observer.gamma);
          const start = clock.photonMesh.getWorldPosition(vector());
          observer.update(dtLab);
          const actual = clock.photonMesh.getWorldPosition(vector()).sub(start).divideScalar(dtLab);

          // Boost indépendant du quadrivecteur lumineux (1, ±e).
          const direction = axis.clone().multiplyScalar(sign);
          const projection = beta.dot(direction);
          const g = observer.gamma;
          const expected = direction.add(beta.clone().multiplyScalar(
            g + g * g / (g + 1) * projection,
          )).divideScalar(g * (1 + projection));
          expect(actual.length()).toBeCloseTo(1, 12);
          expect(actual.x).toBeCloseTo(expected.x, 12);
          expect(actual.y).toBeCloseTo(expected.y, 12);
          expect(actual.z).toBeCloseTo(expected.z, 12);
          expect(observer.clockH.phase).toBe(observer.clockV.phase);
        }
      }
    });

    test.each(velocities)('%s : réflexion continue, retour à la base et ticks H/V synchronisés', (_label, beta) => {
      const sim = simulation();
      for (const orientation of ['H', 'V']) {
        const observer = sim.addObserver('A', vector(), beta, { armLength: 1 });
        const clock = observer[`clock${orientation}`];
        const b = orientation === 'H' ? beta.x : beta.y;
        const reflection = 1 + b;
        const epsilon = 1e-5;
        const dtLab = epsilon * observer.gamma;
        observer.update((reflection - epsilon) * observer.gamma);
        const before = clock.photonMesh.getWorldPosition(vector());
        observer.update(dtLab);
        const at = clock.photonMesh.getWorldPosition(vector());
        expect(at.distanceTo(clock.mesh.children[2].getWorldPosition(vector()))).toBeLessThan(1e-12);
        expect(clock.phase).toBeCloseTo((1 + b) / 2, 12);
        observer.update(dtLab);
        const after = clock.photonMesh.getWorldPosition(vector());
        expect(at.clone().sub(before).divideScalar(dtLab).length()).toBeCloseTo(1, 8);
        expect(after.clone().sub(at).divideScalar(dtLab).length()).toBeCloseTo(1, 8);

        const remaining = 2 - reflection - epsilon;
        const ticks = observer.update(remaining * observer.gamma);
        expect(ticks.ticksH).toHaveLength(1);
        expect(ticks.ticksV).toEqual(ticks.ticksH);
        expect(ticks.ticksH[0]).toBeCloseTo(remaining, 12);
        for (const current of [observer.clockH, observer.clockV]) {
          expect(current.period).toBe(2);
          expect(current.tickCount).toBe(1);
          expect(current.phase).toBeCloseTo(0, 12);
          expect(current.photonMesh.position.length()).toBeLessThan(1e-12);
        }
        expect(observer.clockH.phase).toBe(observer.clockV.phase);
      }
    });

    test('βx=0.6 et dtlab=0.1 ne produisent plus une vitesse photon de 1.24c', () => {
      const observer = simulation().addObserver('A', vector(), vector(0.6));
      const start = observer.clockH.photonMesh.getWorldPosition(vector());
      observer.update(0.1);
      const velocity = observer.clockH.photonMesh.getWorldPosition(vector()).sub(start).divideScalar(0.1);
      expect(velocity.x).toBeCloseTo(1, 12);
      expect(velocity.y).toBe(0);
      expect(velocity.z).toBe(0);
    });

    test('update et setLabVelocity partagent la même animation sans changer phase ni ticks', () => {
      const observer = simulation().addObserver('A', vector(), vector(), { armLength: 1 });
      for (const clock of [observer.clockH, observer.clockV]) {
        clock.update(1);
        for (const beta of [vector(0.6, 0.4), vector(-0.6, -0.4), vector()]) {
          const phase = clock.phase;
          clock.setLabVelocity(beta);
          const b = clock.orientation === 'H' ? beta.x : beta.y;
          const fraction = 1 / (1 + Math.abs(b));
          expect(clock.photonMesh.position.distanceTo(
            clock.mesh.children[2].position.clone().multiplyScalar(fraction),
          )).toBeLessThan(1e-12);
          const position = clock.photonMesh.position.clone();
          expect(clock.update(0)).toEqual([]);
          expect(clock.photonMesh.position.equals(position)).toBe(true);
          expect(clock.phase).toBe(phase);
          expect(clock.tickCount).toBe(0);
        }
        clock.setLabVelocity(vector(0.6, -0.4));
        clock.update(0.1);
        const b = clock.orientation === 'H' ? 0.6 : -0.4;
        const fraction = 1.1 < 1 + b ? 1.1 / (1 + b) : 0.9 / (1 - b);
        expect(clock.photonMesh.position.distanceTo(
          clock.mesh.children[2].position.clone().multiplyScalar(fraction),
        )).toBeLessThan(1e-12);
      }
    });

    test('reset restaure le boost oblique et les photons à c après la contraction historique', () => {
      const observer = simulation().addObserver('A', vector(2, 3, 4), vector(0.3, -0.4, 0.5));
      const clocks = [observer.clockH, observer.clockV];
      const ends = clocks.map(clock => clock.mesh.children[2].position.clone());
      observer.update(1);
      observer.setVelocity(vector(-0.6, 0.4));
      observer.update(1);
      observer.reset();
      const starts = clocks.map((clock, i) => {
        expect(clock.phase).toBe(0);
        expect(clock.tickCount).toBe(0);
        expect(clock.mesh.children[2].position.equals(ends[i])).toBe(true);
        expect(clock.photonMesh.position.length()).toBe(0);
        return clock.photonMesh.getWorldPosition(vector());
      });
      observer.update(0.1);
      clocks.forEach((clock, i) => {
        const velocity = clock.photonMesh.getWorldPosition(vector()).sub(starts[i]).divideScalar(0.1);
        expect(velocity.length()).toBeCloseTo(1, 12);
      });
      expect(observer.clockH.phase).toBe(observer.clockV.phase);
    });
  });

  test('conserve toutes les émissions et leur événement exact même à vitesse ×100', () => {
    const sim = simulation();
    const source = sim.addObserver('A', vector(), vector(0.6), { armLength: 0.01 });
    sim.addObserver('B', vector(1000));
    sim.timeScale = 100;
    sim.play();
    sim.update(0.1);
    const emitted = sim.signals.filter(signal => signal.sourceId === source.id && signal.clockType === 'H');
    expect(emitted).toHaveLength(400);
    expect(source.properTime).toBeCloseTo(8, 10);
    emitted.forEach((signal, index) => {
      expect(signal.tickNumber).toBe(index + 1);
      expect(signal.emissionProperTime).toBeCloseTo((index + 1) * 0.02, 10);
      expect(signal.emissionLabTime).toBeCloseTo((index + 1) * 0.025, 10);
      expect(signal.origin.x).toBeCloseTo(signal.emissionLabTime * 0.6, 10);
    });
  });

  test('réception exacte à l’intérieur du pas et Doppler conservé', () => {
    const sim = simulation();
    const source = sim.addObserver('A', vector(), vector(0.6));
    const receiver = sim.addObserver('B', vector(0.103), vector(0.2));
    sim.autoEmitPhotons = false;
    sim.emitPhoton(source, 'H', 1);
    advance(sim, 0.2);
    const reception = receiver.receptionHistory[0];
    // t = .103 / (1−.2), τ=t√(1−.2²).
    expect(reception.lightTravelTime).toBeCloseTo(0.103 / 0.8, 12);
    expect(reception.tau).toBeCloseTo(0.103 / 0.8 * Math.sqrt(0.96), 12);
    expect(reception.dopplerFactor).toBeCloseTo(2 * Math.sqrt(0.8 / 1.2), 12);
  });

  test('un changement ultérieur de vitesse source ne change pas le signal émis', () => {
    const sim = simulation();
    const source = sim.addObserver('A', vector(), vector(0.6));
    const receiver = sim.addObserver('B', vector(0.05));
    sim.autoEmitPhotons = false;
    sim.emitPhoton(source, 'H', 1);
    source.setVelocity(vector(-0.6));
    advance(sim, 0.1);
    expect(receiver.receptionHistory[0].dopplerFactor).toBeCloseTo(2, 12);
    expect(receiver.receptionHistory[0].lightTravelTime).toBeCloseTo(0.05, 12);
  });

  test('la lumière ne dépend pas du sens de déplacement ni du seuil de frame', () => {
    for (const speed of [-0.9, 0, 0.9]) {
      const delay = Physics.lightReceptionDelay(vector(1), vector(speed), 0);
      expect(delay).toBeCloseTo(1 / (1 - speed), 12);
    }
    expect(Physics.lightReceptionDelay(vector(), vector(), 0)).toBe(0);
    expect(Physics.lightReceptionDelay(vector(1), vector(), 2)).toBeNull();
  });

  test('30, 60 et 144 Hz donnent le même temps, trajectoire et carburant', () => {
    const results = [30, 60, 144].map(fps => {
      const sim = simulation();
      const observer = sim.addObserver('A', vector(), vector(0.3));
      sim.beforeStep = dt => observer.applyThrust(vector(0, 1), 10 * dt);
      advance(sim, 2, fps);
      return { time: sim.labTime, mass: observer.mass, tau: observer.properTime, position: observer.position.toArray() };
    });
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    expect(results[0].mass).toBeCloseTo(980, 9);
    expect(results[0].time).toBeCloseTo(2, 12);
  });

  test('pause et reset notifient sans écouler de temps, valeurs invalides refusées', () => {
    const sim = simulation();
    const observer = sim.addObserver('A', vector(), vector(0.6));
    const notify = jest.fn();
    sim.onUpdate(notify);
    advance(sim, 1);
    sim.pause();
    const time = sim.labTime;
    sim.update(0.1);
    expect(sim.labTime).toBe(time);
    sim.reset();
    expect(observer.properTime).toBe(0);
    expect(observer.mass).toBe(1000);
    expect(notify).toHaveBeenLastCalledWith(sim);
    sim.play();
    for (const delta of [NaN, Infinity, -1]) {expect(() => sim.update(delta)).toThrow(RangeError);}
    expect(sim.labTime).toBe(0);
    sim.update(FIXED_STEP);
    expect(sim.labTime).toBe(FIXED_STEP);
  });

  test('un signal léger devient visible et les cibles supprimées ne le retiennent pas', () => {
    const sim = simulation();
    const source = sim.addObserver('A', vector());
    const receiver = sim.addObserver('B', vector(10));
    sim.emitPhoton(source, 'H', 1);
    const signal = sim.signals[0];
    expect(signal.lightweight).toBe(true);
    sim.showSignals = true;
    sim.refresh();
    expect(signal.mesh.isMesh).toBe(true);
    expect(signal.mesh.visible).toBe(true);
    sim.removeObserver(receiver.id);
    advance(sim, 1);
    expect(sim.signals).toHaveLength(0);
    sim.emitPhoton(source, 'H', 2);
    expect(sim.signals).toHaveLength(0);
  });

  test('agrégation numérique bornée et émissions H/V simultanées non dédoublées', () => {
    const observer = simulation().addObserver('A', vector());
    observer.properTime = 200;
    for (let i = 1; i <= 600; i++) {
      observer.recordReceivedTick('source', 'H', i, 0.5, i, 1, i / 10);
    }
    expect(observer.receptionHistory.length).toBeLessThanOrEqual(500);
    expect(observer.receptionHistory.every(event => Number.isFinite(event.tau))).toBe(true);
    const tracker = observer.pingTracker.get('source');
    const count = tracker.receptionIntervals.length;
    observer.recordReceivedTick('source', 'V', 600, 0.5, 600, 1, 60);
    expect(tracker.receptionIntervals.length).toBe(count);
    expect(tracker.roundTripTime).toBeNull();
  });

  test('libère les textures de labels et les géométries', () => {
    const sim = simulation();
    const observer = sim.addObserver('A', vector());
    const label = observer.mesh.children.find(child => child.isSprite);
    const textureDispose = jest.spyOn(label.material.map, 'dispose');
    const geometryDispose = jest.spyOn(observer.bodyMesh.geometry, 'dispose');
    sim.dispose();
    expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(sim.scene.children).toHaveLength(0);
  });
});
