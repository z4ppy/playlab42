/**
 * Configuration ESLint pour Playlab42
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 */

import js from '@eslint/js';
import globals from 'globals';
import html from 'eslint-plugin-html';
import { sourceIgnores } from './scripts/lint-source-policy.js';

export default [
  { ignores: sourceIgnores },
  // Configuration de base recommandée
  js.configs.recommended,

  // Configuration globale
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // === Qualité du code ===
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off', // Autorisé pour le debug
      'prefer-const': 'error',
      'no-var': 'error',

      // === Style ===
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'indent': ['error', 2, { SwitchCase: 1 }],
      'comma-dangle': ['error', 'always-multiline'],
      'eol-last': ['error', 'always'],
      'no-trailing-spaces': 'error',
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],

      // === Bonnes pratiques ===
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-return-await': 'error',
      'require-await': 'error',

      // === ES6+ ===
      'arrow-spacing': 'error',
      'no-duplicate-imports': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
    },
  },

  {
    files: ['**/*.html'],
    plugins: { html },
  },

  {
    // Ces supports utilisent quatre espaces dans leurs scripts embarqués.
    files: [
      'games/go-9x9/**/*.html',
      'parcours/_shared/templates/**/*.html',
      'parcours/epics/algorithm-complexity/**/*.html',
      'parcours/epics/as-code-paradigm/**/*.html',
      'parcours/epics/deep-learning-intro/**/*.html',
    ],
    rules: {
      indent: ['error', 4, { SwitchCase: 1 }],
    },
  },

  {
    files: ['tools/neural-style.html'],
    languageOptions: {
      globals: { mi: 'readonly' },
    },
  },

  {
    files: ['scripts/og-fetcher.js', 'scripts/lib/build-utils.js'],
    rules: {
      complexity: ['error', 10],
    },
  },

  {
    files: [
      'games/checkers/engine.js',
      'games/go-9x9/engine.js',
      'games/tetris/engine.js',
      'games/tetris/engine/**/*.js',
      'app/keyboard-commands.js',
      'app/game-messages.js',
      'app/game-loader.js',
      'lib/parcours-viewer.js',
      'lib/parcours/ParcoursUI.js',
      'lib/parcours/{events,keyboard,loading,slide-messages}.js',
      'lib/local-data.js',
      'lib/local-data/**/*.js',
      'games/diese-et-mat/src/engine/ExerciseEngine.js',
      'games/diese-et-mat/src/engine/ProgressTracker.js',
    ],
    ignores: ['**/*.test.js'],
    rules: {
      complexity: ['error', 10],
    },
  },

  // Configuration spécifique pour les tests
  {
    files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      'no-unused-vars': 'off', // Flexibilité dans les tests
    },
  },

];
