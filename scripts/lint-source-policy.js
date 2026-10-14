export const sourceIgnores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/coverage/**',
  'test-results/**',
  'playwright-report/**',
  'data/**',
  'assets/vendor/**',
  'vendor/**',
  'docs/site/**',
  'site/**',
  // Fork tiers et distributions générées ; ses tests dédiés utilisent node:test.
  'parcours/epics/anatomie-llm/transformer-explainer/.source/**',
  'parcours/epics/anatomie-llm/transformer-explainer/.source/.*',
  'parcours/epics/anatomie-llm/transformer-explainer/public/**',
];
