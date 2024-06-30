import customConfig from './lint/eslintrc-custom.config.js';
import eslintConfigPrettier from 'eslint-config-prettier';
import gjsConfig from './lint/eslintrc-gjs.config.js';
import gnomeShellConfig from './lint/eslintrc-shell.config.js';

export default [
    ...gjsConfig,
    ...gnomeShellConfig,
    eslintConfigPrettier,
    ...customConfig,
];
