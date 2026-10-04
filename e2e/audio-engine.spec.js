import { test, expect, activate } from './fixtures.js';

/**
 * Fumée navigateur : le vrai AudioEngine pilote le vrai Tone 15 distribué
 * localement par la page Diese & Mat. Elle vérifie construction, graphe,
 * réglages, remplacement et destruction ; elle ne dit rien du rendu sonore.
 */
test('AudioEngine réel sur Tone 15 : graphe, réglages, remplacement, notes et destruction', async ({ page }) => {
  await page.goto('/games/diese-et-mat/index.html');
  // Le contexte audio exige un vrai geste utilisateur avant le démarrage du moteur testé.
  await activate(page.locator('#btn-piano'));

  const result = await page.evaluate(async () => {
    const { AudioEngine } = await import('./src/audio/AudioEngine.js');
    const engine = new AudioEngine();
    const out = { errors: [] };
    const events = [];
    engine.on('noteStart', (event) => events.push(['start', event.note ?? event.notes]));
    engine.on('noteEnd', (event) => events.push(['end', event.note ?? event.notes]));
    const kinds = { poly: 'PolySynth', fm: 'PolySynth', pluck: 'PluckSynth', membrane: 'MembraneSynth', metal: 'MetalSynth', noise: 'NoiseSynth' };
    try {
      await engine.init();
      out.version = engine.Tone.version;
      await engine.start();
      out.contextState = engine.Tone.getContext().state;
      out.start = {
        synth: engine.synth.name,
        effects: [engine.effects.filter.name, engine.effects.delay.name, engine.effects.reverb.name],
        volume: engine.synth.volume.value,
      };

      const presets = [];
      for (const [name, preset] of Object.entries(AudioEngine.getPresets())) {
        const previous = engine.synth;
        engine.setPreset(name);
        engine.playNote('C4', 0.02);
        presets.push({
          name,
          expected: kinds[preset.synthType],
          synth: engine.synth.name,
          replaced: engine.synth !== previous && previous.disposed === true,
          distortion: engine.distortion?.name ?? null,
          noiseFilter: engine.noiseFilter?.name ?? null,
        });
        engine.stopAll();
      }
      out.presets = presets;

      engine.setPreset('piano');
      engine.applySettings({
        preset: 'custom', synthType: 'poly', oscillator: 'square', volume: -25,
        effects: {
          reverb: { enabled: true, amount: 0.6 },
          delay: { enabled: true, time: 0.3, feedback: 0.2 },
          filter: { enabled: true, frequency: 900 },
        },
      });
      out.applied = {
        volume: engine.synth.volume.value,
        reverbWet: engine.effects.reverb.wet.value,
        delayWet: engine.effects.delay.wet.value,
        delayTime: engine.effects.delay.delayTime.value,
        feedback: engine.effects.delay.feedback.value,
        filterFrequency: engine.effects.filter.frequency.value,
        settings: engine.getSettings().oscillator,
      };

      engine.setPreset('percHihat');
      engine.setSynthParam('metal', 'harmonicity', 9);
      engine.setSynthParam('metal', 'frequency', 321);
      out.metal = {
        stored: engine.metalParams.harmonicity,
        harmonicity: engine.synth.harmonicity,
        frequency: engine.synth.frequency.value,
      };
      engine.setPreset('guitarClassic');
      engine.setSynthParam('pluck', 'dampening', 1234);
      out.pluckDampening = engine.synth.dampening;
      engine.setPreset('percKick');
      engine.setSynthParam('membrane', 'octaves', 3);
      out.membraneOctaves = engine.synth.octaves;

      engine.setPreset('piano');
      engine.noteOn('E4');
      engine.noteOff('E4');
      engine.playChord(['C4', 'E4', 'G4'], 0.02);
      out.muted = (engine.setMuted(true), engine.synth.volume.value);
      engine.setMuted(false);
      out.unmuted = engine.synth.volume.value;
      await new Promise((resolve) => setTimeout(resolve, 150));
      out.events = events;

      const nodes = [engine.synth, ...Object.values(engine.effects)];
      engine.dispose();
      out.disposed = nodes.map((node) => node.disposed);
      out.after = { synth: engine.synth, tone: engine.Tone, started: engine.started };
      out.restart = await engine.start().then(() => 'accepté', (error) => error.message);
    } catch (error) {
      out.errors.push(String(error?.stack ?? error));
      engine.dispose();
    }
    return out;
  });

  expect(result.errors).toEqual([]);
  expect(result.version).toBe('15.1.22');
  expect(result.contextState).toBe('running');
  expect(result.start).toEqual({
    synth: 'PolySynth', effects: ['Filter', 'FeedbackDelay', 'Reverb'], volume: expect.closeTo(-10, 5),
  });
  expect(result.presets).toHaveLength(15);
  for (const preset of result.presets) {
    expect(preset.synth, preset.name).toBe(preset.expected);
    expect(preset.replaced, `${preset.name} remplace et libère l'ancien synthé`).toBe(true);
  }
  expect(Object.fromEntries(result.presets.map((p) => [p.name, [p.distortion, p.noiseFilter]])))
    .toMatchObject({ piano: [null, null], guitarElectric: ['Distortion', null], percSnare: [null, 'Filter'] });
  expect(result.applied.volume).toBeCloseTo(-25, 5);
  expect(result.applied.reverbWet).toBeCloseTo(0.6, 5);
  expect(result.applied.delayWet).toBeCloseTo(0.5, 5);
  expect(result.applied.delayTime).toBeCloseTo(0.3, 5);
  expect(result.applied.feedback).toBeCloseTo(0.2, 5);
  expect(result.applied.filterFrequency).toBeCloseTo(900, 3);
  expect(result.applied.settings).toBe('square');
  // Correction voulue : harmonicity est un nombre simple dans Tone 15 et s'applique en direct.
  expect(result.metal.stored).toBe(9);
  expect(result.metal.harmonicity).toBe(9);
  expect(result.metal.frequency).toBeCloseTo(321, 3);
  expect(result.pluckDampening).toBeCloseTo(1234, 3);
  expect(result.membraneOctaves).toBeCloseTo(3, 5);
  expect(result.muted).toBe(-Infinity);
  expect(result.unmuted).toBeCloseTo(-25, 5);
  expect(result.events).toEqual(expect.arrayContaining([
    ['start', 'E4'], ['end', 'E4'], ['start', ['C4', 'E4', 'G4']], ['end', ['C4', 'E4', 'G4']],
  ]));
  expect(result.disposed).toEqual([true, true, true, true]);
  expect(result.after).toEqual({ synth: null, tone: null, started: false });
  expect(result.restart).toBe('Moteur audio détruit');
});
