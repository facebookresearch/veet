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

const MIN_INTERVAL = 0;
const DEFAULT_INTERVAL = 2000;
const intervalShape = z.number().gte(MIN_INTERVAL).int().default(DEFAULT_INTERVAL).catch(DEFAULT_INTERVAL);
const stringDefault = 'NOT SET';
const timeZoneDefault: [string, number] = ['America/Los_Angeles', -8];

const IntervalConfigZ = z.object({
  imuInterval: intervalShape,
  phoInterval: intervalShape,
  tofInterval: intervalShape,
  alsInterval: intervalShape,
});

export type IntervalConfig = z.infer<typeof IntervalConfigZ>;
const intervalKeys = Object.keys(IntervalConfigZ.shape) as Array<keyof (IntervalConfig)>;

// Use default and catch to allow for invalid data on some keys and just fix those entries
const ConfigStoreZ = z.object({
  researcherID: z.string().default(stringDefault).catch(stringDefault),
  participantID: z.string().default(stringDefault).catch(stringDefault),
  timeZoneOffset: z.number().default(timeZoneDefault[1]).catch(timeZoneDefault[1]),
  timeZoneName: z.string().default(timeZoneDefault[0]).catch(timeZoneDefault[0]),
  //deviceSide: z.string().default('L').catch('L'),
}).merge(IntervalConfigZ);

export type ConfigStore = z.infer<typeof ConfigStoreZ>;


type ChangeHandler = (data: Readonly<ConfigStore>) => void;

// parsing an empty object uses the defaults defined above
let gConfigData: ConfigStore = cloneImmutable(ConfigStoreZ.parse({}));

const gChangeHandlers: ChangeHandler[] = [];

function triggerChangeHandlers() {
  const changeHandlers = gChangeHandlers.slice();
  const data = gConfigData;

  for (const handler of changeHandlers) {
    handler(data);
  }
}

export function registerConfigChangeHandler(handler: ChangeHandler) {
  gChangeHandlers.push(handler);
}

function unregisterChangeHandler(handler: ChangeHandler) {
  const idx = gChangeHandlers.indexOf(handler);
  if (idx >= 0) {
    gChangeHandlers.splice(idx, 1);
  }
}

function updateData(newData: ConfigStore) {
  if (newData === gConfigData) {
    return false;
  }

  gConfigData = newData;

  triggerChangeHandlers();

  return true;
}

export function loadConfigFromJson(configJson: string, errorHandler?: ErrorMessageHandler) {
  const configObj = parseJSON(configJson, errorHandler);
  if (!configObj) {
    return;
  }
  const parsed = ConfigStoreZ.safeParse(configObj);
  if (!parsed.success) {
    errorHandler?.(`Failed to parse config.json.\n${parsed.error}`, 'Config Error');
    logger.error('Failed to parse config', {json: configJson, parseError: parsed.error});
    return;
  }
  logger.info('Successfully loaded config data');
  updateConfigStore(parsed.data);
  logger.info(gConfigData);
}

export function getIntervalConfig(): IntervalConfig {
  const outputIntervalConfig: IntervalConfig = IntervalConfigZ.parse({});
  for (const key of intervalKeys) {
    outputIntervalConfig[key] = gConfigData[key];
  }
  return outputIntervalConfig;
}

export function loadIntervalConfigFromJson(intervalConfigJson: string): boolean {
  const intervalConfigObj = parseJSON(intervalConfigJson);
  if (!intervalConfigObj) {
    return false;
  }
  const parsed = IntervalConfigZ.safeParse(intervalConfigObj);
  if (!parsed.success) {
    logger.error('Failed to parse interval config', {json: intervalConfigJson, parseError: parsed.error});
    return false;
  }
  for (const key of intervalKeys) {
    setConfigStoreValue(key, parsed.data[key]);
  }
  return true;
}

// While simply-immutable supports deep pathnames, type safety gets complicated and we don't need deep paths
// So, limiting to a single key, but that key is properly enforced
export function useConfigStoreData<KeyString extends keyof(ConfigStore)>(key: KeyString): ConfigStore[KeyString] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, setState] = useState(gConfigData[key] as any);

  useEffect(() => {
    function handleChange() {
      const newState = replaceImmutable(state, gConfigData[key]);
      if (newState !== state) {
        setState(newState);
      }
    }

    // need to call handleChange immediately to catch a race condition between useState, registerChangeHandler, and data changing
    handleChange();
    registerConfigChangeHandler(handleChange);
    return () => {
      unregisterChangeHandler(handleChange);
    };
  });

  return state;
}

export function setConfigStoreValue<KeyString extends keyof(ConfigStore)>(key: KeyString, value: ConfigStore[KeyString]) {
  if (isRenderer()) {
    logger.error('Can not setConfigStoreValue in renderer, use window.bridgeApi.sendConfigStoreValue()');
    return;
  }
  const newStore = replaceImmutable(gConfigData, [key], value);
  const result = ConfigStoreZ.safeParse(newStore);
  if (!result.success) {
    logger.error('Invalid data: ' + result.error);
    return;
  }
  updateData(newStore);
}


export function updateConfigStore(newData: ConfigStore) {
  updateData(replaceImmutable(gConfigData, newData));
}

export function getConfigStore() {
  return gConfigData;
}
