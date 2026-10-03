import security from 'eslint-plugin-security';
import noUnsanitized from 'eslint-plugin-no-unsanitized';
import globals from 'globals';
import html from 'eslint-plugin-html';
import { sourceIgnores } from './scripts/lint-source-policy.js';

export default [
  {
    ignores: sourceIgnores,
  },
  {
    files: ['**/*.html'],
    plugins: { html },
  },
  {
    files: ['**/*.{js,mjs,cjs,html}'],
    // Les directives de qualité existantes ne sont pas des diagnostics de sécurité.
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    plugins: {
      security,
      'no-unsanitized': noUnsanitized,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-bidi-characters': 'error',
      'no-unsanitized/method': 'error',
    },
  },
];
