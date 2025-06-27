/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path';
import * as fsPromises from 'fs/promises';
import { getDataStore, setDatastoreValue } from '../../shared/DataStore';
import { logger } from '../../shared/Logger';
import { CALIB_FILENAME } from '../../shared/constants';
import { CALIBRATIONDB_PATH, type MainWindow } from './MainWindow';
import { z } from 'zod';
import md5File from 'md5-file';
import crypto from 'crypto';

import { calibrationDBSchema, type CalibrationDB } from '../../shared/CalibrationDB';

const calibrationFilePartialSchema = z.object({
  deviceID: z.string(),
  calib_timestamp: z.string().optional().default(new Date(0).toISOString()), // default to the epoch
});

type CalibrationFile = z.infer<typeof calibrationFilePartialSchema>;

/**
 * Singleton class for managing calibration database
 */
class CalibrationDBManager {
  private _calibrationDB: CalibrationDB | null = null;

  private async getCalibrationDB(): Promise<CalibrationDB | null> {
    if (this._calibrationDB) {
      return this._calibrationDB;
    }

    try {
      const calibDBJson = await fsPromises.readFile(CALIBRATIONDB_PATH(), { encoding: 'utf8' });
      this._calibrationDB = calibrationDBSchema.parse(JSON.parse(calibDBJson));
    } catch (err) {
      logger.error(err);
      this._calibrationDB = null;
    }

    return this._calibrationDB;
  }

  public async getCalibrationData(deviceID: string): Promise<CalibrationFile | null> {
    const calibrationDB = await this.getCalibrationDB();
    if (!calibrationDB) {
      return null;
    }
    return calibrationDB.calibrations[deviceID] || null;
  }
}
const calibrationDBManager = new CalibrationDBManager();

export const updateDeviceCalibrationFromDB = async (mainWindow: MainWindow) => {
  // Check the deviceID
  if (!getDataStore().serialNumber) {
    await mainWindow.checkSerialNumber(); // in case it hasn't run yet
  }
  const deviceID = getDataStore().serialNumber;
  if (!deviceID) {
    logger.error('Unable to find deviceID, cannot update calibration');
    return;
  }

  const dbCalibrationData = await calibrationDBManager.getCalibrationData(deviceID);
  if (!dbCalibrationData) {
    logger.error(`Unable to find calibration data for deviceID ${deviceID}`);
    return;
  }

  const drivePath = getDataStore().drivePath;
  if (!drivePath) {
    logger.info('Unable to find drive path, can\'t write calibration file');
    return;
  }

  const voltageCheckPassed = await mainWindow.checkMinimumVoltageForOperation('calibration file update');
  if (!voltageCheckPassed) {
    logger.info('Calibration file update aborted due to insufficient battery voltage');
    return;
  }

  const calibPath = path.join(drivePath, CALIB_FILENAME);
  const calibrationContent = JSON.stringify(dbCalibrationData, null, 2);

  try {
    const expectedHash = crypto.createHash('md5').update(calibrationContent).digest('hex');
    logger.info('Expected calibration file MD5: ' + expectedHash);

    await fsPromises.writeFile(calibPath, calibrationContent);
    logger.info(`Updated calibration file at ${calibPath}`);

    await new Promise(r => setTimeout(r, 2500));

    const actualHash = await md5File(calibPath);
    logger.info('Actual calibration file MD5: ' + actualHash);

    if (expectedHash !== actualHash) {
      logger.error('Calibration file hash mismatch! Write may have failed.');
      logger.error(`Expected: ${expectedHash}, Actual: ${actualHash}`);
      return;
    }

    logger.info('Calibration file hash verified - write successful');
  } catch (err) {
    logger.error('Error writing calibration file:', err);
  }
};

export const lookupCalibrationDataForDevice = async (mainWindow: MainWindow, showDialog: boolean = false): Promise<boolean> => {
  const drivePath = getDataStore().drivePath;
  if (!drivePath) {
    logger.info('Unable to find drive path, no calib loaded');
    return false;
  }

  // Load the existing calibration file
  let shouldUpdateCalibrationReason = '';
  let currentCalibrationData: CalibrationFile | null = null;
  try {
    const calibPath = path.join(drivePath, CALIB_FILENAME);
    const calibJson = await fsPromises.readFile(calibPath, { encoding: 'utf8' });
    currentCalibrationData = calibrationFilePartialSchema.parse(JSON.parse(calibJson));
  } catch (err) {
    logger.error(err);
  }

  // Check the deviceID
  if (!getDataStore().serialNumber) {
    await mainWindow.checkSerialNumber(); // in case it hasn't run yet
  }
  const deviceID = getDataStore().serialNumber;
  if (!deviceID) {
    logger.error('Unable to find deviceID, cannot update calibration');
    return false;
  }

  const dbCalibrationData = await calibrationDBManager.getCalibrationData(deviceID);
  if (!dbCalibrationData) {
    // This device is not in the DB, report an error to the user and abort
    void mainWindow.showMessageBox({
      title: 'Unknown Device ID',
      message: `The device serial number ${getDataStore().serialNumber
        } does not match any known device for this version of VEETManager. Try updating the VEETManager or contact support at VEETSupport@meta.com`,
    });
    logger.info(`Serial number ${getDataStore().serialNumber} not found in calibration DB`);
    return false;
  }

  if (!currentCalibrationData) {
    // We somehow failed to load an existing calibration file, it might be missing or corrupted. Let's try to update it.
    shouldUpdateCalibrationReason = 'The calibration file on device is missing or corrupted.';
  } else {
    // Check calibration data vs device info
    if (currentCalibrationData.deviceID !== deviceID) {
      shouldUpdateCalibrationReason = 'The calibration file on device is different than expected.';
    } else {
      // Compare with data in the DB
      const currentCalibTime = new Date(currentCalibrationData.calib_timestamp).getTime();
      const dbCalibTime = new Date(dbCalibrationData.calib_timestamp).getTime();
      if (!Number.isFinite(currentCalibTime) || currentCalibTime < dbCalibTime) {
        shouldUpdateCalibrationReason = 'There is updated calibration data available for your device.';
      }
    }
  }

  if (shouldUpdateCalibrationReason) {
    if (showDialog) {
      const response = await mainWindow.showMessageBox({
        message: `We recommend updating your calibration settings: ${shouldUpdateCalibrationReason}`,
        title: 'Update Calibration?',
        buttons: ['Update Calibration', 'Cancel'],
      });

      if (response) {
        switch (response.response) {
          case 0: {
            logger.info('User chose to update calibration');
            await updateDeviceCalibrationFromDB(mainWindow);

            logger.info('Running Reset command');
            const REResult = await mainWindow.runCommand(null, 'RE');
            logger.info('Complete, calibration updated: ' + REResult);
            return true;
          }
          default:
          case 1:
            logger.info('User chose not to update calibration');
            return true;
        }
      }
    } else {
      logger.info(`${shouldUpdateCalibrationReason}`);
    }
  }

  logger.info(`Found correct calibration file`);
  return true;
};

// Not sure if we still want this, but leaving it here for now
export const updateCalibrationFromFile = async (mainWindow: MainWindow) => {
  const drivePath = getDataStore().drivePath;
  if (!drivePath) {
    logger.error('Unable to find drive path, cannot update calibration file');
    return;
  }
  const sourceCalibInfo = await mainWindow.showOpenDialog({
    title: 'Pick New Calibration File',
    buttonLabel: 'Select New Calibration File',
    filters: [{ name: 'All Files', extensions: ['json'] }],
  });
  if (!sourceCalibInfo) {
    logger.error('Failed to open dialog window');
    return;
  }
  if (sourceCalibInfo.canceled) {
    logger.info('Calibration File Update Canceled');
    return;
  }
  if (sourceCalibInfo.filePaths.length !== 1) {
    logger.error('Invalid source calibration info: ' + sourceCalibInfo);
    return;
  }

  // If we got here, we're good to go. Put up a modal.
  setDatastoreValue('modalMessage', 'Updating Calibration...');
  try {
    const sourcePath = sourceCalibInfo.filePaths[0];
    const destPath = path.join(drivePath, CALIB_FILENAME);
    logger.info(`Copying ${sourcePath} to ${destPath}`);
    await fsPromises.copyFile(sourcePath, destPath);

    // Reload the calibration file after updating
    logger.info('Reloading calibration file after copy.');
    await lookupCalibrationDataForDevice(mainWindow);

    // Resetting VEET to reload calibration file
    logger.info('Resetting VEET to reload calibration.');
    await mainWindow.runCommand(null, 'RE');

    logger.info('Complete, calibration updated');
  } catch (err) {
    logger.error(err);
  } finally {
    setDatastoreValue('modalMessage', null);
  }
};
