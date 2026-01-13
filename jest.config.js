/**
 * Configuration Jest pour Playlab42
 *
 * Conventions de tests :
 * - lib/module.test.js : Tests pour lib/module.js (pattern plat)
 * - lib/module/__tests__/*.test.js : Tests pour modules complexes
 * - games/[id]/engine.test.js : Tests pour les moteurs de jeux
 * - tools/[id]/__tests__/*.test.js : Tests pour les tools complexes
 * - scripts/*.test.js : Tests pour les scripts de build
 *
 * @see docs/TESTING.md (à créer)
 */

export default {
  // Environnement de test
  testEnvironment: 'node',

  // Pattern de découverte des fichiers de test
  testMatch: [
    '**/lib/**/*.test.js',
    '**/games/**/*.test.js',
    '**/tools/**/*.test.js',
    '**/scripts/**/*.test.js',
  ],

  // Fichiers à ignorer
  testPathIgnorePatterns: [
    '/node_modules/',
    '/data/',
  ],

  // Transformation pour ES modules
  transform: {},

  // Extensions à considérer
  moduleFileExtensions: ['js', 'mjs', 'json'],

  // Timeout par défaut (10 secondes)
  testTimeout: 10000,

  // Affichage verbose
  verbose: true,

  // Collecter la couverture depuis ces dossiers
  collectCoverageFrom: [
    'lib/**/*.js',
    'games/**/engine.js',
    'tools/**/src/**/*.js',
    'scripts/**/*.js',
    '!**/*.test.js',
    '!**/node_modules/**',
  ],

  // Seuils de couverture (optionnel, à activer progressivement)
  // coverageThreshold: {
  //   global: {
  //     branches: 50,
  //     functions: 50,
  //     lines: 50,
  //     statements: 50,
  //   },
  // },

  // Mapping de modules pour les imports spéciaux (ex: CDN -> mock)
  moduleNameMapper: {
    '^three$': '<rootDir>/tools/__mocks__/three.js',
    '^three/addons/(.*)$': '<rootDir>/tools/__mocks__/three-addons.js',
    '^lil-gui$': '<rootDir>/tools/__mocks__/lil-gui.js',
  },
};
