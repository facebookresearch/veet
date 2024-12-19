/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react';
import { cloneImmutable, replaceImmutable } from 'simply-immutable';
import { z } from 'zod';
import { isRenderer, parseJSON } from './utils';
import type { ErrorMessageHandler } from './constants';
import { logger } from './Logger';

// Use default and catch to allow for invalid data on some keys and just fix those entries
const CalibStoreZ = z.object({
  deviceID: z.string().default(''),
  // TODO, add entries for rest of calibration file
});

export type CalibStore = z.infer<typeof CalibStoreZ>;


type ChangeHandler = (data: Readonly<CalibStore>) => void;

// parsing an empty object uses the defaults defined above
let gCalibData: CalibStore = cloneImmutable(CalibStoreZ.parse({}));

const gChangeHandlers: ChangeHandler[] = [];

function triggerChangeHandlers() {
  const changeHandlers = gChangeHandlers.slice();
  const data = gCalibData;

  for (const handler of changeHandlers) {
    handler(data);
  }
}

export function registerCalibChangeHandler(handler: ChangeHandler) {
  gChangeHandlers.push(handler);
}

function unregisterChangeHandler(handler: ChangeHandler) {
  const idx = gChangeHandlers.indexOf(handler);
  if (idx >= 0) {
    gChangeHandlers.splice(idx, 1);
  }
}

function updateData(newData: CalibStore) {
  if (newData === gCalibData) {
    return false;
  }

  gCalibData = newData;

  triggerChangeHandlers();

  return true;
}

export function loadCalibFromJson(calibJson: string, errorHandler?: ErrorMessageHandler): boolean {
  const calibObj = parseJSON(calibJson, errorHandler);
  if (!calibObj) {
    return false;
  }
  const parsed = CalibStoreZ.safeParse(calibObj);
  if (!parsed.success) {
    logger.error('Failed to parse calib', {json: calibJson, parseError: parsed.error});
    return false;
  }
  logger.info('Successfully loaded calib data');
  updateCalibStore(parsed.data);
  logger.info(gCalibData);
  return true;
}

// While simply-immutable supports deep pathnames, type safety gets complicated and we don't need deep paths
// So, limiting to a single key, but that key is properly enforced
export function useCalibStoreData<KeyString extends keyof(CalibStore)>(key: KeyString): CalibStore[KeyString] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, setState] = useState(gCalibData[key] as any);

  useEffect(() => {
    function handleChange() {
      const newState = replaceImmutable(state, gCalibData[key]);
      if (newState !== state) {
        setState(newState);
      }
    }

    // need to call handleChange immediately to catch a race condition between useState, registerChangeHandler, and data changing
    handleChange();
    registerCalibChangeHandler(handleChange);
    return () => {
      unregisterChangeHandler(handleChange);
    };
  });

  return state;
}

export function setCalibStoreValue<KeyString extends keyof(CalibStore)>(key: KeyString, value: CalibStore[KeyString]) {
  if (isRenderer()) {
    logger.error('Can not setCalibStoreValue in renderer, use window.bridgeApi.sendCalibStoreValue()');
    return;
  }
  const newStore = replaceImmutable(gCalibData, [key], value);
  const result = CalibStoreZ.safeParse(newStore);
  if (!result.success) {
    logger.error('Invalid data: ' + result.error);
    return;
  }
  updateData(newStore);
}


export function updateCalibStore(newData: CalibStore) {
  updateData(replaceImmutable(gCalibData, newData));
}

export function getCalibStore() {
  return gCalibData;
}
