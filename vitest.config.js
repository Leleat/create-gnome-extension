import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        coverage: {
            include: ['cli.js', 'index.js'],
        },
    },
});
