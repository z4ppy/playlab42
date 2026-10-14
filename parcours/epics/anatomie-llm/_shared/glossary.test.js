/** @jest-environment jsdom */
import { readFileSync } from 'node:fs';
import { jest } from '@jest/globals';
import { ParcoursGlossary } from '../../../../lib/parcours/ParcoursGlossary.js';
import { chapters } from './chapters.js';

const source = JSON.parse(readFileSync(new URL('../glossary.json', import.meta.url), 'utf8'));

test('tous les termes marqués ont une infobulle accessible, acronymes compris', async () => {
  const glossary = new ParcoursGlossary('anatomie-llm', '../../');
  glossary.terms = source.terms;
  const warning = jest.spyOn(console, 'warn');
  document.body.innerHTML = chapters.map(chapter => {
    const html = readFileSync(new URL(`../slides/${chapter.id}/index.html`, import.meta.url), 'utf8');
    return new DOMParser().parseFromString(html, 'text/html').querySelector('main').innerHTML;
  }).join('');
  glossary.attachTooltips(document.body);
  const terms = [...document.querySelectorAll('dfn')];
  expect(terms.length).toBeGreaterThan(100);
  for (const term of terms) {
    expect(term.getAttribute('tabindex')).toBe('0');
    const key = term.dataset.term || term.textContent;
    expect(glossary.get(key)?.short).toBeTruthy();
    term.focus();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const tooltip = document.querySelector('#glossary-tooltip');
    expect(tooltip.textContent).toContain(glossary.get(key).short);
    expect(tooltip.style.opacity).toBe('1');
    term.blur();
  }
  expect(warning).not.toHaveBeenCalled();
  glossary.detachTooltips();
  warning.mockRestore();
});
