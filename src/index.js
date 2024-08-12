#!/usr/bin/env node

import toCamelCase from 'lodash.camelcase';
import toKebabCase from 'lodash.kebabcase';
import toFirstUpper from 'lodash.upperfirst';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';
import prompts from 'prompts';

import {PackageDependencies} from './package.versions.js';

const AnsiEscSeq = {
    RESET: '\x1b[0m',
    BOLD: '\x1b[1m',
    FAINT: '\x1b[2m',
    RED: '\x1b[31m',
    YELLOW: '\x1b[33m',
    GREEN: '\x1b[92m',
};

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
    if (projectInfo.useEslint) {
        if (!projectInfo.useTypeScript) {
            await fs.cp(
                path.join(templatePath, 'template.js', 'lint'),
                path.join(projectInfo.targetDir, 'lint'),
                {recursive: true},
            );
        }

        await fs.copyFile(
            path.join(templatePath, templateLangDir, 'eslint.config.js'),
            path.join(projectInfo.targetDir, 'eslint.config.js'),
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
    if (projectInfo.useResources) {
        await fs.cp(
            path.join(templatePath, 'data'),
            path.join(projectInfo.targetDir, 'data'),
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
    metadataJson['name'] = projectInfo.projectName;
    metadataJson['description'] = projectInfo.description;
    metadataJson['uuid'] = projectInfo.uuid;
    metadataJson['shell-version'] = projectInfo.shellVersions;

    if (projectInfo.versionName) {
        metadataJson['version-name'] = projectInfo.versionName;
    }

    if (projectInfo.homepage) {
        metadataJson['url'] = projectInfo.homepage;
    }

    const extFile = projectInfo.useTypeScript ? 'extension.ts' : 'extension.js';
    const minShellVersion = projectInfo.shellVersions.reduce((prev, curr) =>
        Math.min(prev, curr),
    );
    const versionedDeps = PackageDependencies[minShellVersion];

    if (versionedDeps) {
        const deps = Object.keys(packageJson.devDependencies).reduce(
            (d, key) => {
                d[key] = versionedDeps[key] ?? packageJson.devDependencies[key];
                return d;
            },
            {},
        );

        packageJson.devDependencies = {
            ...packageJson.devDependencies,
            ...deps,
        };
    }

    await Promise.all([
        fs
            .readFile(
                path.join(templatePath, templateLangDir, 'src', extFile),
                'utf-8',
            )
            .then(async (fileContent) => {
                await fs.writeFile(
                    path.join(projectInfo.targetDir, 'src', extFile),
                    fileContent.replace(
                        /\$PLACEHOLDER\$/,
                        toPascalCase(projectInfo.projectName),
                    ),
                );
            }),
        fs.copyFile(
            path.join(templatePath, '_gitignore'),
            path.join(projectInfo.targetDir, '.gitignore'),
        ),
        fs.copyFile(
            path.join(templatePath, '.editorconfig'),
            path.join(projectInfo.targetDir, '.editorconfig'),
        ),
        fs.copyFile(
            path.join(templatePath, 'scripts', 'build.sh'),
            path.join(projectInfo.targetDir, 'scripts', 'build.sh'),
        ),
        fs.writeFile(
            path.join(projectInfo.targetDir, 'metadata.json'),
            JSON.stringify(metadataJson, null, 2),
        ),
        fs.writeFile(
            path.join(projectInfo.targetDir, 'package.json'),
            JSON.stringify(packageJson, null, 2),
        ),
        fs.copyFile(
            path.join(import.meta.dirname, '..', 'README.md'),
            path.join(projectInfo.targetDir, 'README.md'),
        ),
    ]);

    console.log(
        `${AnsiEscSeq.GREEN}Project created at ${projectInfo.targetDir}${AnsiEscSeq.RESET}`,
    );

    if (
        projectInfo.useTypeScript ||
        projectInfo.useEslint ||
        projectInfo.usePrettier ||
        projectInfo.useTypes
    ) {
        console.log(
            `Run ${AnsiEscSeq.YELLOW}cd ${projectInfo.targetDir} && npm i${AnsiEscSeq.RESET} to install the dependencies before you start coding.`,
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
    if (projectInfo.usePrefs) {
        const name = toKebabCase(projectInfo.projectName);
        const schemasDirPath = path.join(
            projectInfo.targetDir,
            'src',
            'schemas',
        );
        const filePath = path.join(
            schemasDirPath,
            `org.gnome.shell.extensions.${name}.gschema.xml`,
        );

        await fs.mkdir(schemasDirPath, {recursive: true});
        await fs.writeFile(
            filePath,
            '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<schemalist>\n' +
                `    <schema id="org.gnome.shell.extensions.${name}" path="/org/gnome/shell/extensions/${name}/">\n` +
                '    </schema>\n' +
                '</schemalist>',
        );

        metadataJson['settings-schema'] =
            projectInfo.settingsSchema || projectInfo.uuid;

        if (projectInfo.usePrefsWindow) {
            const prefsFile =
                projectInfo.useTypeScript ? 'prefs.ts' : 'prefs.js';

            await fs
                .readFile(
                    path.join(templatePath, templateLangDir, 'src', prefsFile),
                    'utf-8',
                )
                .then(async (fileContent) => {
                    let content = fileContent.replace(
                        /\$PLACEHOLDER\$/,
                        `${toPascalCase(projectInfo.projectName)}Prefs`,
                    );
                    const minShellVersion = projectInfo.shellVersions.reduce(
                        (prev, curr) => Math.min(prev, curr),
                    );

                    if (minShellVersion < 47) {
                        content = content.replaceAll('async ', '');
                    }

                    await fs.writeFile(
                        path.join(projectInfo.targetDir, 'src', prefsFile),
                        content,
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
    if (projectInfo.usePrettier) {
        await Promise.all([
            fs.copyFile(
                path.join(templatePath, 'prettier.config.js'),
                path.join(projectInfo.targetDir, 'prettier.config.js'),
            ),
            fs.copyFile(
                path.join(templatePath, '.prettierignore'),
                path.join(projectInfo.targetDir, '.prettierignore'),
            ),
        ]);

        if (!projectInfo.useEslint) {
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
    if (projectInfo.useStylesheet) {
        await fs.writeFile(
            path.join(projectInfo.targetDir, 'src', 'stylesheet.css'),
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
    if (projectInfo.useTranslations) {
        await Promise.all([
            fs.cp(
                path.join(templatePath, 'po'),
                path.join(projectInfo.targetDir, 'po'),
                {recursive: true},
            ),
            fs.copyFile(
                path.join(templatePath, 'scripts', 'update-translations.sh'),
                path.join(
                    projectInfo.targetDir,
                    'scripts',
                    'update-translations.sh',
                ),
            ),
        ]);

        metadataJson['gettext-domain'] =
            projectInfo.gettextDomain || projectInfo.uuid;
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
    if (projectInfo.useTypes || projectInfo.useTypeScript) {
        if (projectInfo.useTypeScript) {
            if (projectInfo.useEsbuild) {
                await fs.copyFile(
                    path.join(templatePath, 'scripts', 'esbuild.js'),
                    path.join(projectInfo.targetDir, 'scripts', 'esbuild.js'),
                );
            } else {
                packageJson.devDependencies['esbuild'] = undefined;
                packageJson.devDependencies['esbuild-plugin-tsc'] = undefined;
                tsconfigJson.compilerOptions['isolatedModules'] = undefined;
                tsconfigJson.compilerOptions['experimentalDecorators'] =
                    undefined;
            }

            await fs.writeFile(
                path.join(projectInfo.targetDir, 'tsconfig.json'),
                JSON.stringify(tsconfigJson, null, 2),
            );
        } else {
            await fs.copyFile(
                path.join(templatePath, 'template.js', 'jsconfig.json'),
                path.join(projectInfo.targetDir, 'jsconfig.json'),
            );
        }

        await fs.copyFile(
            path.join(templatePath, 'ambient.d.ts'),
            path.join(projectInfo.targetDir, 'ambient.d.ts'),
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
async function queryProjectInfo() {
    const questions = [
        {
            type: 'text',
            name: 'targetDir',
            message: 'Enter the path for your project',
            validate: async (value) =>
                fs
                    .access(path.resolve(value), fs.constants.F_OK)
                    .then(() => 'Directory already exists.')
                    .catch(() => true),
        },
        {
            type: 'text',
            name: 'projectName',
            message: 'Enter a project name',
            validate: (value) =>
                /\w+/.test(value) || 'The project name is required.',
        },
        {
            type: 'text',
            name: 'description',
            message: 'Enter a short description of what your extension does',
            validate: (value) =>
                /\w+/.test(value) || 'The description is required.',
        },
        {
            type: 'text',
            name: 'versionName',
            message: 'Enter the initial version name of your extension',
            initial: '1.0.0',
        },
        {
            type: 'text',
            name: 'license',
            message: 'License of your project',
            initial: 'GPL-3.0-or-later',
        },
        {
            type: 'text',
            name: 'homepage',
            message: 'Homepage',
            initial: '',
        },
        {
            type: 'text',
            name: 'uuid',
            message:
                'Enter a UUID, a globally-unique identifier, for your extension',
            validate: (value) => /\w+/.test(value) || 'The UUID is required.',
        },
        {
            type: 'list',
            name: 'shellVersions',
            message:
                'Enter the GNOME Shell versions your extension supports as a comma-separated list of numbers',
            validate: (value) =>
                value
                    .split(',')
                    .map((v) => v.trim())
                    .every((v) => /\d+/.test(v) && v >= 45),
        },
        {
            type: 'toggle',
            name: 'useTypeScript',
            message: 'Use TypeScript?',
            active: 'yes',
            inactive: 'no',
            initial: false,
        },
        {
            type: (prev, values) => (values.useTypeScript ? 'toggle' : null),
            name: 'useEsbuild',
            message: 'Use esbuild?',
            active: 'yes',
            inactive: 'no',
            initial: true,
        },
        {
            type: (prev, values) => (values.useTypeScript ? null : 'toggle'),
            name: 'useTypes',
            message:
                'Add GNOME API types to JavaScript with gjsify/ts-for-gir?',
            active: 'yes',
            inactive: 'no',
            initial: false,
        },
        {
            type: 'toggle',
            name: 'useEslint',
            message: 'Add ESlint?',
            active: 'yes',
            inactive: 'no',
            initial: true,
        },
        {
            type: 'toggle',
            name: 'usePrettier',
            message: 'Add Prettier?',
            active: 'yes',
            inactive: 'no',
            initial: true,
        },
        {
            type: 'toggle',
            name: 'useTranslations',
            message: 'Do you want to offer translations for your extension?',
            active: 'yes',
            inactive: 'no',
            initial: false,
        },
        {
            type: (prev, values) => (values.useTranslations ? 'text' : null),
            name: 'gettextDomain',
            message: 'Enter a gettext domain',
            initial: (prev, values) => values.uuid,
            validate: (value) =>
                /\w+/.test(value) || 'The gettext domain is required.',
        },
        {
            type: 'toggle',
            name: 'usePrefs',
            message: 'Add a preferences to your extensions with gsettings?',
            active: 'yes',
            inactive: 'no',
            initial: false,
        },
        {
            type: (prev, values) => (values.usePrefs ? 'text' : null),
            name: 'settingsSchema',
            message: 'Enter a settings schema',
            initial: (prev, values) => values.uuid,
            validate: (value) => /\w+/.test(value) || 'The schema is required.',
        },
        {
            type: (prev, values) => (values.usePrefs ? 'toggle' : null),
            name: 'usePrefsWindow',
            message: 'Add a preferences window?',
            active: 'yes',
            inactive: 'no',
            initial: true,
        },
        {
            type: 'toggle',
            name: 'useStylesheet',
            message: 'Use a stylesheet?',
            active: 'yes',
            inactive: 'no',
            initial: false,
        },
        {
            type: 'toggle',
            name: 'useResources',
            message: 'Use GResources?',
            active: 'yes',
            inactive: 'no',
            initial: false,
        },
    ];

    return await prompts(questions, {
        onCancel: () => {
            throw new Error('Creation of the project was canceled.');
        },
    });
}

/**
 * Creates a new GNOME Shell extension skeleton project.
 */
async function main() {
    const projectInfo = await queryProjectInfo();

    await Promise.all([
        fs.mkdir(path.join(projectInfo.targetDir, 'src'), {
            recursive: true,
        }),
        fs.mkdir(path.join(projectInfo.targetDir, 'scripts'), {
            recursive: true,
        }),
    ]);

    const templatePath = path.resolve(import.meta.dirname, '..', 'template');
    const templateLangDir =
        projectInfo.useTypeScript ? 'template.ts' : 'template.js';
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
 * Turns a string into PascalCase.
 *
 * @param {string} string - the input string
 *
 * @returns {string} - the string in PascalCase
 */
function toPascalCase(string) {
    return toFirstUpper(toCamelCase(string));
}
