import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {getProjectInfo} from '../index.js';

beforeAll(() => {
    vi.mock('../cli.js', async (importOriginal) => {
        const original = await importOriginal();

        return {
            ...original,
            prompt: vi
                .fn(() => {
                    throw new Error(
                        'Unexpected prompt... forgot to update the test?',
                    );
                })
                .mockImplementationOnce(async () => 'uuid')
                .mockImplementationOnce(async () => '46'),
            promptYesOrNo: vi.fn(() => false),
        };
    });
});

afterAll(() => {
    vi.restoreAllMocks();
});

describe('Collect missing project information', () => {
    let originalArgv;

    beforeEach(() => {
        originalArgv = process.argv;
        process.argv = [...originalArgv];
    });

    afterEach(() => {
        process.argv = originalArgv;
    });

    it('should query the user for missing project information', async () => {
        process.argv = [
            'node',
            'index.js',
            'target-dir',
            // Skip query if valid value is provided
            '--project-name=Project',
            '--description=Description',
            '--version-name=1.0.0',
            '--license=GPL-2.0-or-later',
            '--home-page=',
            '--no-use-prefs',
            // Skip conflicting option query (here: TypeScript)
            '--use-types',
            // Query if invalid value is provided
            '--shell-version=not-a-list-of-versions',
        ];

        const projectInfo = await getProjectInfo();

        expect(projectInfo).toEqual({
            'target-dir': 'target-dir',
            'project-name': 'Project',
            'description': 'Description',
            'version-name': '1.0.0',
            'license': 'GPL-2.0-or-later',
            'home-page': '',
            'uuid': 'uuid',
            'shell-version': ['46'],
            'use-types': true,
            'use-eslint': false,
            'use-prettier': false,
            'use-translations': false,
            'use-prefs': false,
            'use-stylesheet': false,
            'use-resources': false,
        });
    });
});
