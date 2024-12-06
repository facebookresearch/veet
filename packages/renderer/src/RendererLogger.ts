/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Logger} from '../../shared/Logger';
import { ConsoleLogger, RegisterLogger } from '../../shared/Logger';

const consoleLogger = new ConsoleLogger();

class BridgeLogger implements Logger {
  log(level: string, message: string, ...meta: any[]): Logger {
    window.bridgeApi.recordLogMessage(level, message, ...meta);
    // Also log to our local console
    consoleLogger.log(level, message, ...meta);
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



export const RegisterRendererLogger = () => {
  RegisterLogger(
    new BridgeLogger(),
  );
};
