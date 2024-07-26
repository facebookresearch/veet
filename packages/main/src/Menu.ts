/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MenuItemConstructorOptions } from 'electron';
import { app, Menu } from 'electron';
import { TAB_NAMES } from '../../shared/constants';
import { getSettingsStore, setSettingsStoreValue } from '../../shared/SettingsStore';
import type { MainWindow } from './MainWindow';



export const SetupCustomMenus = (mainWindow: MainWindow) => {
  const template: (MenuItemConstructorOptions | Electron.MenuItem)[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Update Firmware',
          click: mainWindow.UpdateFirmwareDialog,
        },
        {
          label: 'Reboot Device',
          click: () => {
            void mainWindow.runCommand(null, 'RE');
          },
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Mode',
          click: () => {
            const developerMode = !getSettingsStore().developerMode;
            setSettingsStoreValue('developerMode', developerMode);
            SetupCustomMenus(mainWindow);
          },
        },
        { type: 'separator' },
        {
          label: 'Open VEET Manual',
          click: () => {
            mainWindow.showManual();
          },
        },
        { type: 'separator' },
        {
          label: 'Open Source Attribution',
          click: () => {
            void mainWindow.showLicenses();
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
  ];

  if (getSettingsStore().developerMode) {
    template.push(
      {
        label: 'Developer Tools',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          {
            label: 'Toggle Serial Log',
            click: () => {
              const newShowSerialLogSetting = !getSettingsStore().showSerialLog;
              setSettingsStoreValue('showSerialLog', newShowSerialLogSetting);
              if (newShowSerialLogSetting) {
                setSettingsStoreValue('currentTab', TAB_NAMES.SERIAL_LOG);
              }
            },
          },
          {
            label: 'Toggle Calibrate Tag',
            click: () => {
              const newShowCalibrationSetting = !getSettingsStore().showCalibration;
              setSettingsStoreValue('showCalibration', newShowCalibrationSetting);
              if (newShowCalibrationSetting) {
                setSettingsStoreValue('currentTab', TAB_NAMES.CALIBRATE);
              }
            },
          },
          { type: 'separator' },
          { label: 'VEET Manager version: ' + app.getVersion() },
        ],
      });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};
