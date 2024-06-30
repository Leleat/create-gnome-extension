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

const OPTIONS = {
    'target-dir': {type: 'string'},
    'project-name': {type: 'string'},
    description: {type: 'string'},
    'version-name': {type: 'string'},
    license: {type: 'string'},
    'home-page': {type: 'string'},
    uuid: {type: 'string'},
    'shell-version': {type: 'string'},
    'use-typescript': {type: 'boolean'},
    'no-use-typescript': {type: 'boolean'},
    'use-esbuild': {type: 'boolean'},
    'no-use-esbuild': {type: 'boolean'},
    'use-types': {type: 'boolean'},
    'no-use-types': {type: 'boolean'},
    'use-eslint': {type: 'boolean'},
    'no-use-eslint': {type: 'boolean'},
    'use-prettier': {type: 'boolean'},
    'no-use-prettier': {type: 'boolean'},
    'use-translations': {type: 'boolean'},
    'no-use-translations': {type: 'boolean'},
    'gettext-domain': {type: 'string'},
    'use-prefs': {type: 'boolean'},
    'no-use-prefs': {type: 'boolean'},
    'settings-schema': {type: 'string'},
    'use-prefs-window': {type: 'boolean'},
    'no-use-prefs-window': {type: 'boolean'},
    'use-stylesheet': {type: 'boolean'},
    'no-use-stylesheet': {type: 'boolean'},
    'use-resources': {type: 'boolean'},
    'no-use-resources': {type: 'boolean'},
};

const PROJECT_INFO = await parseCliArguments(OPTIONS);

await queryMissingProjectInfo(OPTIONS);

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
        case 'description':
        case 'project-name':
        case 'shell-version':
        case 'target-dir':
        case 'uuid':
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

        case 'use-prefs-window':
        case 'use-prefs':
        case 'use-resources':
        case 'use-stylesheet':
        case 'use-translations':
        case 'use-types':
        case 'use-typescript':
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
        case 'gettext-domain':
        case 'home-page':
        case 'license':
        case 'settings-schema':
        case 'version-name':
            return typeof value === 'string';

        case 'use-esbuild':
        case 'use-eslint':
        case 'use-prefs-window':
        case 'use-prefs':
        case 'use-prettier':
        case 'use-resources':
        case 'use-stylesheet':
        case 'use-translations':
        case 'use-types':
        case 'use-typescript':
            return typeof value === 'boolean';

        case 'description':
        case 'project-name':
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
 *
 * @param {object} options - the CLI options
 *
 * @returns {Promise<object>} - the information about the project
 */
async function queryMissingProjectInfo(options) {
    const keys = Object.keys(options).filter((o) => !o.startsWith('no-'));

    for (const option of keys) {
        if (useOption(option)) {
            if (PROJECT_INFO[option] === undefined) {
                PROJECT_INFO[option] = await queryUserFor(option);
            }
        } else {
            delete PROJECT_INFO[option];
        }
    }
}

/**
 * Queries the user for an option.
 *
 * @param {string} option - the option to query the user for
 *
 * @returns {Promise<string|boolean>} - the user's input for the option
 */
async function queryUserFor(option) {
    switch (option) {
        case 'description':
            console.log(
                `${FAINT}Enter a description, a single-sentence explanation of what your extension does${RESET}`,
            );

            return await prompt('Description:', {
                validate: async (input) =>
                    await isValidOption('description', input),
                defaultValue: getDefaultForOption('description'),
                onError: 'Description cannot be empty.',
            });

        case 'gettext-domain':
            return await prompt('Enter gettext domain:', {
                defaultValue: getDefaultForOption('gettext-domain'),
            });

        case 'home-page':
            console.log(
                `${FAINT}Optionally, enter a homepage, for example, a Git repository${RESET}`,
            );

            return await prompt('Homepage:', {
                defaultValue: getDefaultForOption('home-page'),
            });

        case 'license':
            console.log(`${FAINT}Enter a SPDX License Identifier${RESET}`);

            return await prompt('License:', {
                defaultValue: getDefaultForOption('license'),
            });

        case 'project-name':
            console.log(
                `${FAINT}Enter a project name. A name should be a short and descriptive string${RESET}`,
            );

            return await prompt('Project name:', {
                validate: async (input) =>
                    await isValidOption('project-name', input),
                defaultValue: getDefaultForOption('project-name'),
                onError: 'Project name cannot be empty.',
            });

        case 'settings-schema':
            return await prompt('Enter settings schema:', {
                defaultValue: getDefaultForOption('settings-schema'),
            });

        case 'shell-version':
            console.log(
                `${FAINT}List the GNOME Shell versions that your extension supports in a comma-separated list of numbers >= 45. For example: 45,46,47${RESET}`,
            );

            return (
                await prompt('Supported GNOME Shell versions:', {
                    validate: (input) => isValidOption('shell-version', input),
                    defaultValue: getDefaultForOption('shell-version'),
                    onError:
                        'The supported GNOME Shell versions should be a comma-separated list of numbers >= 45.',
                })
            )
                .split(',')
                .map((v) => v.trim())
                .filter((v) => v);

        case 'target-dir':
            console.log(`${FAINT}Enter the path for your project${RESET}`);

            return path.resolve(
                await prompt('Target directory:', {
                    validate: async (input) =>
                        await isValidOption('target-dir', input),
                    defaultValue: getDefaultForOption('target-dir'),
                    onError: 'Enter a path to a directory that does not exist.',
                }),
            );

        case 'uuid':
            console.log(
                `${FAINT}Enter a UUID. The UUID is a globally-unique identifier for your extension. This should be in the format of an email address (clicktofocus@janedoe.example.com)${RESET}`,
            );

            return await prompt('UUID:', {
                validate: async (input) => await isValidOption('uuid', input),
                defaultValue: getDefaultForOption('uuid'),
                onError: 'UUID cannot be empty.',
            });

        case 'use-esbuild':
            console.log(
                `${FAINT}esbuild allows for faster builds but doesn't check your code during the build process. So you will need to rely on your editor's type checking or use \`npm run check:types\` manually. esbuild also comes with some caveats. Visit https://esbuild.github.io/content-types/#typescript-caveats for more information.${RESET}`,
            );

            return await promptYesOrNo('Add esbuild?', {
                defaultValue: getDefaultForOption('use-esbuild'),
            });

        case 'use-eslint':
            return await promptYesOrNo('Add ESlint?', {
                defaultValue: getDefaultForOption('use-eslint'),
            });

        case 'use-prefs':
            return await promptYesOrNo('Add preferences?', {
                defaultValue: getDefaultForOption('use-prefs'),
            });

        case 'use-prefs-window':
            return await promptYesOrNo('Add preference window?', {
                defaultValue: getDefaultForOption('use-prefs-window'),
            });

        case 'use-prettier':
            return await promptYesOrNo('Add Prettier?', {
                defaultValue: getDefaultForOption('use-prettier'),
            });

        case 'use-resources':
            return await promptYesOrNo('Use GResources?', {
                defaultValue: getDefaultForOption('use-resources'),
            });

        case 'use-stylesheet':
            return await promptYesOrNo('Add a stylesheet?', {
                defaultValue: getDefaultForOption('use-stylesheet'),
            });

        case 'use-translations':
            return await promptYesOrNo('Add translations?', {
                defaultValue: getDefaultForOption('use-translations'),
            });

        case 'use-types':
            return await promptYesOrNo(
                'Add types to JavaScript with gjsify/ts-for-gir?',
                {
                    defaultValue: getDefaultForOption('use-types'),
                },
            );

        case 'use-typescript':
            return await promptYesOrNo('Add TypeScript?', {
                defaultValue: getDefaultForOption('use-typescript'),
            });

        case 'version-name':
            return await prompt('Version:', {
                defaultValue: getDefaultForOption('version-name'),
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
        description: true,
        'gettext-domain': PROJECT_INFO['use-translations'],
        'home-page': true,
        license: true,
        'no-use-esbuild': PROJECT_INFO['use-typescript'],
        'no-use-eslint': true,
        'no-use-prefs-window': PROJECT_INFO['use-prefs'],
        'no-use-prefs': true,
        'no-use-prettier': true,
        'no-use-resources': true,
        'no-use-stylesheet': true,
        'no-use-translations': true,
        'no-use-types': !PROJECT_INFO['use-typescript'],
        'no-use-typescript': !PROJECT_INFO['use-types'],
        'project-name': true,
        'settings-schema': PROJECT_INFO['use-prefs'],
        'shell-version': true,
        'target-dir': true,
        'use-esbuild': PROJECT_INFO['use-typescript'],
        'use-eslint': true,
        'use-prefs-window': PROJECT_INFO['use-prefs'],
        'use-prefs': true,
        'use-prettier': true,
        'use-resources': true,
        'use-stylesheet': true,
        'use-translations': true,
        'use-types': !PROJECT_INFO['use-typescript'],
        'use-typescript': !PROJECT_INFO['use-types'],
        uuid: true,
        'version-name': true,
    }[option];
}
