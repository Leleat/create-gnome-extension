#!/usr/bin/env node

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';

import {
    AnsiEscSeq,
    Options as CliOptions,
    getDefaultForOption,
    getProcessedArgs,
    isValidOption,
    prompt,
    promptYesOrNo,
    useOption,
} from './cli.js';

const shouldExecute =
    process.argv[1].endsWith('create-gnome-extension') ||
    import.meta.url.includes(process.argv[1]);

if (shouldExecute) {
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
            path.join(import.meta.dirname, '..', 'README.md'),
            path.join(projectInfo['target-dir'], 'README.md'),
        ),
    ]);

    console.log(
        `${AnsiEscSeq.GREEN}Project created at ${projectInfo['target-dir']}${AnsiEscSeq.RESET}`,
    );

    if (
        projectInfo['use-typescript'] ||
        projectInfo['use-eslint'] ||
        projectInfo['use-prettier'] ||
        projectInfo['use-types']
    ) {
        console.log(
            `Run ${AnsiEscSeq.YELLOW}cd ${projectInfo['target-dir']} && npm i${AnsiEscSeq.RESET} to install the dependencies before you start coding.`,
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
                packageJson.devDependencies['esbuild'] = undefined;
                packageJson.devDependencies['esbuild-plugin-tsc'] = undefined;
                tsconfigJson.compilerOptions['isolatedModules'] = undefined;
                tsconfigJson.compilerOptions['experimentalDecorators'] =
                    undefined;
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
 * Gets the information about the project based on the CLI arguments and user
 * input. Conflicting options are resolved and superfluous options are removed.
 * E. g. if the user passes `--use-esbuild` via CLI but chooses not to use TS,
 * the option is removed.
 *
 * @returns {Promise<object>} the information object
 */
// biome-ignore lint/suspicious/noFunctionAssign: So that we can export the function only for tests but keep it 'private' otherwise
async function getProjectInfo() {
    const cliArgs = await getProcessedArgs();
    const projectInfo = {...cliArgs};
    const positiveOptions = Object.keys(CliOptions).filter(
        (o) => !o.startsWith('no-'),
    );

    for (const option of positiveOptions) {
        if (useOption(option, projectInfo)) {
            projectInfo[option] =
                projectInfo[option] ??
                (await queryUserFor(option, projectInfo));
        } else {
            delete projectInfo[option];
        }
    }

    return projectInfo;
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

    const templatePath = path.resolve(import.meta.dirname, '..', 'template');
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
                `${AnsiEscSeq.FAINT}Enter a description, a single-sentence explanation of what your extension does${AnsiEscSeq.RESET}`,
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
                `${AnsiEscSeq.FAINT}Optionally, enter a homepage, for example, a Git repository${AnsiEscSeq.RESET}`,
            );

            return await prompt('Homepage:', {
                defaultValue: getDefaultForOption(
                    'home-page',
                    partialProjectInfo,
                ),
            });

        case 'license':
            console.log(
                `${AnsiEscSeq.FAINT}Enter a SPDX License Identifier${AnsiEscSeq.RESET}`,
            );

            return await prompt('License:', {
                defaultValue: getDefaultForOption(
                    'license',
                    partialProjectInfo,
                ),
            });

        case 'project-name':
            console.log(
                `${AnsiEscSeq.FAINT}Enter a project name. A name should be a short and descriptive string${AnsiEscSeq.RESET}`,
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
                `${AnsiEscSeq.FAINT}List the GNOME Shell versions that your extension supports in a comma-separated list of numbers >= 45. For example: 45,46,47${AnsiEscSeq.RESET}`,
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
            console.log(
                `${AnsiEscSeq.FAINT}Enter the path for your project${AnsiEscSeq.RESET}`,
            );

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
                `${AnsiEscSeq.FAINT}Enter a UUID. The UUID is a globally-unique identifier for your extension. This should be in the format of an email address (clicktofocus@janedoe.example.com)${AnsiEscSeq.RESET}`,
            );

            return await prompt('UUID:', {
                validate: async (input) => await isValidOption('uuid', input),
                defaultValue: getDefaultForOption('uuid', partialProjectInfo),
                onError: 'UUID cannot be empty.',
            });

        case 'use-esbuild':
            console.log(
                `${AnsiEscSeq.FAINT}esbuild allows for faster builds but doesn't check your code during the build process. So you will need to rely on your editor's type checking or use \`npm run check:types\` manually. esbuild also comes with some caveats. E. g. esbuild doesn't support stage 3 decorators, so you will use TypeScripts experimental stage 2 decorators. Visit https://esbuild.github.io/content-types/#typescript-caveats for more.${AnsiEscSeq.RESET}`,
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

if (process.env.VITEST !== 'true') {
    getProjectInfo = undefined;
}

export {getProjectInfo};
