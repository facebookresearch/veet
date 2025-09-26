/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SerialPort } from 'serialport';
import type { ISerialPortFactory, ISerialPort, SerialPortOptions, PortInfo } from './HardwareInterfaces';

/**
 * Production implementation of ISerialPortFactory that wraps the serialport library.
 * This enables dependency injection and mocking for testing while maintaining
 * compatibility with existing SerialManager code.
 */
export class ProductionSerialPortFactory implements ISerialPortFactory {
    /**
     * List all available serial ports.
     * @returns Promise that resolves to an array of port information
     */
    async list(): Promise<PortInfo[]> {
        const ports = await SerialPort.list();
        return ports.map(port => ({
            path: port.path,
            manufacturer: port.manufacturer,
            serialNumber: port.serialNumber,
            vendorId: port.vendorId,
            productId: port.productId,
        }));
    }

    /**
     * Create a new serial port instance.
     * @param options Configuration options for the serial port
     * @returns A new serial port instance
     */
    create(options: SerialPortOptions): ISerialPort {
        return new ProductionSerialPort(options);
    }
}

/**
 * Production implementation of ISerialPort that wraps the SerialPort class.
 * This provides a clean interface for dependency injection while maintaining
 * all the functionality needed by SerialManager.
 */
class ProductionSerialPort implements ISerialPort {
    private port: SerialPort;

    constructor(options: SerialPortOptions) {
        this.port = new SerialPort({
            path: options.path,
            baudRate: options.baudRate,
        });
    }

    /**
     * Current port state - true if open, false if closed.
     */
    get isOpen(): boolean {
        return this.port.isOpen;
    }

    /**
     * Open the serial port connection.
     * @param callback Optional callback function called when operation completes
     */
    open(callback?: (error: Error | null) => void): void {
        this.port.open(callback);
    }

    /**
     * Close the serial port connection.
     * @param callback Optional callback function called when operation completes
     */
    close(callback?: (error: Error | null) => void): void {
        this.port.close(callback);
    }

    /**
     * Write data to the serial port.
     * @param data The data to write (string or Buffer)
     * @param callback Optional callback function called when operation completes
     * @returns True if data was queued successfully, false if port is closed
     */
    write(data: string | Buffer, callback?: (error: Error | null) => void): boolean {
        // Type assertion needed due to serialport callback type accepting undefined but our interface only allows null
        return this.port.write(data, callback as ((error: Error | null | undefined) => void) | undefined);
    }

    /**
     * Flush the port's write buffer.
     * @param callback Optional callback function called when operation completes
     */
    flush(callback?: (error: Error | null) => void): void {
        this.port.flush(callback);
    }

    /**
     * Drain the port's write buffer.
     * @param callback Optional callback function called when operation completes
     */
    drain(callback?: (error: Error | null) => void): void {
        this.port.drain(callback);
    }

    /**
     * Pipe data to a writable stream (for use with DelimiterParser).
     * @param destination The destination stream
     * @returns The destination stream for chaining
     */
    pipe<T extends NodeJS.WritableStream>(destination: T): T {
        return this.port.pipe(destination);
    }

    /**
     * Register event listeners for port events.
     */
    on(event: 'open', listener: () => void): this;
    on(event: 'close', listener: (error?: Error) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'data', listener: (data: Buffer) => void): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string | symbol, listener: (...args: any[]) => void): this {
        this.port.on(event, listener);
        return this;
    }

    /**
     * Add a one-time listener for the given event.
     * @param event The event name
     * @param listener The listener function
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    once(event: string | symbol, listener: (...args: any[]) => void): this {
        this.port.once(event, listener);
        return this;
    }

    /**
     * Remove all event listeners for the specified event, or all events if no event specified.
     * @param event Optional event name to remove listeners for
     */
    removeAllListeners(event?: string): this {
        this.port.removeAllListeners(event);
        return this;
    }

    /**
     * Add a listener to the beginning of the listeners array for the specified event.
     * @param event The event name
     * @param listener The listener function
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prependListener(event: string | symbol, listener: (...args: any[]) => void): this {
        this.port.prependListener(event, listener);
        return this;
    }

    /**
     * Add a one-time listener to the beginning of the listeners array for the specified event.
     * @param event The event name
     * @param listener The listener function
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this {
        this.port.prependOnceListener(event, listener);
        return this;
    }

    /**
     * Add an event listener (alias for on).
     * @param event The event name
     * @param listener The listener function
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addListener(event: string | symbol, listener: (...args: any[]) => void): this {
        this.port.addListener(event, listener);
        return this;
    }

    /**
     * Remove a specific event listener.
     * @param event The event name
     * @param listener The listener function to remove
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
        this.port.removeListener(event, listener);
        return this;
    }

    /**
     * Remove a specific event listener (alias for removeListener).
     * @param event The event name
     * @param listener The listener function to remove
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    off(event: string | symbol, listener: (...args: any[]) => void): this {
        this.port.off(event, listener);
        return this;
    }

    /**
     * Set the maximum number of listeners for this EventEmitter.
     * @param n The maximum number of listeners
     */
    setMaxListeners(n: number): this {
        this.port.setMaxListeners(n);
        return this;
    }

    /**
     * Get the maximum number of listeners for this EventEmitter.
     */
    getMaxListeners(): number {
        return this.port.getMaxListeners();
    }

    /**
     * Get the current listener count for the specified event.
     * @param event The event name
     */
    listenerCount(event: string | symbol): number {
        return this.port.listenerCount(event);
    }

    /**
     * Get an array of listeners for the specified event.
     * @param event The event name
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listeners(event: string | symbol): Array<(...args: any[]) => void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return this.port.listeners(event) as Array<(...args: any[]) => void>;
    }

    /**
     * Get an array of raw listeners for the specified event (including wrappers).
     * @param event The event name
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawListeners(event: string | symbol): Array<(...args: any[]) => void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return this.port.rawListeners(event) as Array<(...args: any[]) => void>;
    }

    /**
     * Get an array of event names for which this EventEmitter has listeners.
     */
    eventNames(): (string | symbol)[] {
        return this.port.eventNames();
    }

    /**
     * Emit an event with the specified arguments.
     * @param event The event name
     * @param args Arguments to pass to listeners
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emit(event: string | symbol, ...args: any[]): boolean {
        return this.port.emit(event, ...args);
    }
}
