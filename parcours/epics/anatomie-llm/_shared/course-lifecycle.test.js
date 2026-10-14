/** @jest-environment jsdom */
import { jest } from '@jest/globals';

const tick = async () => { for (let i = 0; i < 8; i++) { await Promise.resolve(); } };

test('le final ouvre un lien autonome et le restaure après retour depuis le cache de navigation', async () => {
  jest.resetModules();
  document.body.dataset.chapter = '16b-transformer-explainer';
  document.body.innerHTML = '<div id="challenge-choices"></div><p id="challenge-feedback"></p><section id="experiment-root"></section>';
  jest.unstable_mockModule('../../../../lib/theme.js', () => ({ initTheme: jest.fn(), toggleTheme: jest.fn() }));
  jest.unstable_mockModule('../../../_shared/slide-utils.js', () => ({ initGlossary: jest.fn() }));
  const local = jest.fn();
  jest.unstable_mockModule('./model-experiments.js', () => ({ getModel: jest.fn(), modelExperiments: { laboratory: local } }));
  jest.unstable_mockModule('./concept-experiments.js', () => ({ conceptExperiments: {} }));
  await import('./course.js');
  await tick();
  expect(document.querySelector('#experiment-root a').target).toBe('_blank');
  expect(document.querySelector('iframe')).toBeNull();
  expect(local).not.toHaveBeenCalled();
  window.dispatchEvent(new Event('pagehide'));
  expect(document.querySelector('#experiment-root a')).toBeNull();
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', { value: true });
  window.dispatchEvent(event);
  await tick();
  expect(document.querySelectorAll('#experiment-root a')).toHaveLength(1);
  expect(document.querySelector('#experiment-root').dataset.ready).toBe('true');
  window.dispatchEvent(new Event('pagehide'));
});
