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

const DRIVE_SETTLE_TIME = 5 * 1000; // 5 seconds (seems slower on a mac)

const VEET_IMAGE_FILENAME = 'veet_image_boot2.bin';

const FIRMWARE_MANIFEST_PATH = () => path.join(FIRMWARE_PATH(), 'manifest.json');

class Version {
  private major_: number;
  get major() { return this.major_; }

  private minor_: number;
  get minor() { return this.minor_; }

  private patch_: number;
  get patch() { return this.patch_; }

  constructor(major: number, minor: number, patch: number) {
    this.major_ = major;
    this.minor_ = minor;
    this.patch_ = patch;
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
        }
      }
    }
    return false;
  };

  public isEqualTo = (other: Version) => {
    return this.major === other.major && this.minor === other.minor && this.patch === other.patch;
  };

  public isOlderThan = (other: Version) => {
    return !this.isEqualTo(other) && !other.isNewerThan(this);
  };

  toString() {
    return `${this.major_}.${this.minor_}.${this.patch_}`;
  }
}

export const parseVersion = (version: string|null|undefined): Version|null => {
  if (!version || !validVersion(version)) {
    return null;
  }
  const [major, minor, patch] = version.split('.');
  return new Version(parseInt(major, 10), parseInt(minor, 10), parseInt(patch, 10));
};

export const validVersion = (version: string): boolean => {
  return /^[0-9]+\.[0-9]+\.[0-9]+$/.test(version);
};

export const checkHardwareVersion = async (mainWindow: MainWindow) => {
  const HV = await mainWindow.runCommand(null, 'HV');
  const FV = await mainWindow.runCommand(null, 'FV');
  console.log(`Hardware version: [${HV}], Firmware version: [${FV}]`);
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

      if (validVersion(hardwareVersion)) {
        await checkFirmwareUpdate(mainWindow);
      }
    }
  }
};


const FirmwareManifestZ = z.object({
  binFile: z.string(),
  version: z.string(),
  md5: z.string(),
});
type FirmwareManifest = z.infer<typeof FirmwareManifestZ>;

const loadFirmwareManifest = async (): Promise<FirmwareManifest|null> => {
  try {
    const manifestJSON = await fs.readJson(FIRMWARE_MANIFEST_PATH());
    if (!manifestJSON) {
      console.error('Unable to find firmware manifest');
      return null;
    }
    const parsed = FirmwareManifestZ.safeParse(manifestJSON);
    if (!parsed.success) {
      console.error('Failed to parse calib', { json: manifestJSON, parseError: parsed.error });
      return null;
    }
    return parsed.data;
  } catch (err) {
    console.error(err);
    console.error('Unable to find firmware manifest');
    return null;
  }
};


export const checkFirmwareUpdate = async (mainWindow: MainWindow) => {
  const firmwareVersionStr = getDataStore().firmwareVersion;
  const hardwareVersionStr = getDataStore().hardwareVersion;
  if (!firmwareVersionStr || !hardwareVersionStr) {
    console.log('Unable to find firmware or hardware version');
    return;
  }
  const drivePath = getDataStore().drivePath;
  if (!drivePath) {
    console.log('Unable to find drive path, cannot update firmware');
    return;
  }
  // Check firmware manifest
  const firmwareManifest = await loadFirmwareManifest();
  if (!firmwareManifest) {
    return;
  }
  const manifestVersion = parseVersion(firmwareManifest.version);
  if (!manifestVersion) {
    console.error('Unable to parse firmware manifest version');
    return;
  }

  const firmwareVersion = parseVersion(firmwareVersionStr);
  const hardwareVersion = parseVersion(hardwareVersionStr);

  if (!firmwareVersion || !hardwareVersion) {
    console.error('Unable to parse firmware or hardware version');
    return;
  }

  // If on manifest firmware is not newer than on device, no point in updating
  if (!manifestVersion.isNewerThan(firmwareVersion)) {
    console.log(`Manifest version ${manifestVersion} is not newer than firmware version ${firmwareVersion}. Aborting autoupdate.`);
    return;
  }

  // Make sure our hardware is not too far ahead
  if (hardwareVersion.major > manifestVersion.major || hardwareVersion.minor > manifestVersion.minor) {
    console.error(`Hardware version ${hardwareVersionStr} is too new for manifest version ${firmwareManifest.version}. Aborting autoupdate.`);
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
        console.log('User chose to update firmware');
        await updateFirmware(mainWindow, path.join(FIRMWARE_PATH(), firmwareManifest.binFile), firmwareManifest.md5);
        return;
      default:
      case 1: // Cancel
        console.log('User chose not to update firmware');
        return;
    }
  }
};


export const updateFirmware = async (mainWindow: MainWindow, sourcePath: string, expectedMD5?: string) => {
  const drivePath = getDataStore().drivePath;
  if (!drivePath) {
    console.error('Unable to find drive path, cannot update firmware');
    return;
  }
  const sourcePathExists = await fs.pathExists(sourcePath);
  if (!sourcePathExists) {
    console.error(`Invalid source firmware path: ${sourcePath}`);
    return;
  }
  setDatastoreValue('modalMessage', 'Updating Firmware...');
  try {
    // first, check the expected md5 if provided
    const md5Src = await md5File(sourcePath);
    console.log('MD5 Source: ' + md5Src);
    if (expectedMD5 && md5Src !== expectedMD5) {
      console.error(`MD5s do not match, aborting update. Expected: ${expectedMD5}, Actual: ${md5Src}`);
      return;
    }

    // Go ahead and copy to the drive
    const destPath = path.join(drivePath, VEET_IMAGE_FILENAME);
    console.log(`Copying ${sourcePath} to ${destPath}`);
    await fs.copyFile(sourcePath, destPath);

    // Now compare source and destination md5s to make sure copy was successful
    console.log('Comparing md5s');
    const md5Dest = await md5File(destPath);
    console.log('MD5 Dest: ' + md5Dest);
    if (md5Src !== md5Dest) {
      console.error('MD5s do not match, aborting update');
      return;
    }

    // We need to stop the drive watch to release any handles on the disk
    mainWindow.stopDriveWatch();

    await new Promise(r => setTimeout(r, DRIVE_SETTLE_TIME));
    console.log('Ejecting drive');
    const ejectResult = await ejectDrive(drivePath);
    console.log('Eject Result: ' + ejectResult);
    await new Promise(r => setTimeout(r, DRIVE_SETTLE_TIME));

    // We're ready, run the bootloader command
    console.log('Running BootLoader command');
    const BLResult = await mainWindow.runCommand(null, 'BL');
    console.log('Complete, firmware updated: ' + BLResult);

    // Let's clean up the bin file upon reconnection
    mainWindow.setFileToDeleteUponConnection(destPath);
  } catch (err) {
    console.error(err);
  } finally {
    setDatastoreValue('modalMessage', null);
  }
};
