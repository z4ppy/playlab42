/**
 * Configuration Jest pour Playlab42
 *
 * Conventions de tests :
 * - app/module.test.js : Tests pour app/module.js (nécessitent jsdom, déclaré
 *   par un docblock `@jest-environment jsdom` en tête de fichier)
 * - lib/module.test.js : Tests pour lib/module.js (pattern plat)
 * - lib/module/__tests__/*.test.js : Tests pour modules complexes
 * - games/[id]/engine.test.js : Tests pour les moteurs de jeux
 * - tools/[id]/__tests__/*.test.js : Tests pour les tools complexes
 * - parcours/.../module.test.js : Tests des interactions et styles pédagogiques
 * - scripts/*.test.js : Tests pour les scripts de build
 *
 * Supporte JavaScript (.js) et TypeScript (.ts)
 *
 * @see docs/TESTING.md (à créer)
 */

export default {
  // Environnement de test
  testEnvironment: 'node',

  // Resolver personnalisé pour gérer les imports .js -> .ts
  resolver: './jest.resolver.cjs',

  // Pattern de découverte des fichiers de test (JS et TS)
  testMatch: [
    '**/app/**/*.test.{js,ts}',
    '**/lib/**/*.test.{js,ts}',
    '**/games/**/*.test.{js,ts}',
    '**/tools/**/*.test.{js,ts}',
    '**/parcours/**/*.test.{js,ts}',
    '**/scripts/**/*.test.{js,ts}',
  ],

  // Fichiers à ignorer
  testPathIgnorePatterns: [
    '/node_modules/',
    '/data/',
    '/dist/',
    '/assets/vendor/',
  ],
  modulePathIgnorePatterns: ['<rootDir>/assets/vendor/'],

  // Transformation : esbuild pour TypeScript (transpilation seule, sans
  // vérification de types ; celle-ci est assurée par `npm run typecheck`)
  transform: {
    '^.+\\.ts$': './jest.transform.cjs',
  },

  // Traiter les .ts comme des modules ES natifs
  // Le "type": "module" du package.json ne couvre que les .js ; sans cette
  // ligne Jest chargerait les .ts transpilés comme du CommonJS et échouerait
  // sur « Cannot use import statement outside a module ».
  extensionsToTreatAsEsm: ['.ts'],

  // Ne pas ignorer les fichiers ESM locaux (lib/*.js, games/*.js)
  // Par défaut Jest ignore node_modules ; on garde ce comportement
  // mais on s'assure que les sources locales .js sont bien traitées en ESM natif
  transformIgnorePatterns: ['/node_modules/'],

  // Extensions à considérer
  moduleFileExtensions: ['js', 'mjs', 'ts', 'json'],

  // Timeout par défaut (10 secondes)
  testTimeout: 10000,

  // Affichage verbose
  verbose: true,

  // Collecter la couverture depuis ces dossiers
  collectCoverageFrom: [
    'app/**/*.{js,ts}',
    'lib/**/*.{js,ts}',
    'games/**/engine.{js,ts}',
    'tools/**/src/**/*.{js,ts}',
    'scripts/**/*.js',
    '!**/*.test.{js,ts}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],

  coverageThreshold: {
    './lib/seeded-random.js': { branches: 100, functions: 100, lines: 100, statements: 100 },
    './scripts/build-site.js': { branches: 80, functions: 100, lines: 80, statements: 80 },
    './scripts/check-deployment.js': { branches: 80, functions: 100, lines: 80, statements: 80 },
  },

  // Mapping de modules pour les imports spéciaux (ex: CDN -> mock)
  moduleNameMapper: {
    // Mocks pour les librairies CDN
    '^three$': '<rootDir>/tools/__mocks__/three.js',
    '^three/addons/(.*)$': '<rootDir>/tools/__mocks__/three-addons.js',
    '^lil-gui$': '<rootDir>/tools/__mocks__/lil-gui.js',
  },
};
