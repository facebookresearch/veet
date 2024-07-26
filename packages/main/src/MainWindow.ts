/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { getDataStore, registerChangeHandler, setDatastoreValue } from '../../shared/DataStore';
import { commands } from '../../shared/commands';
import { SerialConnectionStatus, SerialManager  } from './SerialManager';
import { invLerpClamped } from '../../shared/utils';
import { list } from 'drivelist';
import { check } from 'diskusage';

import * as path from 'path';
import * as fsPromises from 'fs/promises';
import {fileURLToPath} from 'node:url';
import type { TAB_TYPE } from '../../shared/constants';
import { CALIB_FILENAME, CONFIG_FILENAME, DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_WIDTH, SENSOR_DATA_FILENAME, TAB_NAMES, VEET_DRIVE_DESCRIPTION } from '../../shared/constants';
import { getConfigStore, getIntervalConfig, loadConfigFromJson, loadIntervalConfigFromJson, registerConfigChangeHandler, setConfigStoreValue } from '../../shared/ConfigStore';
import { getSettingsStore, registerSettingsChangeHandler, setSettingsStoreValue } from '../../shared/SettingsStore';
import { SetupCustomMenus } from './Menu';
import { debounce } from 'ts-debounce';
import type { FSWatcher} from 'fs';
import { watch } from 'fs';
import { getCalibStore, loadCalibFromJson, registerCalibChangeHandler } from '../../shared/CalibStore';
import { checkFirmwareUpdate, checkHardwareVersion, updateFirmware } from './VersionManager';


const CONNECTION_RETRY_PERIOD = 3000;
const DRIVE_RETRY_PERIOD = 1000;
const BATTERY_POLL_PERIOD = 30 * 1000;
const CLOCK_POLL_PERIOD = 5 * 1000;
const SENSOR_POLL_WAIT_PERIOD = 10;

const IMU_POLL_COMMAND = 'S0';
const PHO_POLL_COMMAND = 'S1';
const TOF_POLL_COMMAND = 'S2';
const ALS_POLL_COMMAND = 'S3';

// This needs to be a function so that app is initialized by the time it runs.
// In dev mode we can use getAppPath, but in prod it is packaged into an asar file and the path is extra deep
export const ROOT_APPLICATION_PATH = () => import.meta.env.DEV ? app.getAppPath() : path.join(process.resourcesPath, '..');
export const FIRMWARE_PATH = () => path.join(ROOT_APPLICATION_PATH(), 'firmware');
export const DOCUMENTATION_PATH = () => path.join(ROOT_APPLICATION_PATH(), 'documentation');
const VEET_MANUAL_PATH = () => path.join(DOCUMENTATION_PATH(), 'VEET 2.0 Device Manual.pdf');

export class MainWindow {
  private serialManager_: SerialManager;
  private browserWindow_: BrowserWindow|undefined = undefined;
  private isConnected_ = false;
  private currentTab_: TAB_TYPE | null = null;

  // Intervals
  private batteryInterval_: NodeJS.Timeout|null = null;
  private clockInterval_: NodeJS.Timeout|null = null;
  private connectionRetry_: NodeJS.Timeout|null = null;
  private driveRetry_: NodeJS.Timeout|null = null;
  private driveWatch_: FSWatcher|null = null;
  private sensorPollThreadRunning = false;
  private deleteFileOnConnection_: string|null = null;


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

  createWindow = async () => {
    // Create the browser window.
    this.browserWindow_ = new BrowserWindow({
      show: false, // Use the 'ready-to-show' event to show the instantiated BrowserWindow.
      height: DEFAULT_WINDOW_HEIGHT,
      width: DEFAULT_WINDOW_WIDTH,
      minHeight: 600,
      minWidth: 600,
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
        console.error('Got invalid window size: ' + size);
        return;
      }
      setDatastoreValue('windowSize', size as [number, number]);
    });

    /**
     * If the 'show' property of the BrowserWindow's constructor is omitted from the initialization options,
     * it then defaults to 'true'. This can cause flickering as the window loads the html content,
     * and it also has show problematic behaviour with the closing of the window.
     * Use `show: false` and listen to the  `ready-to-show` event to show the window.
     *
     * @see https://github.com/electron/electron/issues/25012 for the afford mentioned issue.
     */
    this.browserWindow_.on('ready-to-show', () => {
      this.browserWindow_?.show();
    });

    SetupCustomMenus(this);

    // and load the index.html of the app.
    console.log('Loading typescript...');
    const loadTimeStart = performance.now();
    /**
     * Load the main page of the main window.
     */
    await this.loadEntryPoint(this.browserWindow_, 'index.html');
    console.log('Done loading typescript in ' + Math.ceil(performance.now() - loadTimeStart) +'ms');

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
  runCommand = async (_: Electron.IpcMainInvokeEvent|null, cmd: string): Promise<string|null> => {
    if (!this.isConnected_) {
        // TODO: Display Error
      return null;
    }
    return await this.serialManager_.runCommand(cmd);
  };

  startPolls = async () => {
    if (this.batteryInterval_ == null) {
      await this.pollBattery();
      this.batteryInterval_ = setInterval(this.pollBattery, BATTERY_POLL_PERIOD);
    }
    if (this.clockInterval_ == null) {
      await this.pollClock();
      this.clockInterval_ = setInterval(this.pollClock, CLOCK_POLL_PERIOD);
    }
    void this.startPollSensorThread(); // note that this doesn't need to be stopped as it sleeps itself. also don't await this one
  };

  stopPolls = () => {
    if (this.batteryInterval_ != null) {
      clearInterval(this.batteryInterval_);
      this.batteryInterval_ = null;
      setDatastoreValue('batteryPct', null);
      setDatastoreValue('batteryMV', null);
    }
    if (this.clockInterval_ != null) {
      clearInterval(this.clockInterval_);
      this.clockInterval_ = null;
    }
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
    setDatastoreValue('drivePath', null);
    // Stop watching drive
    this.stopDriveWatch();
    setDatastoreValue('driveSpaceAvailable', 0);
    setDatastoreValue('driveSpaceTotal', 0);
    console.log('Disconnected from VEET');

    // Start trying again perodically
    if (this.connectionRetry_ == null) {
      this.connectionRetry_ = setInterval(this.attemptConnection, CONNECTION_RETRY_PERIOD);
    }
  };

  attemptConnection = async () => {
    // Make sure we haven't had a delayed connection verification
    if (this.isConnected_) {
      return;
    }
    const connectionStatus = await this.serialManager_.findVeet();
    if (connectionStatus == SerialConnectionStatus.CONNECTED) {
      // We're connected, switch state
      this.isConnected_ = true;

      // On Connection, restart polls
      await this.startDriveSearch();
      await this.analyzeSensorData();
      await this.loadConfig();
      await this.loadCalib();
      await this.startPolls();
      await checkHardwareVersion(this);
      await this.checkDeviceSide();
      console.log('Connected to VEET');
      this.connectionRetry_ && clearInterval(this.connectionRetry_);
      this.connectionRetry_ = null;
    } else if (this.isConnected_) {
      this.disconnected();
    }
  };

  pollBattery = async () => {
    if (!this.isConnected_) {
      // We're disconnected. Shouldn't be called, so just return
      return;
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
        console.error(`Invalid battery response: "${batteryString}"`);
        return;
      }
      // Map to a percentage. This is very rough, and things get wonky at the extremes, but we'll call anything over
      // 4.1V 100%, and anything less than 3.6V 1%, and linearly interpolate
      const frac = Math.max(invLerpClamped(3600, 4100, mv), 0.01);
      setDatastoreValue('batteryPct', frac);
      setDatastoreValue('batteryMV', mv);
      console.log(`${batteryString} -> ${(frac * 100).toFixed(1)}%`);
    }
  };

  checkDriveSpace = async () => {
    const drivePath = getDataStore().drivePath;
    if (drivePath == null) {
      // No drive path, can't check disk space
      return;
    }
    const diskInfo = await check(drivePath);
    console.log(`DiskUsage: ${(diskInfo.available / (1024 * 1024)).toFixed(2)}MB / ${(diskInfo.total / (1024 * 1024)).toFixed(2)}MB`);
    setDatastoreValue('driveSpaceAvailable', diskInfo.available);
    setDatastoreValue('driveSpaceTotal', diskInfo.total);
  };

  findDrive = async () => {
    console.log('Searching for VEET storage device drive');
    try {
      if (getDataStore().drivePath) {
        // Already found drive, must have been an extraneous check
        return;
      }
      const drives = await list();
      let found = false;
      for (const drive of drives) {
        if (drive.description.startsWith(VEET_DRIVE_DESCRIPTION) && drive.mountpoints && drive.mountpoints.length > 0) {
          // Found drive!
          const drivePath = drive.mountpoints[0].path;
          found = true;
          console.log('Found VEET Drive at path ' + drivePath);
          setDatastoreValue('drivePath', drivePath);

          // Check drive space, and setup a file watch
          const DRIVE_CHECK_INTERVAL_MS = 1000;
          const debouncedDriveCheck = debounce(this.checkDriveSpace, DRIVE_CHECK_INTERVAL_MS);
          await debouncedDriveCheck();
          this.stopDriveWatch();
          this.driveWatch_ = watch(drivePath, {}, () => {
            // Something changed on the VEET device, do another driveSpaceCheck
            void debouncedDriveCheck();
          });

          // Found the drive, check if we need to delete the image file
          if (this.deleteFileOnConnection_) {
            console.log('Deleting ' + this.deleteFileOnConnection_);
            await fsPromises.unlink(this.deleteFileOnConnection_);
            this.deleteFileOnConnection_ = null;
          }

          await checkFirmwareUpdate(this);

          // Stop searching
          if (this.driveRetry_ != null) {
            clearInterval(this.driveRetry_);
            this.driveRetry_ = null;
          }
          break;
        }
      }
      if (!found) {
        console.log('Failed to find VEET storage device drive out of ' + drives.length + ' drives');
        setDatastoreValue('drivePath', null);
        setDatastoreValue('driveSpaceAvailable', 0);
        setDatastoreValue('driveSpaceTotal', 0);
      }
    } catch (err) {
      console.error(err);
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

  showMessageBox = async (options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue|undefined> => {
    if (!this.browserWindow_) {
      console.error('Unable to display error message, no browser window found');
      return;
    }
    return await dialog.showMessageBox(this.browserWindow_, options);
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
      console.log('Unable to find drive path, no data analysis');
      return;
    }
    const sensorDataPath = path.join(drivePath, SENSOR_DATA_FILENAME);
    try {
      const stat = await fsPromises.stat(sensorDataPath);
      setDatastoreValue('sensorDataFileSize', stat.size);
    } catch (err) {
      setDatastoreValue('sensorDataFileSize', 0);
      console.error(err);
    }
  };

  writeConfigFile = async () => {
    const drivePath = getDataStore().drivePath;
    if (!drivePath) {
      console.error('Unable to write config file, no drive path found');
      return;
    }
    const configPath = path.join(drivePath, CONFIG_FILENAME);
    const configData = getConfigStore();

    try {
      const configStr = JSON.stringify(configData, null, 2);
      await fsPromises.writeFile(configPath, configStr);
      console.log('Config written to ' + configPath);
      console.log(configStr);
    } catch (err) {
      console.log('Error writing config file: ' + err);
    }
  };

  loadConfig = async () => {
    const drivePath = getDataStore().drivePath;
    if (!drivePath) {
      console.log('Unable to find drive path, no config loaded');
      return;
    }
    try {
      const configPath = path.join(drivePath, CONFIG_FILENAME);
      const configJson = await fsPromises.readFile(configPath, {encoding: 'utf8'});
      const CONFIG_WRITE_DEBOUNCE_MS = 1000;
      loadConfigFromJson(configJson, this.displayFatalError);
      const debouncedWrite = debounce(this.writeConfigFile, CONFIG_WRITE_DEBOUNCE_MS);
      registerConfigChangeHandler( () => {
        void debouncedWrite();
      });
    } catch (err) {
      console.error(err);
    }
  };

  loadCalib = async () => {
    const drivePath = getDataStore().drivePath;
    if (!drivePath) {
      console.log('Unable to find drive path, no calib loaded');
      return;
    }
    try {
      const calibPath = path.join(drivePath, CALIB_FILENAME);
      const calibJson = await fsPromises.readFile(calibPath, {encoding: 'utf8'});
      loadCalibFromJson(calibJson, this.displayFatalError);
    } catch (err) {
      console.error(err);
    }
  };

  syncClock = async () => {
    const curEpoch = Math.round(Date.now() * 0.001); // Date.now() is ms, not secs
    return await this.runCommand(null, `ST${curEpoch}`);
  };

  pollClock = async () => {
    if (!this.isConnected_) {
      // We're disconnected. Shouldn't be called, so just return
      return;
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
        console.log(`VEET is ${-diff} seconds behind, syncing`);
        await this.syncClock();
      } else if (diff > 5) {
        console.log(`VEET is ${diff} seconds ahead, syncing`);
        await this.syncClock();
      } else {
        console.log('VEET is within 5 seconds of your PC');
      }
    }
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
              }
              break;
            }
            case TAB_NAMES.TOF: {
              const tofStr = await this.runCommand(null, TOF_POLL_COMMAND);
              if (tofStr && !tofStr.startsWith('#Err')) {
                setDatastoreValue('tofData', tofStr);
              }
              break;
            }
            case TAB_NAMES.ALS: {
              const alsStr = await this.runCommand(null, ALS_POLL_COMMAND);
              if (alsStr && !alsStr.startsWith('#Err')) {
                setDatastoreValue('alsData', alsStr);
              }
              break;
            }
            case TAB_NAMES.IMU: {
              const imuStr = await this.runCommand(null, IMU_POLL_COMMAND);
              if (imuStr && !imuStr.startsWith('#Err')) {
                setDatastoreValue('imuData', imuStr);
              }
              break;
            }
          }

        } catch (err) {
          console.error(err);
        }
      }

      // sleep until next check
      await new Promise(r => setTimeout(r, SENSOR_POLL_WAIT_PERIOD));
    }

  };


  sendDataStoreUpdate = () => {
    // TODO: If perf becomes an issue, look into turning off freezeImmutableStructures
    this.browserWindow_?.webContents.send(commands.updateDataStore, getDataStore());
  };

  sendConfigStoreUpdate = () => {
    // TODO: If perf becomes an issue, look into turning off freezeImmutableStructures
    this.browserWindow_?.webContents.send(commands.updateConfigStore, getConfigStore());
  };

  sendCalibStoreUpdate = () => {
    // TODO: If perf becomes an issue, look into turning off freezeImmutableStructures
    this.browserWindow_?.webContents.send(commands.updateCalibStore, getCalibStore());
  };

  sendSettingsStoreUpdate = () => {
    // TODO: If perf becomes an issue, look into turning off freezeImmutableStructures
    this.browserWindow_?.webContents.send(commands.updateSettingsStore, getSettingsStore());
  };

  showFolder = (_: Electron.IpcMainInvokeEvent, path: string) => {
    console.log('showing path ' + path);
    shell.showItemInFolder(path);
  };

  setFileToDeleteUponConnection = (filePath: string|null) => {
    this.deleteFileOnConnection_ = filePath;
  };

  public UpdateFirmwareDialog = async () => {
    if (!this.browserWindow_) {
      console.error('BrowserWindow is null when updating firmware');
      return;
    }
    const drivePath = getDataStore().drivePath;
    if (!drivePath) {
      console.error('Unable to find drive path, cannot update firmware');
      return;
    }
    const sourceBinInfo = await dialog.showOpenDialog(this.browserWindow_, {
      title: 'Pick New Firmware File',
      buttonLabel: 'Select New Firmware',
      defaultPath: FIRMWARE_PATH(),
      filters: [{name: 'All Files', extensions: ['bin']}],
    });
    if (sourceBinInfo.canceled) {
      console.log('Firmware Update Canceled');
      return;
    }
    if (sourceBinInfo.filePaths.length !== 1) {
      console.error('Invalid source bin info: ' + sourceBinInfo);
      return;
    }

    // If we got here, we're good to go.
    const sourcePath = sourceBinInfo.filePaths[0];
    await updateFirmware(this, sourcePath);
  };

  public UpdateCalibrationFile = async () => {
    if (!this.browserWindow_) {
      console.error('BrowserWindow is null when updating calibration file');
      return;
    }
    const drivePath = getDataStore().drivePath;
    if (!drivePath) {
      console.error('Unable to find drive path, cannot update calibration file');
      return;
    }
    const sourceCalibInfo = await dialog.showOpenDialog(this.browserWindow_, {
      title: 'Pick New Calibration File',
      buttonLabel: 'Select New Calibration File',
      filters: [{name: 'All Files', extensions: ['json']}],
    });
    if (sourceCalibInfo.canceled) {
      console.log('Calibration File Update Canceled');
      return;
    }
    if (sourceCalibInfo.filePaths.length !== 1) {
      console.error('Invalid source calibration info: ' + sourceCalibInfo);
      return;
    }

    // If we got here, we're good to go. Put up a modal.
    setDatastoreValue('modalMessage', 'Updating Calibration...');
    try {
      const sourcePath = sourceCalibInfo.filePaths[0];
      const destPath = path.join(drivePath, CALIB_FILENAME);
      console.log(`Copying ${sourcePath} to ${destPath}`);
      await fsPromises.copyFile(sourcePath, destPath);

      // Reload the calibration file after updating
      console.log('Reloading calibration file after copy.');
      await this.loadCalib();

      // Resetting VEET to reload calibration file
      console.log('Resetting VEET to reload calibration.');
      await this.runCommand(null, 'RE');

      // Resetting VEET to reload calibration file
      await this.runCommand(null, 'RE');
      console.log('Complete, calibration updated');
    } catch(err) {
      console.error(err);
    } finally {
      setDatastoreValue('modalMessage', null);
    }
  };

  private SaveConfigTemplate = async () => {
    console.log('Saving Config Template');
    if (!this.browserWindow_) {
      console.error('BrowserWindow is null when saving config template');
      return;
    }
    const saveConfigInfo = await dialog.showSaveDialog(this.browserWindow_, {
      title: 'Save Config Template File',
      buttonLabel: 'Save Config Template File',
      filters: [{name: 'All Files', extensions: ['json']}],
    });
    if (saveConfigInfo.canceled) {
      console.log('Calibration File Update Canceled');
      return;
    }
    if (!saveConfigInfo.filePath) {
      console.error('Invalid source calibration info: ' + saveConfigInfo);
      return;
    }
    const intervalConfigJSON = JSON.stringify(getIntervalConfig());
    await fsPromises.writeFile(saveConfigInfo.filePath, intervalConfigJSON);
    setDatastoreValue('configTemplate', intervalConfigJSON);
  };

  private LoadConfigTemplate = async () => {
    if (!this.browserWindow_) {
      console.error('BrowserWindow is null when saving config template');
      return;
    }
    const openConfigInfo = await dialog.showOpenDialog(this.browserWindow_, {
      title: 'Open Config Template File',
      buttonLabel: 'Open Config Template File',
      filters: [{name: 'All Files', extensions: ['json']}],
    });
    if (openConfigInfo.canceled) {
      console.log('Calibration File Update Canceled');
      return;
    }
    if (openConfigInfo.filePaths.length !== 1) {
      console.error('Invalid source calibration info: ' + openConfigInfo);
      return;
    }
    const configTemplateJSON = await fsPromises.readFile(openConfigInfo.filePaths[0], 'utf8');
    if (loadIntervalConfigFromJson(configTemplateJSON)) {
      setDatastoreValue('configTemplate', configTemplateJSON);
    }
  };

  private ReuseLastConfigTemplate = async () => {
    console.log('Reusing Config Template');
    const configTemplate = getDataStore().configTemplate;
    if (!configTemplate || configTemplate.length < 1) {
      console.error('Trying to reuse invalid config template');
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
      console.error(e);
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
      this.currentTab_ = tabName;
    });
    ipcMain.handle(commands.sendConfigStoreValue, (_, key, value) => {
      setConfigStoreValue(key, value);
    });
    ipcMain.handle(commands.updateCalibrationFile, this.UpdateCalibrationFile);
    ipcMain.handle(commands.saveConfigTemplate, this.SaveConfigTemplate);
    ipcMain.handle(commands.loadConfigTemplate, this.LoadConfigTemplate);
    ipcMain.handle(commands.reuseLastConfigTemplate, this.ReuseLastConfigTemplate);

    // If requested, send both store updates
    ipcMain.handle(commands.requestStoresUpdate, () => {
      try {
        this.sendDataStoreUpdate();
        this.sendConfigStoreUpdate();
        this.sendCalibStoreUpdate();
        this.sendSettingsStoreUpdate();
      } catch(err) {
        console.error(err);
      }
    });
    // Also, send an update on any change to the data store and config store
    registerChangeHandler(this.sendDataStoreUpdate);
    registerConfigChangeHandler(this.sendConfigStoreUpdate);
    registerCalibChangeHandler(this.sendCalibStoreUpdate);
    registerSettingsChangeHandler(this.sendSettingsStoreUpdate);
    // TODO: (maybe) use diffs to minimize data sent through IPC, but not clear it's necessary
  };
}
