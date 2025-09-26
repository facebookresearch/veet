#!/usr/bin/env node
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {execSync} from 'child_process';
import {checkBuildReady} from './check-build-ready.js';

/**
 * Ensures the project is built and ready to run.
 * If not built, automatically runs yarn build.
 * If already built, skips the build step.
 */
function ensureBuildReady() {
  // Check if build is ready (returns true if ready, false if not)
  const isReady = checkBuildReady({shouldExit: false, silent: false});

  if (!isReady) {
    // Build artifacts are missing, run the build
    console.log('\n🔨 Running yarn build to generate missing artifacts...');
    try {
      execSync('yarn build', {stdio: 'inherit'});
      console.log('✅ Build completed successfully!');

      // Verify the build worked
      const isReadyAfterBuild = checkBuildReady({shouldExit: false, silent: true});
      if (isReadyAfterBuild) {
        console.log('🚀 Ready to run yarn watch or yarn test!');
      } else {
        console.error('❌ Build completed but some artifacts are still missing');
        process.exit(1);
      }
    } catch (buildError) {
      console.error('❌ Build failed:', buildError.message);
      process.exit(1);
    }
  }
}

// Allow this script to be run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureBuildReady();
}
