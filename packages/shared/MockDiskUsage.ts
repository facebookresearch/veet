/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDiskUsage, DiskUsageInfo } from './HardwareInterfaces';

/**
 * Mock disk storage configuration for testing scenarios.
 */
export interface MockDiskInfo {
    /** Path this mock applies to */
    path: string;
    /** Total storage capacity in bytes */
    total: number;
    /** Available storage in bytes */
    available: number;
    /** Free storage in bytes (may differ from available due to reserved space) */
    free: number;
}

/**
 * Configuration for mock disk usage scenarios.
 */
export interface MockDiskUsageConfig {
    /** Map of paths to their disk usage information */
    diskMap: Record<string, MockDiskInfo>;
    /** Default disk info for unmapped paths */
    defaultDisk: MockDiskInfo;
    /** Simulate latency in milliseconds (default: 25ms) */
    latencyMs?: number;
    /** Probability of simulating a temporary error (0-1, default: 0) */
    errorProbability?: number;
    /** Paths that should trigger specific error types */
    errorPaths?: Record<string, string>;
}

/**
 * Mock implementation of IDiskUsage for testing purposes.
 * Provides configurable storage scenarios without requiring actual disk access.
 */
export class MockDiskUsage implements IDiskUsage {
    private config: MockDiskUsageConfig;

    constructor(config?: Partial<MockDiskUsageConfig>) {
        this.config = {
            diskMap: {},
            defaultDisk: {
                path: '/',
                total: 1000000000000, // 1TB default
                available: 500000000000, // 500GB available
                free: 500000000000, // 500GB free
            },
            latencyMs: 25,
            errorProbability: 0,
            errorPaths: {},
            ...config,
        };
    }

    /**
     * Update the mock configuration for testing different scenarios.
     * @param config New configuration to apply
     */
    setConfig(config: Partial<MockDiskUsageConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Add or update disk usage information for a specific path.
     * @param path The path to configure
     * @param diskInfo The mock disk information
     */
    setDiskInfo(path: string, diskInfo: MockDiskInfo): void {
        this.config.diskMap[path] = diskInfo;
    }

    /**
     * Remove disk usage configuration for a specific path.
     * @param path The path to remove configuration for
     */
    removeDiskInfo(path: string): void {
        delete this.config.diskMap[path];
    }

    /**
     * Simulate storage usage changes for a path (e.g., during data downloads).
     * @param path The path to update
     * @param usedBytes Additional bytes to mark as used
     */
    simulateStorageUsage(path: string, usedBytes: number): void {
        const diskInfo = this.config.diskMap[path] || { ...this.config.defaultDisk };
        diskInfo.available = Math.max(0, diskInfo.available - usedBytes);
        diskInfo.free = Math.max(0, diskInfo.free - usedBytes);
        this.config.diskMap[path] = diskInfo;
    }

    /**
     * Configure a specific path to always return an error.
     * @param path The path to configure for errors
     * @param errorMessage The error message to return
     */
    setErrorPath(path: string, errorMessage: string): void {
        this.config.errorPaths = this.config.errorPaths || {};
        this.config.errorPaths[path] = errorMessage;
    }

    /**
     * Clear error configuration for a specific path.
     * @param path The path to clear error configuration for
     */
    clearErrorPath(path: string): void {
        if (this.config.errorPaths) {
            delete this.config.errorPaths[path];
        }
    }

    /**
     * Check disk usage for a given path with configurable mock behavior.
     * @param path The path to check disk usage for
     * @returns Promise that resolves to disk usage information
     * @throws Error if configured to simulate errors for this path
     */
    async check(path: string): Promise<DiskUsageInfo> {
        // Simulate latency if configured
        const latency = this.config.latencyMs ?? 25;
        if (latency > 0) {
            await new Promise(resolve => setTimeout(resolve, latency));
        }

        // Check for path-specific errors first
        if (this.config.errorPaths && this.config.errorPaths[path]) {
            throw new Error(`Mock disk usage error for path "${path}": ${this.config.errorPaths[path]}`);
        }

        // Simulate random errors if configured
        const errorProbability = this.config.errorProbability ?? 0;
        if (errorProbability > 0 && Math.random() < errorProbability) {
            throw new Error(`Mock disk usage error: Simulated filesystem access failure for path "${path}"`);
        }

        // Find best matching path (longest prefix match)
        let bestMatch = this.config.defaultDisk;
        let bestMatchLength = 0;

        for (const [configPath, diskInfo] of Object.entries(this.config.diskMap)) {
            if (path.startsWith(configPath) && configPath.length > bestMatchLength) {
                bestMatch = diskInfo;
                bestMatchLength = configPath.length;
            }
        }

        return {
            available: bestMatch.available,
            free: bestMatch.free,
            total: bestMatch.total,
        };
    }
}

/**
 * Predefined test scenarios for common VEET Manager storage testing use cases.
 */
export class MockDiskUsageScenarios {
    /**
     * VEET device with plenty of storage available.
     */
    static veetDeviceWithStorage(): MockDiskUsageConfig {
        return {
            diskMap: {
                '/mnt/veet1': {
                    path: '/mnt/veet1',
                    total: 8000000000, // 8GB VEET device
                    available: 6000000000, // 6GB available
                    free: 6000000000, // 6GB free
                },
            },
            defaultDisk: {
                path: '/',
                total: 1000000000000, // 1TB system
                available: 500000000000, // 500GB available
                free: 500000000000, // 500GB free
            },
        };
    }

    /**
     * VEET device with low storage (less than 1GB available).
     */
    static veetDeviceLowStorage(): MockDiskUsageConfig {
        return {
            diskMap: {
                '/mnt/veet1': {
                    path: '/mnt/veet1',
                    total: 8000000000, // 8GB VEET device
                    available: 800000000, // 800MB available
                    free: 800000000, // 800MB free
                },
            },
            defaultDisk: {
                path: '/',
                total: 1000000000000,
                available: 500000000000,
                free: 500000000000,
            },
        };
    }

    /**
     * VEET device that is nearly full (less than 100MB available).
     */
    static veetDeviceNearlyFull(): MockDiskUsageConfig {
        return {
            diskMap: {
                '/mnt/veet1': {
                    path: '/mnt/veet1',
                    total: 8000000000, // 8GB VEET device
                    available: 50000000, // 50MB available
                    free: 50000000, // 50MB free
                },
            },
            defaultDisk: {
                path: '/',
                total: 1000000000000,
                available: 500000000000,
                free: 500000000000,
            },
        };
    }

    /**
     * VEET device that is completely full.
     */
    static veetDeviceFull(): MockDiskUsageConfig {
        return {
            diskMap: {
                '/mnt/veet1': {
                    path: '/mnt/veet1',
                    total: 8000000000, // 8GB VEET device
                    available: 0, // No space available
                    free: 0, // No space free
                },
            },
            defaultDisk: {
                path: '/',
                total: 1000000000000,
                available: 500000000000,
                free: 500000000000,
            },
        };
    }

    /**
     * Multiple VEET devices with different storage levels.
     */
    static multipleVeetDevices(): MockDiskUsageConfig {
        return {
            diskMap: {
                '/mnt/veet1': {
                    path: '/mnt/veet1',
                    total: 8000000000, // 8GB device #1
                    available: 6000000000, // 6GB available
                    free: 6000000000,
                },
                '/mnt/veet2': {
                    path: '/mnt/veet2',
                    total: 8000000000, // 8GB device #2
                    available: 2000000000, // 2GB available
                    free: 2000000000,
                },
            },
            defaultDisk: {
                path: '/',
                total: 1000000000000,
                available: 500000000000,
                free: 500000000000,
            },
        };
    }

    /**
     * Different size VEET devices for testing various capacity scenarios.
     */
    static variableDeviceSizes(): MockDiskUsageConfig {
        return {
            diskMap: {
                '/mnt/veet_small': {
                    path: '/mnt/veet_small',
                    total: 1000000000, // 1GB device
                    available: 500000000, // 500MB available
                    free: 500000000,
                },
                '/mnt/veet_large': {
                    path: '/mnt/veet_large',
                    total: 32000000000, // 32GB device
                    available: 24000000000, // 24GB available
                    free: 24000000000,
                },
            },
            defaultDisk: {
                path: '/',
                total: 1000000000000,
                available: 500000000000,
                free: 500000000000,
            },
        };
    }

    /**
     * Windows-style drive paths for cross-platform testing.
     */
    static windowsStyle(): MockDiskUsageConfig {
        return {
            diskMap: {
                'F:\\': {
                    path: 'F:\\',
                    total: 8000000000, // 8GB VEET device
                    available: 6000000000, // 6GB available
                    free: 6000000000,
                },
            },
            defaultDisk: {
                path: 'C:\\',
                total: 1000000000000, // 1TB system drive
                available: 500000000000, // 500GB available
                free: 500000000000,
            },
        };
    }

    /**
     * Scenario with simulated latency for performance testing.
     */
    static withLatency(latencyMs: number = 200): MockDiskUsageConfig {
        const config = this.veetDeviceWithStorage();
        config.latencyMs = latencyMs;
        return config;
    }

    /**
     * Scenario with intermittent errors for error handling testing.
     */
    static withErrors(errorProbability: number = 0.2): MockDiskUsageConfig {
        const config = this.veetDeviceWithStorage();
        config.errorProbability = errorProbability;
        return config;
    }

    /**
     * Scenario with specific paths configured to always error.
     */
    static withErrorPaths(): MockDiskUsageConfig {
        const config = this.veetDeviceWithStorage();
        config.errorPaths = {
            '/mnt/broken_veet': 'Permission denied',
            '/invalid/path': 'Path does not exist',
            '/mnt/disconnected': 'Device not found',
        };
        return config;
    }

    /**
     * Scenario for testing storage usage simulation (downloads, data recording).
     * Starts with moderate storage that can be reduced during testing.
     */
    static simulatedUsage(): MockDiskUsageConfig {
        return {
            diskMap: {
                '/mnt/veet1': {
                    path: '/mnt/veet1',
                    total: 8000000000, // 8GB VEET device
                    available: 4000000000, // 4GB available initially
                    free: 4000000000, // 4GB free initially
                },
            },
            defaultDisk: {
                path: '/',
                total: 1000000000000,
                available: 500000000000,
                free: 500000000000,
            },
            latencyMs: 50, // Slight latency for realistic behavior
        };
    }

    /**
     * System drive with low storage - tests system storage warnings.
     */
    static systemDriveLowStorage(): MockDiskUsageConfig {
        return {
            diskMap: {},
            defaultDisk: {
                path: '/',
                total: 500000000000, // 500GB system drive
                available: 5000000000, // Only 5GB available
                free: 5000000000,
            },
        };
    }
}
