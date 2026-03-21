/**
 * Configuration ESLint pour Playlab42
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 */

import js from '@eslint/js';
import globals from 'globals';

export default [
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
      'no-return-await': 'error',
      'require-await': 'error',

      // === ES6+ ===
      'arrow-spacing': 'error',
      'no-duplicate-imports': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
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

  // Fichiers ignorés
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'data/**',
      'games/**/index.html',
    ],
  },
];
