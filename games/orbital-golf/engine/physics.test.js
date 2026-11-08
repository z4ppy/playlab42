import { normalizeHole } from './level.js';
import {
  CAPTURE_RADIUS, CAPTURE_SPEED, DT, MAX_FLIGHT_SECONDS, MAX_SPEED,
  angleToRadians, isCaptured, launchSpeed, leavesSurface, simulateShot, simulateVelocity, surfaceNormal,
} from './physics.js';

/** Trou de laboratoire : cible et limites lointaines, pour isoler un phénomène. */
const lab = (bodies, extra = {}) => normalizeHole({
  id: 'lab', name: 'Laboratoire', par: 2, tee: [0, 0], hole: { x: 2500, y: 2500 },
  bounds: [-3000, -3000, 3000, 3000], bodies, ...extra,
});

/** Énergie mécanique : potentiel adouci de Plummer, cohérent avec a = μ·d / (|d|² + ε²)^{3/2}. */
function energy(hole, x, y, vx, vy) {
  let total = 0.5 * (vx * vx + vy * vy);
  for (const body of hole.bodies) {
    total -= body.mass * 1e6 / Math.sqrt((body.x - x) ** 2 + (body.y - y) ** 2 + 100);
  }
  return total - 2e5 / Math.sqrt((hole.hole.x - x) ** 2 + (hole.hole.y - y) ** 2 + 900);
}

/** Dérive relative maximale de l'énergie sur un vol complet. */
function energyDrift(hole, from, vx, vy, seconds) {
  let initial = null;
  let drift = 0;
  const result = simulateVelocity(hole, from, vx, vy, 0, {
    maxSeconds: seconds,
    onSample: (x, y, _t, _bounced, svx, svy) => {
      const value = energy(hole, x, y, svx, svy);
      initial ??= value;
      drift = Math.max(drift, Math.abs((value - initial) / initial));
    },
  });
  return { result, drift };
}

describe('Conversions du tir', () => {
  test('la vitesse de lancement suit 40 + 560·(p/100)^1,5', () => {
    expect(launchSpeed(100)).toBe(600);
    expect(launchSpeed(1)).toBeCloseTo(40.56, 2);
    expect(launchSpeed(50)).toBeCloseTo(40 + 560 * Math.SQRT1_2 / 2, 9);
  });

  test('les dixièmes de degré tournent dans le sens horaire, y vers le bas', () => {
    expect(angleToRadians(0)).toBe(0);
    expect(angleToRadians(900)).toBeCloseTo(Math.PI / 2, 12);
    expect(angleToRadians(1800)).toBeCloseTo(Math.PI, 12);
  });
});

describe('Intégration de Verlet vitesse', () => {
  test('conserve l’énergie d’une orbite circulaire sur 8 s (|ΔE/E₀| < 10⁻⁴)', () => {
    const hole = lab([{ kind: 'planet', x: 500, y: 500, radius: 40, mass: 4 }]);
    const r = 250;
    const speed = Math.sqrt(4e6 * r * r / (r * r + 100) ** 1.5);
    const { result, drift } = energyDrift(hole, { x: 750, y: 500 }, 0, speed, 8);
    expect(result).toMatchObject({ outcome: 'lost', steps: 8 * 240 });
    expect(drift).toBeLessThan(1e-4);
  });

  test('borne la dérive d’un passage rapproché au périastre de 40 u (mesuré : 1,5·10⁻³)', () => {
    const hole = lab([{ kind: 'planet', x: 500, y: 500, radius: 20, mass: 8 }]);
    const semiMajor = (300 + 40) / 2;
    const apoSpeed = Math.sqrt(8e6 * (2 / 300 - 1 / semiMajor));
    const { result, drift } = energyDrift(hole, { x: 800, y: 500 }, 0, apoSpeed, 8);
    expect(result.outcome).toBe('lost');
    expect(drift).toBeLessThan(5e-3);
  });

  test('est réversible sans collision : inverser la vitesse ramène au départ', () => {
    const hole = lab([{ kind: 'planet', x: 500, y: 500, radius: 20, mass: 3 }]);
    let last = null;
    const forward = simulateVelocity(hole, { x: 800, y: 500 }, 0, 110, 0, {
      maxSeconds: 3, onSample: (...sample) => { last = sample; },
    });
    const back = simulateVelocity(hole, { x: forward.x, y: forward.y }, -last[4], -last[5], 0, { maxSeconds: 3 });
    expect(Math.hypot(back.x - 800, back.y - 500)).toBeLessThan(1e-6);
  });

  test('ne traverse pas un petit corps à la vitesse maximale bornée', () => {
    const hole = lab([{ kind: 'planet', x: 500, y: 0, radius: 1, mass: 0.3 }]);
    let farthest = -Infinity;
    let bounced = false;
    simulateVelocity(hole, { x: 300, y: 0 }, 5000, 0, 0, {
      maxSeconds: 1,
      onSample: (x, _y, _t, hit, vx, vy) => {
        farthest = Math.max(farthest, x);
        bounced ||= hit;
        if (hit) { expect(Math.hypot(vx, vy)).toBeLessThanOrEqual(MAX_SPEED); }
      },
    });
    expect(bounced).toBe(true);
    expect(farthest).toBeLessThan(500);
  });

  test('une balle au centre exact d’un corps en sort par l’est, sans division par zéro', () => {
    // Trou au même centre : aucune accélération ne déplace la balle avant la collision.
    const hole = lab([{ kind: 'planet', x: 500, y: 500, radius: 40, mass: 1 }], { hole: { x: 500, y: 500 } });
    let first = null;
    simulateVelocity(hole, { x: 500, y: 500 }, 0, 0, 0, { maxSeconds: DT, onSample: (x, y) => { first = [x, y]; } });
    expect(first[0]).toBeCloseTo(548, 6);
    expect(first[1]).toBeCloseTo(500, 6);
  });

  test('est déterministe : même entrée, même vol au bit près', () => {
    const hole = lab([{ kind: 'planet', x: 400, y: 300, radius: 50, mass: 5 }]);
    const run = () => simulateShot(hole, { x: 100, y: 100 }, 300, 70, 1.25);
    expect(run()).toEqual(run());
  });
});

describe('Résultats d’un vol et leurs limites', () => {
  test('capture : distance ≤ 22 u incluse, vitesse < 150 u/s exclue', () => {
    expect(isCaptured(CAPTURE_RADIUS, CAPTURE_SPEED - 1e-9)).toBe(true);
    expect(isCaptured(CAPTURE_RADIUS + 1e-9, 0)).toBe(false);
    expect(isCaptured(0, CAPTURE_SPEED)).toBe(false);
  });

  test('rentré : la balle posée au bord du trou tombe et finit au centre', () => {
    const hole = lab([]);
    const result = simulateVelocity(hole, { x: 2500, y: 2480 }, 0, 0, 0);
    expect(result).toMatchObject({ outcome: 'holed', x: 2500, y: 2500, on: null, steps: 1 });
  });

  test('arrêtée : une balle lâchée au-dessus d’une planète s’y pose', () => {
    const hole = lab([{ kind: 'planet', x: 500, y: 500, radius: 60, mass: 3 }]);
    const result = simulateVelocity(hole, { x: 500, y: 400 }, 0, 0, 0);
    expect(result.outcome).toBe('rest');
    expect(result.on).toBe(0);
    expect(Math.hypot(result.x - 500, result.y - 500)).toBeCloseTo(68, 3);
  });

  test('coupure en contact : une balle qui roule encore est arrêtée, pas perdue', () => {
    const hole = lab([{ kind: 'planet', x: 500, y: 500, radius: 60, mass: 3 }]);
    const result = simulateVelocity(hole, { x: 500, y: 430 }, 80, 0, 0, { maxSeconds: 0.4 });
    expect(result).toMatchObject({ outcome: 'rest', on: 0, steps: 96 });
  });

  test('hors limites : le centre de la balle franchit la limite', () => {
    const hole = normalizeHole({ id: 'o', name: 'o', par: 1, tee: [100, 500], hole: { x: 850, y: 500 }, bodies: [] });
    const result = simulateShot(hole, hole.tee, 1800, 50, 0);
    expect(result.outcome).toBe('out');
    expect(result.x).toBeLessThan(-80);
    expect(result.x).toBeGreaterThan(-80 - 600 * DT);
  });

  test('avalée : la balle passe l’horizon de 30 u d’un trou noir', () => {
    const hole = lab([{ kind: 'blackhole', x: 500, y: 500, mass: 9 }]);
    const result = simulateVelocity(hole, { x: 200, y: 500 }, 100, 0, 0);
    expect(result.outcome).toBe('swallowed');
    expect(Math.hypot(result.x - 500, result.y - 500)).toBeLessThan(30);
  });

  test('perdue en orbite : 2 400 pas exactement, sans support', () => {
    const result = simulateVelocity(lab([]), { x: 0, y: 0 }, -10, 0, 0);
    expect(result).toMatchObject({ outcome: 'lost', steps: 2400, on: null });
    expect(result.duration).toBeCloseTo(MAX_FLIGHT_SECONDS, 9);
  });

  test('priorité : le trou passe avant les limites dans le même pas', () => {
    const hole = lab([], { hole: { x: 1100, y: 500 }, bounds: [-80, -80, 1080, 1080] });
    expect(simulateVelocity(hole, { x: 1100, y: 500 }, 0, 0, 0).outcome).toBe('holed');
  });

  test('priorité : le trou noir passe avant le trou dans le même pas', () => {
    const hole = lab([{ kind: 'blackhole', x: 500, y: 500, mass: 9 }], { hole: { x: 500, y: 500 } });
    expect(simulateVelocity(hole, { x: 500, y: 500 }, 0, 0, 0).outcome).toBe('swallowed');
  });

  test('une lune renvoie toujours la balle (restitution 0,8) sans la retenir', () => {
    const hole = lab([{ kind: 'moon', radius: 30, mass: 0.3, orbit: { cx: 500, cy: 500, r: 100, period: 4, phase: 0 } }]);
    const hits = [];
    const result = simulateVelocity(hole, { x: 600, y: 540 }, 0, -100, 0, {
      maxSeconds: 1, onSample: (_x, _y, _t, hit, _vx, vy) => { if (hit) { hits.push(vy); } },
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toBeGreaterThan(100);
    expect(result.outcome).toBe('lost');
  });

  test('le green arrête une balle lente à côté du trou', () => {
    const hole = lab([]);
    const result = simulateVelocity(hole, { x: 2440, y: 2500 }, -60, 0, 0);
    expect(result.outcome).toBe('rest');
    expect(result.on).toBeNull();
    expect(Math.hypot(result.x - 2500, result.y - 2500)).toBeLessThanOrEqual(90);
  });
});

describe('Aperçu de trajectoire', () => {
  const hole = normalizeHole({
    id: 'p', name: 'p', par: 1, tee: [100, 500], hole: { x: 850, y: 500 },
    bodies: [{ kind: 'planet', x: 400, y: 500, radius: 40, mass: 1 }],
  });

  test('s’arrête au premier contact sans montrer le rebond', () => {
    const samples = [];
    const result = simulateShot(hole, hole.tee, 0, 50, 0, { preview: 2, onSample: (x, y) => samples.push([x, y]) });
    expect(result.outcome).toBe('contact');
    expect(samples.every(([x]) => x <= 400 - 48 + 1e-6)).toBe(true);
  });

  test('s’arrête à l’horizon demandé et échantillonne au pas demandé', () => {
    let count = 0;
    const result = simulateShot(hole, hole.tee, 900, 20, 0, { preview: 0.5, sampleEvery: 12, onSample: () => { count += 1; } });
    expect(result).toMatchObject({ outcome: 'horizon', steps: 120 });
    expect(count).toBe(1 + 120 / 12);
  });

  test('ignore la surface de départ puis détecte le contact suivant', () => {
    const planet = { kind: 'planet', x: 500, y: 500, radius: 60, mass: 3 };
    const onPlanet = lab([planet]);
    const ball = { x: 500, y: 432, on: 0 };
    expect(simulateShot(onPlanet, ball, 2700, 10, 0, { preview: 3 }).outcome).toBe('contact');
  });
});

describe('Tir depuis une surface', () => {
  const hole = lab([{ kind: 'planet', x: 500, y: 500, radius: 60, mass: 3 }]);
  const ball = { x: 500, y: 432, on: 0 };

  test('la normale sortante pointe vers la balle ; aucune en vol libre', () => {
    expect(surfaceNormal(hole, ball)).toEqual({ x: 0, y: -1 });
    expect(surfaceNormal(hole, { x: 1, y: 2, on: null })).toBeNull();
    expect(surfaceNormal(hole, { x: 1, y: 2 })).toBeNull();
    expect(surfaceNormal(hole, { x: 500, y: 500, on: 0 })).toEqual({ x: 0, y: 0 });
  });

  test('un tir vers l’intérieur ou rasant la surface est refusé', () => {
    expect(leavesSurface(hole, ball, 2700)).toBe(true);
    expect(leavesSurface(hole, ball, 900)).toBe(false);
    expect(leavesSurface(hole, ball, 0)).toBe(false);
    expect(leavesSurface(hole, { x: 0, y: 0, on: null }, 900)).toBe(true);
  });
});
