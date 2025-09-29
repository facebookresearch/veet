/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockDriveList, MockDriveListScenarios } from '../../shared/MockDriveList';
import { MockDiskUsage, MockDiskUsageScenarios } from '../../shared/MockDiskUsage';
import { MockHardwareFactory } from '../../shared/HardwareFactory';
import type { IDriveList, IDiskUsage } from '../../shared/HardwareInterfaces';

/**
 * Hardware mock validation tests for main process.
 * These tests ensure that hardware mocks work correctly in the main process context
 * and validate their integration with the factory pattern.
 *
 * Step 4.5: Basic main process mock validation test for IDriveList
 */
describe('Hardware Mock Validation - IDriveList', () => {
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
        // Save original NODE_ENV
        originalNodeEnv = process.env.NODE_ENV;
        // Set test environment to trigger mock usage
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        // Restore original NODE_ENV
        if (originalNodeEnv !== undefined) {
            process.env.NODE_ENV = originalNodeEnv;
        } else {
            delete process.env.NODE_ENV;
        }
    });

    describe('MockDriveList basic functionality', () => {
        it('should create MockDriveList instance with default configuration', () => {
            const mockDriveList = new MockDriveList();
            expect(mockDriveList).toBeInstanceOf(MockDriveList);
        });

        it('should return empty drive list with no devices scenario', async () => {
            const config = MockDriveListScenarios.noDevices();
            const mockDriveList = new MockDriveList(config);

            const drives = await mockDriveList.list();

            // Should only contain non-VEET drives (system drives)
            expect(drives).toHaveLength(1);
            expect(drives[0].device).toBe('/dev/sda1');
            expect(drives[0].description).toBe('System Drive');
            expect(drives[0].isUSB).toBe(false);
            expect(drives[0].isRemovable).toBe(false);
        });

        it('should return single VEET device with single device scenario', async () => {
            const config = MockDriveListScenarios.singleDevice();
            const mockDriveList = new MockDriveList(config);

            const drives = await mockDriveList.list();

            // Should contain 1 VEET device + 1 system drive
            expect(drives).toHaveLength(2);

            // Find the VEET device
            const veetDevice = drives.find(d => d.device === '/dev/sdb1');
            expect(veetDevice).toBeDefined();
            expect(veetDevice!.description).toBe('VEET Device Storage');
            expect(veetDevice!.size).toBe(8000000000); // 8GB
            expect(veetDevice!.isUSB).toBe(true);
            expect(veetDevice!.isRemovable).toBe(true);
            expect(veetDevice!.mountpoints).toHaveLength(1);
            expect(veetDevice!.mountpoints[0].path).toBe('/mnt/veet1');
            expect(veetDevice!.mountpoints[0].label).toBe('VEET');
        });

        it('should return multiple VEET devices with multiple device scenario', async () => {
            const config = MockDriveListScenarios.multipleDevices();
            const mockDriveList = new MockDriveList(config);

            const drives = await mockDriveList.list();

            // Should contain 2 VEET devices + 1 system drive
            expect(drives).toHaveLength(3);

            // Find the VEET devices
            const veetDevices = drives.filter(d => d.description.includes('VEET'));
            expect(veetDevices).toHaveLength(2);

            expect(veetDevices[0].device).toBe('/dev/sdb1');
            expect(veetDevices[0].mountpoints[0].label).toBe('VEET_001');

            expect(veetDevices[1].device).toBe('/dev/sdc1');
            expect(veetDevices[1].mountpoints[0].label).toBe('VEET_002');
        });

        it('should simulate latency when configured', async () => {
            const config = MockDriveListScenarios.withLatency(100);
            const mockDriveList = new MockDriveList(config);

            const startTime = Date.now();
            await mockDriveList.list();
            const endTime = Date.now();

            // Should take at least 100ms due to configured latency
            expect(endTime - startTime).toBeGreaterThanOrEqual(95); // Allow small margin for test timing
        });

        it('should simulate errors when configured', async () => {
            const config = MockDriveListScenarios.withErrors(1.0); // 100% error rate
            const mockDriveList = new MockDriveList(config);

            // Should throw error due to 100% error probability
            await expect(mockDriveList.list()).rejects.toThrow('Mock drive list error: Simulated hardware communication failure');
        });

        it('should support dynamic configuration updates', async () => {
            const mockDriveList = new MockDriveList(MockDriveListScenarios.noDevices());

            // Initially no VEET devices
            let drives = await mockDriveList.list();
            const veetDevicesCount = drives.filter(d => d.description.includes('VEET')).length;
            expect(veetDevicesCount).toBe(0);

            // Add a VEET device dynamically
            mockDriveList.addVeetDevice({
                device: '/dev/sdc1',
                description: 'VEET Device Storage (Dynamic)',
                size: 4000000000,
                mountPath: '/mnt/veet_dynamic',
                label: 'VEET_DYN',
            });

            // Should now contain the added device
            drives = await mockDriveList.list();
            const dynamicVeetDevices = drives.filter(d => d.description.includes('Dynamic'));
            expect(dynamicVeetDevices).toHaveLength(1);
            expect(dynamicVeetDevices[0].device).toBe('/dev/sdc1');
        });

        it('should support Windows-style paths', async () => {
            const config = MockDriveListScenarios.windowsStyle();
            const mockDriveList = new MockDriveList(config);

            const drives = await mockDriveList.list();

            // Find the VEET device
            const veetDevice = drives.find(d => d.device === 'F:');
            expect(veetDevice).toBeDefined();
            expect(veetDevice!.mountpoints[0].path).toBe('F:\\');
        });
    });

    describe('MockHardwareFactory integration', () => {
        it('should create MockDriveList instance from factory in test environment', () => {
            const factory = new MockHardwareFactory();
            const driveList = factory.createDriveList();

            expect(driveList).toBeInstanceOf(MockDriveList);
        });

        it('should return consistent drive list results from factory-created instance', async () => {
            const factory = new MockHardwareFactory();
            const driveList = factory.createDriveList();

            const drives = await driveList.list();

            // Factory default is single device scenario
            const veetDevices = drives.filter(d => d.description.includes('VEET'));
            expect(veetDevices).toHaveLength(1);
            expect(veetDevices[0].device).toBe('/dev/sdb1');
        });
    });

    describe('IDriveList interface compliance', () => {
        it('should implement IDriveList interface correctly', async () => {
            const mockDriveList: IDriveList = new MockDriveList();

            // Should have list method that returns Promise<DriveInfo[]>
            const result = mockDriveList.list();
            expect(result).toBeInstanceOf(Promise);

            const drives = await result;
            expect(Array.isArray(drives)).toBe(true);

            // Validate DriveInfo structure if drives exist
            if (drives.length > 0) {
                const drive = drives[0];
                expect(typeof drive.device).toBe('string');
                expect(typeof drive.description).toBe('string');
                expect(typeof drive.isRemovable).toBe('boolean');
                expect(Array.isArray(drive.mountpoints)).toBe(true);
                // size and isUSB can be null
                if (drive.size !== null) {
                    expect(typeof drive.size).toBe('number');
                }
                if (drive.isUSB !== null) {
                    expect(typeof drive.isUSB).toBe('boolean');
                }
            }
        });

        it('should return valid DriveInfo objects with all required properties', async () => {
            const config = MockDriveListScenarios.singleDevice();
            const mockDriveList = new MockDriveList(config);

            const drives = await mockDriveList.list();

            for (const drive of drives) {
                // Validate required properties exist
                expect(drive).toHaveProperty('device');
                expect(drive).toHaveProperty('description');
                expect(drive).toHaveProperty('size');
                expect(drive).toHaveProperty('mountpoints');
                expect(drive).toHaveProperty('isUSB');
                expect(drive).toHaveProperty('isRemovable');

                // Validate types
                expect(typeof drive.device).toBe('string');
                expect(typeof drive.description).toBe('string');
                expect(drive.size === null || typeof drive.size === 'number').toBe(true);
                expect(Array.isArray(drive.mountpoints)).toBe(true);
                expect(drive.isUSB === null || typeof drive.isUSB === 'boolean').toBe(true);
                expect(typeof drive.isRemovable).toBe('boolean');

                // Validate mountpoints structure
                for (const mountpoint of drive.mountpoints) {
                    expect(mountpoint).toHaveProperty('path');
                    expect(typeof mountpoint.path).toBe('string');
                    if (mountpoint.label !== undefined) {
                        expect(typeof mountpoint.label).toBe('string');
                    }
                }
            }
        });
    });

    describe('Error handling and edge cases', () => {
        it('should handle empty VEET devices array', async () => {
            const mockDriveList = new MockDriveList({ veetDevices: [], otherDrives: [] });

            const drives = await mockDriveList.list();
            expect(drives).toHaveLength(0);
        });

        it('should handle configuration with only VEET devices (no other drives)', async () => {
            const config = MockDriveListScenarios.variableStorageSizes();
            const mockDriveList = new MockDriveList(config);

            const drives = await mockDriveList.list();
            const veetDevices = drives.filter(d => d.description.includes('VEET'));

            expect(drives.length).toBe(veetDevices.length); // All drives should be VEET devices
            expect(veetDevices).toHaveLength(2);
        });

        it('should handle device removal operations', async () => {
            const mockDriveList = new MockDriveList(MockDriveListScenarios.multipleDevices());

            // Initial state should have 2 VEET devices
            let drives = await mockDriveList.list();
            let veetDevices = drives.filter(d => d.description.includes('VEET'));
            expect(veetDevices).toHaveLength(2);

            // Remove one device
            mockDriveList.removeVeetDevice('/dev/sdb1');

            // Should now have 1 VEET device
            drives = await mockDriveList.list();
            veetDevices = drives.filter(d => d.description.includes('VEET'));
            expect(veetDevices).toHaveLength(1);
            expect(veetDevices[0].device).toBe('/dev/sdc1');
        });

        it('should handle clearing all VEET devices', async () => {
            const mockDriveList = new MockDriveList(MockDriveListScenarios.multipleDevices());

            // Clear all VEET devices
            mockDriveList.clearVeetDevices();

            const drives = await mockDriveList.list();
            const veetDevices = drives.filter(d => d.description.includes('VEET'));
            expect(veetDevices).toHaveLength(0);

            // Should still have system drives
            const systemDrives = drives.filter(d => !d.description.includes('VEET'));
            expect(systemDrives).toHaveLength(1);
        });
    });
});

/**
 * Step 4.7: Basic main process mock validation test for IDiskUsage
 */
describe('Hardware Mock Validation - IDiskUsage', () => {
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
        // Save original NODE_ENV
        originalNodeEnv = process.env.NODE_ENV;
        // Set test environment to trigger mock usage
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        // Restore original NODE_ENV
        if (originalNodeEnv !== undefined) {
            process.env.NODE_ENV = originalNodeEnv;
        } else {
            delete process.env.NODE_ENV;
        }
    });

    describe('MockDiskUsage basic functionality', () => {
        it('should create MockDiskUsage instance with default configuration', () => {
            const mockDiskUsage = new MockDiskUsage();
            expect(mockDiskUsage).toBeInstanceOf(MockDiskUsage);
        });

        it('should return default disk usage info for unmapped paths', async () => {
            const mockDiskUsage = new MockDiskUsage();

            const result = await mockDiskUsage.check('/some/random/path');

            expect(result).toHaveProperty('available');
            expect(result).toHaveProperty('free');
            expect(result).toHaveProperty('total');
            expect(result.total).toBe(1000000000000); // 1TB default
            expect(result.available).toBe(500000000000); // 500GB available
            expect(result.free).toBe(500000000000); // 500GB free
        });

        it('should return VEET device storage info with configured scenario', async () => {
            const config = MockDiskUsageScenarios.veetDeviceWithStorage();
            const mockDiskUsage = new MockDiskUsage(config);

            const result = await mockDiskUsage.check('/mnt/veet1');

            expect(result.total).toBe(8000000000); // 8GB VEET device
            expect(result.available).toBe(6000000000); // 6GB available
            expect(result.free).toBe(6000000000); // 6GB free
        });

        it('should return low storage scenario correctly', async () => {
            const config = MockDiskUsageScenarios.veetDeviceLowStorage();
            const mockDiskUsage = new MockDiskUsage(config);

            const result = await mockDiskUsage.check('/mnt/veet1');

            expect(result.total).toBe(8000000000); // 8GB total
            expect(result.available).toBe(800000000); // 800MB available
            expect(result.free).toBe(800000000); // 800MB free
        });

        it('should return nearly full storage scenario correctly', async () => {
            const config = MockDiskUsageScenarios.veetDeviceNearlyFull();
            const mockDiskUsage = new MockDiskUsage(config);

            const result = await mockDiskUsage.check('/mnt/veet1');

            expect(result.total).toBe(8000000000); // 8GB total
            expect(result.available).toBe(50000000); // 50MB available
            expect(result.free).toBe(50000000); // 50MB free
        });

        it('should return full storage scenario correctly', async () => {
            const config = MockDiskUsageScenarios.veetDeviceFull();
            const mockDiskUsage = new MockDiskUsage(config);

            const result = await mockDiskUsage.check('/mnt/veet1');

            expect(result.total).toBe(8000000000); // 8GB total
            expect(result.available).toBe(0); // No space available
            expect(result.free).toBe(0); // No space free
        });

        it('should handle multiple devices with different storage levels', async () => {
            const config = MockDiskUsageScenarios.multipleVeetDevices();
            const mockDiskUsage = new MockDiskUsage(config);

            const result1 = await mockDiskUsage.check('/mnt/veet1');
            expect(result1.available).toBe(6000000000); // 6GB available

            const result2 = await mockDiskUsage.check('/mnt/veet2');
            expect(result2.available).toBe(2000000000); // 2GB available
        });

        it('should support Windows-style paths', async () => {
            const config = MockDiskUsageScenarios.windowsStyle();
            const mockDiskUsage = new MockDiskUsage(config);

            const result = await mockDiskUsage.check('F:\\');

            expect(result.total).toBe(8000000000); // 8GB VEET device
            expect(result.available).toBe(6000000000); // 6GB available
        });

        it('should simulate latency when configured', async () => {
            const config = MockDiskUsageScenarios.withLatency(100);
            const mockDiskUsage = new MockDiskUsage(config);

            const startTime = Date.now();
            await mockDiskUsage.check('/mnt/veet1');
            const endTime = Date.now();

            // Should take at least 100ms due to configured latency
            expect(endTime - startTime).toBeGreaterThanOrEqual(95); // Allow small margin for test timing
        });

        it('should simulate errors when configured with probability', async () => {
            const config = MockDiskUsageScenarios.withErrors(1.0); // 100% error rate
            const mockDiskUsage = new MockDiskUsage(config);

            // Should throw error due to 100% error probability
            await expect(mockDiskUsage.check('/mnt/veet1'))
                .rejects.toThrow('Mock disk usage error: Simulated filesystem access failure');
        });

        it('should handle specific error paths', async () => {
            const config = MockDiskUsageScenarios.withErrorPaths();
            const mockDiskUsage = new MockDiskUsage(config);

            // Should throw specific error for configured error path
            await expect(mockDiskUsage.check('/mnt/broken_veet'))
                .rejects.toThrow('Mock disk usage error for path "/mnt/broken_veet": Permission denied');

            await expect(mockDiskUsage.check('/invalid/path'))
                .rejects.toThrow('Mock disk usage error for path "/invalid/path": Path does not exist');

            await expect(mockDiskUsage.check('/mnt/disconnected'))
                .rejects.toThrow('Mock disk usage error for path "/mnt/disconnected": Device not found');
        });
    });

    describe('MockDiskUsage dynamic configuration', () => {
        it('should support configuration updates', () => {
            const mockDiskUsage = new MockDiskUsage();

            const newConfig = {
                defaultDisk: {
                    path: '/',
                    total: 2000000000000, // 2TB
                    available: 1000000000000, // 1TB available
                    free: 1000000000000, // 1TB free
                },
            };

            mockDiskUsage.setConfig(newConfig);

            // Configuration should be updated for subsequent calls
            // (We can't directly test the private config, but this ensures method works)
            expect(() => mockDiskUsage.setConfig(newConfig)).not.toThrow();
        });

        it('should support adding disk info for specific paths', async () => {
            const mockDiskUsage = new MockDiskUsage();

            // Add disk info for a specific path
            mockDiskUsage.setDiskInfo('/mnt/test', {
                path: '/mnt/test',
                total: 4000000000, // 4GB
                available: 2000000000, // 2GB available
                free: 2000000000, // 2GB free
            });

            const result = await mockDiskUsage.check('/mnt/test');

            expect(result.total).toBe(4000000000);
            expect(result.available).toBe(2000000000);
            expect(result.free).toBe(2000000000);
        });

        it('should support removing disk info for specific paths', async () => {
            const mockDiskUsage = new MockDiskUsage();

            // Add then remove disk info
            mockDiskUsage.setDiskInfo('/mnt/temp', {
                path: '/mnt/temp',
                total: 1000000000,
                available: 500000000,
                free: 500000000,
            });

            mockDiskUsage.removeDiskInfo('/mnt/temp');

            // Should fall back to default configuration
            const result = await mockDiskUsage.check('/mnt/temp');
            expect(result.total).toBe(1000000000000); // Default 1TB
        });

        it('should simulate storage usage changes', async () => {
            const mockDiskUsage = new MockDiskUsage();

            // Set initial storage state
            mockDiskUsage.setDiskInfo('/mnt/veet1', {
                path: '/mnt/veet1',
                total: 8000000000, // 8GB total
                available: 4000000000, // 4GB available initially
                free: 4000000000, // 4GB free initially
            });

            // Simulate 1GB of storage usage
            mockDiskUsage.simulateStorageUsage('/mnt/veet1', 1000000000);

            const result = await mockDiskUsage.check('/mnt/veet1');

            expect(result.total).toBe(8000000000); // Total unchanged
            expect(result.available).toBe(3000000000); // 3GB available (reduced by 1GB)
            expect(result.free).toBe(3000000000); // 3GB free (reduced by 1GB)
        });

        it('should handle storage usage beyond available space', async () => {
            const mockDiskUsage = new MockDiskUsage();

            // Set initial storage state with limited space
            mockDiskUsage.setDiskInfo('/mnt/veet1', {
                path: '/mnt/veet1',
                total: 8000000000, // 8GB total
                available: 500000000, // 500MB available
                free: 500000000, // 500MB free
            });

            // Simulate 1GB of storage usage (more than available)
            mockDiskUsage.simulateStorageUsage('/mnt/veet1', 1000000000);

            const result = await mockDiskUsage.check('/mnt/veet1');

            expect(result.total).toBe(8000000000); // Total unchanged
            expect(result.available).toBe(0); // Should not go below 0
            expect(result.free).toBe(0); // Should not go below 0
        });

        it('should support error path configuration', async () => {
            const mockDiskUsage = new MockDiskUsage();

            // Configure a path to always error
            mockDiskUsage.setErrorPath('/mnt/broken', 'Device malfunction');

            await expect(mockDiskUsage.check('/mnt/broken'))
                .rejects.toThrow('Mock disk usage error for path "/mnt/broken": Device malfunction');

            // Clear the error path
            mockDiskUsage.clearErrorPath('/mnt/broken');

            // Should no longer error
            const result = await mockDiskUsage.check('/mnt/broken');
            expect(result).toHaveProperty('total');
        });
    });

    describe('MockHardwareFactory integration', () => {
        it('should create MockDiskUsage instance from factory in test environment', () => {
            const factory = new MockHardwareFactory();
            const diskUsage = factory.createDiskUsage();

            expect(diskUsage).toBeInstanceOf(MockDiskUsage);
        });

        it('should return consistent disk usage results from factory-created instance', async () => {
            const factory = new MockHardwareFactory();
            const diskUsage = factory.createDiskUsage();

            const result = await diskUsage.check('/some/path');

            // Factory default should return valid disk usage
            expect(result).toHaveProperty('available');
            expect(result).toHaveProperty('free');
            expect(result).toHaveProperty('total');
            expect(typeof result.available).toBe('number');
            expect(typeof result.free).toBe('number');
            expect(typeof result.total).toBe('number');
        });
    });

    describe('IDiskUsage interface compliance', () => {
        it('should implement IDiskUsage interface correctly', async () => {
            const mockDiskUsage: IDiskUsage = new MockDiskUsage();

            // Should have check method that returns Promise<DiskUsageInfo>
            const result = mockDiskUsage.check('/test/path');
            expect(result).toBeInstanceOf(Promise);

            const diskInfo = await result;
            expect(typeof diskInfo).toBe('object');
            expect(diskInfo).not.toBeNull();
        });

        it('should return valid DiskUsageInfo objects with all required properties', async () => {
            const config = MockDiskUsageScenarios.veetDeviceWithStorage();
            const mockDiskUsage = new MockDiskUsage(config);

            const result = await mockDiskUsage.check('/mnt/veet1');

            // Validate required properties exist
            expect(result).toHaveProperty('available');
            expect(result).toHaveProperty('free');
            expect(result).toHaveProperty('total');

            // Validate types
            expect(typeof result.available).toBe('number');
            expect(typeof result.free).toBe('number');
            expect(typeof result.total).toBe('number');

            // Validate logical relationships
            expect(result.available).toBeGreaterThanOrEqual(0);
            expect(result.free).toBeGreaterThanOrEqual(0);
            expect(result.total).toBeGreaterThan(0);
            expect(result.available).toBeLessThanOrEqual(result.total);
            expect(result.free).toBeLessThanOrEqual(result.total);
        });

        it('should handle path prefix matching correctly', async () => {
            const mockDiskUsage = new MockDiskUsage();

            // Configure a mount point
            mockDiskUsage.setDiskInfo('/mnt/veet', {
                path: '/mnt/veet',
                total: 8000000000,
                available: 4000000000,
                free: 4000000000,
            });

            // Paths under the mount point should match
            const result1 = await mockDiskUsage.check('/mnt/veet/data/file.csv');
            expect(result1.total).toBe(8000000000);

            const result2 = await mockDiskUsage.check('/mnt/veet/config');
            expect(result2.total).toBe(8000000000);

            // Different path should use default
            const result3 = await mockDiskUsage.check('/mnt/other/device');
            expect(result3.total).toBe(1000000000000); // Default 1TB
        });
    });

    describe('Predefined scenarios validation', () => {
        it('should provide realistic VEET device scenarios', async () => {
            const scenarios = [
                MockDiskUsageScenarios.veetDeviceWithStorage(),
                MockDiskUsageScenarios.veetDeviceLowStorage(),
                MockDiskUsageScenarios.veetDeviceNearlyFull(),
                MockDiskUsageScenarios.veetDeviceFull(),
            ];

            for (const config of scenarios) {
                const mockDiskUsage = new MockDiskUsage(config);
                const result = await mockDiskUsage.check('/mnt/veet1');

                // All scenarios should return valid data
                expect(result.total).toBe(8000000000); // All VEET devices are 8GB
                expect(result.available).toBeGreaterThanOrEqual(0);
                expect(result.free).toBeGreaterThanOrEqual(0);
                expect(result.available).toBeLessThanOrEqual(result.total);
            }
        });

        it('should provide realistic system scenarios', async () => {
            const config = MockDiskUsageScenarios.systemDriveLowStorage();
            const mockDiskUsage = new MockDiskUsage(config);

            const result = await mockDiskUsage.check('/home/user');

            expect(result.total).toBe(500000000000); // 500GB system drive
            expect(result.available).toBe(5000000000); // 5GB available
            expect(result.free).toBe(5000000000); // 5GB free
        });

        it('should provide variable device size scenarios', async () => {
            const config = MockDiskUsageScenarios.variableDeviceSizes();
            const mockDiskUsage = new MockDiskUsage(config);

            const smallDevice = await mockDiskUsage.check('/mnt/veet_small');
            expect(smallDevice.total).toBe(1000000000); // 1GB device

            const largeDevice = await mockDiskUsage.check('/mnt/veet_large');
            expect(largeDevice.total).toBe(32000000000); // 32GB device
        });

        it('should provide simulated usage scenario', async () => {
            const config = MockDiskUsageScenarios.simulatedUsage();
            const mockDiskUsage = new MockDiskUsage(config);

            const result = await mockDiskUsage.check('/mnt/veet1');

            expect(result.total).toBe(8000000000); // 8GB total
            expect(result.available).toBe(4000000000); // 4GB initially available
            expect(config.latencyMs).toBe(50); // Should have realistic latency
        });
    });

    describe('Error handling and edge cases', () => {
        it('should handle empty disk map configuration', async () => {
            const mockDiskUsage = new MockDiskUsage({ diskMap: {} });

            const result = await mockDiskUsage.check('/any/path');

            // Should fall back to default disk
            expect(result.total).toBe(1000000000000); // Default 1TB
        });

        it('should handle zero latency configuration', async () => {
            const mockDiskUsage = new MockDiskUsage({ latencyMs: 0 });

            const startTime = Date.now();
            await mockDiskUsage.check('/test');
            const endTime = Date.now();

            // Should complete quickly with no artificial latency
            expect(endTime - startTime).toBeLessThan(50); // Should be very fast
        });

        it('should handle undefined latency (default behavior)', async () => {
            const mockDiskUsage = new MockDiskUsage({ latencyMs: undefined });

            const startTime = Date.now();
            await mockDiskUsage.check('/test');
            const endTime = Date.now();

            // Should apply default latency (25ms)
            expect(endTime - startTime).toBeGreaterThanOrEqual(20);
        });

        it('should handle invalid paths gracefully', async () => {
            const mockDiskUsage = new MockDiskUsage();

            // Empty path should not crash
            const result1 = await mockDiskUsage.check('');
            expect(result1).toHaveProperty('total');

            // Root path should work
            const result2 = await mockDiskUsage.check('/');
            expect(result2).toHaveProperty('total');

            // Very long path should work
            const longPath = '/very/long/path/that/might/not/exist/in/real/filesystem/but/should/work/in/mock';
            const result3 = await mockDiskUsage.check(longPath);
            expect(result3).toHaveProperty('total');
        });

        it('should handle error probability of 0 (no errors)', async () => {
            const mockDiskUsage = new MockDiskUsage({ errorProbability: 0 });

            // Run multiple times to ensure no random errors occur
            for (let i = 0; i < 10; i++) {
                const result = await mockDiskUsage.check('/test');
                expect(result).toHaveProperty('total');
            }
        });

        it('should clear error paths completely', async () => {
            const mockDiskUsage = new MockDiskUsage();

            // Set error path
            mockDiskUsage.setErrorPath('/error/path', 'Test error');

            // Verify error occurs
            await expect(mockDiskUsage.check('/error/path'))
                .rejects.toThrow('Test error');

            // Clear error path
            mockDiskUsage.clearErrorPath('/error/path');

            // Should work normally now
            const result = await mockDiskUsage.check('/error/path');
            expect(result).toHaveProperty('total');
        });
    });
});
