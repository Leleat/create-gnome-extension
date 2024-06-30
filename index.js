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

const PROJECT_INFO = parseCliArguments({
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
const [METADATA_JSON, PACKAGE_JSON] = await Promise.all([
    fs
        .readFile(path.join(TEMPLATE_PATH, 'metadata.json'), 'utf-8')
        .then(JSON.parse),
    fs
        .readFile(path.join(TEMPLATE_PATH, 'js', 'package.json'), 'utf-8')
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
    await Promise.all([
        fs.cp(
            path.join(TEMPLATE_PATH, 'js', 'lint'),
            path.join(PROJECT_INFO['target-dir'], 'lint'),
            {recursive: true},
        ),
        fs.copyFile(
            path.join(TEMPLATE_PATH, 'js', 'eslint.config.js'),
            path.join(PROJECT_INFO['target-dir'], 'eslint.config.js'),
        ),
    ]);
} else {
    delete PACKAGE_JSON.scripts['check:lint'];
    delete PACKAGE_JSON.devDependencies['@eslint/js'];
    delete PACKAGE_JSON.devDependencies['eslint'];
    delete PACKAGE_JSON.devDependencies['eslint-plugin-jsdoc'];
}

if (PROJECT_INFO['use-prettier']) {
    await Promise.all([
        fs.copyFile(
            path.join(TEMPLATE_PATH, 'js', 'prettier.config.js'),
            path.join(PROJECT_INFO['target-dir'], 'prettier.config.js'),
        ),
        fs.copyFile(
            path.join(TEMPLATE_PATH, 'js', '.prettierignore'),
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

if (PROJECT_INFO['use-types']) {
    await Promise.all([
        fs.copyFile(
            path.join(TEMPLATE_PATH, 'js', 'jsconfig.json'),
            path.join(PROJECT_INFO['target-dir'], 'jsconfig.json'),
        ),
        fs.copyFile(
            path.join(TEMPLATE_PATH, 'js', 'ambient.d.ts'),
            path.join(PROJECT_INFO['target-dir'], 'ambient.d.ts'),
        ),
    ]);
} else {
    delete PACKAGE_JSON.devDependencies['@girs/gjs'];
    delete PACKAGE_JSON.devDependencies['@girs/gnome-shell'];
}

if (PROJECT_INFO['use-translations']) {
    await Promise.all([
        fs.cp(
            path.join(TEMPLATE_PATH, 'js', 'po'),
            path.join(PROJECT_INFO['target-dir'], 'po'),
            {recursive: true},
        ),
        fs.copyFile(
            path.join(TEMPLATE_PATH, 'js', 'scripts', 'update-translations.sh'),
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
        await fs
            .readFile(
                path.join(TEMPLATE_PATH, 'js', 'src', 'prefs.js'),
                'utf-8',
            )
            .then(async (prefsJsFile) => {
                await fs.writeFile(
                    path.join(PROJECT_INFO['target-dir'], 'src', 'prefs.js'),
                    prefsJsFile.replace(
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
        path.join(TEMPLATE_PATH, 'js', 'data'),
        path.join(PROJECT_INFO['target-dir'], 'data'),
        {recursive: true},
    );
}

await Promise.all([
    fs
        .readFile(
            path.join(TEMPLATE_PATH, 'js', 'src', 'extension.js'),
            'utf-8',
        )
        .then(async (extensionJsFile) => {
            await fs.writeFile(
                path.join(PROJECT_INFO['target-dir'], 'src', 'extension.js'),
                extensionJsFile.replace(
                    /\$PLACEHOLDER\$/,
                    toPascalCase(PROJECT_INFO['project-name']),
                ),
            );
        }),
    fs.copyFile(
        path.join(TEMPLATE_PATH, 'js', '_gitignore'),
        path.join(PROJECT_INFO['target-dir'], '.gitignore'),
    ),
    fs.copyFile(
        path.join(TEMPLATE_PATH, 'js', '.editorconfig'),
        path.join(PROJECT_INFO['target-dir'], '.editorconfig'),
    ),
    fs.copyFile(
        path.join(TEMPLATE_PATH, 'js', 'scripts', 'build.sh'),
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

        case 'use-eslint':
        case 'use-prettier':
        case 'use-types':
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

        case 'use-eslint':
        case 'use-prettier':
        case 'use-types':
        case 'use-translations':
        case 'use-prefs':
        case 'use-prefs-window':
        case 'use-stylesheet':
        case 'use-resources':
            return true;

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
 * @returns {object} - the parsed CLI arguments
 */
function parseCliArguments(options) {
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

    Object.entries(argv).forEach(async ([key, value]) => {
        if (!(await isValidOption(key, value))) {
            delete argv[key];
        } else if (value === '') {
            argv[key] = getDefaultForOption(key);
        }
    });

    argv['target-dir'] = argv['target-dir'] ?? positionals[0];

    return argv;
}

/**
 * Queries the user for information about the project.
 */
async function queryMissingProjectInfo() {
    if (!(await isValidOption('target-dir', PROJECT_INFO['target-dir']))) {
        console.log(`${FAINT}Enter the path for your project${RESET}`);
        PROJECT_INFO['target-dir'] = path.resolve(
            await prompt('Target directory:', {
                validate: async (input) =>
                    await isValidOption('target-dir', input),
                onError: 'Enter a path to a directory that does not exist.',
            }),
        );
    }

    if (!(await isValidOption('project-name', PROJECT_INFO['project-name']))) {
        console.log(
            `${FAINT}Enter a project name. A name should be a short and descriptive string${RESET}`,
        );
        PROJECT_INFO['project-name'] = await prompt('Project name:', {
            validate: async (input) =>
                await isValidOption('project-name', input),
            onError: 'Project name cannot be empty.',
        });
    }

    if (!(await isValidOption('description', PROJECT_INFO['description']))) {
        console.log(
            `${FAINT}Enter a description, a single-sentence explanation of what your extension does${RESET}`,
        );
        PROJECT_INFO['description'] = await prompt('Description:', {
            validate: async (input) =>
                await isValidOption('description', input),
            onError: 'Description cannot be empty.',
        });
    }

    if (!(await isValidOption('version-name', PROJECT_INFO['version-name']))) {
        PROJECT_INFO['version-name'] = await prompt('Version:', {
            defaultValue: getDefaultForOption('version-name'),
        });
    }

    if (!(await isValidOption('license', PROJECT_INFO['license']))) {
        console.log(`${FAINT}Enter a SPDX License Identifier${RESET}`);
        PROJECT_INFO['license'] = await prompt('License:', {
            defaultValue: getDefaultForOption('license'),
        });
    }

    if (!(await isValidOption('home-page', PROJECT_INFO['home-page']))) {
        console.log(
            `${FAINT}Optionally, enter a homepage, for example, a Git repository${RESET}`,
        );
        PROJECT_INFO['home-page'] = await prompt('Homepage:');
    }

    if (!(await isValidOption('uuid', PROJECT_INFO['uuid']))) {
        console.log(
            `${FAINT}Enter a UUID. The UUID is a globally-unique identifier for your extension. This should be in the format of an email address (clicktofocus@janedoe.example.com)${RESET}`,
        );
        PROJECT_INFO['uuid'] = await prompt('UUID:', {
            validate: async (input) => await isValidOption('uuid', input),
            onError: 'UUID cannot be empty.',
        });
    }

    if (
        !(await isValidOption('shell-version', PROJECT_INFO['shell-version']))
    ) {
        console.log(
            `${FAINT}List the GNOME Shell versions that your extension supports in a comma-separated list of numbers >= 45. For example: 45,46,47${RESET}`,
        );
        PROJECT_INFO['shell-version'] = await prompt(
            'Supported GNOME Shell versions:',
            {
                validate: (input) => isValidOption('shell-version', input),
                onError:
                    'The supported GNOME Shell versions should be a comma-separated list of numbers >= 45.',
            },
        );
    }

    PROJECT_INFO['shell-version'] = PROJECT_INFO['shell-version']
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v);

    if (!(await isValidOption('use-prefs', PROJECT_INFO['use-prefs']))) {
        PROJECT_INFO['use-prefs'] = await promptYesOrNo('Add preferences?');
    }

    if (PROJECT_INFO['use-prefs']) {
        if (
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
            !(await isValidOption(
                'use-prefs-window',
                PROJECT_INFO['use-prefs-window'],
            ))
        ) {
            PROJECT_INFO['use-prefs-window'] = await promptYesOrNo(
                'Add preference window?',
            );
        }
    }

    if (
        !(await isValidOption(
            'use-translations',
            PROJECT_INFO['use-translations'],
        ))
    ) {
        PROJECT_INFO['use-translations'] =
            await promptYesOrNo('Add translations?');
    }

    if (
        PROJECT_INFO['use-translations'] &&
        !(await isValidOption('gettext-domain', PROJECT_INFO['gettext-domain']))
    ) {
        PROJECT_INFO['gettext-domain'] = await prompt('Enter gettext domain:', {
            defaultValue: PROJECT_INFO['uuid'],
        });
    }

    if (
        !(await isValidOption('use-stylesheet', PROJECT_INFO['use-stylesheet']))
    ) {
        PROJECT_INFO['use-stylesheet'] =
            await promptYesOrNo('Add a stylesheet?');
    }

    if (
        !(await isValidOption('use-resources', PROJECT_INFO['use-resources']))
    ) {
        PROJECT_INFO['use-resources'] = await promptYesOrNo('Use GResources?');
    }

    if (!(await isValidOption('use-types', PROJECT_INFO['use-types']))) {
        PROJECT_INFO['use-types'] = await promptYesOrNo(
            'Add types with gjsify/ts-for-gir?',
        );
    }

    if (!(await isValidOption('use-eslint', PROJECT_INFO['use-eslint']))) {
        PROJECT_INFO['use-eslint'] = await promptYesOrNo('Add ESlint?');
    }

    if (!(await isValidOption('use-prettier', PROJECT_INFO['use-prettier']))) {
        PROJECT_INFO['use-prettier'] = await promptYesOrNo('Add Prettier?');
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
    const defaultString = defaultValue ? ` (${defaultValue})` : '';
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
