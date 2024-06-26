// Override GJS, GNOME Shell and prettier config options here

export default [
    {
        files: ['src/**'],
        ignores: ['src/prefs**'],
        languageOptions: {
            globals: {
                global: 'readonly',
                _: 'readonly',
                C_: 'readonly',
                N_: 'readonly',
                ngettext: 'readonly',
            },
        },
    },
    {
        files: ['src/prefs**'],
        languageOptions: {
            globals: {
                _: 'readonly',
                C_: 'readonly',
                N_: 'readonly',
            },
        },
    },
];
