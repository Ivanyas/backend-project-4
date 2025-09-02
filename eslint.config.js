import globals from 'globals';
import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import jestPlugin from 'eslint-plugin-jest';

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  
  js.configs.recommended,
  
  {
    files: ['**/*.js'],
    plugins: {
      import: importPlugin,
      jest: jestPlugin,
    },
    rules: {
      'import/no-unresolved': 'error',
      'import/extensions': ['error', 'ignorePackages', { js: 'always' }],
      'import/prefer-default-export': 'off',
      
      'no-console': 'off',
      'no-unused-disable-directives': 'off',
      'no-underscore-dangle': [
        'error',
        { allow: ['__filename', '__dirname'] },
      ],
      
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/expect-expect': 'error',
      'jest/no-done-callback': 'error',
    },
  },
  
  {
    files: ['**/*.test.js', '**/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
    rules: {
      'jest/no-disabled-tests': 'off',
    },
  },
];
