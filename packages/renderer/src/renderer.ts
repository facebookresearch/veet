/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import './app.css';
import './App';

import type {ContextBridgeApi} from '../../shared/ContextBridgeApi';
import { updateDataStore } from '../../shared/DataStore';
import { updateConfigStore } from '../../shared/ConfigStore';
import { updateSettingsStore } from '../../shared/SettingsStore';
import { updateCalibStore } from '../../shared/CalibStore';

declare global {
  interface Window {
    bridgeApi: ContextBridgeApi;
  }
}

// Handle updates to the data stores from the main process
window.bridgeApi.updateDataStore((_, newData) => {
  updateDataStore(newData);
});

window.bridgeApi.updateConfigStore((_, newData) => {
  updateConfigStore(newData);
});

window.bridgeApi.updateCalibStore((_, newData) => {
  updateCalibStore(newData);
});

window.bridgeApi.updateSettingsStore((_, newData) => {
  updateSettingsStore(newData);
});

// Request initial data store sync
window.bridgeApi.requestStoresUpdate();
