import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { globals: globals.node },
    rules: {
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
  { files: ['src/**/*.js', 'tests/browser/**/*.js'], languageOptions: { globals: globals.browser } },
];
