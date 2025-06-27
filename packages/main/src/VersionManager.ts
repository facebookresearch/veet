/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path';
import fs from 'fs-extra';
import { getDataStore, setDatastoreValue } from '../../shared/DataStore';
import { FIRMWARE_PATH, type MainWindow } from './MainWindow';
import { z } from 'zod';
import md5File from 'md5-file';
import { ejectDrive } from './mainUtils';
import { logger } from '../../shared/Logger';
import { updateDeviceCalibrationFromDB, lookupCalibrationDataForDevice } from './CalibManager';

const DRIVE_SETTLE_TIME = 5 * 1000; // 5 seconds (seems slower on a mac)

const VEET_IMAGE_FILENAME = 'veet_image_boot2.bin';

const FIRMWARE_MANIFEST_PATH = () => path.join(FIRMWARE_PATH(), 'manifest.json');

// regular expression to extract numbers and trailing text from a version string
const VERSION_REGEX = /^(\d+)\.(\d+)\.(\d+)(.*)$/;

export class Version {
  private major_: number;
  get major() { return this.major_; }

  private minor_: number;
  get minor() { return this.minor_; }

  private patch_: number;
  get patch() { return this.patch_; }

  private extra_: string | null; // This is for any extra version info, like "rc" or "beta"
  get extra() { return this.extra_; }

  get hasExtra() { return this.extra_ !== null && this.extra_.length > 0; }

  constructor(major: number, minor: number, patch: number, extra: string | null) {
    this.major_ = major;
    this.minor_ = minor;
    this.patch_ = patch;
    this.extra_ = extra;
  }

  public isNewerThan = (other: Version) => {
    if (this.major > other.major) {
      return true;
    } else if (this.major === other.major) {
      if (this.minor > other.minor) {
        return true;
      } else if (this.minor === other.minor) {
        if (this.patch > other.patch) {
          return true;
        } else if (this.patch === other.patch && other.hasExtra && !this.hasExtra) {
          return true; // other has extra, but we don't, so we're newer
        }
      }
    }
    return false;
  };

  public isEqualTo = (other: Version) => {
    // Note, we treat having any extra as equivalent, because we can't compare non-numerical version values
    return this.major === other.major && this.minor === other.minor && this.patch === other.patch && this.hasExtra === other.hasExtra;
  };

  public isOlderThan = (other: Version) => {
    // Not equal and not newer, must be older
    return !this.isEqualTo(other) && !this.isNewerThan(other);
  };

  toString() {
    return `${this.major_}.${this.minor_}.${this.patch_}${this.extra_ || ''}`;
  }
}

export const parseVersion = (version: string | null | undefined): Version | null => {
  if (!version || !validVersion(version)) {
    return null;
  }
  const regExResult = VERSION_REGEX.exec(version);
  if (!regExResult || regExResult.length !== 5) {
    return null;
  }
  const [major, minor, patch, extra] = regExResult.slice(1);
  return new Version(parseInt(major, 10), parseInt(minor, 10), parseInt(patch, 10), (extra && extra.length > 0) ? extra : null);
};

export const validVersion = (version: string): boolean => {
  return VERSION_REGEX.test(version);
};

export const checkHardwareVersion = async (mainWindow: MainWindow) => {
  const HV = await mainWindow.runCommand(null, 'HV');
  const FV = await mainWindow.runCommand(null, 'FV');
  logger.info(`Hardware version: [${HV}], Firmware version: [${FV}]`);
  if (!HV) {
    // We must be on old (VEET 1.0) hardware, so present an error message
    void mainWindow.displayFatalError(
      'The connected hardware is VEET 1.0. This software is not compatible with your hardware.\nPlease get the legacy software for your VEET hardware version.',
      'Hardware Version Warning',
    );
    return;
  }

  let hardwareVersion = HV;
  if (hardwareVersion.startsWith('HW')) {
    hardwareVersion = hardwareVersion.slice(2);
  }
  if (validVersion(hardwareVersion)) {
    setDatastoreValue('hardwareVersion', hardwareVersion);
  }

  let firmwareVersion = FV;
  if (firmwareVersion) {
    if (firmwareVersion.startsWith('FW')) {
      firmwareVersion = firmwareVersion.slice(2);
    }
    if (validVersion(firmwareVersion)) {
      setDatastoreValue('firmwareVersion', firmwareVersion);
    }
  }
};


const FirmwareManifestZ = z.object({
  binFile: z.string(),
  version: z.string(),
  md5: z.string(),
});
type FirmwareManifest = z.infer<typeof FirmwareManifestZ>;

const loadFirmwareManifest = async (): Promise<FirmwareManifest | null> => {
  try {
    const manifestJSON = await fs.readJson(FIRMWARE_MANIFEST_PATH());
    if (!manifestJSON) {
      logger.error('Unable to find firmware manifest');
      return null;
    }
    const parsed = FirmwareManifestZ.safeParse(manifestJSON);
    if (!parsed.success) {
      logger.error('Failed to parse calib', { json: manifestJSON, parseError: parsed.error });
      return null;
    }
    return parsed.data;
  } catch (err) {
    logger.error(err);
    logger.error('Unable to find firmware manifest');
    return null;
  }
};


export const checkFirmwareUpdate = async (mainWindow: MainWindow) => {
  await checkHardwareVersion(mainWindow);

  const firmwareVersionStr = getDataStore().firmwareVersion;
  const hardwareVersionStr = getDataStore().hardwareVersion;
  if (!firmwareVersionStr || !hardwareVersionStr) {
    logger.info('Unable to find firmware or hardware version');
    return;
  }
  const drivePath = getDataStore().drivePath;
  if (!drivePath) {
    logger.info('Unable to find drive path, cannot update firmware');
    return;
  }
  // Check firmware manifest
  const firmwareManifest = await loadFirmwareManifest();
  if (!firmwareManifest) {
    return;
  }
  const manifestVersion = parseVersion(firmwareManifest.version);
  if (!manifestVersion) {
    logger.error('Unable to parse firmware manifest version');
    return;
  }

  const firmwareVersion = parseVersion(firmwareVersionStr);
  const hardwareVersion = parseVersion(hardwareVersionStr);

  if (!firmwareVersion || !hardwareVersion) {
    logger.error('Unable to parse firmware or hardware version');
    return;
  }

  // If on manifest firmware is not newer than on device, no point in updating
  if (!manifestVersion.isNewerThan(firmwareVersion)) {
    logger.info(`Manifest version ${manifestVersion} is not newer than firmware version ${firmwareVersion}. Aborting autoupdate.`);

    // If firmware versions are equal, check for calibration updates
    if (manifestVersion.isEqualTo(firmwareVersion)) {
      logger.info('Firmware versions are equal, checking for calibration updates');
      await checkCalibrationUpdate(mainWindow);
    }
    return;
  }

  // Make sure our hardware is not too far ahead
  if (hardwareVersion.major > manifestVersion.major || hardwareVersion.minor > manifestVersion.minor) {
    logger.error(`Hardware version ${hardwareVersionStr} is too new for manifest version ${firmwareManifest.version}. Aborting autoupdate.`);
    return;
  }

  // If we get here, we have a newer firmware version available and we can update
  const response = await mainWindow.showMessageBox({
    message: `A newer firmware version is available. Would you like to update?\nCurrent version: ${firmwareVersion}\nAvailable version: ${manifestVersion}`,
    title: 'Update Firmware?',
    buttons: [`Update Firmware to ${manifestVersion}`, 'Cancel'],
  });

  if (response) {
    switch (response.response) {
      case 0: // Proceed
        logger.info('User chose to update firmware');
        await updateFirmware(mainWindow, path.join(FIRMWARE_PATH(), firmwareManifest.binFile), firmwareManifest.md5);
        return;
      default:
      case 1: // Cancel
        logger.info('User chose not to update firmware');
        return;
    }
  }
};


const checkCalibrationUpdate = async (mainWindow: MainWindow) => {
  await lookupCalibrationDataForDevice(mainWindow, true);
};

export const updateFirmware = async (mainWindow: MainWindow, sourcePath: string, expectedMD5?: string) => {
  const drivePath = getDataStore().drivePath;
  if (!drivePath) {
    logger.error('Unable to find drive path, cannot update firmware');
    return;
  }
  const sourcePathExists = await fs.pathExists(sourcePath);
  if (!sourcePathExists) {
    logger.error(`Invalid source firmware path: ${sourcePath}`);
    return;
  }

  const voltageCheckPassed = await mainWindow.checkMinimumVoltageForOperation('firmware update');
  if (!voltageCheckPassed) {
    logger.info('Firmware update aborted due to insufficient battery voltage');
    return;
  }

  setDatastoreValue('modalMessage', 'Updating Firmware...');
  try {
    // first, check the expected md5 if provided
    const md5Src = await md5File(sourcePath);
    logger.info('MD5 Source: ' + md5Src);
    if (expectedMD5 && md5Src !== expectedMD5) {
      logger.error(`MD5s do not match, aborting update. Expected: ${expectedMD5}, Actual: ${md5Src}`);
      return;
    }

    // Go ahead and copy to the drive
    const destPath = path.join(drivePath, VEET_IMAGE_FILENAME);
    logger.info(`Copying ${sourcePath} to ${destPath}`);
    await fs.copyFile(sourcePath, destPath);

    // Now compare source and destination md5s to make sure copy was successful
    logger.info('Comparing md5s');
    const md5Dest = await md5File(destPath);
    logger.info('MD5 Dest: ' + md5Dest);
    if (md5Src !== md5Dest) {
      logger.error('MD5s do not match, aborting update');
      return;
    }

    // Always update the calibration file on the drive when we update the firmware
    await updateDeviceCalibrationFromDB(mainWindow);

    // We need to stop the drive watch to release any handles on the disk
    mainWindow.stopDriveWatch();

    await new Promise(r => setTimeout(r, DRIVE_SETTLE_TIME));
    logger.info('Ejecting drive');
    const ejectResult = await ejectDrive(drivePath);
    logger.info('Eject Result: ' + ejectResult);
    await new Promise(r => setTimeout(r, DRIVE_SETTLE_TIME));

    // We're ready, run the bootloader command
    logger.info('Running BootLoader command');
    const BLResult = await mainWindow.runCommand(null, 'BL');
    logger.info('Complete, firmware updated: ' + BLResult);

    // Let's clean up the bin file upon reconnection
    mainWindow.setFileToDeleteUponConnection(destPath);
  } catch (err) {
    logger.error(err);
  } finally {
    setDatastoreValue('modalMessage', null);
  }
};
