/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as fs from 'fs';

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../shared/Logger';

export function countFileLinesStreaming(filePath : string, lineEnding: number): Promise<number>{
  return new Promise((resolve, reject) => {
  let lineCount = -1;
  fs.createReadStream(filePath)
    .on('data', (buffer: Buffer) => {
      logger.info(buffer);
      let idx = -1;
      do {
        idx = buffer.indexOf(lineEnding, idx+1);
        lineCount++;
      } while (idx !== -1);
    }).on('end', () => {
      resolve(lineCount);
    }).on('error', reject);
  });
}

const execPromise = promisify(exec);

export async function ejectDrive(drivePath: string) {
  if (process.platform == 'win32') {
    const drive = drivePath.slice(0, 2);
    if (drive.length !== 2) {
      logger.error('Invalid drive: ' + drive);
      return;
    }
    try {
      await execPromise(`powershell (New-Object -comObject Shell.Application).Namespace(17).ParseName(\\"${drive}\\").InvokeVerb(\\"Eject\\")`);
    } catch (error) {
      logger.error(error);
    }
  } else if (process.platform === 'darwin') {
    try {
      await execPromise(`diskutil unmount '${drivePath}'`);
    } catch (error) {
      logger.error(error);
    }
  }
}

export const retryWrapper = async (func: () => Promise<boolean>, retryCount: number, retryDelayMS: number) => {
  let retriesLeft = retryCount;
  while (retriesLeft > 0) {
    --retriesLeft;
    if (await func()) {
      return;
    }
    await new Promise(r => setTimeout(r, retryDelayMS));
  }
  // If we got here, we failed
  logger.error('Failed after ' + retryCount + ' retries');
};
