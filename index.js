#!/usr/bin/env node

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';
import readline from 'readline';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const FAINT = '\x1b[2m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[92m';

const TEMPLATE_PATH = path.resolve(import.meta.dirname, 'template');
const [METADATA_JSON, PACKAGE_JSON] = await Promise.all([
    fs
        .readFile(path.join(TEMPLATE_PATH, 'metadata.json'), 'utf-8')
        .then(JSON.parse),
    fs
        .readFile(path.join(TEMPLATE_PATH, 'js', 'package.json'), 'utf-8')
        .then(JSON.parse),
]);
const PROJECT_INFO = {
    'project-name': '',
    description: '',
    'version-name': '',
    license: '',
    'home-page': '',
    uuid: '',
    'gettext-domain': '',
    'settings-schema': '',
    'shell-version': [],
    'include-eslint': false,
    'include-prettier': false,
    'include-types': false,
    'include-translations': false,
    'include-prefs': false,
    'include-prefs-window': false,
    'include-stylesheet': false,
    'include-resources': false,
};

await collectProjectInfo();

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

if (PROJECT_INFO['include-eslint']) {
    await Promise.all([
        fs.cp(
            path.join(TEMPLATE_PATH, 'js', 'lint'),
            path.join(PROJECT_INFO['target-dir'], 'lint'),
            {recursive: true},
        ),
        fs.copyFile(
            path.join(TEMPLATE_PATH, 'js', 'eslint.config.js'),
            path.join(PROJECT_INFO['target-dir'], '.eslint.config.js'),
        ),
    ]);
} else {
    delete PACKAGE_JSON.scripts['check:lint'];
    delete PACKAGE_JSON.devDependencies['@eslint/js'];
    delete PACKAGE_JSON.devDependencies['eslint'];
    delete PACKAGE_JSON.devDependencies['eslint-plugin-jsdoc'];
}

if (PROJECT_INFO['include-prettier']) {
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

    if (!PROJECT_INFO['include-eslint']) {
        delete PACKAGE_JSON.devDependencies['eslint-config-prettier'];
    }
} else {
    delete PACKAGE_JSON.scripts['check:format'];
    delete PACKAGE_JSON.devDependencies['prettier'];
    delete PACKAGE_JSON.devDependencies['eslint-config-prettier'];
}

if (PROJECT_INFO['include-types']) {
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

if (PROJECT_INFO['include-translations']) {
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

if (PROJECT_INFO['include-prefs']) {
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

    if (PROJECT_INFO['include-prefs-window']) {
        const prefsFile = await fs.readFile(
            path.join(TEMPLATE_PATH, 'js', 'src', 'prefs.js'),
            'utf-8',
        );

        await fs.writeFile(
            path.join(PROJECT_INFO['target-dir'], 'src', 'prefs.js'),
            prefsFile.replace(
                /\$PLACEHOLDER\$/,
                toPascalCase(PROJECT_INFO['project-name']) + 'Prefs',
            ),
        );
    }
}

if (PROJECT_INFO['include-stylesheet']) {
    await fs.writeFile(
        path.join(PROJECT_INFO['target-dir'], 'src', 'stylesheet.css'),
        '',
    );
}

if (PROJECT_INFO['include-resources']) {
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
    PROJECT_INFO['include-eslint'] ||
    PROJECT_INFO['include-prettier'] ||
    PROJECT_INFO['include-types']
) {
    console.log(
        `Run ${YELLOW}cd ${PROJECT_INFO['target-dir']} && npm i${RESET} to install the dependencies before you start coding.`,
    );
}

/*******************************************************************************
 *******************************************************************************
 *******************************************************************************/

/**
 * Queries the user for information about the project.
 */
async function collectProjectInfo() {
    console.log(`${FAINT}Enter the path for your project${RESET}`);
    PROJECT_INFO['target-dir'] = path.resolve(
        await prompt('Target directory:', {
            isValid: async (input) => {
                try {
                    await fs.access(path.resolve(input), fs.constants.F_OK);

                    return false;

                    /* eslint-disable no-unused-vars */
                } catch (e) {
                    return true;
                }
            },
            errorMessage: 'Directory already exists.',
        }),
    );

    console.log(
        `${FAINT}Enter a project name. A name should be a short and descriptive string${RESET}`,
    );
    PROJECT_INFO['project-name'] = await prompt('Project name:', {
        isValid: (input) => /\w+/.test(input),
        errorMessage: 'Project name cannot be empty.',
    });

    console.log(
        `${FAINT}Enter a description, a single-sentence explanation of what your extension does${RESET}`,
    );
    PROJECT_INFO['description'] = await prompt('Description:', {
        isValid: (input) => /\w+/.test(input),
        errorMessage: 'Description cannot be empty.',
    });

    PROJECT_INFO['version-name'] = await prompt('Version:', {
        defaultValue: '1.0.0',
    });

    console.log(`${FAINT}Enter a SPDX License Identifier${RESET}`);
    PROJECT_INFO['license'] = await prompt('License:', {
        defaultValue: 'GPL-2.0-or-later',
    });

    console.log(
        `${FAINT}Optionally, enter a homepage, for example, a Git repository${RESET}`,
    );
    PROJECT_INFO['home-page'] = await prompt('Homepage:');

    console.log(
        `${FAINT}Enter a UUID. The UUID is a globally-unique identifier for your extension. This should be in the format of an email address (clicktofocus@janedoe.example.com)${RESET}`,
    );
    PROJECT_INFO['uuid'] = await prompt('UUID:', {
        isValid: (input) => /\w+/.test(input),
        errorMessage: 'UUID cannot be empty.',
    });

    console.log(
        `${FAINT}List the GNOME Shell versions that your extension supports in a comma-separated list of numbers >= 45. For example: 45,46,47${RESET}`,
    );
    const supportedVersions = await prompt('Supported GNOME Shell versions:', {
        isValid: (input) =>
            input
                .split(',')
                .map((v) => v.trim())
                .every((v) => /\d+/.test(v) && v >= 45),
        errorMessage:
            'The supported GNOME Shell versions should be a comma-separated list of numbers >= 45.',
    });
    PROJECT_INFO['shell-version'] = supportedVersions
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v);

    PROJECT_INFO['include-prefs'] = await promptYesOrNo('Add preferences?');

    if (PROJECT_INFO['include-prefs']) {
        PROJECT_INFO['settings-schema'] = await prompt(
            'Enter settings schema:',
            {
                defaultValue: PROJECT_INFO['uuid'],
            },
        );
        PROJECT_INFO['include-prefs-window'] = await promptYesOrNo(
            'Add preference window?',
        );
    }

    PROJECT_INFO['include-translations'] =
        await promptYesOrNo('Add translations?');

    if (PROJECT_INFO['include-translations']) {
        PROJECT_INFO['gettext-domain'] = await prompt('Enter gettext domain:', {
            defaultValue: PROJECT_INFO['uuid'],
        });
    }

    PROJECT_INFO['include-stylesheet'] =
        await promptYesOrNo('Add a stylesheet?');

    PROJECT_INFO['include-resources'] = await promptYesOrNo('Use GResources?');

    PROJECT_INFO['include-types'] = await promptYesOrNo(
        'Add types with gjsify/ts-for-gir?',
    );

    PROJECT_INFO['include-eslint'] = await promptYesOrNo('Add ESlint?');

    PROJECT_INFO['include-prettier'] = await promptYesOrNo('Add Prettier?');
}

/**
 * Prompts the user for an input.
 *
 * @param {string} prompt - the prompt message shown to the user
 * @param {object} [param] - the options object
 * @param {Function} [param.isValid] - the function that validates the input
 * @param {*} [param.defaultValue] - the value that is returned, if the user
 *      doesn't provide an input
 * @param {string} [param.errorMessage] - the error message shown to the user, if
 *      the input doesn't pass the validation function
 *
 * @returns {Promise<string>} - the user's input or the default value if the user doesn't
 *      provide an input
 */
async function prompt(
    prompt,
    {
        isValid = async () => true,
        defaultValue,
        errorMessage = 'Invalid input.',
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
        } else if (await isValid(input)) {
            break;
        }

        console.log(`${RED}${errorMessage}${RESET}`);
    }

    lineReader.close();

    return input;
}

/**
 * Prompts the user for a yes or no answer.
 *
 * @param {string} prompt - the prompt message shown to the user
 * @param {*} defaultValue - the value that is returned, if the user doesn't
 *      provide an input
 *
 * @returns {Promise<boolean>} - the user's choice
 */
async function promptYesOrNo(prompt, defaultValue = false) {
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
