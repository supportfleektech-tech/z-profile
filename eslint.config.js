import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts', 'vitest.config.ts'],
  })),
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts', 'vitest.config.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { args: 'all', argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.d.ts'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['server/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': ['error', { args: 'all', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
