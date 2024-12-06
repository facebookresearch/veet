/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {IpcRendererEvent} from 'electron';
import type { CalibStore } from './CalibStore';
import type { ConfigStore } from './ConfigStore';
import type { TAB_TYPE } from './constants';
import type { VEETDataStore } from './DataStore';
import type { SettingsStore } from './SettingsStore';

export type ContextBridgeApi = {
  // Renderer -> Main
  runCommand: (cmd: string) => Promise<string>;
  requestStoresUpdate: () => void;
  showFolder: (path: string) => void;
  setCurrentTab: (tabName: TAB_TYPE) => void; // todo, generalize setting settings from the renderer
  sendConfigStoreValue: <KeyString extends keyof (ConfigStore)>(key: KeyString, value: ConfigStore[KeyString]) => void; // todo: remove this in favor of a two-way datastore
  updateCalibrationFile: () => void;
  saveConfigTemplate: () => void;
  loadConfigTemplate: () => void;
  reuseLastConfigTemplate: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recordLogMessage: (level: string, message: string, ...meta: any[]) => void;
  writeClipboard: (data: string) => void;
  toggleRecording: () => void;

  // Main -> Renderer
  updateDataStore: (cb: (event: IpcRendererEvent, dataStore: VEETDataStore) => void) => () => void; // return unsubscribe callback
  updateConfigStore: (cb: (event: IpcRendererEvent, configStore: ConfigStore) => void) => () => void; // return unsubscribe callback
  updateCalibStore: (cb: (event: IpcRendererEvent, calibStore: CalibStore) => void) => () => void; // return unsubscribe callback
  updateSettingsStore: (cb: (event: IpcRendererEvent, configStore: SettingsStore) => void) => () => void; // return unsubscribe callback
};
