/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Configuration for E2E tests only (tests directory in project root).
 * @type {import('vite').UserConfig}
 * @see https://vitest.dev/config/
 */
const config = {
  test: {
    /**
     * Only include test files in the root tests directory for E2E tests.
     */
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    /**
     * The default timeout of 5000ms is sometimes not enough for playwright.
     */
    testTimeout: 30_000,
    hookTimeout: 30_000,

    /**
     * Environment configuration for hardware mocking.
     * Sets NODE_ENV to 'test' to ensure mock hardware implementations are used.
     */
    env: {
      NODE_ENV: 'test',
    },

    /**
     * Run E2E tests sequentially to avoid Electron process conflicts.
     * Multiple Electron instances can't be launched simultaneously.
     */
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
};

export default config;
