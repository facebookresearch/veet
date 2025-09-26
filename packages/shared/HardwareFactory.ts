/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDriveList, IDiskUsage } from './HardwareInterfaces';
import { ProductionDriveList } from './ProductionDriveList';
import { ProductionDiskUsage } from './ProductionDiskUsage';

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
     * @throws Error indicating mock implementation is not yet available
     */
    createDriveList(): IDriveList {
        throw new Error('Mock hardware factory not yet implemented - scheduled for Phase 4');
    }

    /**
     * Create a mock disk usage implementation for testing.
     * @returns Mock IDiskUsage instance with configurable test scenarios
     * @throws Error indicating mock implementation is not yet available
     */
    createDiskUsage(): IDiskUsage {
        throw new Error('Mock hardware factory not yet implemented - scheduled for Phase 4');
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
