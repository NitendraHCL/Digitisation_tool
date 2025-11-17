import js from '@eslint/js';
import security from 'eslint-plugin-security';
import noSecrets from 'eslint-plugin-no-secrets';

export default [
  js.configs.recommended,
  {
    plugins: {
      security,
      'no-secrets': noSecrets
    },
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        global: 'readonly'
      }
    },
    rules: {
      // ESLint Security Plugin Rules
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-fs-filename': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'error',

      // No Secrets Plugin Rules
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
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-proto': 'error',
      'no-script-url': 'error',
      'no-with': 'error'
    }
  },
  {
    // Test file overrides
    files: ['**/*.test.js', '**/*.spec.js', 'test/**/*.js'],
    rules: {
      'no-console': 'off',
      'security/detect-non-literal-fs-filename': 'off'
    }
  },
  {
    // Ignore patterns
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '*.config.js',
      'eslint-security-report.html'
    ]
  }
];
