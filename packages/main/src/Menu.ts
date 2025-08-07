/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MenuItemConstructorOptions } from 'electron';
import { app, Menu, shell } from 'electron';
import { TAB_NAMES } from '../../shared/constants';
import { getSettingsStore, setSettingsStoreValue } from '../../shared/SettingsStore';
import type { MainWindow } from './MainWindow';
import { logger } from '../../shared/Logger';
import { getDataStore } from '../../shared/DataStore';



export const SetupCustomMenus = (mainWindow: MainWindow) => {
  const isConnected = Boolean(getDataStore().connectionPort);
  const driveConnected = Boolean(getDataStore().drivePath);
  const isFullyConnected = isConnected && driveConnected;
  const template: (MenuItemConstructorOptions | Electron.MenuItem)[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Update Firmware',
          click: mainWindow.UpdateFirmwareDialog,
          enabled: isFullyConnected,
        },
        {
          label: 'Reboot Device',
          click: () => {
            void mainWindow.runCommand(null, 'RE');
          },
          enabled: isConnected,
        },
        {
          label: 'Transport Mode',
          click: async () => {
            const response = await mainWindow.showMessageBox({
              message: 'Transport Mode will stop the VEET from gathering data until the next time it is plugged in. The VEET will immediately be disconnected. Do you want to continue?',
              title: 'Enable Transport Mode?',
              buttons: ['Enable Transport Mode', 'Cancel'],
            });
            if (response) {
              switch (response.response) {
                case 0: // Proceed
                  logger.info('User chose to enable Transport Mode');
                  await mainWindow.runCommand(null, 'TM');
                  return;
                default:
                case 1: // Cancel
                  logger.info('User chose not to enable Transport Mode');
                  return;
              }
            }
          },
          enabled: isConnected,
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open VEET Manual',
          click: () => {
            mainWindow.showManual();
          },
        },
        {
          label: 'Open Source Attribution',
          click: () => {
            void mainWindow.showLicenses();
          },
        },
        {
          label: 'Changelog',
          click: () => {
            void mainWindow.showChangelog();
          },
        },
        { type: 'separator' },
        {
          label: 'Show Logs Location',
          click: () => {
            void shell.openPath(app.getPath('logs'));
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
          label: 'Contact Support - VEETSupport@meta.com',
          click: () => {
            void shell.openExternal('mailto:VEETSupport@meta.com');
          },
        },
        { type: 'separator' },
        { label: 'VEET Manager version: ' + app.getVersion() },
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
        ],
      });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};
