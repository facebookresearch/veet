/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */


export interface LeveledLogMethod {
  (message: string, ...meta: any[]): Logger;
  (message: any): Logger;
}

export interface LogMethod {
  (level: string, message: string, ...meta: any[]): Logger;
  (level: string, message: any): Logger;
}

export interface Logger {
  log: LogMethod;
  info: LeveledLogMethod;
  warn: LeveledLogMethod;
  error: LeveledLogMethod;
}

export class ConsoleLogger implements Logger {
  log(level: string, message: string, ...meta: any[]): Logger {
    if (level === 'error') {
      // eslint-disable-next-line no-console
      console.error(message, ...meta);
    } else if (level === 'warn') {
      // eslint-disable-next-line no-console
      console.warn(message, ...meta);
    } else {
      // eslint-disable-next-line no-console
      console.log(message, ...meta);
    }
    return this;
  }

  info(message: string, ...meta: any) {
    return this.log('info', message, ...meta);
  }
  warn(message: string, ...meta: any) {
    return this.log('warn', message, ...meta);
  }
  error(message: string, ...meta: any) {
    return this.log('error', message, ...meta);
  }

}


// Default logger until app registers a better one
export let logger: Logger = new ConsoleLogger();

// Overrides the default logger
export const RegisterLogger = (newLogger: Logger) => {
  logger = newLogger;
};
