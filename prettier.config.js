/** @type {import("prettier").Config} */
export default {
    tabWidth: 4,
    singleQuote: true,
    bracketSpacing: false,
    experimentalTernaries: true,
    overrides: [
        {
            files: ['*.json', '*.yml', '*.yaml'],
            options: {
                tabWidth: 2,
            },
        },
    ],
};
