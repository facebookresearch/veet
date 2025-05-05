/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { app, BrowserWindow, clipboard, dialog, ipcMain, shell, screen } from 'electron';
import { getDataStore, registerChangeHandler, resetDataStore, setDatastoreValue } from '../../shared/DataStore';
import { commands } from '../../shared/commands';
import { SerialConnectionStatus, SerialManager } from './SerialManager';
import { invLerpClamped } from '../../shared/utils';
import { list } from 'drivelist';
import { check } from 'diskusage';

import * as path from 'path';
import * as fsPromises from 'fs/promises';
import { fileURLToPath } from 'node:url';
import type { TAB_TYPE } from '../../shared/constants';
import { CONFIG_FILENAME, DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_WIDTH, SENSOR_DATA_FILENAME, TAB_NAMES, VEET_DRIVE_DESCRIPTION } from '../../shared/constants';
import { getConfigStore, getIntervalConfig, loadConfigFromJson, loadIntervalConfigFromJson, registerConfigChangeHandler, setConfigStoreValue } from '../../shared/ConfigStore';
import { getSettingsStore, registerSettingsChangeHandler, setSettingsStoreValue } from '../../shared/SettingsStore';
import { SetupCustomMenus } from './Menu';
import { debounce } from 'ts-debounce';
import type { FSWatcher } from 'fs';
import { watch } from 'fs';
import { checkFirmwareUpdate, checkHardwareVersion, updateFirmware } from './VersionManager';
import { logger } from '../../shared/Logger';
import { RegisterMainLogger } from './MainLogger';
import { StreamRecorder } from './StreamRecorder';
import { lookupCalibrationDataForDevice } from './CalibManager';
import { retryWrapper } from './mainUtils';

RegisterMainLogger();


const CONNECTION_RETRY_PERIOD = 3000;
const DRIVE_RETRY_PERIOD = 1000;
const SENSOR_POLL_WAIT_PERIOD = 10;
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY = 500;

const BATTERY_FAST_POLL_PERIOD = 3 * 1000;
const CLOCK_FAST_POLL_PERIOD = 3 * 1000;
const BATTERY_SLOW_POLL_PERIOD = 30 * 1000;
const CLOCK_SLOW_POLL_PERIOD = 60 * 1000;

const IMU_POLL_COMMAND = 'S0';
const PHO_POLL_COMMAND = 'S1';
const TOF_POLL_COMMAND = 'S2';
const ALS_POLL_COMMAND = 'S3';

// This needs to be a function so that app is initialized by the time it runs.
// In dev mode we can use getAppPath, but in prod it is packaged into an asar file and the path is extra deep
export const ROOT_RESOURCE_PATH = () => import.meta.env.DEV ? app.getAppPath() : process.resourcesPath;
export const FIRMWARE_PATH = () => path.join(ROOT_RESOURCE_PATH(), 'firmware');
export const CALIBRATIONDB_PATH = () => path.join(FIRMWARE_PATH(), 'calibrationDB.json');
export const DOCUMENTATION_PATH = () => path.join(ROOT_RESOURCE_PATH(), 'documentation');
const VEET_MANUAL_PATH = () => path.join(DOCUMENTATION_PATH(), 'VEET 2.0 Device Manual.pdf');


class PollingHelper {
  timeoutHandler_: NodeJS.Timeout | null = null;
  isPolling_ = true;
  constructor(readonly pollingCallback: () => Promise<number>) {
    this.runPolling();
  }
  public stop() {
    this.isPolling_ = false;
    this.timeoutHandler_ && clearTimeout(this.timeoutHandler_);
    this.timeoutHandler_ = null;
  }
  private runPolling() {
    void this.pollingCallback().then(nextDelay => {
      if (nextDelay > 0 && this.isPolling_) {
        this.timeoutHandler_ = setTimeout(() => this.runPolling(), nextDelay);
      }
    });
  }
}


export class MainWindow {
  private serialManager_: SerialManager;
  private browserWindow_: BrowserWindow | undefined = undefined;
  private isConnected_ = false;
  private connectionAttemptInFlight_ = false;
  private currentTab_: TAB_TYPE | null = null;
  private streamRecorder_: StreamRecorder | undefined = undefined;

  // Intervals
  private batteryPoller_: PollingHelper | null = null;
  private clockPoller_: PollingHelper | null = null;
  private connectionRetry_: NodeJS.Timeout | null = null;
  private driveRetry_: NodeJS.Timeout | null = null;
  private driveWatch_: FSWatcher | null = null;
  private sensorPollThreadRunning = false;
  private deleteFileOnConnection_: string | null = null;


  constructor() {
    this.serialManager_ = new SerialManager();
    this.serialManager_.on('disconnect', this.disconnected);
  }

  loadEntryPoint = async (browserWindow: BrowserWindow, path: string) => {
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL !== undefined) {
      /**
       * Load from the Vite dev server for development.
       */
      await browserWindow.loadURL(import.meta.env.VITE_DEV_SERVER_URL + path);
    } else {
      /**
       * Load from the local file system for production and test.
       *
       * Use BrowserWindow.loadFile() instead of BrowserWindow.loadURL() for WhatWG URL API limitations
       * when path contains special characters like `#`.
       * Let electron handle the path quirks.
       * @see https://github.com/nodejs/node/issues/12682
       * @see https://github.com/electron/electron/issues/6869
       */
      await browserWindow.loadFile(
        fileURLToPath(new URL('./../../renderer/dist/' + path, import.meta.url)),
      );
    }
  };

  // Create the browser window.
  createWindow = async () => {
    // If the zoom factor is over 1.5, the window is too small
    // This seems to work well on a large number of displays
    const pixelScaleFactor = Math.min(screen.getPrimaryDisplay().scaleFactor, 1.5);

    const maxStartHeight = screen.getPrimaryDisplay().workArea.height * 0.9;
    const maxStartWidth = screen.getPrimaryDisplay().workArea.width * 0.9;
    const height = Math.round(Math.min(DEFAULT_WINDOW_HEIGHT / pixelScaleFactor, maxStartHeight));
    const width = Math.round(Math.min(DEFAULT_WINDOW_WIDTH / pixelScaleFactor, maxStartWidth));

    logger.info('Pixel Scale Factor: ' + pixelScaleFactor);
    logger.info(`Width: ${width}, Height: ${height}`);

    // Create the browser window.
    this.browserWindow_ = new BrowserWindow({
      show: false, // Use the 'ready-to-show' event to show the instantiated BrowserWindow.
      height: height,
      width: width,
      resizable: true,
      useContentSize: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webviewTag: false,
        preload: path.join(app.getAppPath(), 'packages/preload/dist/index.mjs'),
      },
      title: 'VEETManager ' + app.getVersion(),
    });

    this.browserWindow_.on('resize', () => {
      const size: number[] = this.browserWindow_?.getSize() || [DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT];
      if (size.length != 2) {
        logger.error('Got invalid window size: ' + size);
        return;
      }
      size[0] = Math.round(size[0] * pixelScaleFactor);
      size[1] = Math.round(size[1] * pixelScaleFactor);
      setDatastoreValue('windowSize', size as [number, number]);
    });

    this.streamRecorder_ = new StreamRecorder(this.browserWindow_);

    /**
     * If the 'show' property of the BrowserWindow's constructor is omitted from the initialization options,
     * it then defaults to 'true'. This can cause flickering as the window loads the html content,
     * and it also has show problematic behaviour with the closing of the window.
     * Use `show: false` and listen to the  `ready-to-show` event to show the window.
     *
     * @see https://github.com/electron/electron/issues/25012 for the afford mentioned issue.
     */
    this.browserWindow_.on('ready-to-show', () => {
      this.browserWindow_?.webContents.setZoomFactor(1.0 / pixelScaleFactor);
      this.browserWindow_?.show();
    });

    SetupCustomMenus(this);

    // and load the index.html of the app.
    logger.info('Loading typescript...');
    const loadTimeStart = performance.now();
    /**
     * Load the main page of the main window.
     */
    await this.loadEntryPoint(this.browserWindow_, 'index.html');
    logger.info('Done loading typescript in ' + Math.ceil(performance.now() - loadTimeStart) + 'ms');

    // Open the DevTools.
    //this.openDevTools();
    /*
    this.browserWindow_.webContents.openDevTools({
      mode: 'detach',
    });
    */

    // Try to connect to the VEET periodically
    this.connectionRetry_ = setInterval(this.attemptConnection, CONNECTION_RETRY_PERIOD);
    await this.attemptConnection(); // don't wait for the first interval
    return this.browserWindow_;
  };

  restoreOrCreateWindow = async () => {
    let window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());

    if (window === undefined) {
      window = await this.createWindow();
    }
    if (!window) return;

    if (window.isMinimized()) {
      window.restore();
    }

    window.focus();
  };

  // null means failure (we'll display an error)
  runCommand = async (_: Electron.IpcMainInvokeEvent | null, cmd: string): Promise<string | null> => {
    if (!this.isConnected_) {
      // TODO: Display Error
      return null;
    }
    return await this.serialManager_.runCommand(cmd);
  };



  startPolls = async () => {
    if (this.batteryPoller_) {
      this.batteryPoller_.stop();
    }
    this.batteryPoller_ = new PollingHelper(this.pollBattery);


    if (this.clockPoller_) {
      this.clockPoller_.stop();
    }
    this.clockPoller_ = new PollingHelper(this.pollClock);

    // Start polling
    void this.startPollSensorThread(); // note that this doesn't need to be stopped as it sleeps itself. also don't await this one
  };

  stopPolls = () => {
    this.batteryPoller_?.stop();
    this.batteryPoller_ = null;
    this.clockPoller_?.stop();
    this.clockPoller_ = null;

    setDatastoreValue('batteryPct', null);
    setDatastoreValue('batteryMV', null);
  };

  stopDriveWatch = () => {
    if (this.driveWatch_ != null) {
      this.driveWatch_.close();
      this.driveWatch_ = null;
    }
  };

  disconnected = () => {
    this.isConnected_ = false;
    this.stopPolls();
    this.stopDriveWatch();

    // Window size is the only field we want to keep around
    // This should probably be made more explicit but I don't expect more fields like this
    const windowSize = getDataStore().windowSize;
    resetDataStore();
    setDatastoreValue('windowSize', windowSize);

    logger.info('Disconnected from VEET');
    SetupCustomMenus(this);

    // Start trying again perodically
    if (this.connectionRetry_ == null) {
      this.connectionRetry_ = setInterval(this.attemptConnection, CONNECTION_RETRY_PERIOD);
    }
  };

  attemptConnection = async () => {
    // Do not try to connect more than once at a time
    if (this.connectionAttemptInFlight_) {
      return;
    }

    // Wrap the attempt in an in_flight flag check to prevent multiple attempts
    const doAttemptConnection = async () => {
      // Make sure we haven't had a delayed connection verification
      if (this.isConnected_) {
        return;
      }
      const connectionStatus = await this.serialManager_.findVeet();
      if (connectionStatus == SerialConnectionStatus.CONNECTED) {
        // We're connected, switch state
        this.isConnected_ = true;
        SetupCustomMenus(this);

        // On Connection, restart polls
        await this.startDriveSearch();
        if (!this.isConnected_) {
          // We disconnected before we could find the drive, so stop looking
          this.driveRetry_ && clearInterval(this.driveRetry_);
          return;
        }
        await this.checkSerialNumber();
        if (!this.isConnected_) { return; }
        await this.startPolls();
        if (!this.isConnected_) { return; }
        await checkHardwareVersion(this);
        if (!this.isConnected_) { return; }
        await this.checkDeviceSide();
        // Note, there is a potential race condition here where we disconnect before all of these async checks are complete.
        // In that case, don't stop the interval.
        if (!this.isConnected_) { return; }
        logger.info('Connected to VEET');
        this.connectionRetry_ && clearInterval(this.connectionRetry_);
        this.connectionRetry_ = null;
      } else if (this.isConnected_) {
        this.disconnected();
      }
    };

    this.connectionAttemptInFlight_ = true;
    await doAttemptConnection();
    this.connectionAttemptInFlight_ = false;

  };

  private pollBattery = async (): Promise<number> => {
    if (!this.isConnected_) {
      // We're disconnected. Shouldn't be called, so just return
      return BATTERY_FAST_POLL_PERIOD;
    }

    const batteryString = await this.runCommand(null, 'GB');
    if (batteryString) {

      // There are two formats I've seen, try both
      // Try to parse from expected format "Battery: XXXXmV"
      const prefix = 'Battery: ';
      let mv = 0;
      if (batteryString.startsWith(prefix)) {
        mv = parseInt(batteryString.slice(prefix.length, prefix.length + 4));
      } else {
        // Parse from expected format "TIMESTAMP,BAT,XXXX"
        const splt = batteryString.split(',');
        if (splt && splt.length == 3) {
          mv = parseInt(splt[2].trim());
        }
      }
      if (mv < 100 || mv > 6000) {
        // probably an invalid string
        logger.error(`Invalid battery response: "${batteryString}"`);
        return BATTERY_FAST_POLL_PERIOD;
      }
      // Map to a percentage. This is very rough, and things get wonky at the extremes, but we'll call anything over
      // 4.1V 100%, and anything less than 3.6V 1%, and linearly interpolate
      const frac = Math.max(invLerpClamped(3600, 4100, mv), 0.01);
      setDatastoreValue('batteryPct', frac);
      setDatastoreValue('batteryMV', mv);
      logger.info(`${batteryString} -> ${(frac * 100).toFixed(1)}%`);

      // Valid battery value, so poll at the slower rate
      return BATTERY_SLOW_POLL_PERIOD;
    }
    return BATTERY_FAST_POLL_PERIOD;
  };

  checkDriveSpace = async () => {
    const drivePath = getDataStore().drivePath;
    if (drivePath == null) {
      // No drive path, can't check disk space
      return;
    }
    const diskInfo = await check(drivePath);
    logger.info(`DiskUsage: ${(diskInfo.available / (1024 * 1024)).toFixed(2)}MB / ${(diskInfo.total / (1024 * 1024)).toFixed(2)}MB`);
    setDatastoreValue('driveSpaceAvailable', diskInfo.available);
    setDatastoreValue('driveSpaceTotal', diskInfo.total);
  };

  findDrive = async () => {
    logger.info('Searching for VEET storage device drive');
    try {
      if (getDataStore().drivePath) {
        // Already found drive, must have been an extraneous check
        return;
      }
      const drives = await list();
      let found = false;
      for (const drive of drives) {
        if (!drive.description.startsWith(VEET_DRIVE_DESCRIPTION)) {
          continue;
        }
        logger.info(`Found VEET Drive at ${drive.device}, checking mountpoints`);
        if (drive.mountpoints && drive.mountpoints.length > 0) {
          // Found drive!
          const drivePath = drive.mountpoints[0].path;
          found = true;
          logger.info('Found VEET Drive at path ' + drivePath);
          setDatastoreValue('drivePath', drivePath);
          setDatastoreValue('sensorDataFilePath', path.join(drivePath, SENSOR_DATA_FILENAME));

          await this.postDriveFind(drivePath);


          // Stop searching
          if (this.driveRetry_ != null) {
            clearInterval(this.driveRetry_);
            this.driveRetry_ = null;
          }
          break;
        } else {
          logger.info(`No mountpoints found for VEET drive at ${drive.device}`);
          setDatastoreValue('driveFound', true);
        }
      }
      if (!found) {
        logger.info('Failed to find VEET storage device drive out of ' + drives.length + ' drives');
        setDatastoreValue('drivePath', null);
        setDatastoreValue('sensorDataFilePath', null);
        setDatastoreValue('driveSpaceAvailable', 0);
        setDatastoreValue('driveSpaceTotal', 0);
      }
    } catch (err) {
      logger.error(err);
    }
  };

  startDriveSearch = async () => {
    await this.findDrive();
    if (getDataStore().drivePath == null) {
      // Failed to find the drive, so setup an interval
      if (this.driveRetry_ == null) {
        this.driveRetry_ = setInterval(this.findDrive, DRIVE_RETRY_PERIOD);
      }
    }
  };

  postDriveFind = async (drivePath: string) => {
    // Check drive space, and setup a file watch
    const DRIVE_CHECK_INTERVAL_MS = 1000;
    const debouncedDriveCheck = debounce(this.checkDriveSpace, DRIVE_CHECK_INTERVAL_MS);
    await debouncedDriveCheck();
    this.stopDriveWatch();
    this.driveWatch_ = watch(drivePath, {}, () => {
      // Something changed on the VEET device, do another driveSpaceCheck
      void debouncedDriveCheck();
    });

    SetupCustomMenus(this);
    // Found the drive, check if we need to delete the image file
    if (this.deleteFileOnConnection_) {
      logger.info('Deleting ' + this.deleteFileOnConnection_);
      await fsPromises.unlink(this.deleteFileOnConnection_);
      this.deleteFileOnConnection_ = null;
    }

    // Do checks we need to do once we find the drive
    const calibrationDataFoundForDevice = await lookupCalibrationDataForDevice(this);
    if (calibrationDataFoundForDevice) {
      await checkFirmwareUpdate(this);
    }
    await this.analyzeSensorData();
    await this.loadConfig();
  };

  checkDeviceSide = async () => {
    const deviceSideCmdResp = await this.runCommand(null, 'GM');
    if (deviceSideCmdResp === null) {
      setDatastoreValue('deviceSide', null);
      return;
    }
    const deviceSideArr = deviceSideCmdResp.split(',');
    if (deviceSideArr.length !== 3) {
      setDatastoreValue('deviceSide', null);
      return;
    }
    const deviceSide = deviceSideArr[2];
    if (deviceSide == 'L') {
      setDatastoreValue('deviceSide', 'L');
    } else if (deviceSide == 'R') {
      setDatastoreValue('deviceSide', 'R');
    } else {
      setDatastoreValue('deviceSide', null);
    }
  };

  checkSerialNumber = async () => {
    await retryWrapper(async () => {
      const serialNumberResp = await this.runCommand(null, 'GS');
      const splt = serialNumberResp?.split(',') || null;
      if (!splt || splt.length !== 3) {
        logger.info('Serial Number: not found, response: ' + serialNumberResp);
        setDatastoreValue('serialNumber', null);
        return false;
      }
      const serialNumber = splt[2].trim();
      if (serialNumber) {
        logger.info('Serial Number: ' + serialNumber);
        setDatastoreValue('serialNumber', serialNumber);
        return true; // success, we're done
      } else {
        logger.info('Serial Number: not found, response: ' + serialNumberResp);
        setDatastoreValue('serialNumber', null);
        return false;
      }
    }, DEFAULT_RETRY_COUNT, DEFAULT_RETRY_DELAY);
  };

  showMessageBox = async (options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue | undefined> => {
    if (!this.browserWindow_) {
      logger.error('Unable to display error message, no browser window found');
      return;
    }
    return await dialog.showMessageBox(this.browserWindow_, options);
  };

  showOpenDialog = async (options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue | undefined> => {
    if (!this.browserWindow_) {
      logger.error('Unable to display error message, no browser window found');
      return;
    }
    return await dialog.showOpenDialog(this.browserWindow_, options);
  };

  displayFatalError = async (errorMessage: string, errorTitle: string) => {
    const response = await this.showMessageBox({
      message: errorMessage,
      title: errorTitle,
      buttons: ['Proceed Anyway', 'Exit Software'],
    });
    if (!response) {
      return;
    }
    switch (response.response) {
      default:
      case 0: // Proceed Anyway
        return;
      case 1: // Exit
        app.exit();
        return;
    }
  };




  analyzeSensorData = async () => {
    const drivePath = getDataStore().drivePath;
    if (!drivePath) {
      logger.info('Unable to find drive path, no data analysis');
      return;
    }
    const sensorDataPath = path.join(drivePath, SENSOR_DATA_FILENAME);
    try {
      const stat = await fsPromises.stat(sensorDataPath);
      setDatastoreValue('sensorDataFileSize', stat.size);
    } catch (err) {
      setDatastoreValue('sensorDataFileSize', 0);
      logger.error(err);
    }
  };

  writeConfigFile = async () => {
    const drivePath = getDataStore().drivePath;
    if (!drivePath) {
      logger.error('Unable to write config file, no drive path found');
      return;
    }
    const configPath = path.join(drivePath, CONFIG_FILENAME);
    const configData = getConfigStore();

    try {
      const configStr = JSON.stringify(configData, null, 2);
      await fsPromises.writeFile(configPath, configStr);
      logger.info('Config written to ' + configPath);
      logger.info(configStr);
    } catch (err) {
      logger.info('Error writing config file: ' + err);
    }
  };

  loadConfig = async () => {
    logger.info('Loading config file');
    const drivePath = getDataStore().drivePath;
    if (!drivePath) {
      logger.info('Unable to find drive path, no config loaded');
      return;
    }
    try {
      const configPath = path.join(drivePath, CONFIG_FILENAME);
      const configJson = await fsPromises.readFile(configPath, { encoding: 'utf8' });
      const CONFIG_WRITE_DEBOUNCE_MS = 1000;
      loadConfigFromJson(configJson, this.displayFatalError);
      const debouncedWrite = debounce(this.writeConfigFile, CONFIG_WRITE_DEBOUNCE_MS);
      registerConfigChangeHandler(() => {
        void debouncedWrite();
      });
    } catch (err) {
      logger.error(err);
    }
  };

  syncClock = async () => {
    const curEpoch = Math.round(Date.now() * 0.001); // Date.now() is ms, not secs
    return await this.runCommand(null, `ST${curEpoch}`);
  };

  private pollClock = async (): Promise<number> => {
    if (!this.isConnected_) {
      // We're disconnected. Shouldn't be called, so just return
      return CLOCK_FAST_POLL_PERIOD;
    }

    // Note that with the current serial connection, it will take an extra second or so
    // before we get the time back from the VEET, but we do not need precision timing
    const timeString = await this.runCommand(null, 'GT');
    if (timeString) {
      // Parse from expected format "Time(s): XXXXXXX"
      const prefix = 'Time(s): '.length;
      const veetEpoch = parseInt(timeString.slice(prefix));
      setDatastoreValue('timeOnVeet', veetEpoch);
      const curEpoch = Math.round(Date.now() * 0.001); // Date.now() is ms, not secs
      const diff = veetEpoch - curEpoch;
      if (diff < -5) {
        logger.info(`VEET is ${-diff} seconds behind, syncing`);
        await this.syncClock();
        return CLOCK_FAST_POLL_PERIOD;
      } else if (diff > 5) {
        logger.info(`VEET is ${diff} seconds ahead, syncing`);
        await this.syncClock();
        return CLOCK_FAST_POLL_PERIOD;
      } else {
        logger.info('VEET is within 5 seconds of your PC');
        // Normal clock time, so poll at the slower rate
        return CLOCK_SLOW_POLL_PERIOD;
      }
    }
    logger.error('Got invalid response from GT command, trying again');
    return CLOCK_FAST_POLL_PERIOD;
  };

  startPollSensorThread = async () => {
    // Make sure we only run the sensor poll thread once
    if (this.sensorPollThreadRunning) {
      return;
    }
    this.sensorPollThreadRunning = true;
    // Loop forever, checking sensor data if appropriate, otherwise sleeping until next check
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.isConnected_) {
        try {
          switch (this.currentTab_) {
            case TAB_NAMES.PHO: {
              const phoStr = await this.runCommand(null, PHO_POLL_COMMAND);
              if (phoStr && !phoStr.startsWith('#Err')) {
                setDatastoreValue('phoData', phoStr);
                this.streamRecorder_?.WriteIfRecording(phoStr);
              }
              break;
            }
            case TAB_NAMES.TOF: {
              const promiseArr = await Promise.all([
                this.runCommand(null, TOF_POLL_COMMAND),
                new Promise(resolve => setTimeout(resolve, 500))
              ]);
              const tofStr = promiseArr[0];
              if (tofStr && !tofStr.startsWith('#Err')) {
                setDatastoreValue('tofData', tofStr);
                this.streamRecorder_?.WriteIfRecording(tofStr);
              }
              break;
            }
            case TAB_NAMES.ALS: {
              const alsStr = await this.runCommand(null, ALS_POLL_COMMAND);
              if (alsStr && !alsStr.startsWith('#Err')) {
                setDatastoreValue('alsData', alsStr);
                this.streamRecorder_?.WriteIfRecording(alsStr);
              }
              break;
            }
            case TAB_NAMES.IMU: {
              const imuStr = await this.runCommand(null, IMU_POLL_COMMAND);
              if (imuStr && !imuStr.startsWith('#Err')) {
                setDatastoreValue('imuData', imuStr);
                this.streamRecorder_?.WriteIfRecording(imuStr);
              }
              break;
            }
          }

        } catch (err) {
          logger.error(err);
        }
      }

      // sleep until next check
      await new Promise(r => setTimeout(r, SENSOR_POLL_WAIT_PERIOD));
    }

  };


  sendDataStoreUpdate = () => {
    // TODO: If perf becomes an issue, look into turning off freezeImmutableStructures
    if (this.browserWindow_?.isDestroyed()) {
      return;
    }
    this.browserWindow_?.webContents.send(commands.updateDataStore, getDataStore());
  };

  sendConfigStoreUpdate = () => {
    // TODO: If perf becomes an issue, look into turning off freezeImmutableStructures
    if (this.browserWindow_?.isDestroyed()) {
      return;
    }
    this.browserWindow_?.webContents.send(commands.updateConfigStore, getConfigStore());
  };

  sendSettingsStoreUpdate = () => {
    // TODO: If perf becomes an issue, look into turning off freezeImmutableStructures
    if (this.browserWindow_?.isDestroyed()) {
      return;
    }
    this.browserWindow_?.webContents.send(commands.updateSettingsStore, getSettingsStore());
  };

  showFolder = (_: Electron.IpcMainInvokeEvent, path: string) => {
    logger.info('showing path ' + path);
    shell.showItemInFolder(path);
  };

  setFileToDeleteUponConnection = (filePath: string | null) => {
    this.deleteFileOnConnection_ = filePath;
  };

  public UpdateFirmwareDialog = async () => {
    if (!this.browserWindow_) {
      logger.error('BrowserWindow is null when updating firmware');
      return;
    }
    const drivePath = getDataStore().drivePath;
    if (!drivePath) {
      logger.error('Unable to find drive path, cannot update firmware');
      return;
    }
    const sourceBinInfo = await this.showOpenDialog({
      title: 'Pick New Firmware File',
      buttonLabel: 'Select New Firmware',
      defaultPath: FIRMWARE_PATH(),
      filters: [{ name: 'All Files', extensions: ['bin'] }],
    });
    if (!sourceBinInfo) {
      logger.error('Failed to open dialog window');
      return;
    }
    if (sourceBinInfo.canceled) {
      logger.info('Firmware Update Canceled');
      return;
    }
    if (sourceBinInfo.filePaths.length !== 1) {
      logger.error('Invalid source bin info: ' + sourceBinInfo);
      return;
    }

    // If we got here, we're good to go.
    const sourcePath = sourceBinInfo.filePaths[0];
    await updateFirmware(this, sourcePath);
  };


  private SaveConfigTemplate = async () => {
    logger.info('Saving Config Template');
    if (!this.browserWindow_) {
      logger.error('BrowserWindow is null when saving config template');
      return;
    }
    const saveConfigInfo = await dialog.showSaveDialog(this.browserWindow_, {
      title: 'Save Config Template File',
      buttonLabel: 'Save Config Template File',
      filters: [{ name: 'All Files', extensions: ['json'] }],
    });
    if (saveConfigInfo.canceled) {
      logger.info('Calibration File Update Canceled');
      return;
    }
    if (!saveConfigInfo.filePath) {
      logger.error('Invalid source calibration info: ' + saveConfigInfo);
      return;
    }
    const intervalConfigJSON = JSON.stringify(getIntervalConfig());
    await fsPromises.writeFile(saveConfigInfo.filePath, intervalConfigJSON);
    setDatastoreValue('configTemplate', intervalConfigJSON);
  };

  private LoadConfigTemplate = async () => {
    if (!this.browserWindow_) {
      logger.error('BrowserWindow is null when saving config template');
      return;
    }
    const openConfigInfo = await this.showOpenDialog({
      title: 'Open Config Template File',
      buttonLabel: 'Open Config Template File',
      filters: [{ name: 'All Files', extensions: ['json'] }],
    });
    if (!openConfigInfo) {
      logger.error('Failed to open dialog window');
      return;
    }
    if (openConfigInfo.canceled) {
      logger.info('Calibration File Update Canceled');
      return;
    }
    if (openConfigInfo.filePaths.length !== 1) {
      logger.error('Invalid source calibration info: ' + openConfigInfo);
      return;
    }
    const configTemplateJSON = await fsPromises.readFile(openConfigInfo.filePaths[0], 'utf8');
    if (loadIntervalConfigFromJson(configTemplateJSON)) {
      setDatastoreValue('configTemplate', configTemplateJSON);
    }
  };

  private ReuseLastConfigTemplate = async () => {
    logger.info('Reusing Config Template');
    const configTemplate = getDataStore().configTemplate;
    if (!configTemplate || configTemplate.length < 1) {
      logger.error('Trying to reuse invalid config template');
      return;
    }
    loadIntervalConfigFromJson(configTemplate);
  };

  showLicenses = async () => {
    const modalWindow = new BrowserWindow({
      show: true,
      parent: this.browserWindow_,
      modal: true,
      autoHideMenuBar: true,
      height: DEFAULT_WINDOW_HEIGHT * 0.75,
      width: DEFAULT_WINDOW_WIDTH * 0.75,
      resizable: true,
      useContentSize: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webviewTag: false,
      },
      title: 'Licenses',
    });
    try {
      await this.loadEntryPoint(modalWindow, 'ATTRIBUTION.html');
    } catch (e) {
      logger.error(e);
    }
  };

  showManual = () => {
    void shell.openExternal(`file://${VEET_MANUAL_PATH()}`);
  };

  whenReady = () => {
    ipcMain.handle(commands.runCommand, this.runCommand);
    ipcMain.handle(commands.showFolder, this.showFolder);
    ipcMain.handle(commands.setCurrentTab, (_, tabName: TAB_TYPE) => {
      setSettingsStoreValue('currentTab', tabName);
      if (this.currentTab_ != tabName) {
        this.streamRecorder_?.StopRecording();
      }
      this.currentTab_ = tabName;
    });
    ipcMain.handle(commands.sendConfigStoreValue, (_, key, value) => {
      setConfigStoreValue(key, value);
    });
    ipcMain.handle(commands.saveConfigTemplate, this.SaveConfigTemplate);
    ipcMain.handle(commands.loadConfigTemplate, this.LoadConfigTemplate);
    ipcMain.handle(commands.reuseLastConfigTemplate, this.ReuseLastConfigTemplate);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcMain.handle(commands.recordLogMessage, (_, level: string, message: string, ...meta: any[]) => {
      logger.log(level, message, ...meta);
    });
    ipcMain.handle(commands.writeClipboard, (_, data: string) => {
      clipboard.writeText(data);
    });
    ipcMain.handle(commands.toggleRecording, (_) => {
      this.streamRecorder_?.ToggleRecording();
    });

    // If requested, send both store updates
    ipcMain.handle(commands.requestStoresUpdate, () => {
      try {
        this.sendDataStoreUpdate();
        this.sendConfigStoreUpdate();
        this.sendSettingsStoreUpdate();
      } catch (err) {
        logger.error(err);
      }
    });
    // Also, send an update on any change to the data store and config store
    registerChangeHandler(this.sendDataStoreUpdate);
    registerConfigChangeHandler(this.sendConfigStoreUpdate);
    registerSettingsChangeHandler(this.sendSettingsStoreUpdate);
    // TODO: (maybe) use diffs to minimize data sent through IPC, but not clear it's necessary
  };
}
