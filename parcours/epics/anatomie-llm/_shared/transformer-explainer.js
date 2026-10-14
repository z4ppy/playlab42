/**
 * Propose le laboratoire dans un nouvel onglet, sans le charger dans le cours.
 * @param {HTMLElement} root Surface du chapitre.
 * @param {{signal?: AbortSignal}} [options] Annulation du montage du lien.
 */
export function transformerExplainer(root, { signal } = {}) {
  const theme = root?.ownerDocument?.documentElement?.dataset.theme === 'dark' ? 'dark' : 'light';
  return mountTransformerExplainer(root, { theme, signal });
}

/**
 * Monte uniquement un lien : aucun iframe, téléchargement ou session de calcul.
 * @param {HTMLElement} container Surface du chapitre.
 * @param {{theme?: 'light'|'dark', url?: string|URL, signal?: AbortSignal}} [options] Thème, URL et annulation.
 */
export async function mountTransformerExplainer(container, { theme = 'light', url, signal } = {}) {
  if (!(container instanceof HTMLElement)) { throw new TypeError('Conteneur HTML requis.'); }
  signal?.throwIfAborted();
  if (container.isConnected === false) { throw new DOMException('Conteneur du laboratoire détaché.', 'AbortError'); }
  const target = new URL(url || '../transformer-explainer/public/index.html', import.meta.url);
  const origin = new URL(import.meta.url);
  if (target.origin !== origin.origin || target.protocol !== origin.protocol) {
    throw new TypeError('Le laboratoire doit être hébergé sur la même origine que le parcours.');
  }
  target.searchParams.set('theme', theme === 'dark' ? 'dark' : 'light');
  const link = container.ownerDocument.createElement('a');
  link.className = 'gpt2-lab-link';
  link.href = target.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Ouvrir le laboratoire GPT-2 dans un nouvel onglet ↗';
  container.append(link);
  let destroyed = false;
  function destroy() {
    if (destroyed) { return; }
    destroyed = true;
    signal?.removeEventListener('abort', destroy);
    link.remove();
  }
  signal?.addEventListener('abort', destroy, { once: true });
  await Promise.resolve();
  if (signal?.aborted || container.isConnected === false) {
    destroy();
    signal?.throwIfAborted();
    throw new DOMException('Conteneur du laboratoire détaché.', 'AbortError');
  }
  return { link, capabilities: transformerExplainerCapabilities, destroy };
}

export const transformerExplainerCapabilities = Object.freeze({
  model: 'gpt2-small-124m',
  tokenizer: 'gpt2-byte-level-bpe',
  integration: 'new-tab',
  explicitConsent: true,
  staticLocalWeights: true,
  offlineGuaranteed: false,
  tokenizerAssets: Object.freeze({
    json: new URL('../transformer-explainer/public/tokenizer/tokenizer.json', import.meta.url).href,
    config: new URL('../transformer-explainer/public/tokenizer/tokenizer_config.json', import.meta.url).href,
  }),
  interactive: Object.freeze(['prompt', 'tokens', 'attention', 'heads', 'blocks', 'temperature', 'top-k', 'top-p']),
  programmatic: Object.freeze({ tokenize: false, inference: false, tensors: false }),
});
