#!/usr/bin/env node

import * as esbuild from 'esbuild';
import esbuildPluginTsc from 'esbuild-plugin-tsc';

esbuild.build({
    entryPoints: ['src/**/*.ts'],
    outdir: 'dist/',
    platform: 'neutral',
    plugins: [
        // esbuild doesn't support TypeScript's stage 3 decorators, so we need
        // this plugin to use `tsc` to transpile the files which use them. Or
        // we could use the stage 2 decorators via the `experimentalDecorators`
        // option, which is supported by esbuild... but that seems worse.
        esbuildPluginTsc(),
    ],
});
