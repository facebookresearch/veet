/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { check } from 'diskusage';
import type { IDiskUsage, DiskUsageInfo } from './HardwareInterfaces';

/**
 * Production implementation of IDiskUsage that wraps the diskusage library.
 * This provides the actual disk usage functionality for hardware interaction
 * in production environments.
 */
export class ProductionDiskUsage implements IDiskUsage {
    /**
     * Check disk usage for a given path using the diskusage library.
     * @param path The path to check disk usage for
     * @returns Promise that resolves to disk usage information
     * @throws Error if the path is invalid or disk usage check fails
     */
    async check(path: string): Promise<DiskUsageInfo> {
        try {
            const diskInfo = await check(path);
            return {
                available: diskInfo.available,
                free: diskInfo.free,
                total: diskInfo.total,
            };
        } catch (error) {
            throw new Error(`Failed to check disk usage for path "${path}": ${error}`);
        }
    }
}
