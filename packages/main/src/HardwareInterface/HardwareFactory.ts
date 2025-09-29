/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDriveList, IDiskUsage, ISerialPortFactory } from './HardwareInterfaces';
import { ProductionDriveList } from './ProductionDriveList';
import { ProductionDiskUsage } from './ProductionDiskUsage';
import { ProductionSerialPortFactory } from './ProductionSerialPort';
import { MockDriveList, MockDriveListScenarios } from './MockDriveList';
import { MockDiskUsage, MockDiskUsageScenarios } from './MockDiskUsage';
import { MockSerialPortFactory, MockSerialPortScenarios } from './MockSerialPort';

/**
 * Hardware factory interface for creating hardware abstraction instances.
 * This enables dependency injection and environment-based switching between
 * production implementations and test mocks.
 */
export interface IHardwareFactory {
    /**
     * Create a drive list implementation.
     * @returns IDriveList instance appropriate for the current environment
     */
    createDriveList(): IDriveList;

    /**
     * Create a disk usage implementation.
     * @returns IDiskUsage instance appropriate for the current environment
     */
    createDiskUsage(): IDiskUsage;

    /**
     * Create a serial port factory implementation.
     * @returns ISerialPortFactory instance appropriate for the current environment
     */
    createSerialPortFactory(): ISerialPortFactory;
}

/**
 * Production hardware factory that creates real hardware implementations.
 * Used in normal application runtime when actual hardware interaction is needed.
 */
export class ProductionHardwareFactory implements IHardwareFactory {
    /**
     * Create a production drive list implementation using the drivelist library.
     * @returns ProductionDriveList instance that communicates with actual hardware
     */
    createDriveList(): IDriveList {
        return new ProductionDriveList();
    }

    /**
     * Create a production disk usage implementation using the diskusage library.
     * @returns ProductionDiskUsage instance that communicates with actual hardware
     */
    createDiskUsage(): IDiskUsage {
        return new ProductionDiskUsage();
    }

    /**
     * Create a production serial port factory implementation using the serialport library.
     * @returns ProductionSerialPortFactory instance that communicates with actual hardware
     */
    createSerialPortFactory(): ISerialPortFactory {
        return new ProductionSerialPortFactory();
    }
}

/**
 * Mock hardware factory that creates test implementations.
 * Used during testing to avoid native dependencies and provide controllable behavior.
 * Implementation will be added in Phase 4 of the migration plan.
 */
export class MockHardwareFactory implements IHardwareFactory {
    /**
     * Create a mock drive list implementation for testing.
     * @returns Mock IDriveList instance with configurable test scenarios
     */
    createDriveList(): IDriveList {
        // Default to single device scenario for most tests
        return new MockDriveList(MockDriveListScenarios.singleDevice());
    }

    /**
     * Create a mock disk usage implementation for testing.
     * @returns Mock IDiskUsage instance with configurable test scenarios
     */
    createDiskUsage(): IDiskUsage {
        // Default to VEET device with storage scenario for most tests
        return new MockDiskUsage(MockDiskUsageScenarios.veetDeviceWithStorage());
    }

    /**
     * Create a mock serial port factory implementation for testing.
     * @returns Mock ISerialPortFactory instance with configurable test scenarios
     */
    createSerialPortFactory(): ISerialPortFactory {
        // Default to single device scenario for most tests
        return new MockSerialPortFactory(MockSerialPortScenarios.singleDevice());
    }
}

/**
 * Environment detection for automatic factory selection.
 * Checks NODE_ENV and VEET_MOCK_HARDWARE environment variables.
 */
const isTestEnvironment = (): boolean => {
    return process.env.NODE_ENV === 'test' || process.env.VEET_MOCK_HARDWARE === 'true';
};

/**
 * Create the appropriate hardware factory based on the current environment.
 * @returns IHardwareFactory instance (production or mock) based on environment detection
 */
export const createHardwareFactory = (): IHardwareFactory => {
    if (isTestEnvironment()) {
        return new MockHardwareFactory();
    }
    return new ProductionHardwareFactory();
};

/**
 * Global hardware factory instance.
 * This provides a singleton pattern for consistent hardware abstraction access
 * throughout the application.
 */
export const hardwareFactory = createHardwareFactory();
