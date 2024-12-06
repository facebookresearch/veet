/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {MockedClass, MockedObject} from 'vitest';
import {beforeEach, expect, test, vi} from 'vitest';

import { MainWindow } from '../src/MainWindow.ts';

import {BrowserWindow} from 'electron';
import { SerialConnectionStatus, type SerialManager } from '../src/SerialManager.ts';

/*
  Mock the logger class to not log anything during tests
*/
vi.mock('../src/MainLogger.ts', () => {
  return {
    RegisterMainLogger: () => {console.log('Not registering logger for tests');},
  };
});


// Mocking this just to make sure the test doesn't try to use the serialport
vi.mock('serialport');

vi.mock('../src/SerialManager.ts', async () => {
  const sm = vi.fn() as unknown as MockedClass<typeof SerialManager>;
  sm.prototype.on = vi.fn<any>();
  sm.prototype.findVeet = vi.fn(() => Promise.resolve(SerialConnectionStatus.NONE_FOUND));
  sm.prototype.runCommand = vi.fn((_: string) => Promise.resolve(''));
  return {
    SerialManager: sm,
    SerialConnectionStatus: await import('../src/SerialManager.ts').then((m) => m.SerialConnectionStatus),
  };
});

/**
 * Mock real electron BrowserWindow API
 */
vi.mock('electron', () => {
  // Use "as unknown as" because vi.fn() does not have static methods
  const bw = vi.fn() as unknown as MockedClass<typeof BrowserWindow>;
  bw.getAllWindows = vi.fn(() => bw.mock.instances);
  bw.prototype.loadURL = vi.fn((_: string, __?: Electron.LoadURLOptions) => Promise.resolve());
  bw.prototype.loadFile = vi.fn((_: string, __?: Electron.LoadFileOptions) => Promise.resolve());
  bw.prototype.on = vi.fn<any>();
  bw.prototype.destroy = vi.fn();
  bw.prototype.isDestroyed = vi.fn();
  bw.prototype.isMinimized = vi.fn();
  bw.prototype.focus = vi.fn();
  bw.prototype.restore = vi.fn();

  const app: Pick<Electron.App, 'getPath'|'getAppPath'|'getVersion'> = {
    getPath(_: string): string {
      return '';
    },
    getAppPath(): string {
      return '';
    },
    getVersion(): string {
      return '';
    },
  };

  const screen: Pick<Electron.Screen, 'getPrimaryDisplay'> = {
    getPrimaryDisplay(): Electron.Display {
      return {
        scaleFactor: 1.5,
        workArea: {
          width: 1920,
          height: 1080,
        },
      } as Electron.Display; // only mocking the properties we need
    },
  };

  // These are static methods so have to take a different mocking approach
  const Menu = vi.fn() as unknown as MockedClass<typeof Electron.Menu>;
  Menu.buildFromTemplate= vi.fn((_: Electron.MenuItemConstructorOptions[]): Electron.Menu => { return {} as Electron.Menu; });
  Menu.setApplicationMenu= vi.fn((_: Electron.Menu): void => { });

  return {BrowserWindow: bw, app, screen, Menu};
});


beforeEach(() => {
  vi.clearAllMocks();
});


test('Should create a new window', async () => {
  const {mock} = vi.mocked(BrowserWindow);
  expect(mock.instances).toHaveLength(0);

  const mainWindow = new MainWindow();
  await mainWindow.restoreOrCreateWindow();
  expect(mock.instances).toHaveLength(1);
  const instance = mock.instances[0] as MockedObject<BrowserWindow>;
  const loadURLCalls = instance.loadURL.mock.calls.length;
  const loadFileCalls = instance.loadFile.mock.calls.length;
  expect(loadURLCalls + loadFileCalls).toBe(1);
  if (loadURLCalls === 1) {
    expect(instance.loadURL).toHaveBeenCalledWith(expect.stringMatching(/index\.html$/));
  } else {
    expect(instance.loadFile).toHaveBeenCalledWith(expect.stringMatching(/index\.html$/));
  }
});

test('Should restore an existing window', async () => {
  const {mock} = vi.mocked(BrowserWindow);
  const mainWindow = new MainWindow();

  // Create a window and minimize it.
  await mainWindow.restoreOrCreateWindow();
  expect(mock.instances).toHaveLength(1);
  const appWindow = vi.mocked(mock.instances[0]);
  appWindow.isMinimized.mockReturnValueOnce(true);

  await mainWindow.restoreOrCreateWindow();
  expect(mock.instances).toHaveLength(1);
  expect(appWindow.restore).toHaveBeenCalledOnce();
});

test('Should create a new window if the previous one was destroyed', async () => {
  const {mock} = vi.mocked(BrowserWindow);
  const mainWindow = new MainWindow();

  // Create a window and destroy it.
  await mainWindow.restoreOrCreateWindow();
  expect(mock.instances).toHaveLength(1);
  const appWindow = vi.mocked(mock.instances[0]);
  appWindow.isDestroyed.mockReturnValueOnce(true);

  await mainWindow.restoreOrCreateWindow();
  expect(mock.instances).toHaveLength(2);
});

import { parseVersion, validVersion } from '../src/VersionManager';
test('Version Comparison', () => {
  const oldVersion = parseVersion('1.0.0');
  const newVersion = parseVersion('1.0.1');
  const newVersionExtra = parseVersion('1.0.1RC'); // actually older than newVersion since it has RC
  const newVersionExtra2 = parseVersion('1.0.1-BETA'); // should be the same as newVersionExtra because we don't compare non-numerical parts

  expect(validVersion('RC1.0.3')).toBe(false);
  expect(validVersion('1.R7C.3')).toBe(false);

  expect(oldVersion).not.toBeNull();
  expect(newVersion).not.toBeNull();
  expect(newVersionExtra).not.toBeNull();
  expect(newVersionExtra2).not.toBeNull();

  if (!oldVersion || !newVersion || !newVersionExtra || !newVersionExtra2) {
    // would be caught by the not.toBeNull() checks, but this prevents requiring ? operators everywhere
    throw new Error('Failed to parse version strings');
  }


  expect(oldVersion.toString()).toBe('1.0.0');
  expect(newVersion.toString()).toBe('1.0.1');
  expect(newVersionExtra.toString()).toBe('1.0.1RC');
  expect(newVersionExtra2.toString()).toBe('1.0.1-BETA');


  expect(oldVersion).not.toBeNull();
  expect(oldVersion.major).toBe(1);
  expect(oldVersion.minor).toBe(0);
  expect(oldVersion.patch).toBe(0);
  expect(newVersion.patch).toBe(1);
  expect(oldVersion.extra).toBeNull();
  expect(newVersion.extra).toBeNull();

  expect(newVersionExtra.patch).toBe(1);
  expect(newVersionExtra.extra).toBe('RC');

  expect(newVersion.isEqualTo(oldVersion)).toBe(false);
  expect(newVersion.isNewerThan(oldVersion)).toBe(true);
  expect(newVersionExtra.isEqualTo(newVersion)).toBe(false);
  expect(newVersionExtra.isOlderThan(newVersion)).toBe(true);

  expect(newVersionExtra2.isOlderThan(newVersion)).toBe(true);
  expect(newVersionExtra2.isEqualTo(newVersionExtra)).toBe(true);
  expect(newVersionExtra2.isOlderThan(newVersionExtra)).toBe(false);
  expect(newVersionExtra2.isNewerThan(newVersionExtra)).toBe(false);
});
