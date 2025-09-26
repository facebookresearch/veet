/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';
import type { ISerialPort, ISerialPortFactory, SerialPortOptions, PortInfo } from './HardwareInterfaces';

/**
 * Mock VEET device state for simulating realistic device behavior.
 */
export interface MockVeetDeviceState {
    /** Device serial number */
    serialNumber: string;
    /** Device side designation (L or R) */
    side: 'L' | 'R';
    /** Hardware version string */
    hardwareVersion: string;
    /** Firmware version string */
    firmwareVersion: string;
    /** Current battery voltage in millivolts */
    batteryVoltage: number;
    /** Current device epoch time in seconds */
    epochTime: number;
    /** Whether device is connected */
    isConnected: boolean;
    /** Device connection path */
    path: string;
    /** Simulated response latency in milliseconds */
    responseLatencyMs: number;
    /** Error probability for command responses (0-1) */
    errorProbability: number;
    /** Whether device is in bootloader mode */
    isInBootloader: boolean;
    /** Whether device is in transport mode */
    isInTransportMode: boolean;
    /** Vendor and product IDs */
    vendorId: string;
    productId: string;
    /** Manufacturer name */
    manufacturer: string;
}

/**
 * Sensor data simulation configuration.
 */
export interface MockSensorData {
    /** IMU data format string */
    imuData: string;
    /** Photometric sensor data format string */
    phoData: string;
    /** Time of Flight sensor data format string */
    tofData: string;
    /** Ambient Light sensor data format string */
    alsData: string;
}

/**
 * Configuration for mock serial port behavior.
 */
export interface MockSerialPortConfig {
    /** Available mock devices */
    devices: MockVeetDeviceState[];
    /** Sensor data simulation */
    sensorData: MockSensorData;
    /** Global error simulation settings */
    globalErrorProbability: number;
    /** Whether to simulate realistic timing */
    simulateRealisticTiming: boolean;
    /** Command timeout in milliseconds */
    commandTimeoutMs: number;
}

/**
 * Mock serial port factory that creates mock serial port instances.
 * Simulates the serialport library behavior for testing purposes.
 */
export class MockSerialPortFactory implements ISerialPortFactory {
    private config: MockSerialPortConfig;

    constructor(config?: Partial<MockSerialPortConfig>) {
        this.config = {
            devices: [],
            sensorData: {
                imuData: '1695123456,IMU,0.12,-0.34,9.81,0.01,0.02,-0.01',
                phoData: '1695123456,PHO,1234,5678,9012,3456,7890',
                tofData: '1695123456,TOF,45.6,67.8,123.4,89.0',
                alsData: '1695123456,ALS,1250,890,456',
            },
            globalErrorProbability: 0,
            simulateRealisticTiming: true,
            commandTimeoutMs: 1000,
            ...config,
        };
    }

    /**
     * Update the mock configuration for testing different scenarios.
     * @param config New configuration to apply
     */
    setConfig(config: Partial<MockSerialPortConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Add a mock VEET device to the available devices list.
     * @param device The mock device to add
     */
    addDevice(device: MockVeetDeviceState): void {
        this.config.devices.push(device);
    }

    /**
     * Remove a mock device by path.
     * @param path The device path to remove
     */
    removeDevice(path: string): void {
        this.config.devices = this.config.devices.filter(device => device.path !== path);
    }

    /**
     * Clear all mock devices.
     */
    clearDevices(): void {
        this.config.devices = [];
    }

    /**
     * List all available serial ports (mock VEET devices).
     * @returns Promise that resolves to an array of port information
     */
    async list(): Promise<PortInfo[]> {
        return this.config.devices
            .filter(device => device.isConnected)
            .map(device => ({
                path: device.path,
                manufacturer: device.manufacturer,
                serialNumber: device.serialNumber,
                vendorId: device.vendorId,
                productId: device.productId,
            }));
    }

    /**
     * Create a new mock serial port instance.
     * @param options Configuration options for the serial port
     * @returns A new mock serial port instance
     */
    create(options: SerialPortOptions): ISerialPort {
        const device = this.config.devices.find(d => d.path === options.path);
        return new MockSerialPort(options, device, this.config);
    }
}

/**
 * Mock serial port implementation that simulates VEET device communication.
 * Implements the complete VEET protocol with realistic response timing and error simulation.
 */
export class MockSerialPort extends EventEmitter implements ISerialPort {
    private options: SerialPortOptions;
    private device: MockVeetDeviceState | undefined;
    private config: MockSerialPortConfig;
    private _isOpen: boolean = false;
    private commandBuffer: string = '';
    private responseTimer: NodeJS.Timeout | null = null;

    constructor(
        options: SerialPortOptions,
        device: MockVeetDeviceState | undefined,
        config: MockSerialPortConfig,
    ) {
        super();
        this.options = options;
        this.device = device;
        this.config = config;
    }

    /**
     * Current port state - true if open, false if closed.
     */
    get isOpen(): boolean {
        return this._isOpen;
    }

    /**
     * Open the serial port connection.
     * @param callback Optional callback function called when operation completes
     */
    open(callback?: (error: Error | null) => void): void {
        // Simulate async operation
        process.nextTick(() => {
            if (this._isOpen) {
                const error = new Error('Port is already open');
                if (callback) callback(error);
                this.emit('error', error);
                return;
            }

            if (!this.device || !this.device.isConnected) {
                const error = new Error(`No such file or directory, cannot open ${this.options.path}`);
                if (callback) callback(error);
                this.emit('error', error);
                return;
            }

            this._isOpen = true;
            if (callback) callback(null);
            this.emit('open');
        });
    }

    /**
     * Close the serial port connection.
     * @param callback Optional callback function called when operation completes
     */
    close(callback?: (error: Error | null) => void): void {
        process.nextTick(() => {
            if (!this._isOpen) {
                const error = new Error('Port is not open');
                if (callback) callback(error);
                return;
            }

            // Clear any pending response timers
            if (this.responseTimer) {
                clearTimeout(this.responseTimer);
                this.responseTimer = null;
            }

            this._isOpen = false;
            if (callback) callback(null);
            this.emit('close');
        });
    }

    /**
     * Write data to the serial port (send commands to mock VEET device).
     * @param data The data to write (string or Buffer)
     * @param callback Optional callback function called when operation completes
     * @returns True if data was queued successfully, false if port is closed
     */
    write(data: string | Buffer, callback?: (error: Error | null) => void): boolean {
        if (!this._isOpen) {
            const error = new Error('Port is not open');
            if (callback) process.nextTick(() => callback(error));
            return false;
        }

        if (!this.device) {
            const error = new Error('No device configured for this port');
            if (callback) process.nextTick(() => callback(error));
            return false;
        }

        const command = data.toString();
        this.commandBuffer += command;

        // Process commands when we receive a carriage return
        if (this.commandBuffer.includes('\r')) {
            const commands = this.commandBuffer.split('\r');
            this.commandBuffer = commands.pop() || ''; // Keep any partial command

            for (const cmd of commands) {
                if (cmd.trim()) {
                    this.processCommand(cmd.trim());
                }
            }
        }

        if (callback) process.nextTick(() => callback(null));
        return true;
    }

    /**
     * Process a VEET device command and generate appropriate response.
     * @param command The command to process
     */
    private processCommand(command: string): void {
        if (!this.device) return;

        // Simulate response latency
        const latency = this.config.simulateRealisticTiming
            ? Math.max(50, this.device.responseLatencyMs + (Math.random() - 0.5) * 20)
            : 0;

        // Check for global and device-specific error simulation
        const errorProbability = Math.max(this.config.globalErrorProbability, this.device.errorProbability);
        const shouldError = Math.random() < errorProbability;

        this.responseTimer = setTimeout(() => {
            if (shouldError) {
                this.sendResponse('#Err Command failed');
                return;
            }

            // Device state checks
            if (this.device!.isInBootloader && command !== 'BL') {
                // In bootloader mode, ignore most commands
                return;
            }

            if (this.device!.isInTransportMode) {
                // In transport mode, device doesn't respond
                return;
            }

            const response = this.generateCommandResponse(command);
            if (response !== null) {
                this.sendResponse(response);
            }
            // If response is null, simulate no response (timeout scenario)
        }, latency);
    }

    /**
     * Generate response for a specific VEET command.
     * @param command The command to generate a response for
     * @returns Response string or null for no response
     */
    private generateCommandResponse(command: string): string | null {
        if (!this.device) return null;

        const timestamp = this.device.epochTime.toString();

        switch (command.toUpperCase()) {
            case 'GB': // Get Battery
                // Support both response formats as documented in the plan
                if (Math.random() < 0.5) {
                    return `Battery: ${this.device.batteryVoltage}mV`;
                } else {
                    return `${timestamp},BAT,${this.device.batteryVoltage}`;
                }

            case 'GT': // Get Time
                return `Time(s): ${this.device.epochTime}`;

            case 'GS': // Get Serial Number
                return `${timestamp},SER,${this.device.serialNumber}`;

            case 'GM': // Get Device Side
                return `${timestamp},SIDE,${this.device.side}`;

            case 'HV': // Hardware Version
                return this.device.hardwareVersion;

            case 'FV': // Firmware Version
                return this.device.firmwareVersion;

            case 'RE': // Reset/Reboot Device
                setTimeout(() => {
                    this.device!.isConnected = false;
                    if (this._isOpen) {
                        this._isOpen = false;
                        this.emit('close');
                    }
                }, 500);
                return 'OK';

            case 'BL': // Enter Bootloader Mode
                this.device.isInBootloader = true;
                setTimeout(() => {
                    this.device!.isConnected = false;
                    if (this._isOpen) {
                        this._isOpen = false;
                        this.emit('close');
                    }
                }, 500);
                return 'Entering bootloader';

            case 'TM': // Transport Mode
                this.device.isInTransportMode = true;
                setTimeout(() => {
                    this.device!.isConnected = false;
                    if (this._isOpen) {
                        this._isOpen = false;
                        this.emit('close');
                    }
                }, 200);
                return 'Transport mode enabled';

            case 'S0': // Poll IMU Data
                return this.config.sensorData.imuData;

            case 'S1': // Poll PHO Data
                return this.config.sensorData.phoData;

            case 'S2': // Poll TOF Data
                return this.config.sensorData.tofData;

            case 'S3': // Poll ALS Data
                return this.config.sensorData.alsData;

            default:
                // Handle SET TIME command (ST followed by epoch time)
                if (command.startsWith('ST') && command.length > 2) {
                    const timeStr = command.substring(2);
                    const newTime = parseInt(timeStr, 10);
                    if (!isNaN(newTime)) {
                        this.device.epochTime = newTime;
                        return 'Time set';
                    }
                }

                // Unknown command - return error or no response
                if (Math.random() < 0.8) {
                    return '#Err Unknown command';
                } else {
                    return null; // Simulate timeout
                }
        }
    }

    /**
     * Send a response back to the application with proper EOT termination.
     * @param response The response string to send
     */
    private sendResponse(response: string): void {
        if (!this._isOpen) return;

        // All responses are terminated with EOT character as per VEET protocol
        const responseBuffer = Buffer.from(response + '\x04');

        // Emit data event to simulate receiving response data
        process.nextTick(() => {
            this.emit('data', responseBuffer);
        });
    }

    /**
     * Flush the port's write buffer.
     * @param callback Optional callback function called when operation completes
     */
    flush(callback?: (error: Error | null) => void): void {
        if (callback) process.nextTick(() => callback(null));
    }

    /**
     * Drain the port's write buffer.
     * @param callback Optional callback function called when operation completes
     */
    drain(callback?: (error: Error | null) => void): void {
        if (callback) process.nextTick(() => callback(null));
    }

    /**
     * Pipe data to a writable stream (for use with DelimiterParser).
     * @param destination The destination stream
     * @returns The destination stream for chaining
     */
    pipe<T extends NodeJS.WritableStream>(destination: T): T {
        // Forward data events to the destination stream
        this.on('data', (data: Buffer) => {
            destination.write(data.toString('utf8'));
        });

        this.on('close', () => {
            if ('end' in destination && typeof destination.end === 'function') {
                destination.end();
            }
        });

        this.on('error', (error: Error) => {
            if ('destroy' in destination && typeof destination.destroy === 'function') {
                destination.destroy(error);
            }
        });

        return destination;
    }

    /**
     * Add a one-time listener for the given event.
     * @param event The event name
     * @param listener The listener function
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    once(event: string | symbol, listener: (...args: any[]) => void): this {
        return super.once(event, listener);
    }

    /**
     * Remove all event listeners for the specified event, or all events if no event specified.
     * @param event Optional event name to remove listeners for
     */
    removeAllListeners(event?: string): this {
        return super.removeAllListeners(event);
    }
}

/**
 * Predefined test scenarios for common VEET Manager serial communication testing.
 */
export class MockSerialPortScenarios {
    /**
     * Single VEET device with typical configuration.
     */
    static singleDevice(): MockSerialPortConfig {
        return {
            devices: [
                {
                    serialNumber: 'TEST001',
                    side: 'L',
                    hardwareVersion: 'VEET-HW-2.1',
                    firmwareVersion: 'VEET-FW-1.5.2',
                    batteryVoltage: 4120,
                    epochTime: Math.floor(Date.now() / 1000),
                    isConnected: true,
                    path: '/dev/ttyUSB0',
                    responseLatencyMs: 100,
                    errorProbability: 0,
                    isInBootloader: false,
                    isInTransportMode: false,
                    vendorId: '04d8',
                    productId: '0001',
                    manufacturer: 'Meta',
                },
            ],
            sensorData: {
                imuData: '1695123456,IMU,0.12,-0.34,9.81,0.01,0.02,-0.01',
                phoData: '1695123456,PHO,1234,5678,9012,3456,7890',
                tofData: '1695123456,TOF,45.6,67.8,123.4,89.0',
                alsData: '1695123456,ALS,1250,890,456',
            },
            globalErrorProbability: 0,
            simulateRealisticTiming: true,
            commandTimeoutMs: 1000,
        };
    }

    /**
     * Left and right VEET devices connected simultaneously.
     */
    static leftRightPair(): MockSerialPortConfig {
        const baseConfig = this.singleDevice();
        baseConfig.devices = [
            {
                ...baseConfig.devices[0],
                serialNumber: 'TEST001L',
                side: 'L',
                path: '/dev/ttyUSB0',
            },
            {
                ...baseConfig.devices[0],
                serialNumber: 'TEST001R',
                side: 'R',
                path: '/dev/ttyUSB1',
                batteryVoltage: 4085, // Slightly different battery level
            },
        ];
        return baseConfig;
    }

    /**
     * Device with low battery for testing battery warnings.
     */
    static lowBatteryDevice(): MockSerialPortConfig {
        const config = this.singleDevice();
        config.devices[0].batteryVoltage = 3650; // Low battery voltage
        return config;
    }

    /**
     * Device with intermittent communication errors.
     */
    static unreliableDevice(): MockSerialPortConfig {
        const config = this.singleDevice();
        config.devices[0].errorProbability = 0.3; // 30% error rate
        config.devices[0].responseLatencyMs = 200; // Slower responses
        return config;
    }

    /**
     * Device that simulates firmware update scenario.
     */
    static bootloaderDevice(): MockSerialPortConfig {
        const config = this.singleDevice();
        config.devices[0].isInBootloader = true;
        return config;
    }

    /**
     * Device in transport/shipping mode.
     */
    static transportModeDevice(): MockSerialPortConfig {
        const config = this.singleDevice();
        config.devices[0].isInTransportMode = true;
        return config;
    }

    /**
     * Multiple devices for testing device selection and management.
     */
    static multipleDevices(): MockSerialPortConfig {
        const baseConfig = this.singleDevice();
        baseConfig.devices = [
            {
                ...baseConfig.devices[0],
                serialNumber: 'TEST001',
                side: 'L',
                path: '/dev/ttyUSB0',
                batteryVoltage: 4120,
            },
            {
                ...baseConfig.devices[0],
                serialNumber: 'TEST002',
                side: 'R',
                path: '/dev/ttyUSB1',
                batteryVoltage: 4085,
                firmwareVersion: 'VEET-FW-1.5.1', // Different firmware version
            },
            {
                ...baseConfig.devices[0],
                serialNumber: 'TEST003',
                side: 'L',
                path: '/dev/ttyUSB2',
                batteryVoltage: 3850,
                hardwareVersion: 'VEET-HW-2.0', // Older hardware
            },
        ];
        return baseConfig;
    }

    /**
     * Device with realistic sensor data patterns.
     */
    static realisticSensorData(): MockSerialPortConfig {
        const config = this.singleDevice();

        // Update sensor data to simulate realistic readings
        const timestamp = Math.floor(Date.now() / 1000);
        config.sensorData = {
            imuData: `${timestamp},IMU,0.15,-0.28,9.83,0.012,0.025,-0.008`,
            phoData: `${timestamp},PHO,1856,2341,2987,3124,3456`,
            tofData: `${timestamp},TOF,127.5,89.2,156.8,203.4`,
            alsData: `${timestamp},ALS,1450,920,678`,
        };

        return config;
    }

    /**
     * Device with high latency for performance testing.
     */
    static highLatencyDevice(): MockSerialPortConfig {
        const config = this.singleDevice();
        config.devices[0].responseLatencyMs = 500; // 500ms latency
        return config;
    }

    /**
     * No devices connected scenario.
     */
    static noDevices(): MockSerialPortConfig {
        return {
            devices: [],
            sensorData: {
                imuData: '',
                phoData: '',
                tofData: '',
                alsData: '',
            },
            globalErrorProbability: 0,
            simulateRealisticTiming: true,
            commandTimeoutMs: 1000,
        };
    }

    /**
     * Device that becomes disconnected during operation.
     */
    static intermittentConnection(): MockSerialPortConfig {
        const config = this.singleDevice();

        // Simulate device disconnection after some time
        setTimeout(() => {
            config.devices[0].isConnected = false;
        }, 5000); // Disconnect after 5 seconds

        return config;
    }

    /**
     * Legacy device (VEET 1.0) for backward compatibility testing.
     */
    static legacyDevice(): MockSerialPortConfig {
        const config = this.singleDevice();
        config.devices[0] = {
            ...config.devices[0],
            serialNumber: 'LEGACY001',
            hardwareVersion: 'VEET-HW-1.0',
            firmwareVersion: 'VEET-FW-1.0.5',
            batteryVoltage: 3980,
        };
        return config;
    }
}
