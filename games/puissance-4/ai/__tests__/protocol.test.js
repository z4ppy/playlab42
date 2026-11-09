/**
 * Protocole du worker, testé hors navigateur : validation des messages,
 * coups des bots par niveau et reproductibilité via l'état du RNG.
 */

import { SeededRandom } from '../../../../lib/seeded-random.js';
import { jsonCopy } from '../../../../lib/__tests__/engine-contract-helpers.js';
import { EVALUATION_BUDGET, handleAiRequest } from '../protocol.js';
import { stateAfter } from './helpers.js';

const view = () => jsonCopy(stateAfter('44'));

describe('requêtes « analyze »', () => {
  it('analyse la vue avec le budget léger par défaut ou celui demandé', () => {
    const response = handleAiRequest({ id: 1, kind: 'analyze', view: stateAfter('4433') });
    expect(response).toMatchObject({ id: 1, ok: true, analysis: { forced: { winner: 'self', inMoves: 2 } } });
    expect(EVALUATION_BUDGET.maxNodes).toBeGreaterThan(0);
    const limited = handleAiRequest({ id: 2, kind: 'analyze', view: view(), budget: { maxDepth: 2 } });
    expect(limited.analysis.depth).toBe(2);
  });

  it('accepte un budget null comme « budget par défaut »', () => {
    const response = handleAiRequest({ id: 2, kind: 'analyze', view: stateAfter('112237'), budget: null });
    expect(response).toMatchObject({ ok: true, analysis: { column: 3 } });
  });

  it('produit une réponse entièrement sérialisable (structured clone / JSON)', () => {
    const response = handleAiRequest({ id: 3, kind: 'analyze', view: view(), budget: { maxNodes: 5_000 } });
    expect(jsonCopy(response)).toEqual(response);
  });
});

describe('requêtes « move »', () => {
  it.each(['facile', 'moyen', 'difficile', 'expert'])('le niveau %s renvoie un coup légal et le nouvel état du RNG', (level) => {
    const response = handleAiRequest({ id: 7, kind: 'move', view: view(), level, rngState: 42 });
    expect(response.ok).toBe(true);
    expect(response.action).toEqual({ type: 'drop', column: expect.any(Number) });
    expect(Number.isInteger(response.rngState)).toBe(true);
  });

  it('est reproductible : même vue et même état du RNG, même coup', () => {
    const request = { id: 8, kind: 'move', view: view(), level: 'facile', rngState: new SeededRandom(99).getState() };
    const first = handleAiRequest(request);
    expect(handleAiRequest(request)).toEqual(first);
    expect(first.rngState).not.toBe(request.rngState);
  });

  it('joint l\'analyse pour les niveaux qui cherchent', () => {
    const response = handleAiRequest({ id: 9, kind: 'move', view: stateAfter('4433'), level: 'expert', rngState: 1 });
    expect([1, 4]).toContain(response.action.column);
    expect(response.analysis.reason.code).toBe('double-threat');
    expect(handleAiRequest({ id: 10, kind: 'move', view: view(), level: 'moyen', rngState: 1 }).analysis).toBeUndefined();
  });
});

describe('requêtes invalides', () => {
  const badBoard = view();
  badBoard.board[0][0] = 'red';
  const unknownColor = view();
  unknownColor.board[5][0] = 'green';
  const over = stateAfter('1212121');

  it.each([
    ['sans identifiant', { kind: 'analyze', view: view() }, null, /inconnue/],
    ['type inconnu', { id: 1, kind: 'solve', view: view() }, 1, /inconnue/],
    ['type hérité', { id: 1, kind: 'toString', view: view() }, 1, /inconnue/],
    ['message vide', null, null, /inconnue/],
    ['vue absente', { id: 2, kind: 'analyze' }, 2, /Vue de partie invalide/],
    ['grille tronquée', { id: 2, kind: 'analyze', view: { ...view(), board: [] } }, 2, /Vue de partie invalide/],
    ['jeton en l\'air', { id: 2, kind: 'analyze', view: badBoard }, 2, /Vue de partie invalide/],
    ['couleur inconnue', { id: 2, kind: 'analyze', view: unknownColor }, 2, /Vue de partie invalide/],
    ['joueur sans couleur', { id: 2, kind: 'analyze', view: { ...view(), currentPlayerId: 'x' } }, 2, /Vue de partie invalide/],
    ['partie terminée', { id: 3, kind: 'analyze', view: over }, 3, /terminée/],
    ['budget négatif', { id: 4, kind: 'analyze', view: view(), budget: { maxNodes: -1 } }, 4, /Budget/],
    ['niveau inconnu', { id: 5, kind: 'move', view: view(), level: 'divin', rngState: 1 }, 5, /Niveau/],
    ['RNG absent', { id: 6, kind: 'move', view: view(), level: 'facile' }, 6, /Niveau/],
  ])('refuse proprement : %s', (_label, request, id, message) => {
    const response = handleAiRequest(request);
    expect(response).toEqual({ id, ok: false, error: expect.stringMatching(message) });
  });
});
