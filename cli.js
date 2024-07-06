import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import readline from 'node:readline';
import {parseArgs} from 'node:util';

const Options = {
    'target-dir': {type: 'string'},
    'project-name': {type: 'string'},
    'description': {type: 'string'},
    'version-name': {type: 'string'},
    'license': {type: 'string'},
    'home-page': {type: 'string'},
    'uuid': {type: 'string'},
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

const AnsiEscSeq = {
    RESET: '\x1b[0m',
    BOLD: '\x1b[1m',
    FAINT: '\x1b[2m',
    RED: '\x1b[31m',
    YELLOW: '\x1b[33m',
    GREEN: '\x1b[92m',
};

/**
 * Gets the conflicting options.
 *
 * @returns {string[][]} an array of options that conflict with each other
 */
function getConflictingOptions() {
    return [['use-typescript', 'use-types']];
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
            throw new Error(`Unknown option: ${option}`);
    }
}

/**
 * Gets the CLI arguments as an object that holds information about the project.
 * Conflicting options are resolved and bool options are merged into 1 JS
 * boolean each.
 *
 * @returns {Promise<object>} the parsed CLI arguments
 */
async function getProcessedArgs() {
    const {
        values: argv,
        positionals,
        tokens,
    } = parseArgs({
        args: process.argv.slice(2),
        options: Options,
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

    for (const conflictingOptions of getConflictingOptions()) {
        if (conflictingOptions.some((o) => argv[o])) {
            conflictingOptions
                .filter((o) => argv[o])
                .slice(1)
                .forEach((o) => delete argv[o]);
        }
    }

    argv['target-dir'] = argv['target-dir'] ?? positionals[0];

    const optionNames = Object.keys(Options);

    for (const [key, value] of Object.entries(argv)) {
        if (!optionNames.includes(key)) {
            delete argv[key];
            console.warn(`Unknown option passed: ${key}`);
        } else if (!(await isValidOption(key, value))) {
            delete argv[key];
        } else if (value === '') {
            argv[key] = getDefaultForOption(key, argv);
        }
    }

    return argv;
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
            throw new Error(`Unknown option: ${option}`);
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
            `${AnsiEscSeq.BOLD}${prompt}${AnsiEscSeq.RESET}${AnsiEscSeq.FAINT}${defaultString}${AnsiEscSeq.RESET} `,
        );
        input = input.trim();

        if (input === '' && defaultValue !== undefined) {
            input = defaultValue;
            break;
        }

        if (await validate(input)) {
            break;
        }

        console.log(`${AnsiEscSeq.RED}${onError}${AnsiEscSeq.RESET}`);
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
            `${AnsiEscSeq.BOLD}${prompt}${AnsiEscSeq.RESET} ${AnsiEscSeq.FAINT}[${option}]${AnsiEscSeq.RESET}: `,
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

        console.log(
            `${AnsiEscSeq.RED}Please enter "y" or "n".${AnsiEscSeq.RESET}`,
        );
    }

    lineReader.close();

    return input;
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
    const options = {
        'description': true,
        'gettext-domain': args['use-translations'],
        'home-page': true,
        'license': true,
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
        'uuid': true,
        'version-name': true,
    };

    if (Object.keys(options).indexOf(option) === -1) {
        throw new Error(`Unknown option: ${option}`);
    }

    return options[option];
}

export {
    AnsiEscSeq,
    getDefaultForOption,
    getProcessedArgs,
    isValidOption,
    Options,
    prompt,
    promptYesOrNo,
    useOption,
};
