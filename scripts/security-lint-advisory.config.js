import securityConfig from '../eslint.security.config.js';

export default [
  ...securityConfig,
  {
    files: ['**/*.{js,mjs,cjs,html}'],
    rules: {
      'no-unsanitized/property': 'warn',
      'security/detect-unsafe-regex': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-child-process': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
    },
  },
];
