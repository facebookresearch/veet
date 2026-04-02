/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { statfs } from 'node:fs/promises';
import type { IDiskUsage, DiskUsageInfo } from './HardwareInterfaces';

/**
 * Production implementation of IDiskUsage that uses Node.js built-in fs.statfs.
 * This provides the actual disk usage functionality for hardware interaction
 * in production environments.
 */
export class ProductionDiskUsage implements IDiskUsage {
    /**
     * Check disk usage for a given path using Node.js fs.statfs.
     * @param path The path to check disk usage for
     * @returns Promise that resolves to disk usage information
     * @throws Error if the path is invalid or disk usage check fails
     */
    async check(path: string): Promise<DiskUsageInfo> {
        try {
            const stats = await statfs(path);
            return {
                available: stats.bavail * stats.bsize,
                free: stats.bfree * stats.bsize,
                total: stats.blocks * stats.bsize,
            };
        } catch (error) {
            throw new Error(`Failed to check disk usage for path "${path}": ${error}`);
        }
    }
}
