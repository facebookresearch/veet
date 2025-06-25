/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const VEET_DRIVE_DESCRIPTION = 'Microchp Mass Storage';
export const SENSOR_DATA_FILENAME = 'Sensor_Data.csv';
export const CONFIG_FILENAME = '.config/config.json';
export const CALIB_FILENAME = '.config/calib.json';
export const SENSOR_DATA_LINE_ENDING = 0x0D; // CR only for some reason

export const DEFAULT_WINDOW_WIDTH = 960;
export const DEFAULT_WINDOW_HEIGHT = 1150;

// TOF Data
export const TOF_PRE_INFO_LENGTH = 2;
export const TOF_NUM_SENSORS_ON_SIDE = 8;
export const TOF_NUM_SENSORS = TOF_NUM_SENSORS_ON_SIDE * TOF_NUM_SENSORS_ON_SIDE;
export const TOF_NUM_OBJECTS = 2;
export const TOF_DATA_LENGTH = TOF_NUM_SENSORS * TOF_NUM_OBJECTS * 2;

// TOF FOV
export const TOF_FOV_DEGREES = 45;
export const TOF_FOV_RAD_MIN = -0.5 * TOF_FOV_DEGREES * Math.PI / 180;
export const TOF_FOV_RAD_MAX =  0.5 * TOF_FOV_DEGREES * Math.PI / 180;

export type TAB_TYPE = typeof TAB_NAMES[keyof typeof TAB_NAMES];
export const TAB_NAMES = Object.freeze({
  CONFIG: 'Config',
  DOWNLOAD: 'Download',
  CALIBRATE: 'Calibrate',
  TOF: 'TOF',
  PHO: 'PHO',
  IMU: 'IMU',
  ALS: 'ALS',
  SERIAL_LOG: 'Serial Log',
});

// Battery voltage thresholds
export const MIN_VOLTAGE_FOR_OPERATIONS_MV = 3700;
export const BATTERY_MIN_VOLTAGE_MV = 3600; // 3.6V represents 1% battery
export const BATTERY_MAX_VOLTAGE_MV = 4100; // 4.1V represents 100% battery

// TODO: Write a full error handling system
export type ErrorMessageHandler = (errorMessage: string, errorTitle: string) => void;
