#!/usr/bin/env node

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';
import readline from 'node:readline';
import {parseArgs} from 'node:util';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const FAINT = '\x1b[2m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[92m';

const CLI_OPTIONS = {
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

const isMainModule = import.meta.url.includes(process.argv[1]);

if (isMainModule) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}

/*******************************************************************************
 * Functions *******************************************************************
 *******************************************************************************/

/**
 * Configures ESLint for the project.
 *
 * @param {object} param
 * @param {object} param.packageJson - the parsed package.json object
 * @param {object} param.projectInfo - the information about the project
 * @param {string} param.templateLangDir - the name of the directory for the
 *      language specific template files
 * @param {string} param.templatePath - the path to the template directory
 *
 * @returns {Promise<void>}
 */
async function configureEslint({
    packageJson,
    projectInfo,
    templateLangDir,
    templatePath,
}) {
    if (projectInfo['use-eslint']) {
        if (!projectInfo['use-typescript']) {
            await fs.cp(
                path.join(templatePath, 'template.js', 'lint'),
                path.join(projectInfo['target-dir'], 'lint'),
                {recursive: true},
            );
        }

        await fs.copyFile(
            path.join(templatePath, templateLangDir, 'eslint.config.js'),
            path.join(projectInfo['target-dir'], 'eslint.config.js'),
        );
    } else {
        packageJson.scripts['check:lint'] = undefined;
        packageJson.devDependencies['@eslint/js'] = undefined;
        packageJson.devDependencies['eslint'] = undefined;
        packageJson.devDependencies['globals'] = undefined;

        // JavaScript-specific
        packageJson.devDependencies['eslint-plugin-jsdoc'] = undefined;

        // TypeScript-specific
        packageJson.devDependencies['typescript-eslint'] = undefined;
        packageJson.devDependencies['@types/eslint__js'] = undefined;
    }
}

/**
 * Configures GResources for the project.
 *
 * @param {object} param
 * @param {object} param.projectInfo - the information about the project
 * @param {string} param.templatePath - the path to the template directory
 *
 * @returns {Promise<void>}
 */
async function configureGresources({projectInfo, templatePath}) {
    if (projectInfo['use-resources']) {
        await fs.cp(
            path.join(templatePath, 'data'),
            path.join(projectInfo['target-dir'], 'data'),
            {recursive: true},
        );
    }
}

/**
 * Configures the mandatory files for the project.
 *
 * @param {object} param
 * @param {object} param.metadataJson - the parsed metadata.json object
 * @param {object} param.packageJson - the parsed package.json object
 * @param {object} param.projectInfo - the information about the project
 * @param {string} param.templateLangDir - the name of the directory for the
 *     language specific template files
 * @param {string} param.templatePath - the path to the template directory
 *
 * @returns {Promise<void>}
 */
async function configureMandatoryFiles({
    metadataJson,
    packageJson,
    projectInfo,
    templateLangDir,
    templatePath,
}) {
    metadataJson['name'] = projectInfo['project-name'];
    metadataJson['description'] = projectInfo['description'];
    metadataJson['uuid'] = projectInfo['uuid'];
    metadataJson['shell-version'] = projectInfo['shell-version'];

    if (projectInfo['version-name']) {
        metadataJson['version-name'] = projectInfo['version-name'];
    }

    if (projectInfo['home-page']) {
        metadataJson['url'] = projectInfo['home-page'];
    }

    const extFile = projectInfo['use-typescript']
        ? 'extension.ts'
        : 'extension.js';

    await Promise.all([
        fs
            .readFile(
                path.join(templatePath, templateLangDir, 'src', extFile),
                'utf-8',
            )
            .then(async (fileContent) => {
                await fs.writeFile(
                    path.join(projectInfo['target-dir'], 'src', extFile),
                    fileContent.replace(
                        /\$PLACEHOLDER\$/,
                        toPascalCase(projectInfo['project-name']),
                    ),
                );
            }),
        fs.copyFile(
            path.join(templatePath, '_gitignore'),
            path.join(projectInfo['target-dir'], '.gitignore'),
        ),
        fs.copyFile(
            path.join(templatePath, '.editorconfig'),
            path.join(projectInfo['target-dir'], '.editorconfig'),
        ),
        fs.copyFile(
            path.join(templatePath, 'scripts', 'build.sh'),
            path.join(projectInfo['target-dir'], 'scripts', 'build.sh'),
        ),
        fs.writeFile(
            path.join(projectInfo['target-dir'], 'metadata.json'),
            JSON.stringify(metadataJson, null, 2),
        ),
        fs.writeFile(
            path.join(projectInfo['target-dir'], 'package.json'),
            JSON.stringify(packageJson, null, 2),
        ),
        fs.copyFile(
            path.join(import.meta.dirname, 'README.md'),
            path.join(projectInfo['target-dir'], 'README.md'),
        ),
    ]);

    console.log(
        `${GREEN}Project created at ${projectInfo['target-dir']}${RESET}`,
    );

    if (
        projectInfo['use-typescript'] ||
        projectInfo['use-eslint'] ||
        projectInfo['use-prettier'] ||
        projectInfo['use-types']
    ) {
        console.log(
            `Run ${YELLOW}cd ${projectInfo['target-dir']} && npm i${RESET} to install the dependencies before you start coding.`,
        );
    }
}

/**
 * Configures the extension preferences for the project.
 *
 * @param {object} param0
 * @param {object} param0.metadataJson - the parsed metadata.json object
 * @param {object} param0.projectInfo - the information about the project
 * @param {string} param0.templateLangDir - the name of the directory for the
 *    language specific template files
 * @param {string} param0.templatePath - the path to the template directory
 *
 * @returns {Promise<void>}
 */
async function configurePrefs({
    metadataJson,
    projectInfo,
    templateLangDir,
    templatePath,
}) {
    if (projectInfo['use-prefs']) {
        const name = toKebabCase(projectInfo['project-name']);
        const schemasDirPath = path.join(
            projectInfo['target-dir'],
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
                // biome-ignore lint/style/useTemplate: to keep the indents here
                '<?xml version="1.0" encoding="UTF-8"?>\n' +
                    '<schemalist>\n' +
                    `    <schema id="org.gnome.shell.extensions.${name}" path="/org/gnome/shell/extensions/${name}/">\n` +
                    '    </schema>\n' +
                    '</schemalist>',
            ),
        ]);

        metadataJson['settings-schema'] =
            projectInfo['settings-schema'] || projectInfo['uuid'];

        if (projectInfo['use-prefs-window']) {
            const prefsFile = projectInfo['use-typescript']
                ? 'prefs.ts'
                : 'prefs.js';

            await fs
                .readFile(
                    path.join(templatePath, templateLangDir, 'src', prefsFile),
                    'utf-8',
                )
                .then(async (fileContent) => {
                    await fs.writeFile(
                        path.join(projectInfo['target-dir'], 'src', prefsFile),
                        fileContent.replace(
                            /\$PLACEHOLDER\$/,
                            `${toPascalCase(projectInfo['project-name'])}Prefs`,
                        ),
                    );
                });
        }
    }
}

/**
 * Configures Prettier for the project.
 *
 * @param {object} param
 * @param {object} param.packageJson - the parsed package.json object
 * @param {object} param.projectInfo - the information about the project
 * @param {string} param.templatePath - the path to the template directory
 *
 * @returns {Promise<void>}
 */
async function configurePrettier({packageJson, projectInfo, templatePath}) {
    if (projectInfo['use-prettier']) {
        await Promise.all([
            fs.copyFile(
                path.join(templatePath, 'prettier.config.js'),
                path.join(projectInfo['target-dir'], 'prettier.config.js'),
            ),
            fs.copyFile(
                path.join(templatePath, '.prettierignore'),
                path.join(projectInfo['target-dir'], '.prettierignore'),
            ),
        ]);

        if (!projectInfo['use-eslint']) {
            packageJson.devDependencies['eslint-config-prettier'] = undefined;
        }
    } else {
        packageJson.scripts['check:format'] = undefined;
        packageJson.devDependencies['prettier'] = undefined;
        packageJson.devDependencies['eslint-config-prettier'] = undefined;
    }
}

/**
 * Configures the stylesheet for the project.
 *
 * @param {object} param
 * @param {object} param.projectInfo - the information about the project
 *
 * @returns {Promise<void>}
 */
async function configureStylesheet({projectInfo}) {
    if (projectInfo['use-stylesheet']) {
        await fs.writeFile(
            path.join(projectInfo['target-dir'], 'src', 'stylesheet.css'),
            '',
        );
    }
}

/**
 * Configures the translations for the project.
 *
 * @param {object} param
 * @param {object} param.metadataJson - the parsed metadata.json object
 * @param {object} param.packageJson - the parsed package.json object
 * @param {object} param.projectInfo - the information about the project
 * @param {string} param.templatePath - the path to the template directory
 *
 * @returns {Promise<void>}
 */
async function configureTranslations({
    metadataJson,
    packageJson,
    projectInfo,
    templatePath,
}) {
    if (projectInfo['use-translations']) {
        await Promise.all([
            fs.cp(
                path.join(templatePath, 'po'),
                path.join(projectInfo['target-dir'], 'po'),
                {recursive: true},
            ),
            fs.copyFile(
                path.join(templatePath, 'scripts', 'update-translations.sh'),
                path.join(
                    projectInfo['target-dir'],
                    'scripts',
                    'update-translations.sh',
                ),
            ),
        ]);

        metadataJson['gettext-domain'] =
            projectInfo['gettext-domain'] || projectInfo['uuid'];
    } else {
        packageJson.scripts['translations:update'] = undefined;
    }
}

/**
 * Configures the type system or TypeScript for the project.
 *
 * @param {object} param
 * @param {object} param.packageJson - the parsed package.json object
 * @param {object} param.projectInfo - the information about the project
 * @param {string} param.templatePath - the path to the template directory
 * @param {object} param.tsconfigJson - the parsed tsconfig.json object
 *
 * @returns {Promise<void>}
 */
async function configureTypes({
    packageJson,
    projectInfo,
    templatePath,
    tsconfigJson,
}) {
    if (projectInfo['use-types'] || projectInfo['use-typescript']) {
        if (projectInfo['use-typescript']) {
            if (projectInfo['use-esbuild']) {
                await fs.copyFile(
                    path.join(templatePath, 'scripts', 'esbuild.js'),
                    path.join(
                        projectInfo['target-dir'],
                        'scripts',
                        'esbuild.js',
                    ),
                );
            } else {
                tsconfigJson['compilerOptions']['isolatedModules'] = undefined;
            }

            await fs.writeFile(
                path.join(projectInfo['target-dir'], 'tsconfig.json'),
                JSON.stringify(tsconfigJson, null, 2),
            );
        } else {
            await fs.copyFile(
                path.join(templatePath, 'template.js', 'jsconfig.json'),
                path.join(projectInfo['target-dir'], 'jsconfig.json'),
            );
        }

        await fs.copyFile(
            path.join(templatePath, 'ambient.d.ts'),
            path.join(projectInfo['target-dir'], 'ambient.d.ts'),
        );
    } else {
        packageJson.devDependencies['@girs/gjs'] = undefined;
        packageJson.devDependencies['@girs/gnome-shell'] = undefined;
    }
}

/**
 * Gets the CLI arguments as an object that holds information about the project.
 * Conflicting options are resolved.
 *
 * @returns {Promise<object>} the parsed CLI arguments
 */
async function getCleanCliArguments() {
    const {
        values: argv,
        positionals,
        tokens,
    } = parseArgs({
        args: process.argv.slice(2),
        options: CLI_OPTIONS,
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
            argv[key] = getDefaultForOption(key, argv);
        }
    }

    return argv;
}

/**
 * Gets the default value for an option.
 *
 * @param {string} option - the option to get the default value for
 * @param {object} args - the arguments that holds the project infos. That
 *      information may be incomplete when the user didn't provide all options
 *      via the CLI.
 *
 * @returns {string|boolean} the default value for the option
 */
function getDefaultForOption(option, args) {
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
            return args['uuid'];

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
 * Gets the information about the project based on the CLI arguments and user
 * input. Conflicting options are resolved.
 *
 * @returns {Promise<object>} the information object
 */
async function getProjectInfo() {
    const cliArgs = await getCleanCliArguments();
    const projectInfo = {...cliArgs};
    const positiveOptions = Object.keys(CLI_OPTIONS).filter(
        (o) => !o.startsWith('no-'),
    );

    for (const option of positiveOptions) {
        if (
            useOption(option, projectInfo) &&
            projectInfo[option] === undefined
        ) {
            projectInfo[option] = await queryUserFor(option, projectInfo);
        }
    }

    return projectInfo;
}

/**
 * Validates the value of an option.
 *
 * @param {string} option - the option to validate
 * @param {string} value - the value of the option to validate
 *
 * @returns {Promise<boolean>} whether the value is valid
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

                // biome-ignore lint/correctness/noUnusedVariables: test
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
 * Creates a new GNOME Shell extension skeleton project.
 */
async function main() {
    const projectInfo = await getProjectInfo();

    await Promise.all([
        fs.mkdir(path.join(projectInfo['target-dir'], 'src'), {
            recursive: true,
        }),
        fs.mkdir(path.join(projectInfo['target-dir'], 'scripts'), {
            recursive: true,
        }),
    ]);

    const templatePath = path.resolve(import.meta.dirname, 'template');
    const templateLangDir = projectInfo['use-typescript']
        ? 'template.ts'
        : 'template.js';
    const [metadataJson, packageJson, tsconfigJson] = await parseConfigJsons({
        templatePath,
        templateLangDir,
    });

    const data = {
        metadataJson,
        packageJson,
        projectInfo,
        templateLangDir,
        templatePath,
        tsconfigJson,
    };

    await configureTypes(data);
    await configureEslint(data);
    await configurePrettier(data);
    await configurePrefs(data);
    await configureTranslations(data);
    await configureGresources(data);
    await configureStylesheet(data);
    await configureMandatoryFiles(data);
}

/**
 * Queries the user for an option.
 *
 * @param {string} option - the option to query the user for
 * @param {object} partialProjectInfo - the information about the project that
 *    has been gathered so far
 *
 * @returns {Promise<string|boolean>} the user's input for the option
 */
async function queryUserFor(option, partialProjectInfo) {
    switch (option) {
        case 'description':
            console.log(
                `${FAINT}Enter a description, a single-sentence explanation of what your extension does${RESET}`,
            );

            return await prompt('Description:', {
                validate: async (input) =>
                    await isValidOption('description', input),
                defaultValue: getDefaultForOption(
                    'description',
                    partialProjectInfo,
                ),
                onError: 'Description cannot be empty.',
            });

        case 'gettext-domain':
            return await prompt('Enter gettext domain:', {
                defaultValue: getDefaultForOption(
                    'gettext-domain',
                    partialProjectInfo,
                ),
            });

        case 'home-page':
            console.log(
                `${FAINT}Optionally, enter a homepage, for example, a Git repository${RESET}`,
            );

            return await prompt('Homepage:', {
                defaultValue: getDefaultForOption(
                    'home-page',
                    partialProjectInfo,
                ),
            });

        case 'license':
            console.log(`${FAINT}Enter a SPDX License Identifier${RESET}`);

            return await prompt('License:', {
                defaultValue: getDefaultForOption(
                    'license',
                    partialProjectInfo,
                ),
            });

        case 'project-name':
            console.log(
                `${FAINT}Enter a project name. A name should be a short and descriptive string${RESET}`,
            );

            return await prompt('Project name:', {
                validate: async (input) =>
                    await isValidOption('project-name', input),
                defaultValue: getDefaultForOption(
                    'project-name',
                    partialProjectInfo,
                ),
                onError: 'Project name cannot be empty.',
            });

        case 'settings-schema':
            return await prompt('Enter settings schema:', {
                defaultValue: getDefaultForOption(
                    'settings-schema',
                    partialProjectInfo,
                ),
            });

        case 'shell-version':
            console.log(
                `${FAINT}List the GNOME Shell versions that your extension supports in a comma-separated list of numbers >= 45. For example: 45,46,47${RESET}`,
            );

            return (
                await prompt('Supported GNOME Shell versions:', {
                    validate: (input) => isValidOption('shell-version', input),
                    defaultValue: getDefaultForOption(
                        'shell-version',
                        partialProjectInfo,
                    ),
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
                    defaultValue: getDefaultForOption(
                        'target-dir',
                        partialProjectInfo,
                    ),
                    onError: 'Enter a path to a directory that does not exist.',
                }),
            );

        case 'uuid':
            console.log(
                `${FAINT}Enter a UUID. The UUID is a globally-unique identifier for your extension. This should be in the format of an email address (clicktofocus@janedoe.example.com)${RESET}`,
            );

            return await prompt('UUID:', {
                validate: async (input) => await isValidOption('uuid', input),
                defaultValue: getDefaultForOption('uuid', partialProjectInfo),
                onError: 'UUID cannot be empty.',
            });

        case 'use-esbuild':
            console.log(
                `${FAINT}esbuild allows for faster builds but doesn't check your code during the build process. So you will need to rely on your editor's type checking or use \`npm run check:types\` manually. esbuild also comes with some caveats. Visit https://esbuild.github.io/content-types/#typescript-caveats for more information.${RESET}`,
            );

            return await promptYesOrNo('Add esbuild?', {
                defaultValue: getDefaultForOption(
                    'use-esbuild',
                    partialProjectInfo,
                ),
            });

        case 'use-eslint':
            return await promptYesOrNo('Add ESlint?', {
                defaultValue: getDefaultForOption(
                    'use-eslint',
                    partialProjectInfo,
                ),
            });

        case 'use-prefs':
            return await promptYesOrNo('Add preferences?', {
                defaultValue: getDefaultForOption(
                    'use-prefs',
                    partialProjectInfo,
                ),
            });

        case 'use-prefs-window':
            return await promptYesOrNo('Add preference window?', {
                defaultValue: getDefaultForOption(
                    'use-prefs-window',
                    partialProjectInfo,
                ),
            });

        case 'use-prettier':
            return await promptYesOrNo('Add Prettier?', {
                defaultValue: getDefaultForOption(
                    'use-prettier',
                    partialProjectInfo,
                ),
            });

        case 'use-resources':
            return await promptYesOrNo('Use GResources?', {
                defaultValue: getDefaultForOption(
                    'use-resources',
                    partialProjectInfo,
                ),
            });

        case 'use-stylesheet':
            return await promptYesOrNo('Add a stylesheet?', {
                defaultValue: getDefaultForOption(
                    'use-stylesheet',
                    partialProjectInfo,
                ),
            });

        case 'use-translations':
            return await promptYesOrNo('Add translations?', {
                defaultValue: getDefaultForOption(
                    'use-translations',
                    partialProjectInfo,
                ),
            });

        case 'use-types':
            return await promptYesOrNo(
                'Add types to JavaScript with gjsify/ts-for-gir?',
                {
                    defaultValue: getDefaultForOption(
                        'use-types',
                        partialProjectInfo,
                    ),
                },
            );

        case 'use-typescript':
            return await promptYesOrNo('Add TypeScript?', {
                defaultValue: getDefaultForOption(
                    'use-typescript',
                    partialProjectInfo,
                ),
            });

        case 'version-name':
            return await prompt('Version:', {
                defaultValue: getDefaultForOption(
                    'version-name',
                    partialProjectInfo,
                ),
            });
    }
}

/**
 * Parses the metadata.json, package.json, and tsconfig.json files into objects.
 *
 * @param {object} param
 * @param {string} param.templateLangDir - the name of the directory for the
 *    language specific template files
 * @param {string} param.templatePath - the path to the template directory
 *
 * @returns {Promise<Array<object>>} the parsed JSON objects
 */
async function parseConfigJsons({templateLangDir, templatePath}) {
    return await Promise.all([
        fs
            .readFile(path.join(templatePath, 'metadata.json'), 'utf-8')
            .then(JSON.parse),
        fs
            .readFile(
                path.join(templatePath, templateLangDir, 'package.json'),
                'utf-8',
            )
            .then(JSON.parse),
        fs
            .readFile(
                path.join(templatePath, 'template.ts', 'tsconfig.json'),
                'utf-8',
            )
            .then(JSON.parse),
    ]);
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
 * @returns {Promise<string>} the user's input or the default value if the user
 *      doesn't provide an input
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
        }

        if (await validate(input)) {
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
 * @returns {Promise<boolean>} the user's choice
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
        }

        if (input === 'yes' || input === 'y') {
            input = true;
            break;
        }

        if (input === 'no' || input === 'n') {
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
 *
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
 *
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
 * @param {string} option - the option
 * @param {object} args - the arguments that holds the project infos. That
 *      information may be incomplete when the user didn't provide all options
 *      via the CLI.
 *
 * @returns {boolean}
 */
function useOption(option, args) {
    return {
        description: true,
        'gettext-domain': args['use-translations'],
        'home-page': true,
        license: true,
        'no-use-esbuild': args['use-typescript'],
        'no-use-eslint': true,
        'no-use-prefs-window': args['use-prefs'],
        'no-use-prefs': true,
        'no-use-prettier': true,
        'no-use-resources': true,
        'no-use-stylesheet': true,
        'no-use-translations': true,
        'no-use-types': !args['use-typescript'],
        'no-use-typescript': !args['use-types'],
        'project-name': true,
        'settings-schema': args['use-prefs'],
        'shell-version': true,
        'target-dir': true,
        'use-esbuild': args['use-typescript'],
        'use-eslint': true,
        'use-prefs-window': args['use-prefs'],
        'use-prefs': true,
        'use-prettier': true,
        'use-resources': true,
        'use-stylesheet': true,
        'use-translations': true,
        'use-types': !args['use-typescript'],
        'use-typescript': !args['use-types'],
        uuid: true,
        'version-name': true,
    }[option];
}
