/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path';
import * as fsPromises from 'fs/promises';
import { getCalibStore, loadCalibFromJson } from '../../shared/CalibStore';
import { getDataStore, setDatastoreValue } from '../../shared/DataStore';
import { logger } from '../../shared/Logger';
import { CALIB_FILENAME } from '../../shared/constants';
import type { MainWindow } from './MainWindow';

export const loadCalib = async (mainWindow: MainWindow) => {
  const drivePath = getDataStore().drivePath;
  if (!drivePath) {
    logger.info('Unable to find drive path, no calib loaded');
    return;
  }
  let loadedCalib = false;
  try {
    const calibPath = path.join(drivePath, CALIB_FILENAME);
    const calibJson = await fsPromises.readFile(calibPath, { encoding: 'utf8' });
    loadedCalib = loadCalibFromJson(calibJson, mainWindow.displayFatalError);
  } catch (err) {
    logger.error(err);
  }

  if (loadedCalib) {
    // Do we have a deviceID in the calibration file?
    if (!getCalibStore().deviceID) {
      void mainWindow.showMessageBox({
        title: 'Missing Calibration',
        message: 'No deviceID found in calibration file. This most likely means that the device is not calibrated. Please contact support at VEETSupport@meta.com',
      });
    } else {
      // Make sure the serials match
      if (!getDataStore().serialNumber) {
        await mainWindow.checkSerialNumber(); // in case it hasn't run yet
      }
      if (getCalibStore().deviceID != getDataStore().serialNumber) {
        void mainWindow.showMessageBox({
          title: 'Mismatched Calibration ID',
          message: `The deviceID in the calibration file is ${getCalibStore().deviceID}, but the device serial number is ${getDataStore().serialNumber}. This might mean your device is miscalibrated. Please contact support at VEETSupport@meta.com`,
        });
      } else {
        logger.info('Serial number matches calibration deviceID: ' + getDataStore().serialNumber);
      }
    }
  }

};

export const updateCalibrationFile = async (mainWindow: MainWindow) => {
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
    await loadCalib(mainWindow);

    // Resetting VEET to reload calibration file
    logger.info('Resetting VEET to reload calibration.');
    await mainWindow.runCommand(null, 'RE');

    // Resetting VEET to reload calibration file
    await mainWindow.runCommand(null, 'RE');
    logger.info('Complete, calibration updated');
  } catch (err) {
    logger.error(err);
  } finally {
    setDatastoreValue('modalMessage', null);
  }
};
