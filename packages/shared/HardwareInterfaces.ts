/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventEmitter } from 'events';

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

/**
 * Serial port configuration options.
 */
export interface SerialPortOptions {
    path: string;
    baudRate: number;
    // Add other options as needed for production wrapper
}

/**
 * Information about available serial ports.
 */
export interface PortInfo {
    path: string;
    manufacturer?: string;
    serialNumber?: string;
    vendorId?: string;
    productId?: string;
}

/**
 * Factory interface for creating serial port instances.
 * Abstracts the serialport library for dependency injection and testing.
 */
export interface ISerialPortFactory {
    /**
     * List all available serial ports.
     * @returns Promise that resolves to an array of port information
     */
    list(): Promise<PortInfo[]>;

    /**
     * Create a new serial port instance.
     * @param options Configuration options for the serial port
     * @returns A new serial port instance
     */
    create(options: SerialPortOptions): ISerialPort;
}

/**
 * Interface for serial port operations.
 * Abstracts the serialport library for dependency injection and testing.
 * Supports both callback-based and event-driven communication patterns.
 * Extends EventEmitter to support Node.js event handling patterns.
 */
export interface ISerialPort extends EventEmitter {
    /**
     * Current port state - true if open, false if closed.
     */
    readonly isOpen: boolean;

    /**
     * Open the serial port connection.
     * @param callback Optional callback function called when operation completes
     */
    open(callback?: (error: Error | null) => void): void;

    /**
     * Close the serial port connection.
     * @param callback Optional callback function called when operation completes
     */
    close(callback?: (error: Error | null) => void): void;

    /**
     * Write data to the serial port.
     * @param data The data to write (string or Buffer)
     * @param callback Optional callback function called when operation completes
     * @returns True if data was queued successfully, false if port is closed
     */
    write(data: string | Buffer, callback?: (error: Error | null) => void): boolean;

    /**
     * Flush the port's write buffer.
     * @param callback Optional callback function called when operation completes
     */
    flush(callback?: (error: Error | null) => void): void;

    /**
     * Drain the port's write buffer.
     * @param callback Optional callback function called when operation completes
     */
    drain(callback?: (error: Error | null) => void): void;

    /**
     * Pipe data to a writable stream (for use with DelimiterParser).
     * @param destination The destination stream
     * @returns The destination stream for chaining
     */
    pipe<T extends NodeJS.WritableStream>(destination: T): T;

    /**
     * Register event listeners for port events.
     * Overrides EventEmitter.on to provide type-safe event handling for serial port events.
     */
    on(event: 'open', listener: () => void): this;
    on(event: 'close', listener: (error?: Error) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'data', listener: (data: Buffer) => void): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string | symbol, listener: (...args: any[]) => void): this;
}
