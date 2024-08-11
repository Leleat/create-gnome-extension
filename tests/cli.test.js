import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {getProcessedArgs} from '../src/cli.js';

describe('Processing CLI arguments', () => {
    let originalArgv;

    beforeEach(() => {
        originalArgv = process.argv;
        process.argv = [...originalArgv];
    });

    afterEach(() => {
        process.argv = originalArgv;
    });

    it('should use default values if available, drop invalid values, and remove conflicting options', async () => {
        const uuid = 'uuid';

        process.argv = [
            'node',
            'index.js',
            // (only) positional argument
            'target-dir',
            // valid value
            `--uuid=${uuid}`,
            // invalid default value
            '--shell-version=asdas',
            // valid default values
            '--version-name=',
            '--home-page=',
            '--license=',
            // conflicting options
            '--use-typescript',
            '--use-types',
            // use- and no-use- option simultaneously: last one wins
            '--use-prefs',
            '--no-use-prefs',
            '--no-use-prefs-window',
            '--use-prefs-window',
        ];

        const args = await getProcessedArgs();
        const expected = {
            'target-dir': 'target-dir',
            'version-name': '1.0.0',
            uuid: uuid,
            'home-page': '',
            license: 'GPL-2.0-or-later',
            'use-typescript': true,
            'use-prefs': false,
            'use-prefs-window': true,
        };

        expect(args).toEqual(expected);
    });
});
