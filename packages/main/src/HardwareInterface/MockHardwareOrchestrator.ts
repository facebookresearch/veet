/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MockDriveList, MockVeetDrive } from './MockDriveList';
import type { MockDiskUsage, MockDiskInfo } from './MockDiskUsage';
import { type MockSerialPortFactory, type MockVeetDeviceState, type MockSensorData, SAMPLE_IMU_DATA, SAMPLE_TOF_DATA, SAMPLE_PHO_DATA, SAMPLE_ALS_DATA } from './MockSerialPort';
import { VEET_DRIVE_DESCRIPTION } from '../../../shared/constants';

/**
 * Configuration for a VEET device that defines all hardware aspects
 * across drive, storage, and serial port interfaces.
 */
export interface VeetDeviceConfig {
    /** Device version identifier (e.g., 'VEET 2.4.0') */
    version: string;
    /** Unique serial number for the device */
    serialNumber: string;
    /** Device side designation */
    side: 'L' | 'R';
    /** Hardware version string */
    hardwareVersion: string;
    /** Firmware version string */
    firmwareVersion: string;
    /** Battery voltage in millivolts */
    batteryVoltage: number;
    /** Drive configuration */
    drive: {
        device: string;
        description: string;
        size: number;
        mountPath: string;
        label?: string;
    };
    /** Storage usage configuration */
    storage: {
        total: number;
        available: number;
        free: number;
    };
    /** Serial port configuration */
    serialPort: {
        path: string;
        vendorId: string;
        productId: string;
        manufacturer: string;
    };
}

/**
 * High-level orchestrator for coordinating mock hardware interfaces to simulate
 * complete VEET device connection and disconnection scenarios.
 *
 * This class coordinates MockDriveList, MockDiskUsage, and MockSerialPortFactory
 * to provide realistic device simulation for testing purposes. Only one device
 * can be connected at a time.
 */
export class MockHardwareOrchestrator {
    private driveList: MockDriveList;
    private diskUsage: MockDiskUsage;
    private serialPortFactory: MockSerialPortFactory;
    private connectedDeviceName: string | null = null;
    private connectedDeviceConfig: VeetDeviceConfig | null = null;
    private sensorDataTimer: NodeJS.Timeout | null = null;

    /**
     * Hardcoded configuration for VEET 2.4.0 device.
     */
    static readonly VEET_240_CONFIG: VeetDeviceConfig = {
        version: 'VEET 2.4.0',
        serialNumber: 'VEET240001',
        side: 'L',
        hardwareVersion: 'VEET-HW-2.4',
        firmwareVersion: 'VEET-FW-2.4.0',
        batteryVoltage: 4120,
        drive: {
            device: '/dev/sdb1',
            description: VEET_DRIVE_DESCRIPTION,
            size: 8000000000, // 8GB
            mountPath: '/mnt/veet1',
            label: 'VEET_240',
        },
        storage: {
            total: 8000000000, // 8GB
            available: 6000000000, // 6GB available
            free: 6000000000, // 6GB free
        },
        serialPort: {
            path: '/dev/ttyUSB0',
            vendorId: '04d8',
            productId: '0001',
            manufacturer: 'Meta',
        },
    };

    constructor(
        driveList: MockDriveList,
        diskUsage: MockDiskUsage,
        serialPortFactory: MockSerialPortFactory,
    ) {
        this.driveList = driveList;
        this.diskUsage = diskUsage;
        this.serialPortFactory = serialPortFactory;
    }

    /**
     * Connect a device with the specified name and configuration.
     * Only one device can be connected at a time. If a device is already
     * connected, it will be disconnected first.
     *
     * @param name Unique name for the device
     * @param config Complete device configuration
     */
    connectDevice(name: string, config: VeetDeviceConfig): void {
        // Disconnect any existing device first
        if (this.connectedDeviceName !== null) {
            this.disconnectAllDevices();
        }

        // Configure MockDriveList to include the new device
        const mockVeetDrive: MockVeetDrive = {
            device: config.drive.device,
            description: config.drive.description,
            size: config.drive.size,
            mountPath: config.drive.mountPath,
            label: config.drive.label,
        };
        this.driveList.addVeetDevice(mockVeetDrive);

        // Configure MockDiskUsage for the device's mount path
        const mockDiskInfo: MockDiskInfo = {
            path: config.drive.mountPath,
            total: config.storage.total,
            available: config.storage.available,
            free: config.storage.free,
        };
        this.diskUsage.setDiskInfo(config.drive.mountPath, mockDiskInfo);

        // Configure MockSerialPortFactory to include the new device
        const mockDeviceState: MockVeetDeviceState = {
            serialNumber: config.serialNumber,
            side: config.side,
            hardwareVersion: config.hardwareVersion,
            firmwareVersion: config.firmwareVersion,
            batteryVoltage: config.batteryVoltage,
            epochTime: Math.floor(Date.now() / 1000),
            isConnected: true,
            path: config.serialPort.path,
            responseLatencyMs: 100,
            errorProbability: 0,
            isInBootloader: false,
            isInTransportMode: false,
            vendorId: config.serialPort.vendorId,
            productId: config.serialPort.productId,
            manufacturer: config.serialPort.manufacturer,
        };
        this.serialPortFactory.addDevice(mockDeviceState);

        const realisticSensorData: MockSensorData = {
            imuData: SAMPLE_IMU_DATA,
            phoData: SAMPLE_PHO_DATA,
            tofData: SAMPLE_TOF_DATA,
            alsData: SAMPLE_ALS_DATA,
        };

        // Update the MockSerialPortFactory configuration with realistic sensor data
        this.serialPortFactory.setConfig({
            sensorData: realisticSensorData,
        });

        // Track the connected device
        this.connectedDeviceName = name;
        this.connectedDeviceConfig = config;
    }

    /**
     * Disconnect the device with the specified name.
     * If no device with that name is connected, this is a no-op.
     *
     * @param name Name of the device to disconnect
     */
    disconnectDevice(name: string): void {
        if (this.connectedDeviceName !== name || this.connectedDeviceConfig === null) {
            return; // Device not connected or different device connected
        }

        this.performDisconnection();
    }

    /**
     * Disconnect all devices (only one can be connected at a time).
     */
    disconnectAllDevices(): void {
        if (this.connectedDeviceName === null || this.connectedDeviceConfig === null) {
            return; // No device connected
        }

        this.performDisconnection();
    }

    /**
     * Get the name of the currently connected device, or null if none.
     *
     * @returns Device name or null
     */
    getConnectedDevice(): string | null {
        return this.connectedDeviceName;
    }

    /**
     * Check if a device with the specified name is currently connected.
     *
     * @param name Device name to check
     * @returns True if the device is connected, false otherwise
     */
    isDeviceConnected(name: string): boolean {
        return this.connectedDeviceName === name;
    }

    /**
     * Internal method to perform the actual disconnection operations
     * across all three mock hardware interfaces.
     */
    private performDisconnection(): void {
        if (this.connectedDeviceConfig === null) {
            return;
        }

        const config = this.connectedDeviceConfig;

        // Remove device from MockDriveList
        this.driveList.removeVeetDevice(config.drive.device);

        // Remove disk usage configuration from MockDiskUsage
        this.diskUsage.removeDiskInfo(config.drive.mountPath);

        // Remove device from MockSerialPortFactory
        this.serialPortFactory.removeDevice(config.serialPort.path);

        // Clear internal state
        this.connectedDeviceName = null;
        this.connectedDeviceConfig = null;
    }
}
