/**
 * Tests unitaires pour openspec-guide.js (DOM factice minimal, sans jsdom).
 * Les boutons étant natifs, Entrée/Espace déclenchent l'évènement `click` :
 * simuler `click` couvre donc l'interaction clavier.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  READY_ATTR,
  MESSAGES,
  copyText,
  initCopyButtons,
  initQuiz,
  initQuizzes,
  initOpenSpecGuide,
} from '../parcours/epics/openspec-usage-guide/openspec-guide.js';

/** Élément DOM factice. */
class FakeElement {
  constructor(tag, text = '') {
    this.tag = tag;
    this.attrs = {};
    this.children = [];
    this.listeners = {};
    this.parentNode = null;
    this.className = '';
    this.textContent = text;
  }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  async click() { await Promise.all((this.listeners.click || []).map((fn) => fn())); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  insertBefore(child, ref) {
    child.parentNode = this;
    this.children.splice(this.children.indexOf(ref), 0, child);
    return child;
  }
  descendants() { return this.children.flatMap((c) => [c, ...c.descendants()]); }
  querySelectorAll(selector) {
    const attr = /^\[([\w-]+)\]$/.exec(selector);
    return this.descendants().filter((el) => (attr ? attr[1] in el.attrs : el.tag === selector));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

const fakeDocument = () => {
  const body = new FakeElement('body');
  return Object.assign(body, { createElement: (tag) => new FakeElement(tag) });
};

const addCodeBlock = (doc, text) => {
  const pre = new FakeElement('pre');
  pre.appendChild(new FakeElement('code', text));
  doc.appendChild(pre);
  return pre;
};

const addQuiz = (doc) => {
  const quiz = new FakeElement('div');
  quiz.setAttribute('data-guide-quiz', '');
  const good = new FakeElement('button');
  good.setAttribute('data-guide-answer', 'correct');
  good.setAttribute('data-guide-explanation', 'Parce que.');
  const bad = new FakeElement('button');
  bad.setAttribute('data-guide-answer', 'incorrect');
  quiz.appendChild(good);
  quiz.appendChild(bad);
  doc.appendChild(quiz);
  return { quiz, good, bad };
};

describe('copyText', () => {
  it('copie et signale le succès', async () => {
    const written = [];
    const result = await copyText('abc', { writeText: (t) => { written.push(t); return Promise.resolve(); } });
    expect(written).toEqual(['abc']);
    expect(result).toEqual({ ok: true, message: MESSAGES.copied });
  });

  it('signale explicitement un refus du presse-papiers', async () => {
    const result = await copyText('abc', { writeText: () => Promise.reject(new Error('denied')) });
    expect(result).toEqual({ ok: false, message: MESSAGES.copyFailed });
  });

  it('signale l\'absence de presse-papiers', async () => {
    expect((await copyText('abc', undefined)).message).toBe(MESSAGES.copyUnavailable);
    expect((await copyText('abc', {})).ok).toBe(false);
  });
});

describe('initCopyButtons', () => {
  let doc;
  beforeEach(() => { doc = fakeDocument(); });

  it('ajoute un bouton natif avec zone aria-live avant chaque pre>code', () => {
    const pre = addCodeBlock(doc, 'openspec list');
    expect(initCopyButtons(doc, { document: doc })).toBe(1);
    const bar = doc.children[0];
    expect(doc.children[1]).toBe(pre);
    const [button, status] = bar.children;
    expect(button.tag).toBe('button');
    expect(button.getAttribute('type')).toBe('button');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('role')).toBe('status');
  });

  it('ignore les pre sans code', () => {
    doc.appendChild(new FakeElement('pre', 'texte'));
    expect(initCopyButtons(doc, { document: doc })).toBe(0);
  });

  it('est idempotent', () => {
    addCodeBlock(doc, 'x');
    initCopyButtons(doc, { document: doc });
    expect(initCopyButtons(doc, { document: doc })).toBe(0);
    expect(doc.querySelectorAll('button')).toHaveLength(1);
  });

  it('ne copie rien sans action utilisateur', () => {
    addCodeBlock(doc, 'x');
    let calls = 0;
    initCopyButtons(doc, { document: doc, clipboard: { writeText: () => { calls += 1; return Promise.resolve(); } } });
    expect(calls).toBe(0);
  });

  it('copie au clic et annonce le succès', async () => {
    addCodeBlock(doc, 'openspec archive');
    const written = [];
    initCopyButtons(doc, { document: doc, clipboard: { writeText: (t) => { written.push(t); return Promise.resolve(); } } });
    const [button, status] = doc.children[0].children;
    await button.click();
    expect(written).toEqual(['openspec archive']);
    expect(status.textContent).toBe(MESSAGES.copied);
    expect(status.getAttribute('data-state')).toBe('success');
  });

  it('annonce l\'échec au clic', async () => {
    addCodeBlock(doc, 'x');
    initCopyButtons(doc, {
      document: doc,
      clipboard: { writeText: () => Promise.reject(new Error('no')) },
    });
    const [button, status] = doc.children[0].children;
    await button.click();
    expect(status.textContent).toBe(MESSAGES.copyFailed);
    expect(status.getAttribute('data-state')).toBe('error');
  });

  it('annonce l\'absence de clipboard au clic', async () => {
    addCodeBlock(doc, 'x');
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
    try {
      initCopyButtons(doc, { document: doc, clipboard: null });
      const [button, status] = doc.children[0].children;
      await button.click();
      expect(status.textContent).toBe(MESSAGES.copyUnavailable);
    } finally {
      if (original) { Object.defineProperty(globalThis, 'navigator', original); }
      else { delete globalThis.navigator; }
    }
  });

  it('retourne 0 sans racine ou document', () => {
    expect(initCopyButtons(null, { document: doc })).toBe(0);
  });
});

describe('initQuiz', () => {
  let doc;
  beforeEach(() => { doc = fakeDocument(); });

  it('crée la zone de résultat accessible', () => {
    const { quiz } = addQuiz(doc);
    expect(initQuiz(quiz, doc)).toBe(true);
    const result = quiz.querySelector('[data-guide-quiz-result]');
    expect(result.getAttribute('role')).toBe('status');
    expect(result.getAttribute('aria-live')).toBe('polite');
  });

  it('réutilise la zone de résultat existante', () => {
    const { quiz } = addQuiz(doc);
    const existing = new FakeElement('p');
    existing.setAttribute('data-guide-quiz-result', '');
    quiz.appendChild(existing);
    initQuiz(quiz, doc);
    expect(quiz.querySelectorAll('[data-guide-quiz-result]')).toHaveLength(1);
  });

  it('affiche bonne réponse avec explication', async () => {
    const { quiz, good } = addQuiz(doc);
    initQuiz(quiz, doc);
    await good.click();
    const result = quiz.querySelector('[data-guide-quiz-result]');
    expect(result.textContent).toBe(`${MESSAGES.correct} Parce que.`);
    expect(result.getAttribute('data-state')).toBe('success');
    expect(good.getAttribute('aria-pressed')).toBe('true');
  });

  it('affiche mauvaise réponse et permet de rejouer', async () => {
    const { quiz, good, bad } = addQuiz(doc);
    initQuiz(quiz, doc);
    const result = quiz.querySelector('[data-guide-quiz-result]');
    await bad.click();
    expect(result.textContent).toBe(MESSAGES.incorrect);
    expect(result.getAttribute('data-state')).toBe('error');
    await good.click();
    expect(result.getAttribute('data-state')).toBe('success');
    expect(bad.getAttribute('aria-pressed')).toBe('false');
  });

  it('est idempotent (un seul écouteur par bouton)', () => {
    const { quiz, good } = addQuiz(doc);
    expect(initQuiz(quiz, doc)).toBe(true);
    expect(initQuiz(quiz, doc)).toBe(false);
    expect(good.listeners.click).toHaveLength(1);
  });

  it('ignore un quiz sans réponses ou une valeur nulle', () => {
    expect(initQuiz(null, doc)).toBe(false);
    expect(initQuiz(new FakeElement('div'), doc)).toBe(false);
  });
});

describe('initQuizzes et initOpenSpecGuide', () => {
  it('initialise tous les quiz et copies, de façon idempotente', () => {
    const doc = fakeDocument();
    addQuiz(doc);
    addQuiz(doc);
    addCodeBlock(doc, 'x');
    expect(initOpenSpecGuide(doc)).toEqual({ copyButtons: 1, quizzes: 2 });
    expect(initOpenSpecGuide(doc)).toEqual({ copyButtons: 0, quizzes: 0 });
    expect(doc.children.some((c) => c.getAttribute(READY_ATTR) === 'quiz')).toBe(true);
  });

  it('est sans effet sans document', () => {
    expect(initQuizzes(null, null)).toBe(0);
    expect(initOpenSpecGuide(null)).toEqual({ copyButtons: 0, quizzes: 0 });
  });
});
