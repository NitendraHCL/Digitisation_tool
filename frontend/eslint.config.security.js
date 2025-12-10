import js from '@eslint/js';
import react from 'eslint-plugin-react';
import security from 'eslint-plugin-security';
import noSecrets from 'eslint-plugin-no-secrets';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      react,
      security,
      'no-secrets': noSecrets,
      '@typescript-eslint': tseslint
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        React: 'readonly',
        navigator: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        HTMLElement: 'readonly',
        HTMLIFrameElement: 'readonly',
        HTMLInputElement: 'readonly',
        URLSearchParams: 'readonly',
        test: 'readonly',
        expect: 'readonly'
      }
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      // React Security Rules
      'react/no-danger': 'error',
      'react/no-danger-with-children': 'error',
      'react/jsx-no-script-url': 'error',
      'react/jsx-no-target-blank': ['error', { enforceDynamicLinks: 'always' }],

      // Security Plugin Rules
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-pseudoRandomBytes': 'error',

      // TypeScript Security Rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'off', // Too noisy
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],

      // No Secrets Plugin
      'no-secrets/no-secrets': [
        'error',
        {
          tolerance: 4.5,
          additionalRegexes: {
            'OpenAI API Key': 'sk-[a-zA-Z0-9]{48}',
            'Google API Key': 'AIza[0-9A-Za-z\\-_]{35}',
            'JWT Token': 'eyJ[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+'
          }
        }
      ],

      // Built-in Security Rules
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error'
    }
  },
  {
    // Test file overrides
    files: ['**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    // Ignore patterns
    ignores: [
      'node_modules/**',
      'build/**',
      'dist/**',
      'coverage/**',
      '*.config.js',
      'eslint-security-report.html',
      'public/**',
      'src/serviceWorker.ts',
      'src/reportWebVitals.ts'
    ]
  }
];
