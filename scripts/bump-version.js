#!/usr/bin/env node

import * as fs from 'node:fs/promises';

import {Bumper} from 'conventional-recommended-bump';

const bumper = new Bumper(process.cwd()).loadPreset('angular');
const recommendation = await bumper.bump();
const packageJson = await fs.readFile('package.json', 'utf-8').then(JSON.parse);
const prevVersion = packageJson.version;

switch (recommendation.releaseType) {
    case 'major':
        packageJson.version = packageJson.version.replace(
            /(\d+).(\d+).(\d+)/,
            (_, major) => `${Number(major) + 1}.0.0`,
        );

        console.log(
            'Major version bump: %s -> %s',
            prevVersion,
            packageJson.version,
        );

        break;

    case 'minor':
        packageJson.version = packageJson.version.replace(
            /(\d+).(\d+).(\d+)/,
            (_, major, minor) => `${major}.${Number(minor) + 1}.0`,
        );

        console.log(
            'Minor version bump: %s -> %s',
            prevVersion,
            packageJson.version,
        );

        break;

    case 'patch':
        packageJson.version = packageJson.version.replace(
            /(\d+).(\d+).(\d+)/,
            (_, major, minor, patch) =>
                `${major}.${minor}.${Number(patch) + 1}`,
        );

        console.log(
            'Patch version bump: %s -> %s',
            prevVersion,
            packageJson.version,
        );

        break;

    default:
        console.log('Maybe someting went wrong... no changes detected');
        process.exit(1);
}

await fs.writeFile('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
