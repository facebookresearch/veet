/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// A place to list command names
// Could later add more type safety here if it would help
export const commands = {
  // Renderer -> Main
  runCommand: 'runCommand',
  requestStoresUpdate: 'requestStoresUpdate',
  showFolder: 'showFolder',
  setCurrentTab: 'setCurrentTab',
  sendConfigStoreValue: 'sendConfigStoreValue',
  saveConfigTemplate: 'saveConfigTemplate',
  loadConfigTemplate: 'loadConfigTemplate',
  reuseLastConfigTemplate: 'reuseLastConfigTemplate',
  recordLogMessage: 'recordLogMessage',
  writeClipboard: 'writeClipboard',
  toggleRecording: 'toggleRecording',

  // Main -> Renderer
  updateDataStore: 'updateDataStore',
  updateConfigStore: 'updateConfigStore',
  updateCalibStore: 'updateCalibStore',
  updateSettingsStore: 'updateSettingsStore',
};
