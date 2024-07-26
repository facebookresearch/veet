/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react';
import { cloneImmutable, replaceImmutable } from 'simply-immutable';
import { z } from 'zod';
import type { ErrorMessageHandler} from './constants';
import { TAB_NAMES } from './constants';
import { isRenderer, parseJSON } from './utils';

const SettingsStoreZ = z.object({
  currentTab: z.string().default(TAB_NAMES.CONFIG),
  showSerialLog: z.boolean().default(false),
  developerMode: z.boolean().default(false),
  showCalibration: z.boolean().default(false),
});

export type SettingsStore = z.infer<typeof SettingsStoreZ>;


type ChangeHandler = (data: Readonly<SettingsStore>) => void;

// parsing an empty object uses the defaults defined above
let gSettingsData: SettingsStore = cloneImmutable(SettingsStoreZ.parse({}));

const gChangeHandlers: ChangeHandler[] = [];

function triggerChangeHandlers() {
  const changeHandlers = gChangeHandlers.slice();
  const data = gSettingsData;

  for (const handler of changeHandlers) {
    handler(data);
  }
}

export function registerSettingsChangeHandler(handler: ChangeHandler) {
  gChangeHandlers.push(handler);
}

function unregisterChangeHandler(handler: ChangeHandler) {
  const idx = gChangeHandlers.indexOf(handler);
  if (idx >= 0) {
    gChangeHandlers.splice(idx, 1);
  }
}

function updateData(newData: SettingsStore) {
  if (newData === gSettingsData) {
    return false;
  }

  gSettingsData = newData;

  triggerChangeHandlers();

  return true;
}

export function loadSettingsFromJson(settingJson: string, errorHandler?: ErrorMessageHandler) {
  const settingsObj = parseJSON(settingJson, errorHandler);
  if (!settingsObj) {
    return;
  }
  const parsed = SettingsStoreZ.safeParse(settingsObj);
  if (!parsed.success) {
    console.error('Failed to parse settings', {json: settingJson, parseError: parsed.error});
    return;
  }
  console.log('Success fully loaded settings data');
  updateSettingsStore(parsed.data);
  console.log(gSettingsData);
}

// While simply-immutable supports deep pathnames, type safety gets complicated and we don't need deep paths
// So, limiting to a single key, but that key is properly enforced
export function useSettingsStoreData<KeyString extends keyof(SettingsStore)>(key: KeyString): SettingsStore[KeyString] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, setState] = useState(gSettingsData[key] as any);

  useEffect(() => {
    function handleChange() {
      const newState = replaceImmutable(state, gSettingsData[key]);
      if (newState !== state) {
        setState(newState);
      }
    }

    // need to call handleChange immediately to catch a race condition between useState, registerChangeHandler, and data changing
    handleChange();
    registerSettingsChangeHandler(handleChange);
    return () => {
      unregisterChangeHandler(handleChange);
    };
  });

  return state;
}

export function setSettingsStoreValue<KeyString extends keyof(SettingsStore)>(key: KeyString, value: SettingsStore[KeyString]) {
  if (isRenderer()) {
    console.error('Can not setSettingsStoreValue in renderer ');
    return;
  }
  const newStore = replaceImmutable(gSettingsData, [key], value);
  const result = SettingsStoreZ.safeParse(newStore);
  if (!result.success) {
    console.error('Invalid data: ' + result.error);
    return;
  }
  updateData(newStore);
}


export function updateSettingsStore(newData: SettingsStore) {
  updateData(replaceImmutable(gSettingsData, newData));
}

export function getSettingsStore() {
  return gSettingsData;
}
