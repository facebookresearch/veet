/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DelimiterParser, SerialPort } from 'serialport';
import type { Transform } from 'stream';
import { once, EventEmitter } from 'events';
import { getDataStore, setDatastoreValue } from '../../shared/DataStore';
import { Queue } from 'async-await-queue';
import { logger } from '../../shared/Logger';

const BAUD_RATE = 115200; // Doesn't look like this actually does anything, but gotta set something
const LINE_ENDINGS_SEND = '\r'; // carriage return for sending

const TOTAL_TIMEOUT = 1 * 1000; // 1 second should be enough for every command
const END_OF_TRANSMISSION_DELIMITER = Buffer.from([0x04]); // EOT - 0x04
const TIME_BEFORE_INFLIGHT_DISPLAY = 100;

const LOG_COMMAND_FLIGHT_TIMES = false;

const VEET_PRODUCT_ID = '0001';
const VEET_VENDOR_ID = '04d8';

export enum SerialConnectionStatus {
  UNKNOWN,
  NONE_FOUND,
  CONNECTED,
}

export enum WriteResponseCode {
  UNKNOWN,
  PORT_NOT_OPEN,
  RESPONSE_TIMED_OUT,
  NO_VALID_RESPONSE,
  VALID_RESPONSE,
  UNEXPECTED_ERROR,
}

export const UnconnectedPort = 'NONE';

export type UpdateSerialLogCB = (log: string[]) => void;

export class SerialManager extends EventEmitter {
  private connection_: SerialConnection | null = null;
  private connectedPort_ = UnconnectedPort;

  public get connectedPort() { return this.connectedPort_; }

  constructor() {
    super();
  }

  isConnected = (): boolean => {
    return Boolean(this.connection_);
  };

  disconnect = () => {
    this.connection_ = null;
    this.connectedPort_ = UnconnectedPort;
    setDatastoreValue('connectionPort', null);
    this.emit('disconnect');
  };

  findVeet = async (): Promise<SerialConnectionStatus> => {
    if (this.isConnected()) {
      return SerialConnectionStatus.CONNECTED;
    }
    logger.info('Searching for serial ports');
    const portList = await SerialPort.list();
    if (portList.length == 0) {
      this.connectedPort_ = UnconnectedPort;
      this.connection_ = null;
      logger.info('None found');
      return SerialConnectionStatus.NONE_FOUND;
    } else {
      logger.info(`${portList.length} ports found`);
    }
    let foundValidIDs = false;
    for (const portInfo of portList) {
      if (portInfo.vendorId?.toLowerCase() != VEET_VENDOR_ID || portInfo.productId != VEET_PRODUCT_ID) {
        continue;
      }
      foundValidIDs = true;
      logger.info('Found matching product and vendor IDs on port ' + portInfo.path);
      const startPerf = performance.now();
      logger.info('Attempting to connect to port ' + portInfo.path);
      const connection = new SerialConnection();
      const isReady = await connection.connect(portInfo.path);
      if (isReady) {
        this.connection_ = connection;
        logger.info('Found VEET on ' + portInfo.path);
        this.connectedPort_ = portInfo.path;
        setDatastoreValue('connectionPort', portInfo.path);
        connection.on('disconnect', this.disconnect);
        logger.info(`Connected to port ${portInfo.path} in ${Math.ceil(performance.now() - startPerf)}ms`);
        return SerialConnectionStatus.CONNECTED;
      } else {
        // Shouldn't happpen, but if findVeet is called twice there is a race condition
        if (this.isConnected()) {
          logger.info(`Aborted connecting to port ${portInfo.path} in ${Math.ceil(performance.now() - startPerf)}ms`);
          return SerialConnectionStatus.CONNECTED;
        }
        logger.info(`Failed to connect to port ${portInfo.path} in ${Math.ceil(performance.now() - startPerf)}ms`);
      }
    }
    if (!foundValidIDs) {
      logger.info('No valid product and vendor IDs found');
    }
    return SerialConnectionStatus.NONE_FOUND;
  };

  runCommand = async (cmd: string): Promise<string | null> => {
    if (!this.connection_) return null;
    const response = await this.connection_.writeWithResponse(cmd);
    if (response.code == WriteResponseCode.VALID_RESPONSE) {
      return response.value;
    }
    // TODO: Display Error
    return null;
  };

}

export class WriteResponse {
  code: WriteResponseCode = WriteResponseCode.UNKNOWN;
  value = '';
}

class SerialConnection extends EventEmitter {
  private port_: SerialPort | undefined;
  private parser_: Transform | undefined;

  // Only allow one concurrent serial command, but no need to wait until it's done
  // (already waiting 300ms until serial connection drained)
  private queue_: Queue = new Queue(1, 0);

  connect = async (path: string) => {
    this.port_ = new SerialPort({
      path: path,
      baudRate: BAUD_RATE,
    });
    // IMPORTANT: This is needed or any serial port error will crash the main process
    this.port_.on('error', this.handleError);

    // Check if it's open synchronously
    if (!this.port_.isOpen) {
      // SerialPort is an EventEmitter, so wait for it to send the open event async
      try {
        await once(this.port_, 'open');
      } catch (err) {
        logger.error('Error Connecting to port ' + path + ': ' + err);
        return false;
      }
    }

    // Clear out any lingering buffers
    this.port_.flush();

    // Setup parser
    this.parser_ = this.port_.pipe(new DelimiterParser({
      delimiter: END_OF_TRANSMISSION_DELIMITER,
      includeDelimiter: false,
    }));


    const resp = await this.writeWithResponse('VR');
    if (resp.code == WriteResponseCode.VALID_RESPONSE && resp.value && resp.value.startsWith('Build:')) {
      // Successfully found it!
      this.port_.on('close', this.disconnect);
      return true;
    }
    // This was not it... so close the port
    this.disconnect();
    return false;
  };

  disconnect = () => {
    this.parser_?.removeAllListeners();
    this.parser_ = undefined;
    if (this.port_ && this.port_.isOpen) {
      this.port_.close();
    }
    this.port_ = undefined;
    this.emit('disconnect');
  };

  appendSerialLogLine = (logLine: string) => {
    const MAX_LINE_LENGTH = 500;
    let line = logLine;
    if (line.length > MAX_LINE_LENGTH) {
      line = logLine.slice(0, MAX_LINE_LENGTH) + `[...+${logLine.length - MAX_LINE_LENGTH} chars]`;
    }

    setDatastoreValue('serialLog', getDataStore().serialLog.concat(line));
  };

  handleError = (err: Error | null | undefined) => {
    logger.error(`Serial Port Error: ${err}`);
  };


  writeWithResponse = async (toWrite: string): Promise<WriteResponse> => {
    const startTime = performance.now();

    // Guaranteed unique symbol for priority queue tracking
    const mySymbol = Symbol();

    // Wait our turn
    await this.queue_.wait(mySymbol);
    const postWaitTime = performance.now();
    let cmdTakingTooLong: NodeJS.Timeout | null = null;

    try {
      const resp = new WriteResponse();

      // Make sure port is open
      if (!this.port_ || !this.port_.isOpen) {
        resp.code = WriteResponseCode.PORT_NOT_OPEN;
        return resp;
      }

      // Wait for new lines to come in

      // Get ready for response, but also have a timeout
      const pTimeout = new Promise<string>((_, reject) => setTimeout(reject, TOTAL_TIMEOUT, 'TIMEOUT'));
      const pNewLines = new Promise<string>(resolve => { this.parser_?.once('data', (response) => resolve(response.toString())); });

      // Send the message with terminator
      this.port_.write(toWrite + LINE_ENDINGS_SEND);
      this.port_.drain();

      cmdTakingTooLong = setTimeout(() => {
        setDatastoreValue('commandInFlight', true);
        cmdTakingTooLong = null;
      }, TIME_BEFORE_INFLIGHT_DISPLAY);

      this.appendSerialLogLine('> ' + toWrite);


      await Promise.race([pTimeout, pNewLines]).then(
        // Handle response
        (response) => {
          const trimmedResponse = response.trim();
          resp.code = WriteResponseCode.VALID_RESPONSE;
          resp.value = trimmedResponse;
          this.appendSerialLogLine(trimmedResponse);
        },
        // Handle Timeout
        () => {
          resp.code = WriteResponseCode.RESPONSE_TIMED_OUT;
          this.appendSerialLogLine('err: TIMEOUT');
        },
      );
      return resp;
    } catch (err) {
      // Any unexpected error.
      logger.error(err);
      const resp = new WriteResponse();
      resp.code = WriteResponseCode.UNEXPECTED_ERROR;
      this.appendSerialLogLine('err: UNEXPECTED_ERROR');
      return resp;
    } finally {
      // Release our place in the priority queue. Note that this happens regardless of return status
      // Important not to have a return statement in this finally block
      this.queue_.end(mySymbol);
      cmdTakingTooLong && clearTimeout(cmdTakingTooLong);
      setDatastoreValue('commandInFlight', false);
      if (LOG_COMMAND_FLIGHT_TIMES) {
        logger.info(`Executed command ${toWrite.slice(0, 2)} in ${Math.ceil(performance.now() - postWaitTime)}ms, after waiting ${Math.ceil(postWaitTime - startTime)}ms`);
      }
    }
  };
}
