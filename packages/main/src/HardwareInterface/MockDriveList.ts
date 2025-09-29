/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDriveList, DriveInfo } from './HardwareInterfaces';

/**
 * Mock VEET device drive configuration for testing scenarios.
 */
export interface MockVeetDrive {
    /** Device identifier (e.g., '/dev/sdb1' on Linux, 'E:' on Windows) */
    device: string;
    /** Human-readable description */
    description: string;
    /** Size in bytes */
    size: number;
    /** Mount path where the drive is accessible */
    mountPath: string;
    /** Optional volume label */
    label?: string;
}

/**
 * Configuration for mock drive list scenarios.
 */
export interface MockDriveListConfig {
    /** Array of connected VEET devices */
    veetDevices: MockVeetDrive[];
    /** Array of other drives to include in the list */
    otherDrives: DriveInfo[];
    /** Simulate latency in milliseconds (default: 50ms) */
    latencyMs?: number;
    /** Probability of simulating a temporary error (0-1, default: 0) */
    errorProbability?: number;
}

/**
 * Mock implementation of IDriveList for testing purposes.
 * Provides configurable drive scenarios without requiring actual hardware.
 */
export class MockDriveList implements IDriveList {
    private config: MockDriveListConfig;

    constructor(config: MockDriveListConfig = { veetDevices: [], otherDrives: [] }) {
        this.config = config;
    }

    /**
     * Update the mock configuration for testing different scenarios.
     * @param config New configuration to apply
     */
    setConfig(config: MockDriveListConfig): void {
        this.config = config;
    }

    /**
     * Add a VEET device to the mock drive list.
     * @param device The mock VEET device to add
     */
    addVeetDevice(device: MockVeetDrive): void {
        this.config.veetDevices.push(device);
    }

    /**
     * Remove a VEET device from the mock drive list.
     * @param device The device identifier to remove
     */
    removeVeetDevice(device: string): void {
        this.config.veetDevices = this.config.veetDevices.filter(d => d.device !== device);
    }

    /**
     * Clear all VEET devices from the mock drive list.
     */
    clearVeetDevices(): void {
        this.config.veetDevices = [];
    }

    /**
     * List all available drives including mock VEET devices and other drives.
     * @returns Promise that resolves to an array of drive information
     */
    async list(): Promise<DriveInfo[]> {
        // Simulate latency if configured
        const latency = this.config.latencyMs ?? 50;
        if (latency > 0) {
            await new Promise(resolve => setTimeout(resolve, latency));
        }

        // Simulate random errors if configured
        const errorProbability = this.config.errorProbability ?? 0;
        if (errorProbability > 0 && Math.random() < errorProbability) {
            throw new Error('Mock drive list error: Simulated hardware communication failure');
        }

        const drives: DriveInfo[] = [];

        // Convert mock VEET devices to DriveInfo format
        for (const veetDevice of this.config.veetDevices) {
            drives.push({
                device: veetDevice.device,
                description: veetDevice.description,
                size: veetDevice.size,
                mountpoints: [
                    {
                        path: veetDevice.mountPath,
                        label: veetDevice.label,
                    },
                ],
                isUSB: true,
                isRemovable: true,
            });
        }

        // Add other drives from configuration
        drives.push(...this.config.otherDrives);

        return drives;
    }
}

/**
 * Predefined test scenarios for common VEET Manager testing use cases.
 */
export class MockDriveListScenarios {
    /**
     * No VEET devices connected - empty state scenario.
     */
    static noDevices(): MockDriveListConfig {
        return {
            veetDevices: [],
            otherDrives: [
                {
                    device: '/dev/sda1',
                    description: 'System Drive',
                    size: 1000000000000,
                    mountpoints: [{ path: '/' }],
                    isUSB: false,
                    isRemovable: false,
                },
            ],
        };
    }

    /**
     * Single VEET device connected - most common scenario.
     */
    static singleDevice(): MockDriveListConfig {
        return {
            veetDevices: [
                {
                    device: '/dev/sdb1',
                    description: 'VEET Device Storage',
                    size: 8000000000, // 8GB
                    mountPath: '/mnt/veet1',
                    label: 'VEET',
                },
            ],
            otherDrives: [
                {
                    device: '/dev/sda1',
                    description: 'System Drive',
                    size: 1000000000000,
                    mountpoints: [{ path: '/' }],
                    isUSB: false,
                    isRemovable: false,
                },
            ],
        };
    }

    /**
     * Multiple VEET devices connected - advanced testing scenario.
     */
    static multipleDevices(): MockDriveListConfig {
        return {
            veetDevices: [
                {
                    device: '/dev/sdb1',
                    description: 'VEET Device Storage #1',
                    size: 8000000000,
                    mountPath: '/mnt/veet1',
                    label: 'VEET_001',
                },
                {
                    device: '/dev/sdc1',
                    description: 'VEET Device Storage #2',
                    size: 8000000000,
                    mountPath: '/mnt/veet2',
                    label: 'VEET_002',
                },
            ],
            otherDrives: [
                {
                    device: '/dev/sda1',
                    description: 'System Drive',
                    size: 1000000000000,
                    mountpoints: [{ path: '/' }],
                    isUSB: false,
                    isRemovable: false,
                },
            ],
        };
    }

    /**
     * VEET device with different storage sizes for testing edge cases.
     */
    static variableStorageSizes(): MockDriveListConfig {
        return {
            veetDevices: [
                {
                    device: '/dev/sdb1',
                    description: 'VEET Device Storage (Small)',
                    size: 1000000000, // 1GB
                    mountPath: '/mnt/veet_small',
                    label: 'VEET_SMALL',
                },
                {
                    device: '/dev/sdc1',
                    description: 'VEET Device Storage (Large)',
                    size: 32000000000, // 32GB
                    mountPath: '/mnt/veet_large',
                    label: 'VEET_LARGE',
                },
            ],
            otherDrives: [],
        };
    }

    /**
     * Scenario with simulated latency for performance testing.
     */
    static withLatency(latencyMs: number = 500): MockDriveListConfig {
        const config = this.singleDevice();
        config.latencyMs = latencyMs;
        return config;
    }

    /**
     * Scenario with intermittent errors for error handling testing.
     */
    static withErrors(errorProbability: number = 0.2): MockDriveListConfig {
        const config = this.singleDevice();
        config.errorProbability = errorProbability;
        return config;
    }

    /**
     * Windows-style drive paths for cross-platform testing.
     */
    static windowsStyle(): MockDriveListConfig {
        return {
            veetDevices: [
                {
                    device: 'F:',
                    description: 'VEET Device Storage',
                    size: 8000000000,
                    mountPath: 'F:\\',
                    label: 'VEET',
                },
            ],
            otherDrives: [
                {
                    device: 'C:',
                    description: 'System Drive',
                    size: 1000000000000,
                    mountpoints: [{ path: 'C:\\' }],
                    isUSB: false,
                    isRemovable: false,
                },
            ],
        };
    }

    /**
     * Scenario for testing device hot-plugging simulation.
     * Can be used with dynamic configuration updates.
     */
    static dynamicConnection(): MockDriveListConfig {
        return {
            veetDevices: [],
            otherDrives: [
                {
                    device: '/dev/sda1',
                    description: 'System Drive',
                    size: 1000000000000,
                    mountpoints: [{ path: '/' }],
                    isUSB: false,
                    isRemovable: false,
                },
            ],
            latencyMs: 100,
        };
    }
}
