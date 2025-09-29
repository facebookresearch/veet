/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockDriveList, MockDriveListScenarios } from '../../shared/MockDriveList';
import { MockHardwareFactory } from '../../shared/HardwareFactory';
import type { IDriveList } from '../../shared/HardwareInterfaces';

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
                label: 'VEET_DYN'
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
