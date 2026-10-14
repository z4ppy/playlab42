/** @jest-environment jsdom */
import { vector } from './dom.js';

test('un vecteur distingue les signes, conserve zéro et expose ses coordonnées', () => {
  const figure = vector([2, -1, 0, 0.5]);
  const bars = [...figure.querySelectorAll('.vector-bar')];
  expect(bars.map(bar => bar.style.height)).toEqual(['40px', '20px', '0px', '10px']);
  expect(bars.map(bar => bar.classList.contains('negative'))).toEqual([false, true, false, false]);
  expect(figure.querySelector('[role="img"]').getAttribute('aria-label')).toContain('2.00, -1.00, 0.00, 0.50');
  expect([...figure.querySelectorAll('.vector-coordinate small')].map(node => node.textContent)).toEqual(['0', '1', '2', '3']);
  expect(figure.querySelector('summary').textContent).toBe('Lire les 4 valeurs');
  expect([...figure.querySelectorAll('dd')].map(node => node.textContent)).toEqual(['2.0000', '-1.0000', '0.0000', '0.5000']);
  expect(figure.querySelector('figcaption').textContent).toContain('pas une probabilité');
});
