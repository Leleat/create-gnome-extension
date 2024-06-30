#!/usr/bin/env node

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';
import {parseArgs} from 'node:util';
import readline from 'readline';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const FAINT = '\x1b[2m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[92m';

const PROJECT_INFO = await parseCliArguments({
    'target-dir': {type: 'string'},
    'project-name': {type: 'string'},
    description: {type: 'string'},
    'version-name': {type: 'string'},
    license: {type: 'string'},
    'home-page': {type: 'string'},
    uuid: {type: 'string'},
    'gettext-domain': {type: 'string'},
    'settings-schema': {type: 'string'},
    'shell-version': {type: 'string'},
    'use-typescript': {type: 'boolean'},
    'no-use-typescript': {type: 'boolean'},
    'use-esbuild': {type: 'boolean'},
    'no-use-esbuild': {type: 'boolean'},
    'use-eslint': {type: 'boolean'},
    'no-use-eslint': {type: 'boolean'},
    'use-prettier': {type: 'boolean'},
    'no-use-prettier': {type: 'boolean'},
    'use-types': {type: 'boolean'},
    'no-use-types': {type: 'boolean'},
    'use-translations': {type: 'boolean'},
    'no-use-translations': {type: 'boolean'},
    'use-prefs': {type: 'boolean'},
    'no-use-prefs': {type: 'boolean'},
    'use-prefs-window': {type: 'boolean'},
    'no-use-prefs-window': {type: 'boolean'},
    'use-stylesheet': {type: 'boolean'},
    'no-use-stylesheet': {type: 'boolean'},
    'use-resources': {type: 'boolean'},
    'no-use-resources': {type: 'boolean'},
});

await queryMissingProjectInfo();

const TEMPLATE_PATH = path.resolve(import.meta.dirname, 'template');
const TEMPLATE_LANG_DIR = PROJECT_INFO['use-typescript']
    ? 'template.ts'
    : 'template.js';
const [METADATA_JSON, PACKAGE_JSON, TSCONFIG_JSON] = await Promise.all([
    fs
        .readFile(path.join(TEMPLATE_PATH, 'metadata.json'), 'utf-8')
        .then(JSON.parse),
    fs
        .readFile(
            path.join(TEMPLATE_PATH, TEMPLATE_LANG_DIR, 'package.json'),
            'utf-8',
        )
        .then(JSON.parse),
    fs
        .readFile(
            path.join(TEMPLATE_PATH, 'template.ts', 'tsconfig.json'),
            'utf-8',
        )
        .then(JSON.parse),
]);

METADATA_JSON['name'] = PROJECT_INFO['project-name'];
METADATA_JSON['description'] = PROJECT_INFO['description'];
METADATA_JSON['uuid'] = PROJECT_INFO['uuid'];
METADATA_JSON['shell-version'] = PROJECT_INFO['shell-version'];

if (PROJECT_INFO['version-name']) {
    METADATA_JSON['version-name'] = PROJECT_INFO['version-name'];
}

if (PROJECT_INFO['home-page']) {
    METADATA_JSON['url'] = PROJECT_INFO['home-page'];
}

await Promise.all([
    fs.mkdir(path.join(PROJECT_INFO['target-dir'], 'src'), {recursive: true}),
    fs.mkdir(path.join(PROJECT_INFO['target-dir'], 'scripts'), {
        recursive: true,
    }),
]);

if (PROJECT_INFO['use-eslint']) {
    if (!PROJECT_INFO['use-typescript']) {
        await fs.cp(
            path.join(TEMPLATE_PATH, 'template.js', 'lint'),
            path.join(PROJECT_INFO['target-dir'], 'lint'),
            {recursive: true},
        );
    }

    await fs.copyFile(
        path.join(TEMPLATE_PATH, TEMPLATE_LANG_DIR, 'eslint.config.js'),
        path.join(PROJECT_INFO['target-dir'], 'eslint.config.js'),
    );
} else {
    delete PACKAGE_JSON.scripts['check:lint'];
    delete PACKAGE_JSON.devDependencies['@eslint/js'];
    delete PACKAGE_JSON.devDependencies['eslint'];
    delete PACKAGE_JSON.devDependencies['globals'];

    // JavaScript-specific
    delete PACKAGE_JSON.devDependencies['eslint-plugin-jsdoc'];

    // TypeScript-specific
    delete PACKAGE_JSON.devDependencies['typescript-eslint'];
    delete PACKAGE_JSON.devDependencies['@types/eslint__js'];
}

if (PROJECT_INFO['use-prettier']) {
    await Promise.all([
        fs.copyFile(
            path.join(TEMPLATE_PATH, 'prettier.config.js'),
            path.join(PROJECT_INFO['target-dir'], 'prettier.config.js'),
        ),
        fs.copyFile(
            path.join(TEMPLATE_PATH, '.prettierignore'),
            path.join(PROJECT_INFO['target-dir'], '.prettierignore'),
        ),
    ]);

    if (!PROJECT_INFO['use-eslint']) {
        delete PACKAGE_JSON.devDependencies['eslint-config-prettier'];
    }
} else {
    delete PACKAGE_JSON.scripts['check:format'];
    delete PACKAGE_JSON.devDependencies['prettier'];
    delete PACKAGE_JSON.devDependencies['eslint-config-prettier'];
}

if (PROJECT_INFO['use-types'] || PROJECT_INFO['use-typescript']) {
    if (PROJECT_INFO['use-typescript']) {
        if (PROJECT_INFO['use-esbuild']) {
            await fs.copyFile(
                path.join(TEMPLATE_PATH, 'scripts', 'esbuild.js'),
                path.join(PROJECT_INFO['target-dir'], 'scripts', 'esbuild.js'),
            );
        } else {
            delete TSCONFIG_JSON['compilerOptions']['isolatedModules'];
        }

        await fs.writeFile(
            path.join(PROJECT_INFO['target-dir'], 'tsconfig.json'),
            JSON.stringify(TSCONFIG_JSON, null, 2),
        );
    } else {
        await fs.copyFile(
            path.join(TEMPLATE_PATH, 'template.js', 'jsconfig.json'),
            path.join(PROJECT_INFO['target-dir'], 'jsconfig.json'),
        );
    }

    await fs.copyFile(
        path.join(TEMPLATE_PATH, 'ambient.d.ts'),
        path.join(PROJECT_INFO['target-dir'], 'ambient.d.ts'),
    );
} else {
    delete PACKAGE_JSON.devDependencies['@girs/gjs'];
    delete PACKAGE_JSON.devDependencies['@girs/gnome-shell'];
}

if (PROJECT_INFO['use-translations']) {
    await Promise.all([
        fs.cp(
            path.join(TEMPLATE_PATH, 'po'),
            path.join(PROJECT_INFO['target-dir'], 'po'),
            {recursive: true},
        ),
        fs.copyFile(
            path.join(TEMPLATE_PATH, 'scripts', 'update-translations.sh'),
            path.join(
                PROJECT_INFO['target-dir'],
                'scripts',
                'update-translations.sh',
            ),
        ),
    ]);

    METADATA_JSON['gettext-domain'] =
        PROJECT_INFO['gettext-domain'] || PROJECT_INFO['uuid'];
} else {
    delete PACKAGE_JSON.scripts['translations:update'];
}

if (PROJECT_INFO['use-prefs']) {
    const name = toKebabCase(PROJECT_INFO['project-name']);
    const schemasDirPath = path.join(
        PROJECT_INFO['target-dir'],
        'src',
        'schemas',
    );
    const filePath = path.join(
        schemasDirPath,
        `org.gnome.shell.extensions.${name}.gschema.xml`,
    );

    await Promise.all([
        fs.mkdir(schemasDirPath, {recursive: true}),
        fs.writeFile(
            filePath,
            '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<schemalist>\n' +
                `    <schema id="org.gnome.shell.extensions.${name}" path="/org/gnome/shell/extensions/${name}/">\n` +
                '    </schema>\n' +
                '</schemalist>',
        ),
    ]);

    METADATA_JSON['settings-schema'] =
        PROJECT_INFO['settings-schema'] || PROJECT_INFO['uuid'];

    if (PROJECT_INFO['use-prefs-window']) {
        const prefsFile = PROJECT_INFO['use-typescript']
            ? 'prefs.ts'
            : 'prefs.js';

        await fs
            .readFile(
                path.join(TEMPLATE_PATH, TEMPLATE_LANG_DIR, 'src', prefsFile),
                'utf-8',
            )
            .then(async (fileContent) => {
                await fs.writeFile(
                    path.join(PROJECT_INFO['target-dir'], 'src', prefsFile),
                    fileContent.replace(
                        /\$PLACEHOLDER\$/,
                        toPascalCase(PROJECT_INFO['project-name']) + 'Prefs',
                    ),
                );
            });
    }
}

if (PROJECT_INFO['use-stylesheet']) {
    await fs.writeFile(
        path.join(PROJECT_INFO['target-dir'], 'src', 'stylesheet.css'),
        '',
    );
}

if (PROJECT_INFO['use-resources']) {
    await fs.cp(
        path.join(TEMPLATE_PATH, 'data'),
        path.join(PROJECT_INFO['target-dir'], 'data'),
        {recursive: true},
    );
}

const extFile = PROJECT_INFO['use-typescript']
    ? 'extension.ts'
    : 'extension.js';

await Promise.all([
    fs
        .readFile(
            path.join(TEMPLATE_PATH, TEMPLATE_LANG_DIR, 'src', extFile),
            'utf-8',
        )
        .then(async (fileContent) => {
            await fs.writeFile(
                path.join(PROJECT_INFO['target-dir'], 'src', extFile),
                fileContent.replace(
                    /\$PLACEHOLDER\$/,
                    toPascalCase(PROJECT_INFO['project-name']),
                ),
            );
        }),
    fs.copyFile(
        path.join(TEMPLATE_PATH, '_gitignore'),
        path.join(PROJECT_INFO['target-dir'], '.gitignore'),
    ),
    fs.copyFile(
        path.join(TEMPLATE_PATH, '.editorconfig'),
        path.join(PROJECT_INFO['target-dir'], '.editorconfig'),
    ),
    fs.copyFile(
        path.join(TEMPLATE_PATH, 'scripts', 'build.sh'),
        path.join(PROJECT_INFO['target-dir'], 'scripts', 'build.sh'),
    ),
    fs.writeFile(
        path.join(PROJECT_INFO['target-dir'], 'metadata.json'),
        JSON.stringify(METADATA_JSON, null, 2),
    ),
    fs.writeFile(
        path.join(PROJECT_INFO['target-dir'], 'package.json'),
        JSON.stringify(PACKAGE_JSON, null, 2),
    ),
    fs.copyFile(
        path.join(import.meta.dirname, 'README.md'),
        path.join(PROJECT_INFO['target-dir'], 'README.md'),
    ),
]);

console.log(`${GREEN}Project created at ${PROJECT_INFO['target-dir']}${RESET}`);

if (
    PROJECT_INFO['use-typescript'] ||
    PROJECT_INFO['use-eslint'] ||
    PROJECT_INFO['use-prettier'] ||
    PROJECT_INFO['use-types']
) {
    console.log(
        `Run ${YELLOW}cd ${PROJECT_INFO['target-dir']} && npm i${RESET} to install the dependencies before you start coding.`,
    );
}

/*******************************************************************************
 *******************************************************************************
 *******************************************************************************/

/**
 * Gets the default value for an option.
 *
 * @param {string} option - the option to get the default value for
 *
 * @returns {string|boolean} - the default value for the option
 */
function getDefaultForOption(option) {
    switch (option) {
        case 'target-dir':
        case 'project-name':
        case 'description':
        case 'uuid':
        case 'shell-version':
            return undefined;

        case 'home-page':
            return '';

        case 'version-name':
            return '1.0.0';

        case 'license':
            return 'GPL-2.0-or-later';

        case 'gettext-domain':
        case 'settings-schema':
            return PROJECT_INFO['uuid'];

        case 'use-esbuild':
        case 'use-eslint':
        case 'use-prettier':
            return true;

        case 'use-types':
        case 'use-typescript':
        case 'use-translations':
        case 'use-prefs':
        case 'use-prefs-window':
        case 'use-stylesheet':
        case 'use-resources':
            return false;

        default:
            console.warn(`Unknown option: ${option}`);
    }
}

/**
 * Validates the value of an option.
 *
 * @param {string} option - the option to validate
 * @param {string} value - the value of the option to validate
 *
 * @returns {Promise<boolean>} - whether the value is valid
 */
async function isValidOption(option, value) {
    if (value === undefined) {
        return false;
    }

    switch (option) {
        case 'version-name':
        case 'license':
        case 'home-page':
        case 'gettext-domain':
        case 'settings-schema':
            return typeof value === 'string';

        case 'use-esbuild':
        case 'use-eslint':
        case 'use-prettier':
        case 'use-types':
        case 'use-typescript':
        case 'use-translations':
        case 'use-prefs':
        case 'use-prefs-window':
        case 'use-stylesheet':
        case 'use-resources':
            return typeof value === 'boolean';

        case 'project-name':
        case 'description':
        case 'uuid':
            return typeof value === 'string' && /\w+/.test(value);

        case 'target-dir':
            try {
                if (typeof value !== 'string') {
                    return false;
                }

                await fs.access(path.resolve(value), fs.constants.F_OK);

                return false;

                /* eslint-disable-next-line no-unused-vars */
            } catch (e) {
                return true;
            }

        case 'shell-version':
            return (
                typeof value === 'string' &&
                value
                    .split(',')
                    .map((v) => v.trim())
                    .every((v) => /\d+/.test(v) && v >= 45)
            );

        default:
            console.warn(`Unknown option: ${option}`);
    }
}

/**
 * Parses the CLI arguments into an object with information about the project.
 *
 * @param {object} options - the options object to pass to `parseArgs`
 *
 * @returns {Promise<object>} - the parsed CLI arguments
 */
async function parseCliArguments(options) {
    const {
        values: argv,
        positionals,
        tokens,
    } = parseArgs({
        args: process.argv.slice(2),
        options,
        strict: false,
        tokens: true,
    });

    tokens
        .filter((token) => token.kind === 'option')
        .forEach((token) => {
            if (token.name.startsWith('no-')) {
                const positiveName = token.name.slice(3);
                argv[positiveName] = false;

                delete argv[token.name];
            } else {
                // Resave value so last one wins if both --foo and --no-foo.
                argv[token.name] = token.value ?? true;
            }
        });

    // Resolve conflicts. And only 'root conflicts'. Those that are handled
    // transively by other options are not checked here. E.g. handling of
    // use-esbuild in a normal JS project isn't needed since it depends on
    // use-typescript.
    const conflictingOptions = [['use-typescript', 'use-types']];

    for (const options of conflictingOptions) {
        if (options.some((o) => argv[o])) {
            options
                .filter((o) => argv[o])
                .slice(1)
                .forEach((o) => delete argv[o]);
        }
    }

    argv['target-dir'] = argv['target-dir'] ?? positionals[0];

    for (const [key, value] of Object.entries(argv)) {
        if (!(await isValidOption(key, value))) {
            delete argv[key];
        } else if (value === '') {
            argv[key] = getDefaultForOption(key);
        }
    }

    return argv;
}

/**
 * Queries the user for information about the project.
 */
async function queryMissingProjectInfo() {
    if (
        useOption('target-dir') &&
        !(await isValidOption('target-dir', PROJECT_INFO['target-dir']))
    ) {
        console.log(`${FAINT}Enter the path for your project${RESET}`);
        PROJECT_INFO['target-dir'] = path.resolve(
            await prompt('Target directory:', {
                validate: async (input) =>
                    await isValidOption('target-dir', input),
                defaultValue: getDefaultForOption('target-dir'),
                onError: 'Enter a path to a directory that does not exist.',
            }),
        );
    }

    if (
        useOption('project-name') &&
        !(await isValidOption('project-name', PROJECT_INFO['project-name']))
    ) {
        console.log(
            `${FAINT}Enter a project name. A name should be a short and descriptive string${RESET}`,
        );
        PROJECT_INFO['project-name'] = await prompt('Project name:', {
            validate: async (input) =>
                await isValidOption('project-name', input),
            defaultValue: getDefaultForOption('project-name'),
            onError: 'Project name cannot be empty.',
        });
    }

    if (
        useOption('description') &&
        !(await isValidOption('description', PROJECT_INFO['description']))
    ) {
        console.log(
            `${FAINT}Enter a description, a single-sentence explanation of what your extension does${RESET}`,
        );
        PROJECT_INFO['description'] = await prompt('Description:', {
            validate: async (input) =>
                await isValidOption('description', input),
            defaultValue: getDefaultForOption('description'),
            onError: 'Description cannot be empty.',
        });
    }

    if (
        useOption('version-name') &&
        !(await isValidOption('version-name', PROJECT_INFO['version-name']))
    ) {
        PROJECT_INFO['version-name'] = await prompt('Version:', {
            defaultValue: getDefaultForOption('version-name'),
        });
    }

    if (
        useOption('license') &&
        !(await isValidOption('license', PROJECT_INFO['license']))
    ) {
        console.log(`${FAINT}Enter a SPDX License Identifier${RESET}`);
        PROJECT_INFO['license'] = await prompt('License:', {
            defaultValue: getDefaultForOption('license'),
        });
    }

    if (
        useOption('home-page') &&
        !(await isValidOption('home-page', PROJECT_INFO['home-page']))
    ) {
        console.log(
            `${FAINT}Optionally, enter a homepage, for example, a Git repository${RESET}`,
        );
        PROJECT_INFO['home-page'] = await prompt('Homepage:', {
            defaultValue: getDefaultForOption('home-page'),
        });
    }

    if (
        useOption('uuid') &&
        !(await isValidOption('uuid', PROJECT_INFO['uuid']))
    ) {
        console.log(
            `${FAINT}Enter a UUID. The UUID is a globally-unique identifier for your extension. This should be in the format of an email address (clicktofocus@janedoe.example.com)${RESET}`,
        );
        PROJECT_INFO['uuid'] = await prompt('UUID:', {
            validate: async (input) => await isValidOption('uuid', input),
            defaultValue: getDefaultForOption('uuid'),
            onError: 'UUID cannot be empty.',
        });
    }

    if (
        useOption('shell-version') &&
        !(await isValidOption('shell-version', PROJECT_INFO['shell-version']))
    ) {
        console.log(
            `${FAINT}List the GNOME Shell versions that your extension supports in a comma-separated list of numbers >= 45. For example: 45,46,47${RESET}`,
        );
        PROJECT_INFO['shell-version'] = await prompt(
            'Supported GNOME Shell versions:',
            {
                validate: (input) => isValidOption('shell-version', input),
                defaultValue: getDefaultForOption('shell-version'),
                onError:
                    'The supported GNOME Shell versions should be a comma-separated list of numbers >= 45.',
            },
        );
    }

    PROJECT_INFO['shell-version'] = PROJECT_INFO['shell-version']
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v);

    if (
        useOption('use-typescript') &&
        !(await isValidOption('use-typescript', PROJECT_INFO['use-typescript']))
    ) {
        PROJECT_INFO['use-typescript'] = await promptYesOrNo(
            'Add TypeScript?',
            {
                defaultValue: getDefaultForOption('use-typescript'),
            },
        );
    }

    if (
        useOption('use-esbuild') &&
        !(await isValidOption('use-esbuild', PROJECT_INFO['use-esbuild']))
    ) {
        console.log(
            `${FAINT}esbuild allows for faster builds but doesn't check your code during the build process. So you will need to rely on your editor's type checking or use \`npm run check:types\` manually. esbuild also comes with some caveats. Visit https://esbuild.github.io/content-types/#typescript-caveats for more information.${RESET}`,
        );

        PROJECT_INFO['use-esbuild'] = await promptYesOrNo('Add esbuild?', {
            defaultValue: getDefaultForOption('use-esbuild'),
        });
    }

    if (
        useOption('use-prefs') &&
        !(await isValidOption('use-prefs', PROJECT_INFO['use-prefs']))
    ) {
        PROJECT_INFO['use-prefs'] = await promptYesOrNo('Add preferences?', {
            defaultValue: getDefaultForOption('use-prefs'),
        });
    }

    if (
        useOption('settings-schema') &&
        !(await isValidOption(
            'settings-schema',
            PROJECT_INFO['settings-schema'],
        ))
    ) {
        PROJECT_INFO['settings-schema'] = await prompt(
            'Enter settings schema:',
            {
                defaultValue: PROJECT_INFO['uuid'],
            },
        );
    }

    if (
        useOption('use-prefs-window') &&
        !(await isValidOption(
            'use-prefs-window',
            PROJECT_INFO['use-prefs-window'],
        ))
    ) {
        PROJECT_INFO['use-prefs-window'] = await promptYesOrNo(
            'Add preference window?',
            {
                defaultValue: getDefaultForOption('use-prefs-window'),
            },
        );
    }

    if (
        useOption('use-translations') &&
        !(await isValidOption(
            'use-translations',
            PROJECT_INFO['use-translations'],
        ))
    ) {
        PROJECT_INFO['use-translations'] = await promptYesOrNo(
            'Add translations?',
            {
                defaultValue: getDefaultForOption('use-translations'),
            },
        );
    }

    if (
        useOption('gettext-domain') &&
        !(await isValidOption('gettext-domain', PROJECT_INFO['gettext-domain']))
    ) {
        PROJECT_INFO['gettext-domain'] = await prompt('Enter gettext domain:', {
            defaultValue: PROJECT_INFO['uuid'],
        });
    }

    if (
        useOption('use-stylesheet') &&
        !(await isValidOption('use-stylesheet', PROJECT_INFO['use-stylesheet']))
    ) {
        PROJECT_INFO['use-stylesheet'] = await promptYesOrNo(
            'Add a stylesheet?',
            {
                defaultValue: getDefaultForOption('use-stylesheet'),
            },
        );
    }

    if (
        useOption('use-resources') &&
        !(await isValidOption('use-resources', PROJECT_INFO['use-resources']))
    ) {
        PROJECT_INFO['use-resources'] = await promptYesOrNo('Use GResources?', {
            defaultValue: getDefaultForOption('use-resources'),
        });
    }

    if (
        useOption('use-types') &&
        !(await isValidOption('use-types', PROJECT_INFO['use-types']))
    ) {
        PROJECT_INFO['use-types'] = await promptYesOrNo(
            'Add types to JavaScript with gjsify/ts-for-gir?',
            {
                defaultValue: getDefaultForOption('use-types'),
            },
        );
    }

    if (
        useOption('use-eslint') &&
        !(await isValidOption('use-eslint', PROJECT_INFO['use-eslint']))
    ) {
        PROJECT_INFO['use-eslint'] = await promptYesOrNo('Add ESlint?', {
            defaultValue: getDefaultForOption('use-eslint'),
        });
    }

    if (
        useOption('use-prettier') &&
        !(await isValidOption('use-prettier', PROJECT_INFO['use-prettier']))
    ) {
        PROJECT_INFO['use-prettier'] = await promptYesOrNo('Add Prettier?', {
            defaultValue: getDefaultForOption('use-prettier'),
        });
    }
}

/**
 * Prompts the user for an input.
 *
 * @param {string} prompt - the prompt message shown to the user
 * @param {object} [param] - the options object
 * @param {Function} [param.validate] - the function that validates the input
 * @param {*} [param.defaultValue] - the value that is returned, if the user
 *      doesn't provide an input
 * @param {string} [param.onError] - the error message shown to the user, if
 *      the input doesn't pass the validation function
 *
 * @returns {Promise<string>} - the user's input or the default value if the user doesn't
 *      provide an input
 */
async function prompt(
    prompt,
    {
        validate = async () => true,
        defaultValue,
        onError = 'Invalid input.',
    } = {},
) {
    const defaultString =
        defaultValue === undefined ? '' : ` (${defaultValue})`;
    const lineReader = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const question = (str) =>
        new Promise((resolve) => lineReader.question(str, resolve));
    let input;

    while (true) {
        input = await question(
            `${BOLD}${prompt}${RESET}${FAINT}${defaultString}${RESET} `,
        );
        input = input.trim();

        if (input === '' && defaultValue !== undefined) {
            input = defaultValue;
            break;
        } else if (await validate(input)) {
            break;
        }

        console.log(`${RED}${onError}${RESET}`);
    }

    lineReader.close();

    return input;
}

/**
 * Prompts the user for a yes or no answer.
 *
 * @param {string} prompt - the prompt message shown to the user
 * @param {boolean} [defaultValue] - the value that is returned, if the user doesn't
 *      provide an input
 *
 * @returns {Promise<boolean>} - the user's choice
 */
async function promptYesOrNo(prompt, {defaultValue = false} = {}) {
    const option = defaultValue ? 'Y/n' : 'y/N';
    const lineReader = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const question = (str) =>
        new Promise((resolve) => lineReader.question(str, resolve));
    let input;

    while (true) {
        input = await question(
            `${BOLD}${prompt}${RESET} ${FAINT}[${option}]${RESET}: `,
        );
        input = input.trim().toLowerCase();

        if (input === '') {
            input = defaultValue;
            break;
        } else if (input === 'yes' || input === 'y') {
            input = true;
            break;
        } else if (input === 'no' || input === 'n') {
            input = false;
            break;
        }

        console.log(`${RED}Please enter "y" or "n".${RESET}`);
    }

    lineReader.close();

    return input;
}

/**
 * Turns a string into kebab-case.
 *
 * @param {string} string
 * @returns {string} the string in kebab-case
 */
function toKebabCase(string) {
    return string
        .split(/[ _-]/)
        .map((v) => v.trim())
        .filter((v) => v)
        .join('-')
        .toLowerCase();
}

/**
 * Turns a string into PascalCase.
 *
 * @param {string} string - the input string
 * @returns {string} - the string in PascalCase
 */
function toPascalCase(string) {
    return string
        .split(/[ _-]/)
        .map((v) => v.trim())
        .filter((v) => v)
        .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

/**
 * Determines whether to use an option based on its relation to other options.
 *
 * @param {string} option
 *
 * @returns {boolean}
 */
function useOption(option) {
    return {
        'target-dir': true,
        'project-name': true,
        description: true,
        'version-name': true,
        license: true,
        'home-page': true,
        uuid: true,
        'gettext-domain': PROJECT_INFO['use-translations'],
        'settings-schema': PROJECT_INFO['use-prefs'],
        'shell-version': true,
        'use-typescript': !PROJECT_INFO['use-types'],
        'no-use-typescript': !PROJECT_INFO['use-types'],
        'use-esbuild': PROJECT_INFO['use-typescript'],
        'no-use-esbuild': PROJECT_INFO['use-typescript'],
        'use-eslint': true,
        'no-use-eslint': true,
        'use-prettier': true,
        'no-use-prettier': true,
        'use-types': !PROJECT_INFO['use-typescript'],
        'no-use-types': !PROJECT_INFO['use-typescript'],
        'use-translations': true,
        'no-use-translations': true,
        'use-prefs': true,
        'no-use-prefs': true,
        'use-prefs-window': PROJECT_INFO['use-prefs'],
        'no-use-prefs-window': PROJECT_INFO['use-prefs'],
        'use-stylesheet': true,
        'no-use-stylesheet': true,
        'use-resources': true,
        'no-use-resources': true,
    }[option];
}
