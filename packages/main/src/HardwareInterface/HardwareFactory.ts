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
 * Hardware factory interface for managing hardware abstraction instances.
 * This enables dependency injection and environment-based switching between
 * production implementations and test mocks with lazy initialization.
 */
export interface IHardwareFactory {
    /**
     * Get a drive list implementation (lazy initialized).
     * @returns IDriveList instance appropriate for the current environment
     */
    getDriveList(): IDriveList;

    /**
     * Get a disk usage implementation (lazy initialized).
     * @returns IDiskUsage instance appropriate for the current environment
     */
    getDiskUsage(): IDiskUsage;

    /**
     * Get a serial port factory implementation (lazy initialized).
     * @returns ISerialPortFactory instance appropriate for the current environment
     */
    getSerialPortFactory(): ISerialPortFactory;
}

/**
 * Production hardware factory that manages real hardware implementations.
 * Used in normal application runtime when actual hardware interaction is needed.
 * Implements lazy initialization to avoid recreating instances.
 */
export class ProductionHardwareFactory implements IHardwareFactory {
    private driveList_: IDriveList | null = null;
    private diskUsage_: IDiskUsage | null = null;
    private serialPortFactory_: ISerialPortFactory | null = null;

    /**
     * Get a production drive list implementation using the drivelist library (lazy initialized).
     * @returns ProductionDriveList instance that communicates with actual hardware
     */
    getDriveList(): IDriveList {
        if (!this.driveList_) {
            this.driveList_ = new ProductionDriveList();
        }
        return this.driveList_;
    }

    /**
     * Get a production disk usage implementation using the diskusage library (lazy initialized).
     * @returns ProductionDiskUsage instance that communicates with actual hardware
     */
    getDiskUsage(): IDiskUsage {
        if (!this.diskUsage_) {
            this.diskUsage_ = new ProductionDiskUsage();
        }
        return this.diskUsage_;
    }

    /**
     * Get a production serial port factory implementation using the serialport library (lazy initialized).
     * @returns ProductionSerialPortFactory instance that communicates with actual hardware
     */
    getSerialPortFactory(): ISerialPortFactory {
        if (!this.serialPortFactory_) {
            this.serialPortFactory_ = new ProductionSerialPortFactory();
        }
        return this.serialPortFactory_;
    }
}

/**
 * Mock hardware factory that manages test implementations.
 * Used during testing to avoid native dependencies and provide controllable behavior.
 * Implements lazy initialization to avoid recreating instances.
 */
export class MockHardwareFactory implements IHardwareFactory {
    private driveList_: IDriveList | null = null;
    private diskUsage_: IDiskUsage | null = null;
    private serialPortFactory_: ISerialPortFactory | null = null;

    /**
     * Get a mock drive list implementation for testing (lazy initialized).
     * @returns Mock IDriveList instance with configurable test scenarios
     */
    getDriveList(): IDriveList {
        if (!this.driveList_) {
            // Default to single device scenario for most tests
            this.driveList_ = new MockDriveList(MockDriveListScenarios.singleDevice());
        }
        return this.driveList_;
    }

    /**
     * Get a mock disk usage implementation for testing (lazy initialized).
     * @returns Mock IDiskUsage instance with configurable test scenarios
     */
    getDiskUsage(): IDiskUsage {
        if (!this.diskUsage_) {
            // Default to VEET device with storage scenario for most tests
            this.diskUsage_ = new MockDiskUsage(MockDiskUsageScenarios.veetDeviceWithStorage());
        }
        return this.diskUsage_;
    }

    /**
     * Get a mock serial port factory implementation for testing (lazy initialized).
     * @returns Mock ISerialPortFactory instance with configurable test scenarios
     */
    getSerialPortFactory(): ISerialPortFactory {
        if (!this.serialPortFactory_) {
            // Default to single device scenario for most tests
            this.serialPortFactory_ = new MockSerialPortFactory(MockSerialPortScenarios.singleDevice());
        }
        return this.serialPortFactory_;
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
