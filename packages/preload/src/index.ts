/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @module preload
 */

import type {ContextBridgeApi} from '../../shared/ContextBridgeApi';
import { contextBridge, ipcRenderer} from 'electron';
import {commands} from '../../shared/commands';
import type { TAB_TYPE } from '../../shared/constants';
import type { ConfigStore } from '../../shared/ConfigStore';


const exposedApi: ContextBridgeApi = {
  // Renderer -> Main
  runCommand: (cmd: string) => ipcRenderer.invoke(commands.runCommand, cmd),
  requestStoresUpdate: () => ipcRenderer.invoke(commands.requestStoresUpdate),
  showFolder: (path: string) => ipcRenderer.invoke(commands.showFolder, path),
  setCurrentTab: (tabName: TAB_TYPE) => ipcRenderer.invoke(commands.setCurrentTab, tabName),
  sendConfigStoreValue: <KeyString extends keyof (ConfigStore)>(key: KeyString, value: ConfigStore[KeyString]) => ipcRenderer.invoke(commands.sendConfigStoreValue, key, value),
  updateCalibrationFile: () => ipcRenderer.invoke(commands.updateCalibrationFile),
  saveConfigTemplate: () => ipcRenderer.invoke(commands.saveConfigTemplate),
  loadConfigTemplate: () => ipcRenderer.invoke(commands.loadConfigTemplate),
  reuseLastConfigTemplate: () => ipcRenderer.invoke(commands.reuseLastConfigTemplate),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recordLogMessage: (level: string, message: string, ...meta: any[]) => ipcRenderer.invoke(commands.recordLogMessage, level, message, ...meta),
  writeClipboard: (data: string) => ipcRenderer.invoke(commands.writeClipboard, data),
  toggleRecording: () => ipcRenderer.invoke(commands.toggleRecording),

  // Main -> Renderer
  updateDataStore: cb => {
    const emitter = ipcRenderer.on(commands.updateDataStore, cb);
    return () => {
      emitter.removeListener(commands.updateDataStore, cb);
    };
  },
  updateConfigStore: cb => {
    const emitter = ipcRenderer.on(commands.updateConfigStore, cb);
    return () => {
      emitter.removeListener(commands.updateConfigStore, cb);
    };
  },
  updateCalibStore: cb => {
    const emitter = ipcRenderer.on(commands.updateCalibStore, cb);
    return () => {
      emitter.removeListener(commands.updateCalibStore, cb);
    };
  },
  updateSettingsStore: cb => {
    const emitter = ipcRenderer.on(commands.updateSettingsStore, cb);
    return () => {
      emitter.removeListener(commands.updateSettingsStore, cb);
    };
  },
};

contextBridge.exposeInMainWorld('bridgeApi', exposedApi);
