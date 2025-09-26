#!/usr/bin/env node
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Cross-platform build script for VEET Manager
 *
 * This script replaces the yarn build command to ensure compatibility
 * with Windows cmd.exe where unix shell operators are not supported.
 */

import {execSync, spawn} from 'child_process';
import path from 'path';
import fs from 'fs';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the package.json to access config
const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const repoPath = packageJson.config?.repo_path;

/**
 * Execute a command with proper error handling and output streaming
 */
function runCommand(command, args = [], options = {}) {
  console.log(`Running: ${command} ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    });

    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(' ')}`));
      }
    });

    child.on('error', error => {
      reject(error);
    });
  });
}

/**
 * Check if edenfs is available and add redirect for dist directory
 */
async function setupEdenRedirect() {
  if (process.platform !== 'darwin') {
    console.log('Skipping Eden redirect setup (not on macOS)');
    return;
  }

  if (!repoPath) {
    console.log('No repo_path found in package.json config, skipping Eden redirect');
    return;
  }

  try {
    // Check if edenfsctl is available and we're in an Eden repository
    execSync('edenfsctl info .', {stdio: 'ignore'});

    // Add Eden redirect for dist directory to improve build performance
    const distPath = `${repoPath}/dist`;
    execSync(`eden redirect add ${distPath} bind`, {stdio: 'inherit'});
    console.log(`Added Eden bind redirect for ${distPath}`);
  } catch (error) {
    console.log('Eden not found or not in Eden repository, skipping redirect setup');
  }
}

/**
 * Run the Vite build process for all packages
 */
async function runViteBuild() {
  console.log('Building Vite packages...');

  // Build in sequence: main, preload, then renderer
  await runCommand('yarn', ['viteBuild:main']);
  await runCommand('yarn', ['viteBuild:preload']);
  await runCommand('yarn', ['viteBuild:renderer']);

  console.log('Vite build completed successfully');
}

/**
 * Run electron-builder to package the application
 */
async function runElectronBuilder() {
  console.log('Running electron-builder...');
  await runCommand('yarn', ['electron-builder']);
  console.log('Electron builder completed successfully');
}

/**
 * Main build function
 */
async function build() {
  try {
    console.log('Starting VEET Manager build process...');

    // Step 1: Setup Eden redirect if on macOS
    await setupEdenRedirect();

    // Step 2: Build all Vite packages
    await runViteBuild();

    // Step 3: Package with electron-builder
    await runElectronBuilder();

    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

// Run the build if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  build();
}

export {build, runViteBuild, runElectronBuilder, setupEdenRedirect};
