import globals from 'globals';
import pluginJs from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import jestPlugin from 'eslint-plugin-jest';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Глобальные переменные Node.js
        process: 'readonly',
        console: 'readonly',
        __filename: 'readonly',
        __dirname: 'readonly',

        // Глобальные переменные Jest
        beforeEach: 'readonly',
        beforeAll: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        jest: 'readonly',
      },
    },
    plugins: {
      import: importPlugin,
      jest: jestPlugin,
    },
    rules: {
      'import/no-unresolved': 'error',
      'no-unused-disable-directives': 'off',
      'import/extensions': ['error', 'ignorePackages', { js: 'always' }],
      'import/prefer-default-export': 'off',
      'no-console': 'off',
      'no-underscore-dangle': [
        'error',
        { allow: ['__filename', '__dirname'] },
      ],
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
    },
  },
];
