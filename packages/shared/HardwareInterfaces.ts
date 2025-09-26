/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Hardware abstraction interfaces for VEET Manager E2E testing.
 * These interfaces enable dependency injection and mocking of hardware dependencies.
 */

/**
 * Mount point information for a drive.
 */
export interface MountPoint {
    path: string;
    label?: string;
}

/**
 * Drive information returned by the drive list interface.
 */
export interface DriveInfo {
    device: string;
    description: string;
    size: number | null;
    mountpoints: MountPoint[];
    isUSB: boolean | null;
    isRemovable: boolean;
}

/**
 * Interface for drive list operations.
 * Abstracts the drivelist library for dependency injection and testing.
 */
export interface IDriveList {
    /**
     * List all available drives.
     * @returns Promise that resolves to an array of drive information
     */
    list(): Promise<DriveInfo[]>;
}

/**
 * Disk usage information for a given path.
 */
export interface DiskUsageInfo {
    available: number;
    free: number;
    total: number;
}

/**
 * Interface for disk usage operations.
 * Abstracts the diskusage library for dependency injection and testing.
 */
export interface IDiskUsage {
    /**
     * Check disk usage for a given path.
     * @param path The path to check disk usage for
     * @returns Promise that resolves to disk usage information
     */
    check(path: string): Promise<DiskUsageInfo>;
}
