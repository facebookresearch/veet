/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'fs-extra';
import path from 'path';

import {calibrationDBSchema, calibrationFileSchema, type CalibrationDB} from '../packages/shared/CalibrationDB';

type FailedFile = {
  file: string;
  reason: string;
}

function ingestCalibrationFiles(pathToProjectRoot: string, pathToCalibrationFolder: string) {
  console.log(`Ingesting calibration files from ${pathToCalibrationFolder}`);
  let calibrationFiles;
  // Find all .json files in the directory
  try {
    calibrationFiles = fs
      .readdirSync(pathToCalibrationFolder)
      .filter(file => file.endsWith('.txt') || file.endsWith('.json'));
    console.log(`Found ${calibrationFiles.length} calibration files`);
  } catch (e) {
    console.error(`Error reading calibration files from ${pathToCalibrationFolder}: ${e}`);
    process.exit(1);
  }

  // Read the contents of each file
  let loadedFileCount = 0;
  const failedFiles: FailedFile[] = [];

  const calibrationDB: CalibrationDB = calibrationDBSchema.parse({
    creation_timestamp: new Date().toISOString(),
    calibrations: {},
  });
  const calibrationDBPath = path.join(pathToProjectRoot, 'firmware', 'calibrationDB.json');
  const deviceIDToFileRecord: Record<string, string> = {};

  for (const file of calibrationFiles) {
    try {
      const filePath = path.join(pathToCalibrationFolder, file);
      const jsonObj = fs.readJSONSync(filePath);
      const parsed = calibrationFileSchema.safeParse(jsonObj);
      if (!parsed.success) {
        failedFiles.push({file, reason: parsed.error.message});
        continue;
      }
      // Check the date is valid
      const date = new Date(parsed.data.calib_timestamp);
      if (isNaN(date.getTime())) {
        failedFiles.push({file, reason: 'Invalid date format'});
        continue;
      }
      if (date.getFullYear() < 2020 || date.getFullYear() > 2100) {
        failedFiles.push({file, reason: 'Date out of range (2020-2100)'});
        continue;
      }

      // Passes checks
      // See if there is already a calibration for this device ID
      const existingCalibration = calibrationDB.calibrations[parsed.data.deviceID];
      if (existingCalibration) {
        const existingDate = new Date(existingCalibration.calib_timestamp);
        if (date.getTime() > existingDate.getTime()) {
          // Replace the existing calibration with the new one
          calibrationDB.calibrations[parsed.data.deviceID] = parsed.data;

          // Record the old file as a failed file
          failedFiles.push({file: deviceIDToFileRecord[parsed.data.deviceID], reason: 'Duplicate device ID, older date'});
          deviceIDToFileRecord[parsed.data.deviceID] = file;
          continue;
        } else {
          // Skip this file
          failedFiles.push({file, reason: 'Duplicate device ID, older date'});
          continue;
        }
      } else {
        calibrationDB.calibrations[parsed.data.deviceID] = parsed.data;
        deviceIDToFileRecord[parsed.data.deviceID] = file;
        loadedFileCount++;
      }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e:any) {
      failedFiles.push({file, reason: e.toString()});
    }
  }

  console.log(`Loaded ${loadedFileCount} calibration files`);
  console.log(`Rejected ${failedFiles.length} calibration file[s]:`);
  console.log('---');
  if (failedFiles.length > 0) {
    for (const file of failedFiles) {
      console.log(file);
    }
    console.log('---');
  }

  console.log('Writing calibration DB to file...');
  try {
    fs.writeFileSync(calibrationDBPath, JSON.stringify(calibrationDB, null, 2));
    console.log('Success');
  } catch (e) {
    console.error(`Error writing calibration DB to file: ${e}`);
    process.exit(1);
  }
}

if (!process.argv[2] || !process.argv[3]) {
  if (!process.argv[2]) {
    console.log('No project root path provided');
  } else if (!process.argv[3]) {
    console.log('No path to calibration folder provided');
  }
  console.log(
    'Usage: tsx ingestCalibrationFiles.ts <path-to-project-root> <path-to-calibration-files-folder>',
  );
  process.exit(1);
}

ingestCalibrationFiles(process.argv[2], process.argv[3]);
