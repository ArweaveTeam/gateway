module.exports = {
  'env': {
    'es2021': true,
    'node': true,
  },
  'extends': [
    'standard',
    'google',
  ],
  'parser': '@typescript-eslint/parser',
  'parserOptions': {
    'ecmaVersion': 12,
    'sourceType': 'module',
  },
  'plugins': [
    '@typescript-eslint',
  ],
  'rules': {
    'require-jsdoc': 0,
    'valid-jsdoc': 0,
    'max-len': 0,
    'no-async-promise-executor': 0,
    'prefer-promise-reject-errors': 0,
    'camelcase': 0,
  },
};
