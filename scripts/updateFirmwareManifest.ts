/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'fs-extra';
import path from 'path';
import md5File from 'md5-file';

type FirmwareManifest = {
  binFile: string;
  version: string;
  md5: string;
};

const versionRegex = /^[0-9]+\.[0-9]+\.[0-9]+$/;

function updateFirmwareManifest(pathToProjectRoot: string, version: string) {
  // Check for valid version
  if (!versionRegex.test(version)) {
    console.log(`Invalid version ${version}, must be in the form of <NUM>.<NUM>.<NUM>`);
    process.exit(1);
  }

  const firmwarePath = path.join(pathToProjectRoot, 'firmware');
  try {
    const files = fs.readdirSync(firmwarePath);
    let binFile: string = '';
    for (const file of files) {
      if (file.endsWith('.bin')) {
        if (binFile.length > 0) {
          console.log('Multiple bin files found in firmware directory');
          process.exit(1);
        }
        binFile = file;
      }
    }
    if (binFile.length === 0) {
      console.log('No bin file found in firmware directory');
      process.exit(1);
    }
    const manifest: FirmwareManifest = {
      binFile,
      version,
      md5: md5File.sync(path.join(firmwarePath, binFile)),
    };
    const manifestPath = path.join(firmwarePath, 'manifest.json');
    fs.writeJSONSync(manifestPath, manifest, {spaces: 2});
    console.log(`Updated ${manifestPath}: ${JSON.stringify(manifest)}`);
  } catch (err) {
    console.log('Error reading firmware directory');
    process.exit(1);
  }
}

if (!process.argv[2]) {
  console.log('Usage: tsx updateFirmwareManifest.ts <path-to-project-root> <version>');
  process.exit(1);
}

if (!process.argv[3]) {
  console.log('No version provided');
  console.log('Usage: tsx updateFirmwareManifest.ts <path-to-project-root> <version>');
  process.exit(1);
}
updateFirmwareManifest(process.argv[2], process.argv[3]);
