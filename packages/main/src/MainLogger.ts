/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import winston from 'winston';
import  'winston-daily-rotate-file';
import { RegisterLogger } from '../../shared/Logger';
import { app } from 'electron';


export const RegisterMainLogger = () => {
  // eslint-disable-next-line no-console
  console.log('Writing logs to ', app.getPath('logs'));

  const rotatedLog = new winston.transports.DailyRotateFile({
    filename: 'veet-%DATE%.log',
    dirname: app.getPath('logs'),
    datePattern: 'YYYY-MM-DD-HH',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
  });

  RegisterLogger(
    winston.createLogger({
      level: 'info',
      transports: [
        new winston.transports.Console(),
        rotatedLog,
      ],
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  );
};
