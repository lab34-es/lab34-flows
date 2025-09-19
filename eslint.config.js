const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      'frontend/**',
      'dist/**',
      'build/**',
      '*.min.js',
      'coverage/**'
    ]
  },
  
  // Base configuration for all JS files
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      
      // Error prevention
      'no-console': 'off', // Allow console.log in Node.js
      'no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-undef': 'error',
      'no-unreachable': 'error',
      
      // Best practices
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
      
      // Code style
      'indent': ['error', 2, { SwitchCase: 1 }],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'space-before-function-paren': ['error', {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always'
      }],
      'max-len': ['error', { 
        code: 120,
        ignoreComments: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true
      }],
      
      // Node.js specific
      'no-process-exit': 'off',
      'callback-return': 'off',
      'global-require': 'off',
      'handle-callback-err': 'error'
    }
  },
  
  // Test files specific configuration
  {
    files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
    rules: {
      'no-unused-expressions': 'off' // Often used in test assertions
    }
  }
];
