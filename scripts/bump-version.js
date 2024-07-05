#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

import {Bumper} from 'conventional-recommended-bump';

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

/*******************************************************************************
 * Functions *******************************************************************
 *******************************************************************************/

async function main() {
    process.chdir(path.resolve(import.meta.dirname, '..'));

    const packageJsonPath = path.resolve(process.cwd(), 'package.json');
    const packageJson = await fs
        .readFile(packageJsonPath, 'utf-8')
        .then(JSON.parse);
    const bumper = new Bumper(process.cwd()).loadPreset('angular');
    const recommendation = await bumper.bump();
    const prevVersion = packageJson.version;

    packageJson.version = getNewVersion(
        prevVersion,
        recommendation.releaseType,
    );

    await fs.writeFile(
        packageJsonPath,
        `${JSON.stringify(packageJson, null, 2)}\n`,
    );

    console.log('Version bumped: %s -> %s', prevVersion, packageJson.version);
}

/**
 * Gets the recommended new version number.
 *
 * @param {string} currentVersion - the current version number
 * @param {string|undefined} releaseType - the release type of
 *      BumperRecommendation
 *
 * @returns {string} - the recommended new version number
 */
function getNewVersion(currentVersion, releaseType) {
    const versionRegex = /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/;
    const match = currentVersion.match(versionRegex);

    if (!match) {
        throw new Error('Invalid version format in package.json');
    }

    const {major, minor, patch} = match.groups;

    switch (releaseType) {
        case 'major':
            return `${Number(major) + 1}.0.0`;
        case 'minor':
            return `${major}.${Number(minor) + 1}.0`;
        case 'patch':
            return `${major}.${minor}.${Number(patch) + 1}`;
        default:
            throw new Error('Maybe someting went wrong... no changes detected');
    }
}
