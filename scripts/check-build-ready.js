#!/usr/bin/env node
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {existsSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Define all the build artifacts we need to check
const requiredFiles = [
  // Native module binaries
  'node_modules/drivelist/build/Release/drivelist.node',
  'node_modules/diskusage/build/Release/diskusage.node',
  'node_modules/@serialport/bindings-cpp/prebuilds/darwin-x64+arm64/node.napi.node',

  // Other important native modules that might be needed
  'node_modules/fsevents/fsevents.node',

  // Vite build artifacts for each package
  'packages/main/dist/index.js',
  'packages/preload/dist/index.mjs',
  'packages/renderer/dist/index.html',
];

// Optional files that are good to have but not strictly required
const optionalFiles = [
  'dist', // electron-builder output directory
];

function checkBuildReady(options = {shouldExit: true, silent: false}) {
  const missing = [];
  const optional = [];

  // Check required files
  for (const file of requiredFiles) {
    const fullPath = join(projectRoot, file);
    if (!existsSync(fullPath)) {
      missing.push(file);
    }
  }

  // Check optional files
  for (const file of optionalFiles) {
    const fullPath = join(projectRoot, file);
    if (!existsSync(fullPath)) {
      optional.push(file);
    }
  }

  // Report results
  if (missing.length === 0) {
    if (!options.silent) {
      console.log('✅ All required build artifacts are present');

      if (optional.length > 0) {
        console.log('ℹ️  Some optional files are missing (this is usually fine):');
        optional.forEach(file => console.log(`   - ${file}`));
      }

      console.log('\n🚀 Ready to run yarn watch or yarn test!');
    }

    if (options.shouldExit) {
      process.exit(0);
    }
    return true;
  } else {
    if (!options.silent) {
      console.log('❌ Missing required build artifacts:');
      missing.forEach(file => console.log(`   - ${file}`));

      console.log('\n💡 Run "yarn build" to generate missing artifacts');
    }

    if (options.shouldExit) {
      process.exit(1);
    }
    return false;
  }
}

// Allow this script to be run directly or imported
if (import.meta.url === `file://${process.argv[1]}`) {
  checkBuildReady();
}

export {checkBuildReady};
