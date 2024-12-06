/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react';
import { deepFreeze, replaceImmutable } from 'simply-immutable';
import { DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_WIDTH } from './constants';
import { isRenderer } from './utils';
import { logger } from './Logger';


export interface VEETDataStore {
  hardwareVersion: string|null,
  firmwareVersion: string|null,
  connectionPort: string|null;
  serialLog: string[];
  batteryPct: number|null; // from 0-1, null means dunno
  batteryMV: number|null;
  deviceSide: string|null;
  serialNumber: string|null;
  timeOnVeet: number|null,
  commandInFlight: boolean;
  drivePath: string|null;
  sensorDataFilePath: string|null;
  driveSpaceAvailable: number;
  driveSpaceTotal: number;
  sensorDataFileSize: number;
  tofData: string|null,
  phoData: string|null,
  imuData: string|null,
  alsData: string|null,
  recordingStream: boolean;
  modalMessage: string|null;
  windowSize: [number, number];
  configTemplate: string|null
}

type ChangeHandler = (data: Readonly<VEETDataStore>) => void;

const initialData: VEETDataStore = deepFreeze({
  hardwareVersion: null,
  firmwareVersion: null,
  connectionPort: null,
  serialLog: [],
  batteryPct: null,
  batteryMV: null,
  deviceSide: null,
  serialNumber: null,
  timeOnVeet: null,
  commandInFlight: false,
  drivePath: null,
  sensorDataFilePath: null,
  driveSpaceAvailable: 0,
  driveSpaceTotal: 0,
  sensorDataFileSize: 0,
  tofData: null,
  phoData: null,
  imuData: null,
  alsData: null,
  recordingStream: false,
  modalMessage: null,
  windowSize: [DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT],
  configTemplate: null,
});

let gStoreData: VEETDataStore = initialData;

export function resetDataStore() {
  updateData(initialData);
}

const gChangeHandlers: ChangeHandler[] = [];
const gKeyedChangeHandlers: Partial<Record<keyof(VEETDataStore), ChangeHandler[]>> = {};

function triggerChangeHandlers(oldData: VEETDataStore) {
  const changeHandlers = gChangeHandlers.slice();

  for (const handler of changeHandlers) {
    handler(gStoreData);
  }

  for (const key in gKeyedChangeHandlers) {
    const typedKey = key as keyof VEETDataStore; // for..in requires type assertion here
    const changeHandlers = gKeyedChangeHandlers[typedKey];
    if (gStoreData[typedKey] !== oldData[typedKey] && changeHandlers) {
      // for each key that changed, trigger all change handlers
      for (const handler of changeHandlers) {
        handler(gStoreData);
      }
    }
  }
}

export function registerChangeHandler(handler: ChangeHandler) {
  gChangeHandlers.push(handler);
}

export function unregisterChangeHandler(handler: ChangeHandler) {
  const idx = gChangeHandlers.indexOf(handler);
  if (idx >= 0) {
    gChangeHandlers.splice(idx, 1);
  }
}

export function registerKeyedChangeHandler(handler: ChangeHandler, key: keyof(VEETDataStore)) {
  gKeyedChangeHandlers[key] = gKeyedChangeHandlers[key] || [];
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  gKeyedChangeHandlers[key]!.push(handler); // unclear why typescript wants this assertion given the above line
}

export function unregisterKeyedChangeHandler(handler: ChangeHandler, key: keyof(VEETDataStore)) {
  const changeHandlers = gKeyedChangeHandlers[key];
  if (!changeHandlers || changeHandlers.length == 0) {
    return;
  }
  changeHandlers.splice(changeHandlers.indexOf(handler), 1);
  if (changeHandlers.length == 0) {
    delete gKeyedChangeHandlers[key];
  }
}

function updateData(newData: VEETDataStore) {
  if (newData === gStoreData) {
    return false;
  }

  const oldData = gStoreData;
  gStoreData = newData;

  triggerChangeHandlers(oldData);

  return true;
}

// While simply-immutable supports deep pathnames, type safety gets complicated and we don't need deep paths
// So, limiting to a single key, but that key is properly enforced
export function useStoreData<KeyString extends keyof(VEETDataStore)>(key: KeyString): VEETDataStore[KeyString] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, setState] = useState(gStoreData[key] as any);

  useEffect(() => {
    function handleChange() {
      setState(gStoreData[key]);
    }

    // need to call handleChange immediately to catch a race condition between useState, registerChangeHandler, and data changing
    handleChange();
    registerChangeHandler(handleChange);
    return () => {
      unregisterChangeHandler(handleChange);
    };
  }, [key]);

  return state;
}

export function setDatastoreValue<KeyString extends keyof(VEETDataStore)>(key: KeyString, value: VEETDataStore[KeyString]) {
  if (isRenderer()) {
    logger.error('Can not setDatastoreValue in renderer ');
    return;
  }
  updateData(replaceImmutable(gStoreData, [key], value));
}


export function updateDataStore(newData: VEETDataStore) {
  updateData(replaceImmutable(gStoreData, newData));
}

export function getDataStore() {
  return gStoreData;
}
